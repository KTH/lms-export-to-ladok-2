const CanvasAPI = require('@kth/canvas-api')
const { ladokGot, ladokSearch, getGradingScales } = require('./utils')

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
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray()
  const examinationRounds = sections
    .filter(s => s.integration_id)
    .map(s =>
      s.integration_id.endsWith('_FUNKA')
        ? s.integration_id.slice(0, -6)
        : s.integration_id
    )
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

  // TODO: support multi-examination-round courses
  for (const examination of examinationRounds) {
    const results1 = await searchLadokResults(examination, 'create')

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

    const results2 = await searchLadokResults(examination, 'update')

    for (const result of results2) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const scale = allScales.find(
        s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
      )

      const existingResult = result.ResultatPaUtbildningar.find(
        rpu =>
          rpu.Arbetsunderlag &&
          rpu.Arbetsunderlag.AktivitetstillfalleUID === examination
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
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ['user']
    })
    .toArray()
  const examinationRounds = sections
    .filter(s => s.integration_id)
    .map(s =>
      s.integration_id.endsWith('_FUNKA')
        ? s.integration_id.slice(0, -6)
        : s.integration_id
    )

  const allScales = await getGradingScales()
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

  // TODO: support multi-examination-round courses
  for (const examination of examinationRounds) {
    const results1 = await searchLadokResults(examination, 'create')

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
            UtbildningsinstansUID: examId,
            Betygsgrad: ladokGrade.ID,
            BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
            Examinationsdatum: examinationDate
          })
        }
      }
    }

    const results2 = await searchLadokResults(examination, 'update')

    for (const result of results2) {
      const submission = grades.find(s => s.id === result.Student.Uid)
      const scale = allScales.find(
        s => parseInt(s.ID, 10) === result.Rapporteringskontext.BetygsskalaID
      )

      const existingResult = result.ResultatPaUtbildningar.find(
        rpu =>
          rpu.Arbetsunderlag &&
          rpu.Arbetsunderlag.AktivitetstillfalleUID === examination
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
  }

  // TODO: Log the result to MongoDB

  const g1 = await ladokGot.post('/resultat/studieresultat/skapa', {
    body: transferObject1
  })

  const g2 = await ladokGot.put('/resultat/studieresultat/uppdatera', {
    body: transferObject2
  })

  return grades
}

module.exports = {
  getResults,
  transferResults
}
