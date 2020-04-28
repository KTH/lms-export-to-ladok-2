const ladokApi = require('./api')
const log = require('skog')
const memoizee = require('memoizee')
const { ClientError } = require('../errors')

/** Get the "AttesteradeResultat" of a "Ladok Resultat" related to a module */
function hasAttesteradeResultat (result, moduleId) {
  return result.ResultatPaUtbildningar.find(
    rpu =>
      rpu.SenastAttesteradeResultat &&
      rpu.SenastAttesteradeResultat.UtbildningsinstansUID === moduleId
  )
}

/** Get the "ArbetsUnderlag" of a "Ladok Resultat" related to a module */
function getArbetsUnderlag (result, moduleId) {
  const r = result.ResultatPaUtbildningar.find(
    rpu =>
      rpu.Arbetsunderlag &&
      rpu.Arbetsunderlag.UtbildningsinstansUID === moduleId
  )

  return r && r.Arbetsunderlag
}

/** Get all "Betygskalor" in Ladok without caching */
async function listScalesRaw () {
  log.info('Getting Betygskalor from Ladok')
  return ladokApi
    .get('/resultat/grunddata/betygsskala')
    .then(r => r.body.Betygsskala)
}

/** Get all "Betygskalor" in Ladok */
const listScales = memoizee(listScalesRaw, { maxAge: 3600 * 1000 })

/** Get the "Betyg ID" of a "letter" */
async function getGradeId (scaleId, letterGrade) {
  const allScales = await listScales()

  const scale = allScales.find(s => parseInt(s.ID, 10) === scaleId)

  if (!scale) {
    // if this happens, it's probably because of a bug. So let's not throw a ClientError
    throw new Error(`Grading scale "${scaleId}" not found in Ladok`)
  }
  const grade = scale.Betygsgrad.find(
    g => g.Kod && g.Kod.toUpperCase() === letterGrade.toUpperCase()
  )

  if (!grade) {
    throw new ClientError(
      'ladok_error',
      `Grade "${letterGrade}" not found in grading scale "${scale.Benamning.en}"`
    )
  }

  return grade && grade.ID
}

/** Get all the ladok reporters without caching */
async function listReportersRaw () {
  const { body } = await ladokApi.get(
    `/kataloginformation/behorighetsprofil/${process.env.LADOK_REPORTER_PROFILE_UID}/koppladeanvandare`
  )

  const users = {}
  body.Anvandare.forEach(user => {
    users[user.Anvandarnamn] = {
      Uid: user.Uid,
      Fornamn: user.Fornamn,
      efternamn: user.Efternamn
    }
  })

  return users
}

/** Get all Ladok reporters */
const listReporters = memoizee(listReportersRaw, {
  maxAge: 15 * 60 * 1000
})

/** Get a list of "Resultat" in Ladok that can be created or updated */
async function listGradeableResults (sectionId, moduleId) {
  log.debug(
    `Getting gradeable results for section ${sectionId} - module ${moduleId}`
  )

  const result = await ladokApi
    .sok(
      `/resultat/studieresultat/rapportera/utbildningsinstans/${moduleId}/sok`,
      {
        Filtrering: ['OBEHANDLADE', 'UTKAST'],
        KurstillfallenUID: [sectionId],
        LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
        OrderBy: ['EFTERNAMN_ASC', 'FORNAMN_ASC', 'PERSONNUMMER_ASC'],
        UtbildningsinstansUID: moduleId
      },
      'Resultat'
    )
    .toArray()

  // This is a simple fix to not overwrite the examination dates of older Ladok grades.
  // If a student has an F in Canvas and has already been attesterad in Ladok, without the following // check  we will re-transfer the F with a new examination date. Since it's hard to know which results to transfer or not in this case, we decided to not overwrite any attesterade results at all.
  return result.filter(r => !hasAttesteradeResultat(r, moduleId))
}

async function listCourseRounds (examId) {
  let amount = 0
  let currentPage = 0
  let allRounds = []
  do {
    currentPage++
    const { body } = await ladokApi.get(
      `/resultat/aktivitetstillfallesmojlighet/filtrera?aktivitetstillfalleUID=${examId}&page=${currentPage}&limit=400`
    )

    amount = body.TotaltAntalPoster

    const rounds = body.Resultat.map(
      r => r.Rapporteringskontext.KurstillfalleUID
    )

    allRounds = [...allRounds, ...rounds]
  } while (currentPage * 400 <= amount)

  return Array.from(new Set(allRounds))
}

async function listExamGradeableResults (examId) {
  log.debug(`Getting gradeable results for examination ${examId}`)
  const courseRounds = await listCourseRounds(examId)

  const result = await ladokApi
    .sok(
      `/resultat/studieresultat/rapportera/aktivitetstillfalle/${examId}/sok`,
      {
        Filtrering: ['OBEHANDLADE', 'UTKAST'],
        KurstillfallenUID: courseRounds,
        LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
        OrderBy: ['EFTERNAMN_ASC', 'FORNAMN_ASC', 'PERSONNUMMER_ASC']
      },
      'Resultat'
    )
    .toArray()
  // We don't check if the students has an attesterat result already, because since we create these exam rooms fresh for the exam period, we know that no student will have an old result in Canvas. Any results in Canvas should be transferred to Ladok, regardless if the student has an already attestarat result.
  return result
}

/** Returns a blank "Draft" object that can be sent to ladok */
function createDraft (moduleId) {
  const resultsForCreate = []
  const dataForCreate = []
  const resultsForUpdate = []
  const dataForUpdate = []

  return {
    /** Set a grade (letter) and examination date into a result (Resultat) */
    async setGrade (result, grade, examinationDate) {
      if (!examinationDate) {
        throw new TypeError('Missing mandatory field "examinationDate"')
      }

      if (!grade) {
        return
      }

      const underlag = getArbetsUnderlag(result, moduleId)
      const newLadokGrade = await getGradeId(
        result.Rapporteringskontext.BetygsskalaID,
        grade
      )

      // Check if the current grade is the same as the new one
      if (underlag && underlag.Betygsgrad === newLadokGrade) {
        log.info(
          `Student ${result.Student.Uid}. SAME GRADE. Before: ${newLadokGrade} (${grade}). After: ${newLadokGrade} (${grade})`
        )
        return
      }

      if (!underlag) {
        // Create
        log.info(
          `Student ${result.Student.Uid}. Before: ---. After: ${newLadokGrade} (${grade}) ex.date ${examinationDate}`
        )

        resultsForCreate.push({
          Uid: result.Uid,
          StudieresultatUID: result.Uid,
          UtbildningsinstansUID:
            result.Rapporteringskontext.UtbildningsinstansUID,
          Betygsgrad: newLadokGrade,
          BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
          Examinationsdatum: examinationDate
        })

        dataForCreate.push({
          student: result.Student.Uid,
          grade: grade
        })
      } else {
        const oldGrade = underlag.Betygsgradsobjekt.Kod
        log.info(
          `Student ${result.Student.Uid}. Before: ${underlag.Betygsgrad} (${oldGrade}). After: ${newLadokGrade} (${grade}) ex.date ${examinationDate}`
        )

        // Update
        resultsForUpdate.push({
          Uid: result.Student.Uid,
          ResultatUID: underlag.Uid,
          Betygsgrad: newLadokGrade,
          BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
          Examinationsdatum: examinationDate,
          SenasteResultatandring: underlag.SenasteResultatandring
        })

        dataForUpdate.push({
          student: result.Student.Uid,
          grade: grade
        })
      }
    },

    /** Internal function. Get the object to be sent to Ladok for creating grades as Draft */
    bodyForCreate () {
      return {
        LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
        Resultat: resultsForCreate
      }
    },

    /** Get the content of the Draft in a human-readable way */
    content () {
      return {
        createOperations: dataForCreate,
        updateOperations: dataForUpdate
      }
    },

    /** Internal function. Get the object to be sent to Ladok for updating grades as Draft */
    bodyForUpdate () {
      return {
        Resultat: resultsForUpdate
      }
    }
  }
}

/** Send a Draft to Ladok */
async function sendDraft (draft) {
  try {
    let updateResponse = []
    let createResponse = []

    // First, try to create grades.
    const create = draft.bodyForCreate()
    log.info(`Grades to be created: ${create.Resultat.length}`)
    if (create.Resultat.length > 0) {
      createResponse = await ladokApi
        .requestUrl('/resultat/studieresultat/skapa', 'POST', create)
        .then(r => r.body.Resultat)
    }
    // Then update grades
    const update = draft.bodyForUpdate()
    log.info(`Grades to be updated: ${update.Resultat.length}`)
    if (update.Resultat.length > 0) {
      updateResponse = await ladokApi
        .requestUrl('/resultat/studieresultat/uppdatera', 'PUT', update)
        .then(r => r.body.Resultat)
    }

    return {
      updateResponse,
      createResponse
    }
  } catch (err) {
    log.warn(err)
    const clientError = new ClientError(
      'ladok_error',
      err.body.Meddelande || 'Error creating or updating grades to Ladok'
    )
    throw clientError
  }
}

function getGradeData (ladokResults, moduleId, studentId) {
  const studentResult = ladokResults.find(
    result => result.Student.Uid === studentId
  )

  if (!studentResult) {
    return { letter: null, existsAsDraft: false }
  }

  const underlag = getArbetsUnderlag(studentResult, moduleId)

  if (!underlag) {
    return { letter: null, existsAsDraft: true }
  }

  return { letter: underlag.Betygsgradsobjekt.Kod, existsAsDraft: true }
}

async function emptyDraft (sectionId, moduleId) {
  const results = await listGradeableResults(sectionId, moduleId)

  for (const result of results) {
    const underlag = getArbetsUnderlag(result, moduleId)

    if (underlag) {
      await ladokApi.requestUrl(
        `/resultat/studieresultat/resultat/${underlag.Uid}`,
        'DELETE'
      )
    }
  }
}

async function getModuleLink (courseLadokId, momentId) {
  const utbildningsinstansId = (
    await ladokApi.requestUrl(`/resultat/kurstillfalle/${courseLadokId}`, 'GET')
  ).body.Utbildningsinstans.Uid
  const bytes = Buffer.from(
    `${process.env.LADOK_API_BASEURL}:443/resultat/utbildningsinstans/kursinstans/${utbildningsinstansId}`
  )
  const kursinstansEncoded = encodeURIComponent(bytes.toString('base64'))

  const ladokLink = [
    `${process.env.LADOK_API_BASEURL.replace('api', 'www')}`,
    `/gui/#/studiedokumentation/resultatflikar?vy=rapportera&valtKurstillfalle=${courseLadokId}`,
    `&kursinstans=${kursinstansEncoded}`,
    `&momentID=${momentId}`,
    `&kurstillfalleForRapportering=${courseLadokId}`
  ].join('')

  return ladokLink
}

module.exports = {
  listScales,
  listGradeableResults,
  listExamGradeableResults,
  listReporters,
  getArbetsUnderlag,
  getGradeData,
  getGradeId,
  createDraft,
  sendDraft,
  emptyDraft,
  getModuleLink
}
