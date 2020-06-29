async function denyActAs (req, res, next) {
  const accessData = req.accessData || req.signedCookies.access_data

  if (accessData.realUserId && accessData.userId !== accessData.realUserId) {
    res.status(400).send({
      message: 'You cannot send grades in masquerade ("act as") mode'
    })

    return
  }

  next()
}

module.exports = {
  denyActAs
}
