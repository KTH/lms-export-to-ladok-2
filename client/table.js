import React from 'react'
import Loader from './loader'

function Table ({ loading, error, data: table }) {
  if (loading) return <Loader reason='Fetching grades ...' />
  if (error) return <div>An error occurred: {error.error}</div>

  const sortedList = table
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .map(row => ({
      ...row,
      transferrable: row.grade && row.mode
    }))

  return (
    <div className='table-container'>
      <table>
        <caption>
          Can export {sortedList.filter(row => row.transferrable).length}/
          {sortedList.length} grades
        </caption>
        <thead>
          <tr>
            <th className='table-col-1'>Student</th>
            <th className='table-col-2'>Canvas grade</th>
            <th className='table-col-3'>Transferrable</th>
          </tr>
        </thead>
        <tbody>
          {sortedList.map((row, i) => (
            <tr key={i} className={row.transferrable ? 'do-export-row' : ''}>
              <td className='table-col-1'>{row.name}</td>
              <td className='table-col-2'>{row.grade}</td>
              <td className='table-col-3'>{row.transferrable ? 'Yes' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Table
