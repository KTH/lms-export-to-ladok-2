const express = require('express')
const expressHandlebars = require('express-handlebars')
const Router = require('express-promise-router')
const log = require('skog')
const path = require('path')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const system = require('./system')
const { oauth1, oauth2 } = require('./oauth')('/export3')
const authorization = require('./authorization')
const { startPage, showForm } = require('./export-to-ladok')
const getCourseStructure = require('../lib/get-course-structure')
const transferExamination = require('../lib/transfer-examination')
const transferModule = require('../lib/transfer-module')
const cuid = require('cuid')

const server = express()
server.set('views', path.join(__dirname, '/views'))
server.engine('handlebars', expressHandlebars())
server.set('view engine', 'handlebars')

server.use(bodyParser.json())
server.use(
  bodyParser.urlencoded({
    extended: true
  })
)
server.use(cookieParser(process.env.COOKIE_SIGNATURE_SECRET))

server.use((req, res, next) => {
  log.child(
    {
      req_id: cuid()
    },
    next
  )
})

const PROXY_PATH = process.env.PROXY_PATH || ''

// Define the router as map between routes and a set of middlewares & handlers
const apiRouter = Router()
const router = Router()

if (process.env.NODE_ENV === 'development') {
  const webpack = require('webpack')
  const webpackDevMiddleware = require('webpack-dev-middleware')
  const config = require('../webpack.dev.config.js')
  const compiler = webpack(config)

  server.use(
    webpackDevMiddleware(compiler, {
      publicPath: `${process.env.PROXY_PATH}/dist`
    })
  )

  server.use(require('webpack-hot-middleware')(compiler))
} else {
  router.use('/dist', express.static(path.resolve(process.cwd(), 'dist')))
}
router.get('/fake500', (req, res) => {
  return res.status(500).send();
})
router.get('/fake502', (req, res) => {
  return res.status(502).send();
})
router.post('/export', startPage)
router.post('/export2', oauth1)
router.get('/export3', oauth2, function (req, res) {
  res.redirect('app')
})
router.get('/app', showForm)

router.get('/_monitor', system.monitor)
router.get('/_monitor_all', system.monitor)
router.get('/_about', system.about)
router.use('/api', apiRouter)

apiRouter.get('/course-info', async function getCourseInfo (req, res) {
  const token = req.signedCookies.access_data.token
  const courseId = req.signedCookies.access_data.courseId

  const response = await getCourseStructure(courseId, token)
  res.send(response)
})
apiRouter.get('/table', async function getGrades (req, res) {
  const token = req.signedCookies.access_data.token
  const courseId = req.signedCookies.access_data.courseId

  const assignmentId = req.query.assignmentId
  const moduleId = req.query.moduleId

  if (moduleId) {
    const result = await transferModule.getResults(
      courseId,
      moduleId,
      assignmentId,
      token
    )

    res.send(result)
  } else {
    const result = await transferExamination.getResults(
      courseId,
      assignmentId,
      token
    )

    res.send(result)
  }
})

apiRouter.post(
  '/submit-grades',
  authorization.denyActAs,
  async function submitGrades (req, res) {
    const token = req.signedCookies.access_data.token
    const courseId = req.signedCookies.access_data.courseId

    const assignmentId = req.body.assignmentId
    const moduleId = req.body.moduleId
    const examinationDate = req.body.examinationDate

    try {
      if (moduleId) {
        const result = await transferModule.transferResults(
          courseId,
          moduleId,
          assignmentId,
          examinationDate,
          token
        )

        res.send(result)
      } else {
        const result = await transferExamination.transferResults(
          courseId,
          assignmentId,
          examinationDate,
          token
        )

        res.send(result)
      }
    } catch (err) {
      if (err.body && err.body.Meddelande) {
        log.warn(
          `Known error when transferring results to Ladok: ${err.body.Meddelande}`
        )

        res.status(400).send({
          code: 'ladok_error',
          message: err.body.Meddelande
        })
      } else {
        log.error('Unknown error when transferring results to Ladok', err)
        res.status(500).send('unknown error')
      }
    }
  }
)

server.use(PROXY_PATH, router)
server.use(function catchKnownError (err, req, res, next) {
  if (err.name === 'ClientError') {
    log.warn({
      req,
      res,
      err
    })
    res.render('error', {
      prefix_path: process.env.PROXY_PATH,
      message: err.message,
      layout: false
    })
  } else {
    next(err)
  }
})

/**
 * Generic error handler.
 *
 * This is called only if an unhandled error happened during the execution.
 * In that case, the app response is a 500.
 */
server.use(function catchAll (err, req, res, next) {
  log.error({
    req,
    res,
    err
  })
  res.status(500).send('Unexpected error. Status 500')
})
module.exports = server
