import { useState, useEffect } from 'react'

export function useFetch (url, method, body) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  async function fetchData () {
    setLoading(true)
    const options = { method: method || 'GET' }
    if (body) {
      options.body = JSON.stringify(body)
      options.headers = {
        'Content-Type': 'application/json'
      }
    }
    let isOk
    window
      .fetch(url, options)
      .then(r => {
        isOk = r.ok
        return r
      })
      .then(r => r.json())
      .then(body => {
        if (isOk) {
          setData(body)
        } else {
          setError(body)
        }
      })
      .catch(r => {
        setError(r)
      })
      .finally(r => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [url])

  return { loading, error, data }
}
