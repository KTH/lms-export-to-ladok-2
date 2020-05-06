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

/**
 * Gets the Ladok "Betyg object" matching a given letter grade in a given scale
 *
 * @param {number} scaleId Scale ID in Ladok
 * @param {string} grade Grade (e.g. "A" or "Fx")
 *
 * @returns {Promise<{
 *   Kod: string,
 *   ID: number
 * }>}
 */
async function getLadokGrade (scaleId, grade) {
  const allScales = await getGradingScales()
  const scale = allScales.find(s => parseInt(s.ID, 10) === scaleId)

  if (!scale || !scale.Betygsgrad) {
    return null
  }

  const ladokGrade = scale.Betygsgrad.find(
    g => g.Kod && g.Kod.toUpperCase() === grade.toUpperCase()
  )

  return ladokGrade
}

/**
 * Perform a request to a paginated "/sok" endpoint and returns the list of all
 * results of the search
 */
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
  getGradingScales,
  getLadokGrade
}
