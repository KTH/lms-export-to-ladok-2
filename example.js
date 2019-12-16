/** Try to send grades to Ladok and see what happens */
require('dotenv').config()
require('./lib/ladok/api').init()

const ladok = require('./lib/ladok')

async function start () {
  // Assume a specific Ladok module, Kurstilfälle, etc.
  const moduleId = '7fcb7332-73d8-11e8-b4e0-063f9afb40e3'
  const sectionId = '5c6ca54e-f792-11e8-9614-d09e533d4323'
  await ladok.emptyDraft(sectionId, moduleId)

  // Draft 1
  const gradeableResults1 = await ladok.listGradeableResults(
    sectionId,
    moduleId
  )
  const draft1 = ladok.createDraft(moduleId)
  await draft1.setGrade(gradeableResults1[0], 'F', '2019-12-01')
  await draft1.setGrade(gradeableResults1[6], 'F', '2019-12-01')
  const result1 = await ladok.sendDraft(draft1)
  // return
  console.log(result1.create)

  // Draft 2
  const gradeableResults2 = await ladok.listGradeableResults(
    sectionId,
    moduleId
  )
  const draft2 = ladok.createDraft(moduleId)

  await draft2.setGrade(gradeableResults2[0], 'P', '2019-12-01') // Same
  await draft2.setGrade(gradeableResults2[1], 'P', '2030-12-01') // Update
  await draft2.setGrade(gradeableResults2[2], 'P', '2019-12-01') // Create

  const result2 = await ladok.sendDraft(draft2)
  console.log(result2.create)
  console.log(result2.update)
}

start()
