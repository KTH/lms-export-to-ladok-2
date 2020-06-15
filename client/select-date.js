import React, { useCallback } from 'react'
import DatePicker from 'react-datepicker'
import { format } from 'date-fns'

const SelectDate = ({ examinationDate, setExaminationDate, dateFormat }) => {
  const setDate = useCallback(
    date =>
      setExaminationDate(
        format(
          new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          dateFormat
        )
      ),
    [format]
  )

  const dateFromString = useCallback(date => {
    if (!date.length) {
      return ''
    }
    return new Date(date)
  }, [])

  return (
    <DatePicker
      dateFormat={dateFormat}
      selected={dateFromString(examinationDate)}
      onChange={date => setDate(date)}
      placeholderText='YYYY-MM-DD'
    />
  )
}

export default SelectDate
