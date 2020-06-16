const log = require('skog')

async function startPage (req, res) {
  log.info('log-visited!!!')
  if (!req.body || !req.body.custom_canvas_course_id) {
    res.render('error', {
      layout: false,
      title: 'This app needs to be launched from Canvas',
      subtitle:
        'To use this app you need to click on the "Transfer to Ladok" button on the left-hand side of your course in Canvas.',
      code: 'missing body parameter [custom_canvas_course_id]'
    })
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

module.exports = {
  startPage,
  showForm,
  handleHtmlErrors
}
