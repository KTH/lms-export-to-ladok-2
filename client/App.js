import React, { useState } from 'react'
import Table from './Table'
import { useFetch } from './react-hooks'

function Select ({ name, onChange, options, label }) {
  function changeHandler (event) {
    if (event.target.value !== 'X') {
      onChange(event)
    }
  }

  return (
    <select name={name} onChange={changeHandler}>
      <option value='X'>{label}</option>
      {options.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  )
}

function App ({ courseId }) {
  const { loading, error, data } = useFetch(
    `api/course-info?course_id=${courseId}`
  )

  const [selectedAssignment, setAssignment] = useState(null)
  const [selectedModule, setModule] = useState(null)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error</div>

  const showTable = selectedAssignment && selectedModule

  return (
    <form method='post'>
      <h2>Canvas assignment</h2>
      <Select
        name='canvas_assignment'
        onChange={event => setAssignment(event.target.value)}
        label='Select an assignment in Canvas'
        options={data.canvasAssignments}
      />
      <h2>Ladok Module</h2>
      <Select
        name='ladok_module'
        onChange={event => setModule(event.target.value)}
        label='Select an module in Ladok'
        options={data.ladokModules}
      />
      <h2>Examination Date</h2>
      <p>
        Required field. When exporting to Ladok, all students will receive the
        same Examination Date. If you need to set a different date individually,
        please change it in Ladok after exporting.
      </p>
      <input name='examination_date' type='date' required />

      <input type='hidden' name='course_id' value={courseId} />

      <h2>Click to export</h2>
      <button type='submit'>Export to Ladok</button>

      <h2>Here you can see the grades of the selected assignment/module</h2>
      {showTable && (
        <Table
          course={courseId}
          assignment={selectedAssignment}
          module={selectedModule}
        />
      )}
    </form>
  )
}

export default App
