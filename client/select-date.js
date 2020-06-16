import React from 'react'
import DatePicker from 'react-datepicker'
import { format } from 'date-fns'

const DATE_FORMAT = 'yyyy-MM-dd'

export default function SelectDate ({ examinationDate, setExaminationDate }) {
  const setDate = date => setExaminationDate(format(date, DATE_FORMAT))

  return (
    <DatePicker
      dateFormat={DATE_FORMAT}
      selected={examinationDate ? new Date(examinationDate) : null}
      onChange={setDate}
      placeholderText='YYYY-MM-DD'
    />
  )
}
