import React, { useState } from 'react'
import Table from './Table'
import { useFetch } from './react-hooks'
import { RightIcon } from './Icons'

function Select ({ name, onChange, options, label }) {
  function changeHandler (event) {
    if (event.target.value !== 'X') {
      onChange(event)
    }
  }

  return (
    <div className='select-wrapper'>
      <select name={name} onChange={changeHandler} className='custom-select'>
        <option value='X'>{label}</option>
        {options.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}

function Form ({ courseId, onSubmit = () => {} }) {
  function handleSubmit (event) {
    onSubmit({
      selectedAssignment,
      selectedModule,
      examinationDate
    })

    event.preventDefault()
  }

  const { loading, error, data } = useFetch(
    `api/course-info?course_id=${courseId}`
  )

  const [selectedAssignment, setAssignment] = useState(null)
  const [selectedModule, setModule] = useState(null)
  const [examinationDate, setExaminationDate] = useState('')

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error</div>

  const showTable = selectedAssignment && selectedModule

  return (
    <form method='post' onSubmit={handleSubmit}>
      <h2>From where to where do you want to transfer grades?</h2>
      <div className='form-row align-items-center'>
        <div className='col-4 my-1 form-select'>
          <label>Source</label>
          <Select
            name='canvas_assignment'
            onChange={event => setAssignment(event.target.value)}
            label='Select an assignment in Canvas'
            options={data.canvasAssignments}
          />
        </div>
        <div className='col-auto mt-2'>
          <RightIcon />
        </div>
        <div className='col-4 my-1 form-select'>
          <label>Destination</label>
          <Select
            name='ladok_module'
            onChange={event => setModule(event.target.value)}
            label='Select a module in Ladok'
            options={data.ladokModules}
          />
        </div>
      </div>

      <h2>Examination Date</h2>
      <p>
        Required field. When exporting to Ladok, all students will receive the
        same Examination Date. If you need to set a different date individually,
        please change it in Ladok after exporting.
      </p>
      <input
        name='examination_date'
        type='date'
        value={examinationDate}
        onChange={event => setExaminationDate(event.target.value)}
      />

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

export default Form
