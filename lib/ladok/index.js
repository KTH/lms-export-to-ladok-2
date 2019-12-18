const ladokApi = require('./api')
const log = require('skog')
const memoizee = require('memoizee')

/** Get the "ArbetsUnderlag" of a "Ladok Resultat" related to a module */
function getArbetsUnderlag (result, moduleId) {
  const underlag = result.ResultatPaUtbildningar.map(rpu => rpu.Arbetsunderlag)

  return underlag.find(au => au && au.UtbildningsinstansUID === moduleId)
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
    throw new Error(`Grading scale "${scaleId}" not found in Ladok`)
  }

  const grade = scale.Betygsgrad.find(
    g => g.Kod && g.Kod.toUpperCase() === letterGrade.toUpperCase()
  )

  if (!grade) {
    throw new Error(
      `Grade "${letterGrade}" not found in grading scale ${scaleId}`
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
  return ladokApi
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
}

/** Returns a blank "Draft" object that can be sent to ladok */
function createDraft (moduleId) {
  const requestsForCreate = []
  const requestsForUpdate = []

  // Content of the draft in a "readable" way
  const content = []

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
        content.push({
          id: result.Student.Uid,
          oldLadokGrade: grade,
          ladokGrade: grade
        })
        return
      }

      if (!underlag) {
        // Create
        log.info(
          `Student ${result.Student.Uid}. Before: ---. After: ${newLadokGrade} (${grade}) ex.date ${examinationDate}`
        )
        content.push({
          id: result.Student.Uid,
          oldLadokGrade: null,
          ladokGrade: grade
        })

        requestsForCreate.push({
          id: result.Uid,
          id2: result.Rapporteringskontext.UtbildningsinstansUID,
          studentId: result.Student.Uid,
          body: {
            Uid: result.Uid,
            StudieresultatUID: result.Uid,
            Betygsgrad: newLadokGrade,
            BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
            Examinationsdatum: examinationDate
          }
        })
      } else {
        const oldGrade = underlag.Betygsgradsobjekt.Kod
        log.info(
          `Student ${result.Student.Uid}. Before: ${underlag.Betygsgrad} (${oldGrade}). After: ${newLadokGrade} (${grade}) ex.date ${examinationDate}`
        )
        content.push({
          id: result.Student.Uid,
          oldLadokGrade: oldGrade,
          ladokGrade: grade
        })

        // Update
        requestsForUpdate.push({
          id: underlag.Uid,
          studentId: result.Student.Uid,
          body: {
            Uid: result.Student.Uid,
            Betygsgrad: newLadokGrade,
            BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
            Examinationsdatum: examinationDate,
            SenasteResultatandring: underlag.SenasteResultatandring
          }
        })
      }
    },

    /** Get the content of the draft in a human-understandable format */
    getContent () {
      return content
    },

    /** Get the object to be sent to Ladok for creating grades as Draft */
    getCreateRequest () {
      return requestsForCreate
    },

    /** Get the objects to be sent to Ladok for updating grades as Draft */
    getUpdateRequest () {
      return requestsForUpdate
    }
  }
}

/** Send a Draft to Ladok */
async function sendDraft (draft) {
  const updateResponse = []
  const createResponse = []

  log.info(`Grades to be updated: ${draft.getUpdateRequest().length}`)

  for (const { id, body, studentId } of draft.getUpdateRequest()) {
    try {
      const responseBody = await ladokApi
        .requestUrl(`/resultat/studieresultat/resultat/${id}`, 'PUT', body)
        .then(r => r.body)

      updateResponse.push({
        success: true,
        studentId,
        body: responseBody
      })
    } catch (err) {
      updateResponse.push({
        success: false,
        studentId,
        body: err.body
      })
    }
  }

  log.info(`Grades to be created: ${draft.getCreateRequest().length}`)

  for (const { id, id2, body, studentId } of draft.getCreateRequest()) {
    try {
      const responseBody = await ladokApi
        .requestUrl(
          `/resultat/studieresultat/${id}/utbildning/${id2}/resultat`,
          'POST',
          body
        )
        .then(r => r.body)

      createResponse.push({
        success: true,
        studentId,
        body: responseBody
      })
    } catch (err) {
      createResponse.push({
        success: false,
        studentId,
        body: err.body
      })
    }
  }

  return {
    createResponse,
    updateResponse
  }
}

function getLetterGrade (ladokResults, moduleId, studentId) {
  const studentResult = ladokResults.find(
    result => result.Student.Uid === studentId
  )

  if (!studentResult) {
    return null
  }

  const underlag = getArbetsUnderlag(studentResult, moduleId)

  if (!underlag) {
    return null
  }

  return underlag.Betygsgradsobjekt.Kod
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

module.exports = {
  listScales,
  listGradeableResults,
  listReporters,
  getArbetsUnderlag,
  getLetterGrade,
  getGradeId,
  createDraft,
  sendDraft,
  emptyDraft
}
