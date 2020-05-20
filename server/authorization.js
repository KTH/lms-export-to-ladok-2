const log = require('skog')
const isAllowed = require('../lib/is-allowed')
const {
  ClientError
} = require('../lib/errors')

async function denyActAs(req, res, next) {
  const accessData = req.accessData || req.signedCookies.access_data

  if (accessData.realUserId && accessData.userId !== accessData.realUserId) {
    throw new ClientError(
      'not_allowed',
      'You are not allowed to use this app in Masquerade mode ("acting as" a different user)'
    )
  }
  next()
}

async function authorize(req, res, next) {
  const accessData = req.signedCookies.access_data

  if (!accessData) {
    throw new ClientError(
      'no_cookie',
      'No access data found in request or cookie.'
    )
  }
  const courseId = accessData.courseId

  try {
    const allowedInLadok = await isAllowed.isAllowedInLadok(
      accessData.token,
      courseId
    )
    if (!allowedInLadok) {
      throw new ClientError(
        'not_allowed',
        'You must have permissions to write results in Ladok to use this function. Contact ladok@kth.se if you need help.'
      )
    }
    const allowedIncanvas = await isAllowed.isAllowedInCanvas(
      accessData.token,
      courseId
    )

    if (!allowedIncanvas) {
      throw new ClientError(
        'not_allowed',
        'Only teachers, examiners and course responsibles are allowed to use this app. Contact it-support@kth.se if you need help.'
      )
    }
  } catch (err) {
    if (err.code && err.code === 'not_allowed') {
      log.info('User is not authorized', err)
    } else {
      log.error('could not authorize user properly', err)
    }

    return next(err)
  }

  next()
}

module.exports = {
  authorize,
  denyActAs
}