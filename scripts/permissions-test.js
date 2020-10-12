require('dotenv').config()
const got = require('got')

async function start () {
  console.log('Hello world')

  const ladokGot = got.extend({
    baseUrl: process.env.LADOK_API_BASEURL,
    json: true,
    pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, 'base64'),
    passphrase: process.env.LADOK_API_PFX_PASSPHRASE,
    headers: {
      Accept: 'application/vnd.ladok-kataloginformation+json'
    }
  })

  const { body } = await ladokGot.get(
    `/kataloginformation/behorighetsprofil/0997fd42-7488-11e8-920e-2de0ccaf48ac/koppladeanvandare`
  )

  console.log(body)
}

start()
