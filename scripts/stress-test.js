/** Do a "stress" test trying to send lots of grades to Ladok from a module */
require('dotenv').config()
require('../lib/ladok/api').init()

const ladok = require('../lib/ladok')

async function runTest (sectionId, moduleId) {
  const t1 = new Date()
  await ladok.emptyDraft(sectionId, moduleId)
  const diff1 = new Date() - t1

  // Draft
  const t2 = new Date()
  const gradeableResults = await ladok.listGradeableResults(sectionId, moduleId)
  const diff2 = new Date() - t2

  const draft = ladok.createDraft(moduleId)

  // Set a "P" to everybody
  const t3 = new Date()
  for (const result of gradeableResults) {
    await draft.setGrade(result, 'F', '2019-12-01')
  }
  const diff3 = new Date() - t3

  const t4 = new Date()
  await ladok.sendDraft(draft)
  const diff4 = new Date() - t4

  const t5 = new Date()
  await ladok.emptyDraft(sectionId, moduleId)
  const diff5 = new Date() - t5

  return {
    moduleId,
    sectionId,
    gradeableResults: gradeableResults.length,
    times: {
      diff1,
      diff2,
      diff3,
      diff4,
      diff5
    },
    timestamps: {
      t1,
      t2,
      t3,
      t4,
      t5
    }
  }
}

async function start () {
  const modules = [
    '7ff45810-73d8-11e8-b4e0-063f9afb40e3',
    '7fecddfd-73d8-11e8-b4e0-063f9afb40e3',
    '7fcb7332-73d8-11e8-b4e0-063f9afb40e3',
    '7fe6754c-73d8-11e8-b4e0-063f9afb40e3',
    '7fd0f177-73d8-11e8-b4e0-063f9afb40e3'
  ]

  // Run in parallel
  const results = await Promise.allSettled(
    modules.map(moduleId =>
      runTest('5c6ca54e-f792-11e8-9614-d09e533d4323', moduleId)
    )
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      console.log(result.value)
    } else {
      console.error(result.reason)
    }
  }
}

start()
