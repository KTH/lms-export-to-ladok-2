const log = require('skog')
const { ClientError } = require('../lib/errors')

async function denyActAs (req, res, next) {
  const accessData = req.accessData || req.signedCookies.access_data

  if (accessData.realUserId && accessData.userId !== accessData.realUserId) {
    throw new ClientError(
      'not_allowed',
      'You are not allowed to use this app in Masquerade mode ("acting as" a different user)'
    )
  }
  next()
}

module.exports = {
  denyActAs
}
