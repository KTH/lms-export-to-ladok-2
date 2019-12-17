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

      {showTable && (
        <div className='my-5'>
          <h2>Ready to export</h2>
          <div>
            <h3>Examination date</h3>
            <p>
              Choose the "examination date" to be sent to Ladok. When exporting,
              all students will receive the same date. If you need to set a
              different date individually, please change it in Ladok after
              exporting.
            </p>
            <input
              name='examination_date'
              className='custom-control form-control d-inline w-auto'
              type='date'
              value={examinationDate}
              onChange={event => setExaminationDate(event.target.value)}
            />
          </div>
          <div className='form-row align-items-center my-2'>
            <div className='ml-auto'>
              <span className='mx-2'>
                You can compare below what is currently in Canvas and Ladok
              </span>
              <button
                type='submit'
                className='btn btn-primary btn-lg font-weight-bold'
              >
                Export to Ladok
              </button>
            </div>
          </div>
        </div>
      )}
      {showTable && (
        <div className='my-5'>
          <Table
            course={courseId}
            assignment={selectedAssignment}
            module={selectedModule}
          />
        </div>
      )}
    </form>
  )
}

export default Form
