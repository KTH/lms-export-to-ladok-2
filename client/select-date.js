import React, { useCallback } from 'react'
import { parse, format } from 'date-fns'

const SelectDate = ({ examinationDate, setExaminationDate, dateFormat }) => {
  const formatDate = useCallback(
    date => format(parse(date, dateFormat, new Date()), dateFormat),
    [parse, format]
  )

  const setDate = useCallback(
    e => setExaminationDate(formatDate(e.target.value)),
    []
  )

  return (
    <input
      name='examination_date '
      className='form-control'
      type='date'
      placeholder='YYYY-MM-DD'
      value={examinationDate}
      onChange={setDate}
      required
    />
  )
}

export default SelectDate
