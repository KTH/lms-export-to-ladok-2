const got = require('got')

async function getModules (courseCode, year, term) {
  const { body: courseDetails } = await got(
    `https://api.kth.se/api/kopps/v2/course/${courseCode}/detailedinformation`,
    {
      json: true
    }
  )

  const termUtils = {
    VT: 1,
    HT: 2
  }

  const termNumber = `20${year}${termUtils[term]}`
  const examinationSets = Object.values(courseDetails.examinationSets)
    .sort(
      (a, b) =>
        parseInt(a.startingTerm.term, 10) - parseInt(b.startingTerm.term, 10)
    )
    .filter(e => parseInt(e.startingTerm.term, 10) <= termNumber)

  const examinationRounds =
    examinationSets[examinationSets.length - 1].examinationRounds

  return examinationRounds.map(round => ({
    id: round.ladokUID,
    name: round.examCode,
    title: round.title
  }))
}

async function getModule (courseCode, examCode, examDate) {
  const { body: courseDetails } = await got(
    `https://api.kth.se/api/kopps/v2/course/${courseCode}/detailedinformation`,
    {
      json: true
    }
  )

  const examinationSet = Object.values(courseDetails.examinationSets).sort(
    (a, b) =>
      // Sort from most recent to oldest
      parseInt(b.startingTerm.term, 10) - parseInt(a.startingTerm.term, 10)
  )[0]

  const examinationRounds = examinationSet.examinationRounds.filter(
    round => round.examCode === examCode
  )

  return examinationRounds.map(round => ({
    id: round.ladokUID,
    name: round.examCode,
    title: round.title,
    examinationDate: examDate || null
  }))
}

module.exports = {
  getModules,
  getModule
}
