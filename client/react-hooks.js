import { useState, useEffect } from 'react'

export function useFetch (url, options = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  async function fetchData () {
    if (!url) {
      return
    }

    setLoading(true)

    window
      .fetch(url, options)
      .then(r => {
        if (!r.ok) {
          throw new Error(r.statusText)
        }
        return r
      })
      .then(r => r.json())
      .then(body => {
        setData(body)
        setLoading(false)
      })
      .catch(r => {
        setError(r)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [url])

  return { loading, error, data }
}

export function useLazyFetch () {
  const [params, setParams] = useState({ url: null, options: {} })
  const { loading, error, data } = useFetch(params.url, params.options)

  function doFetch (url, options) {
    setParams({ url, options })
  }

  return [{ loading, error, data }, doFetch]
}
