const memoizee = require('memoizee')
const got = require('got')

const ladokGot = got.extend({
  baseUrl: process.env.LADOK_API_BASEURL,
  json: true,
  pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, 'base64'),
  passphrase: process.env.LADOK_API_PFX_PASSPHRASE
})

async function gradingScalesRaw () {
  return ladokGot
    .get('/resultat/grunddata/betygsskala')
    .then(r => r.body.Betygsskala)
}

const getGradingScales = memoizee(gradingScalesRaw, { maxAge: 3600 * 1000 })

async function ladokSearch (endpoint, criteria) {
  let result = []

  let currentPage = 0
  let totalPages = 0
  const pageSize = 100

  do {
    currentPage++
    const { body } = await ladokGot(endpoint, {
      method: 'PUT',
      body: {
        ...criteria,
        Page: currentPage,
        Limit: pageSize
      }
    })

    result = [...result, ...body.Resultat]
    totalPages = Math.ceil(body.TotaltAntalPoster / pageSize)
  } while (currentPage <= totalPages)

  return result
}

module.exports = {
  ladokSearch,
  ladokGot,
  getGradingScales
}
