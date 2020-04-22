const canvas = require('./canvas')
const kopps = require('./kopps')
const ladok = require('./ladok')
const mongo = require('./mongo')
const { isAllowed } = require('./is-allowed')
const { ClientError, ExportError } = require('./errors')
const log = require('skog')

/** Get the assignments of a course in Canvas */
async function getCanvasAssignments (courseId, token) {
  return canvas.getAssignments(token, courseId)
}

/** Get the Ladok modules of a course in Canvas */
async function getLadokModules (courseId, token) {
  const course = await canvas.getCourse(token, courseId)
  if (!course.sis_course_id) {
    throw new ClientError(
      'invalid_course',
      'The course is not configured properly to send grades to Ladok.'
    )
  }
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
    const ladokGradeData = await ladok.getGradeData(
      ladokGrades,
      moduleId,
      canvasGrade.user.integration_id
    )

    submissions.push({
      ladokGradeData,
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

  const ladokLink = await ladok.getModuleLink(course.integration_id, moduleId)

  const dataLog = {
    transfer_timestamp: Date.now(),
    user_canvas_id: user.id,
    from_course: `${course.sis_course_id} - ${course.name}`,
    from_course_id: courseId,
    from_assignment_id: assignmentId,

    to_module_id: moduleId,
    to_module_link: ladokLink,
    examination_date: examinationDate,
    new_grades: draft.content().createOperations,
    updated_grades: draft.content().updateOperations
  }
  mongo.write(dataLog)

  log.info('Draft created. Sending to Ladok...')
  const { createResponse, updateResponse } = await ladok.sendDraft(draft)
  const newLadokGrades = [...createResponse, ...updateResponse]

  // TODO: This code might be useful with a more detailed feedback page, thus I'm leaving it for a while.
  /* const submissions = []

  for (const canvasGrade of canvasGrades) {
    const id = canvasGrade.user.integration_id
    const newGrade = newLadokGrades.find(grade => grade.StudentUID === id)

    submissions.push({
      id,
      newGrade: newGrade && newGrade.Betygsgradsobjekt.Kod,
      name: canvasGrade.user.sortable_name
    })
  } */

  return { newLadokGrades, ladokLink }
}

module.exports = {
  getCanvasAssignments,
  getLadokModules,
  getGrades,
  sendGradesToLadok
}
