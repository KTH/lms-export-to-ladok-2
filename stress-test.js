/** Do a "stress" test trying to send lots of grades to Ladok from a module */
require('dotenv').config()
require('./lib/ladok/api').init()

const ladok = require('./lib/ladok')

async function runTest (sectionId, moduleId) {
  const t1 = new Date()
  await ladok.emptyDraft(sectionId, moduleId)
  const emptyDraftTime = new Date() - t1

  // Draft
  const t2 = new Date()
  const gradeableResults = await ladok.listGradeableResults(sectionId, moduleId)
  const getGradeableResultsTime = new Date() - t2

  const draft = ladok.createDraft(moduleId)

  // Set a "P" to everybody
  const t3 = new Date()
  for (const result of gradeableResults) {
    await draft.setGrade(result, 'P', '2019-12-01')
  }
  const setGradeTime = new Date() - t3

  const t4 = new Date()
  await ladok.sendDraft(draft)
  const sendDraftTime = new Date() - t4

  const t5 = new Date()
  await ladok.emptyDraft(sectionId, moduleId)
  const emptyDraftTime2 = new Date() - t5

  return {
    emptyDraftTime,
    emptyDraftTime2,
    getGradeableResultsTime,
    setGradeTime,
    sendDraftTime
  }
}

async function start () {
  const times = await runTest(
    '5c6ca54e-f792-11e8-9614-d09e533d4323',
    '7fcb7332-73d8-11e8-b4e0-063f9afb40e3'
  )
  console.log(times)
}

start()
