import { hot } from 'react-hot-loader/root';
import React, { useState } from 'react'
import Table from './Table'
import { useFetch, useValidatedState } from './react-hooks'

function App({ courseId }) {
  const { loading, error, data } = useFetch(
    `api/course-info?course_id=${courseId}`
  )

  const [selectedAssignment, setAssignment] = useState(null)
  const [selectedModule, setModule] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error</div>

  const allAssignments = [

  ].concat(data.canvasAssignments)

  const allModules = [].concat(
    data.ladokModules
  )

  const showTable = selectedAssignment && selectedModule

  let nextButton
  if (!selectedAssignment) {
    nextButton = <input type="button" disabled title="Choose an assignment in Canvas first" className="btn btn-info" value="Show students and results →"></input>
  } else if (!selectedModule) {
    nextButton = <input type="button" disabled title="Choose a module in Ladok first" className="btn btn-info" value="Show students and results →"></input>
  } else {
    nextButton = <input type="button" className="btn btn-info" onClick={event => setCurrentPage(2)} value="Show students and results →"></input>
  }

  const content1 = <div className="form-group">
    <h1>Choose which assignment to Export, to which Ladok module (Step 1 of 2)</h1>
    <h2>Canvas assignment:</h2>
    <p>Note that only letter grades will be sent to Ladok</p>
    <select
      className={selectedAssignment ? "form-control " : "form-control required_input"}
      value=""
      name='canvas_assignment'
      onChange={event => setAssignment(event.target.value)}
    >
      <option value="" disabled hidden>Choose assignment</option>
      {allAssignments.map(assignment => (
        <option key={assignment.id} value={assignment.id}>
          {assignment.name}
        </option>
      ))}
    </select>
    <h2>Ladok Module</h2>
    <p>To which Ladok module do you want the results to be exported?</p>
    <select
      className={selectedModule ? "form-control " : "form-control required_input"}
      name='ladok_module'
      value=""
      onChange={event => setModule(event.target.value)}
    >
      <option value="" disabled hidden>Choose Ladok module</option>
      {allModules.map(ladokModule => (
        <option key={ladokModule.id} value={ladokModule.id}>
          {ladokModule.name} - {ladokModule.title}
        </option>
      ))}
    </select>
    <h2>Examination Date</h2>
    <p>
      Required field. When exporting to Ladok, all students will receive the
      same Examination Date. If you need to set a different date individually,
      please change it in Ladok after exporting.
</p>
    <input name='examination_date' className="form-control" type='date' required />

    <input type='hidden' name='course_id' value={courseId} />
    <input type="button" className="btn btn-warn" onClick={event => setCurrentPage(0)} value="Cancel"></input>
    {nextButton}

  </div>

  const content2 = <div className="form-group">
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
  </div>

  if (currentPage === 1) {
    content = content1
  } else if (currentPage === 2) {
    content = content2
  }

  return (
    <div>
      {content}
    </div>
  )
}

export default hot(App)

