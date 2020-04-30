const CanvasAPI = require('@kth/canvas-api')
const { ladokGot, ladokSearch, getGradingScales } = require('./utils')

async function searchLadokResults (moduleId, courseRounds, mode) {
  return ladokSearch(
    `/resultat/studieresultat/rapportera/utbildningsinstans/${moduleId}/sok`,
    {
      Filtrering: [mode === 'create' ? 'OBEHANDLADE' : 'UTKAST'],
      KurstillfallenUID: courseRounds,
      LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
      OrderBy: ['EFTERNAMN_ASC', 'FORNAMN_ASC', 'PERSONNUMMER_ASC']
    }
  )
}

/**
 *
 * @param courseId
 * @param moduleId
 * @param assignmentId
 * @param token
 */
async function getResults (courseId, moduleId, assignmentId, token) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray()
  const courseRounds = sections.map(s => s.integration_id)
  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ['user']
    })
    .toArray()

  const allScales = await getGradingScales()

  const grades = submissions.map(s => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
    mode: null
  }))

  const results1 = await searchLadokResults(moduleId, courseRounds, 'create')

  for (const result of results1) {
    const submission = grades.find(s => s.id === result.Student.Uid)
    const scale = allScales.find(
      s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
    )

    if (submission && submission.grade) {
      const ladokGrade = scale.Betygsgrad.find(
        g => g.Kod && g.Kod.toUpperCase() === submission.grade.toUpperCase()
      )

      if (ladokGrade) {
        submission.mode = 'create'
      }
    }
  }

  const results2 = await searchLadokResults(moduleId, courseRounds, 'update')

  for (const result of results2) {
    const submission = grades.find(s => s.id === result.Student.Uid)
    const scale = allScales.find(
      s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
    )

    const existingResult = result.ResultatPaUtbildningar.find(
      rpu =>
        rpu.Arbetsunderlag &&
        rpu.Arbetsunderlag.UtbildningsinstansUID === moduleId
    )

    if (existingResult && submission && submission.grade) {
      const ladokGrade = scale.Betygsgrad.find(
        g => g.Kod && g.Kod.toUpperCase() === submission.grade.toUpperCase()
      )

      if (
        ladokGrade &&
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
  moduleId,
  assignmentId,
  examinationDate,
  token
) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ['user']
    })
    .toArray()

  const allScales = await getGradingScales()
  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray()
  const courseRounds = sections.map(s => s.integration_id)
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

  const results1 = await searchLadokResults(moduleId, courseRounds, 'create')

  for (const result of results1) {
    const submission = grades.find(s => s.id === result.Student.Uid)
    const scale = allScales.find(
      s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
    )

    if (submission && submission.grade) {
      const ladokGrade = scale.Betygsgrad.find(
        g => g.Kod && g.Kod.toUpperCase() === submission.grade.toUpperCase()
      )

      if (ladokGrade && ladokGrade.ID) {
        transferObject1.Resultat.push({
          Uid: result.Uid,
          StudieresultatUID: result.Uid,
          UtbildningsinstansUID: moduleId,
          Betygsgrad: ladokGrade.ID,
          BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
          Examinationsdatum: examinationDate
        })
      }
    }
  }

  const results2 = await searchLadokResults(moduleId, courseRounds, 'update')

  for (const result of results2) {
    const submission = grades.find(s => s.id === result.Student.Uid)
    const scale = allScales.find(
      s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
    )

    const existingResult = result.ResultatPaUtbildningar.find(
      rpu =>
        rpu.Arbetsunderlag &&
        rpu.Arbetsunderlag.UtbildningsinstansUID === moduleId
    )

    const ladokGrade = scale.Betygsgrad.find(
      g => g.Kod && g.Kod.toUpperCase() === submission.grade.toUpperCase()
    )

    if (
      ladokGrade &&
      existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID &&
      submission &&
      submission.grade
    ) {
      transferObject2.Resultat.push({
        Uid: result.Student.Uid,
        ResultatUID: existingResult.Arbetsunderlag.Uid,
        Betygsgrad: ladokGrade.ID,
        BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
        Examinationsdatum: examRoundDate,
        SenasteResultatandring:
          existingResult.Arbetsunderlag.SenasteResultatandring
      })
    }
  }

  // TODO: Log the result to MongoDB

  const r1 = await ladokGot.post('/resultat/studieresultat/skapa', {
    body: transferObject1
  })

  const r2 = await ladokGot.put('/resultat/studieresultat/uppdatera', {
    body: transferObject2
  })

  return [...r1.body.Resultat, ...r2.body.Resultat]
}

module.exports = {
  getResults,
  transferResults
}
