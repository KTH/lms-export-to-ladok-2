import { useState, useEffect } from "react";

// eslint-disable-next-line import/prefer-default-export
export function useFetch(initialParams, initialData) {
  const [params, setParams] = useState(initialParams);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(initialData);

  useEffect(() => {
    async function fetchData() {
      setError(false);
      setLoading(true);

      const options = { method: params.method || "GET" };
      if (params.body) {
        options.body = JSON.stringify(params.body);
        options.headers = {
          "Content-Type": "application/json",
        };
      }

      try {
        const response = await window.fetch(params.url, options);

        if (response.ok) {
          setData(await response.json());
        } else {
          setError(await response.json());
        }
      } catch (err) {
        setError(err);
      }

      setLoading(false);
    }

    if (params && params.url) {
      fetchData();
    }
  }, [params]);

  return [{ data, loading, error }, setParams];
}
