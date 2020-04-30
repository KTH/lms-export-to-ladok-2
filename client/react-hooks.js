import { useState, useEffect } from 'react'

export function useFetch (initialUrl, initialData, method, body) {
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(initialData)

  useEffect(() => {
    async function fetchData () {
      setError(false)
      setLoading(true)

      const options = { method: method || 'GET' }
      if (body) {
        options.body = JSON.stringify(body)
        options.headers = {
          'Content-Type': 'application/json'
        }
      }

      try {
        const response = await window.fetch(url, options)

        if (response.ok) {
          const data = await response.json()
          setData(data)
        } else {
          const error = await response.json()
          setError(error)
        }
      } catch (err) {
        setError(err)
      }

      setLoading(false)
    }

    if (url) {
      fetchData()
    }
  }, [url])

  return [{ data, loading, error }, setUrl]
}
