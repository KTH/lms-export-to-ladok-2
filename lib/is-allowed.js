const log = require('skog')
const got = require('got')
const memoizee = require('memoizee')

const CanvasAPI = require('@kth/canvas-api')
const ladok = got.extend({
  baseUrl: process.env.LADOK_API_BASEURL,
  json: true,
  pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, 'base64'),
  passphrase: process.env.LADOK_API_PFX_PASSPHRASE
})

async function listReportersRaw () {
  const { body } = await ladok.get(
    `/kataloginformation/behorighetsprofil/${process.env.LADOK_REPORTER_PROFILE_UID}/koppladeanvandare`
  )

  const users = {}
  body.Anvandare.forEach(user => {
    users[user.Anvandarnamn] = {
      Uid: user.Uid,
      Fornamn: user.Fornamn,
      efternamn: user.Efternamn
    }
  })

  return users
}

/** Get all Ladok reporters */
const listReporters = memoizee(listReportersRaw, {
  maxAge: 15 * 60 * 1000
})

async function isAllowedInCanvas (token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)

  // These are role IDs mapped to roles in Canvas.
  const EXAMINER = 10
  const TEACHER = 4
  const COURSE_RESPONSIBLE = 9

  const enrollments = await canvas
    .list(`/courses/${courseId}/enrollments`, { user_id: 'self' })
    .toArray()

  const allowedRoles = enrollments
    .map(enrollment => parseInt(enrollment.role_id, 10))
    .filter(
      role =>
        role === EXAMINER || role === TEACHER || role === COURSE_RESPONSIBLE
    )

  log.info(`The user has the roles: ${allowedRoles}`)

  if (allowedRoles.length === 0) {
    log.info(
      'The user is not allowed in Canvas. Only teachers and similar roles can use this app.'
    )
    return false
  }

  return true
}

async function isAllowedInLadok (token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token)
  const { body: currentUser } = await canvas.get('/users/self')
  log.info('currentUser', currentUser)

  // get more information about the user that clicked the button
  const { body: user } = await canvas.get(
    `/courses/${courseId}/users/${currentUser.id}`
  )

  log.info('login_id for currentUser:', user.login_id)

  const reporters = await listReporters()
  const ladokReporter = reporters[user.login_id]
  if (ladokReporter) {
    log.info('The user is one of the result reporters in Ladok', ladokReporter)
    return true
  } else {
    log.warn(
      'Could not find this user among the ladok reporters in Ladok. The user is probably missing the profile in Ladok, and is not allowed to run the report'
    )
    return false
  }
}

async function isAllowed (token, courseId) {
  try {
    const results = await Promise.all([
      isAllowedInCanvas(token, courseId),
      isAllowedInLadok(token, courseId)
    ])

    return results[0] && results[1]
  } catch (e) {
    log.error(e)
    return false
  }
}

module.exports = {
  isAllowedInCanvas,
  isAllowedInLadok,
  isAllowed
}
