import React from 'react'

function FeedbackTable ({ data }) {
  const sortedList = data
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  const success = data.filter(r => r.success)
  const failed = data.filter(r => !r.success)

  return (
    <table border='1'>
      <caption>
        <p>Grades of {success.length} students have been updated.</p>
        <p>{failed.length} failed</p>
      </caption>
      <thead>
        <tr>
          <th>Name</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {sortedList.map((row, i) => (
          <tr key={i}>
            <td>{row.name}</td>
            <td>
              {row.success ? `Updated grade to "${row.ladokGrade}"` : 'Failed'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default FeedbackTable
