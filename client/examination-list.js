import React from 'react'

function Item ({ examination }) {
  const courseCodes = Array.from(
    new Set(examination.modules.map(m => m.courseCode))
  ).join('/')

  const examCodes = Array.from(
    new Set(examination.modules.map(m => m.examCode))
  ).join('/')

  return (
    <li>
      {courseCodes} {examCodes}. {examination.name.en} / {examination.name.sv}
    </li>
  )
}

export default function ExaminationList ({ list }) {
  return (
    <ul>
      {list.map((item, i) => (
        <Item examination={item} key={i} />
      ))}
    </ul>
  )
}
