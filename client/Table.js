import React from 'react'
import { useFetch } from './react-hooks'

function Table ({ course, assignment, module, date }) {
  const { loading, error, data } = useFetch(
    `api/table?course_id=${course}&assignment_id=${assignment.id}&module_id=${module.id}`
  )

  if (loading) return <div className='loader'>Loading...</div>

  if (error) return <div>An error occurred: {error.error}</div>

  const sortedList = data
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  const studentRows = []
  for (const student of sortedList) {
    const isTransferrable =
      student.ladokGradeData.existsAsDraft &&
      student.canvasGrade &&
      student.canvasGrade.toUpperCase() !==
        student.ladokGradeData.letter.toUpperCase()
    studentRows.push({ student, isTransferrable })
  }
  return (
    <>
      <p>
        From: <span className='font-weight-bold'>{assignment.name}</span>
        <br />
        To: <span className='font-weight-bold'>{module.name}</span>
        <br />
        Selected examination date:&nbsp;
        <span className='font-weight-bold'>{date}</span>
      </p>
      <div className='table-container'>
        <table border='1'>
          <caption>
            Can export {studentRows.filter(row => row.isTransferrable).length}/
            {studentRows.length} grades:
          </caption>
          <thead>
            <tr>
              <th className='table-col-1'>Student</th>
              <th className='table-col-2'>Canvas grade</th>
              <th className='table-col-3'>Transferrable</th>
            </tr>
          </thead>
          <tbody>
            {studentRows.map((row, i) => (
              <tr
                key={i}
                className={row.isTransferrable ? 'do-export-row' : ''}
              >
                <td className='table-col-1'>{row.student.name}</td>
                <td className='table-col-2'>{row.student.canvasGrade}</td>
                <td className='table-col-3'>
                  {row.isTransferrable ? 'Yes' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default Table
