const {
  getCanvasAssignments,
  getLadokModules,
  sendGradesToLadok,
  getGrades
} = require('../lib')
const log = require('skog')

async function rootPage (req, res) {
  res.render('root', {
    prefix_path: process.env.PROXY_PATH,
    layout: false
  })
}

async function startPage (req, res) {
  if (!req.body || !req.body.custom_canvas_course_id) {
    throw new Error()
  }

  res.render('start', {
    prefix_path: process.env.PROXY_PATH,
    next: `${process.env.PROXY_PATH}/export2`,
    custom_canvas_course_id: req.body.custom_canvas_course_id,
    layout: false
  })
}

async function showForm (req, res) {
  res.render('form', {
    prefix_path: process.env.PROXY_PATH,
    token: req.signedCookies.access_data.token,
    course_id: req.query.course_id,
    layout: false
  })
}

async function submitGrades (req, res) {
  const courseId = req.signedCookies.access_data.courseId

  log.info(
    `Sending grades of course ${courseId} - assignment ${req.body.canvas_assignment} to Ladok Module ${req.body.ladok_module}`
  )
  const result = await sendGradesToLadok(
    courseId,
    req.body.canvas_assignment,
    req.body.ladok_module,
    req.body.examination_date,
    req.signedCookies.access_data.token
  )

  res.send(result)
}

async function listCourseData (req, res) {
  const courseId = req.signedCookies.access_data.courseId
  const token = req.signedCookies.access_data.token

  log.info(`Fetching data (assignments and modules) of course ${courseId}`)

  const canvasAssignments = await getCanvasAssignments(courseId, token)
  const ladokModules = await getLadokModules(courseId, token)

  res.send({
    url: `${process.env.CANVAS_HOST}/courses/${courseId}`,
    canvasAssignments: canvasAssignments.map(assignment => ({
      published: assignment.published,
      muted: assignment.muted,
      grading_type: assignment.grading_type,
      id: assignment.id,
      name: assignment.name
    })),
    ladokModules
  })
}

async function listGradesData (req, res) {
  const courseId = req.signedCookies.access_data.courseId
  const token = req.signedCookies.access_data.token

  const data = await getGrades(
    courseId,
    req.query.assignment_id,
    req.query.module_id,
    token
  )
  res.send(data)
}

function handleHtmlErrors (err, req, res, next) {
  if (err.name !== 'ExportError') {
    next(err)
    return
  }

  res.render('export-error', {
    layout: false,
    summary:
      err.code === 'ladok_error' ? 'See the error obtained from Ladok' : '',
    details: err.message,
    prefix_path: process.env.PROXY_PATH,
    course_id: req.query.course_id
  })
}

function handleApiErrors (err, req, res, next) {
  log.info('An error occured', err)
  if (err.name === 'ClientError') {
    res.status(500).send({ error: err.message })
  } else {
    res.status(500).send({ error: 'A generic error occured.' })
  }
}

module.exports = {
  rootPage,
  startPage,
  showForm,
  submitGrades,
  listCourseData,
  listGradesData,
  handleHtmlErrors,
  handleApiErrors
}
