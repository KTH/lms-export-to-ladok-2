const canvas = require('./canvas')
const kopps = require('./kopps')
const ladok = require('./ladok')
const mongo = require('./mongo')
const { isAllowed } = require('./is-allowed')
const { ExportError } = require('./errors')
const log = require('skog')

/** Get the assignments of a course in Canvas */
async function getCanvasAssignments (courseId, token) {
  return canvas.getAssignments(token, courseId)
}

/** Get the Ladok modules of a course in Canvas */
async function getLadokModules (courseId, token) {
  const course = await canvas.getCourse(token, courseId)
  const match = course.sis_course_id.match(/(.*)(VT|HT)(\d{2})\d/)

  if (!match) {
    return []
  }

  const [, courseCode, term, year] = match
  return kopps.getModules(courseCode, year, term)
}

async function getGrades (courseId, assignmentId, moduleId, token) {
  const course = await canvas.getCourse(token, courseId)
  const submissions = []
  const ladokGrades = await ladok.listGradeableResults(
    course.integration_id,
    moduleId
  )

  const canvasGrades = await canvas.getSubmissions(
    token,
    courseId,
    assignmentId
  )

  for (const canvasGrade of canvasGrades) {
    const ladokGrade = await ladok.getLetterGrade(
      ladokGrades,
      moduleId,
      canvasGrade.user.integration_id
    )

    submissions.push({
      ladokGrade,
      canvasGrade: canvasGrade.grade,
      name: canvasGrade.user.sortable_name,
      id: canvasGrade.user.integration_id
    })
  }

  return submissions
}

/** Send grades of a canvas course to a ladok module */
async function sendGradesToLadok (
  courseId,
  assignmentId,
  moduleId,
  examinationDate,
  token
) {
  log.debug('Sending grades to Ladok...')
  const allowed = await isAllowed(token, courseId)
  if (!allowed) {
    throw new ExportError(
      'not_allowed',
      'The user is not allowed to send grades to Ladok'
    )
  }

  const user = await canvas.getSelf(token)
  const course = await canvas.getCourse(token, courseId)

  log.info(
    `User ${user.id} (${user.login_id}) is going to send grades of course ${courseId} - assignment ${assignmentId}`
  )

  const gradeableResults = await ladok.listGradeableResults(
    course.integration_id,
    moduleId
  )
  log.debug(`Found ${gradeableResults.length} gradeable results`)

  const draft = ladok.createDraft(moduleId)
  const canvasGrades = await canvas.getSubmissions(
    token,
    courseId,
    assignmentId
  )

  for (const result of gradeableResults) {
    const grade = await canvas.getGrade(canvasGrades, result.Student.Uid)
    await draft.setGrade(result, grade, examinationDate)
  }

  mongo.write({
    course,
    user,
    assignmentId,
    new_grades: draft.bodyForCreate(),
    update_grades: draft.bodyForUpdate()
  })

  log.info('Draft created. Sending to Ladok...')
  const { createResponse, updateResponse } = await ladok.sendDraft(draft)
  const newLadokGrades = [...createResponse, ...updateResponse]

  //TODO: This code might be useful with a more detailed feedback page, thus I'm leaving it for a while.
  /*const submissions = []

  for (const canvasGrade of canvasGrades) {
    const id = canvasGrade.user.integration_id
    const newGrade = newLadokGrades.find(grade => grade.StudentUID === id)

    submissions.push({
      id,
      newGrade: newGrade && newGrade.Betygsgradsobjekt.Kod,
      name: canvasGrade.user.sortable_name
    })
  }*/

  const ladokLink = await ladok.getModuleLink(course.integration_id, moduleId)

  return { newLadokGrades, ladokLink }
}

module.exports = {
  getCanvasAssignments,
  getLadokModules,
  getGrades,
  sendGradesToLadok
}
