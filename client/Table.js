import React from 'react'

function Table ({ assignment, module, data, date }) {
  const sortedList = data
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  return (
    <>
      <p>
        <span className='font-weight-bold'>Selected examination date:</span>{' '}
        {date}
      </p>
      <div className='table-container'>
        <table border='1'>
          <caption>Number of students: {sortedList.length}</caption>
          <thead>
            <tr>
              <th>Student</th>
              <th>Canvas: {assignment.name}</th>
              <th>Ladok: {module.name}</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.map((row, i) => (
              <tr key={i}>
                <td>{row.name}</td>
                <td>{row.canvasGrade}</td>
                <td>{row.ladokGrade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default Table
