const log = require('skog')
const querystring = require('querystring')
const { URL } = require('url')
const got = require('got')
const { ClientError } = require('../lib/errors')

async function getAccessData (redirectUrl, code) {
  const { body } = await got({
    method: 'POST',
    url: `${process.env.CANVAS_HOST}/login/oauth2/token`,
    json: true,
    body: {
      grant_type: 'authorization_code',
      client_id: process.env.CANVAS_CLIENT_ID,
      client_secret: process.env.CANVAS_CLIENT_SECRET,
      redirect_url: redirectUrl,
      code: code,
      replace_tokens: true
    }
  })

  return {
    token: body.access_token,
    userId: body.user.id,
    realUserId: body.real_user && body.real_user.id
  }
}

const oauth1 = redirectPath =>
  function oauth1Middleware (req, res) {
    if (!req.body) {
      throw new ClientError(
        'missing_body',
        'Missing body in the request. Probably the page has been accessed outside from Canvas'
      )
    }

    if (!req.body.custom_canvas_course_id) {
      throw new ClientError(
        'missing_attribute',
        'Missing attribute "custom_canvas_course_id". Probably the page has been accessed outside from Canvas'
      )
    }

    const courseId = req.body.custom_canvas_course_id
    log.info(`App launched for course ${courseId}`)

    const callbackUrl = new URL(
      `${req.baseUrl}${redirectPath}`,
      process.env.PROXY_BASE
    )

    callbackUrl.search = querystring.stringify({
      course_id: courseId
    })

    log.info('Next URL will be %s', callbackUrl)

    const url = new URL('/login/oauth2/auth', process.env.CANVAS_HOST)
    url.search = querystring.stringify({
      client_id: process.env.CANVAS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: callbackUrl.toString()
    })

    log.info('Redirecting to %s', url)

    res.redirect(url)
  }

const oauth2 = redirectPath =>
  async function oauth2Middleware (req, res, next) {
    if (!req.query || !req.query.course_id) {
      throw new ClientError(
        'missing_query_parameters',
        'Missing query parameter [course_id]'
      )
    }

    if (req.query.error && req.query.error === 'access_denied') {
      throw new ClientError(
        'access_denied',
        'The user has not authorized the app. Obtained query parameter [error=access_denied]'
      )
    }

    if (req.query.error) {
      throw new ClientError(
        'unknown_oauth_error',
        `Unexpected query parameter [error=${req.query.error}] received from Canvas`
      )
    }

    if (!req.query.code) {
      throw new ClientError(
        'unknown_oauth_error',
        'Missing query parameter [code]'
      )
    }

    const callbackUrl = new URL(
      `${req.baseUrl}${redirectPath}`,
      process.env.PROXY_BASE
    )

    const { token, userId, realUserId } = await getAccessData(
      callbackUrl.toString(),
      req.query.code
    )

    const accessData = {
      token,
      userId,
      realUserId,
      courseId: req.query.course_id
    }
    res.cookie('access_data', accessData, { signed: true })
    next()
  }

module.exports = redirectPath => ({
  oauth1: oauth1(redirectPath),
  oauth2: oauth2(redirectPath)
})
