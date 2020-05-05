const CanvasAPI = require('@kth/canvas-api')
const { ladokGot, ladokSearch, getLadokGrade } = require('./utils')
const mongo = require('./mongo')
const log = require('skog')

async function getCourseRounds (examinationRoundId) {
  let amount = 0
  let currentPage = 0
  let allRounds = []

  do {
    currentPage++
    const { body } = await ladokGot.get(
      `/resultat/aktivitetstillfallesmojlighet/filtrera?aktivitetstillfalleUID=${examinationRoundId}&page=${currentPage}&limit=400`
    )

    amount = body.TotaltAntalPoster

    const rounds = body.Resultat.map(
      r => r.Rapporteringskontext.KurstillfalleUID
    )

    allRounds = [...allRounds, ...rounds]
  } while (currentPage * 400 <= amount)

  return Array.from(new Set(allRounds))
}

async function searchLadokResults (examinationRoundId, mode) {
  return ladokSearch(
    `/resultat/studieresultat/rapportera/aktivitetstillfalle/${examinationRoundId}/sok`,
    {
      Filtrering: [mode === 'create' ? 'OBEHANDLADE' : 'UTKAST'],
      KurstillfallenUID: await getCourseRounds(examinationRoundId),
      LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
      OrderBy: ['EFTERNAMN_ASC', 'FORNAMN_ASC', 'PERSONNUMMER_ASC']
    }
  )
}

/**
 *
 * @param courseId
 * @param sectionIds
 * @param moduleId
 * @param assignmentId
 * @param token
 */

async function getResults (courseId, assignmentId, token) {
  log.info(
    `Getting results for course ${courseId} - assignment ${assignmentId}`
  )

  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray()
  const examinationRounds = new Set(
    sections
      .filter(s => s.integration_id)
      .map(s =>
        s.integration_id.endsWith('_FUNKA')
          ? s.integration_id.slice(0, -6)
          : s.integration_id
      )
  )

  log.info(
    `Course ${courseId} is mapped to ${examinationRounds.size} examination rounds`
  )

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ['user']
    })
    .toArray()

  log.info(
    `Course ${courseId} - assignment ${assignmentId} has ${submissions.length} submissions`
  )

  const grades = submissions.map(s => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
    mode: null
  }))

  for (const examination of examinationRounds) {
    const results1 = await searchLadokResults(examination, 'create')
    const results2 = await searchLadokResults(examination, 'update')

    log.info(
      `Found ${results1.length} results in Ladok for Create in examination ${examination}`
    )
    log.info(
      `Found ${results2.length} results in Ladok for Update in examination ${examination}`
    )

    for (const result of results1) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const ladokGrade =
        submission &&
        submission.grade &&
        (await getLadokGrade(
          result.Rapporteringskontext.BetygsskalaID,
          submission.grade
        ))

      if (ladokGrade) {
        submission.mode = 'create'
      }
    }

    for (const result of results2) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const ladokGrade =
        submission &&
        submission.grade &&
        (await getLadokGrade(
          result.Rapporteringskontext.BetygsskalaID,
          submission.grade
        ))

      const existingResult = result.ResultatPaUtbildningar.find(
        rpu =>
          rpu.Arbetsunderlag &&
          rpu.Arbetsunderlag.AktivitetstillfalleUID === examination
      )

      if (
        ladokGrade &&
        existingResult &&
        existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID
      ) {
        submission.mode = 'update'
      }
    }
  }

  return grades
}

/**
 * @param courseId
 * @param examinationRoundId
 * @param assignmentId
 * @param examinationDate
 * @param token
 */
async function transferResults (
  courseId,
  assignmentId,
  examinationDate,
  token
) {
  log.info(
    `Transferring results for course ${courseId} - assignment ${assignmentId}`
  )
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  const { body: user } = await canvas.get('/users/self')
  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ['user']
    })
    .toArray()

  log.info(
    `Course ${courseId} - assignment ${assignmentId} has ${submissions.length} submissions`
  )

  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray()
  const examinationRounds = new Set(
    sections
      .filter(s => s.integration_id)
      .map(s =>
        s.integration_id.endsWith('_FUNKA')
          ? s.integration_id.slice(0, -6)
          : s.integration_id
      )
  )

  log.info(
    `Course ${courseId} is mapped to ${examinationRounds.size} examination rounds`
  )

  const transferObject1 = {
    LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
    Resultat: []
  }

  const transferObject2 = {
    Resultat: []
  }

  const grades = submissions.map(s => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade
  }))

  for (const examination of examinationRounds) {
    const results1 = await searchLadokResults(examination, 'create')
    const results2 = await searchLadokResults(examination, 'update')

    log.info(
      `Found ${results1.length} results in Ladok for Create in examination ${examination}`
    )
    log.info(
      `Found ${results2.length} results in Ladok for Update in examination ${examination}`
    )

    for (const result of results1) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const ladokGrade =
        submission &&
        submission.grade &&
        (await getLadokGrade(
          result.Rapporteringskontext.BetygsskalaID,
          submission.grade
        ))

      if (ladokGrade) {
        transferObject1.Resultat.push({
          Uid: result.Uid,
          StudieresultatUID: result.Uid,
          UtbildningsinstansUID:
            result.Rapporteringskontext.UtbildningsinstansUID,
          Betygsgrad: ladokGrade.ID,
          BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
          Examinationsdatum: examinationDate
        })
      }
    }

    for (const result of results2) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const ladokGrade =
        submission &&
        submission.grade &&
        (await getLadokGrade(
          result.Rapporteringskontext.BetygsskalaID,
          submission.grade
        ))

      const existingResult = result.ResultatPaUtbildningar.find(
        rpu =>
          rpu.Arbetsunderlag &&
          rpu.Arbetsunderlag.AktivitetstillfalleUID === examination
      )

      if (
        ladokGrade &&
        existingResult &&
        existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID
      ) {
        transferObject2.Resultat.push({
          Uid: result.Student.Uid,
          ResultatUID: existingResult.Arbetsunderlag.Uid,
          Betygsgrad: ladokGrade.ID,
          BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
          Examinationsdatum: examinationDate,
          SenasteResultatandring:
            existingResult.Arbetsunderlag.SenasteResultatandring
        })
      }
    }
  }

  const dataLog = {
    transfer_timestamp: Date.now(),
    user_canvas_id: user.id,
    from_course_id: courseId,
    from_assignment_id: assignmentId,

    to_examination_rounds: examinationRounds,
    examination_date: examinationDate,
    new_grades: transferObject1.Resultat,
    updated_grades: transferObject2.Resultat
  }
  mongo.write(dataLog)

  const r1 = await ladokGot.post('/resultat/studieresultat/skapa', {
    body: transferObject1
  })

  log.info(`Created ${r1.body.Resultat.length} results in Ladok`)

  const r2 = await ladokGot.put('/resultat/studieresultat/uppdatera', {
    body: transferObject2
  })

  log.info(`Updated ${r2.body.Resultat.length} results in Ladok`)

  return [...r1.body.Resultat, ...r2.body.Resultat]
}

module.exports = {
  getResults,
  transferResults
}
