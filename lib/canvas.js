const CanvasAPI = require('@kth/canvas-api')
const log = require('skog')
const memoizee = require('memoizee')

async function getAssignments (token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  return canvas.list(`/courses/${courseId}/assignments`).toArray()
}

async function getCourse (token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const { body: course } = await canvas.get(`/courses/${courseId}`)

  return course
}
async function getUser (token, userId, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const { body: user } = await canvas.get(
    `/courses/${courseId}/users/${userId}`
  )

  return user
}

async function getSelf (token) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const { body: currentUser } = await canvas.get('/users/self')

  return currentUser
}

async function getSelfEnrollments (token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  return canvas
    .list(`/courses/${courseId}/enrollments`, { user_id: 'self' })
    .toArray()
}

async function getSubmissionsWithoutCache (token, courseId, assignmentId) {
  log.debug(
    `Getting submissions for course ${courseId} - assignment ${assignmentId}`
  )
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const params = { student_ids: ['all'], include: ['user'] }
  return canvas
    .list(`courses/${courseId}/assignments/${assignmentId}/submissions`, params)
    .toArray()
}

async function getGrade (submissions, studentIntegrationId) {
  const submission = submissions
    .filter(s => s.grade)
    .find(s => s.user.integration_id === studentIntegrationId)

  return submission && submission.grade
}

const getSubmissions = memoizee(getSubmissionsWithoutCache, {
  maxAge: 60 * 60 * 1000
})

module.exports = {
  getCourse,
  getSelf,
  getSelfEnrollments,
  getAssignments,
  getSubmissions,
  getGrade,
  getUser
}
