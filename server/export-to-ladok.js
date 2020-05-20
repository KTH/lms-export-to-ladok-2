const log = require('skog')

async function startPage(req, res) {
  console.log('log-visited!');
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
    layout: false
  })
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
  startPage,
  showForm,
  handleHtmlErrors,
  handleApiErrors
}
