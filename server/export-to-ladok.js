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
    token: req.accessData.token,
    course_id: req.query.course_id,
    layout: false
  })
}

/** Show a test form given a course code in req parameters */
async function showTestForm (req, res) {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).end()
    return
  }

  res.render('form', {
    prefix_path: process.env.PROXY_PATH,
    course_id: req.query.course_id,
    layout: false
  })
}

async function submitForm (req, res) {
  try {
    log.info(
      `Sending grades of course ${req.body.course_id} - assignment ${req.body.canvas_assignment} to Ladok Module ${req.body.ladok_module}`
    )
    const draft = await sendGradesToLadok(
      req.body.course_id,
      req.body.canvas_assignment,
      req.body.ladok_module,
      req.body.examination_date,
      req.signedCookies.access_data.token
    )

    res.send(draft)
  } catch (err) {
    err.name = 'ExportError'
    log.error(err)
    throw err
  }
}

async function listCourseData (req, res) {
  const courseId = req.query.course_id

  log.info(`Fetching data (assignments and modules) of course ${courseId}`)

  const canvasAssignments = await getCanvasAssignments(
    courseId,
    process.env.CANVAS_ADMIN_API_TOKEN
  )

  const ladokModules = await getLadokModules(
    courseId,
    process.env.CANVAS_ADMIN_API_TOKEN
  )

  res.send({
    canvasAssignments: canvasAssignments.map(assignment => ({
      id: assignment.id,
      name: assignment.name
    })),
    ladokModules
  })
}

async function listGradesData (req, res) {
  const data = await getGrades(
    req.query.course_id,
    req.query.assignment_id,
    req.query.module_id,
    req.accessData.token
  )
  res.send(data)
}

function handleExportError (err, req, res, next) {
  if (err.name !== 'ExportError') {
    next(err)
    return
  }

  res.render('export-error', {
    layout: false,
    prefix_path: process.env.PROXY_PATH,
    course_id: req.query.course_id
  })
}

module.exports = {
  rootPage,
  startPage,
  showForm,
  showTestForm,
  submitForm,
  listCourseData,
  listGradesData,
  handleExportError
}
