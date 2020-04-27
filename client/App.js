import { hot } from 'react-hot-loader/root'
import React, { useState } from 'react'
import WizardResult from './WizardResult'
import { useFetch } from './react-hooks'
import WizardForm from './WizardForm'
import WizardConfirm from './WizardConfirm'

function App () {
  const { loading, error, data } = useFetch(`api/course-info`)

  const [selectedAssignment, setAssignment] = useState(null)
  const [selectedModule, setModule] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [examinationDate, setExaminationDate] = useState('')

  if (loading) return <div className='loader'>Loading...</div>
  if (error) return <div>An error occurred: {error.error}</div>

  const allAssignments = data.canvasAssignments
  const allModules = data.ladokModules
  const courseUrl = data.url

  function setModuleId (moduleId) {
    const module = allModules.find(m => m.id === moduleId)
    setModule(module)
  }

  function setAssignmentId (assignmentId) {
    const assignment = allAssignments.find(
      a => a.id === parseInt(assignmentId, 10)
    )
    setAssignment(assignment)
  }

  if (!selectedModule && allModules.length === 1) {
    setModuleId(allModules[0].id)
  }

  if (
    !examinationDate &&
    allModules.length === 1 &&
    allModules[0].examinationDate
  ) {
    setExaminationDate(allModules[0].examinationDate)
  }

  if (currentPage === 0) {
    return (
      <h1 className='alert alert-success'>
        Transfer cancelled. You can safely leave this page.
      </h1>
    )
  } else if (currentPage === 1) {
    return (
      <WizardForm
        setCurrentPage={setCurrentPage}
        examinationDate={examinationDate}
        setExaminationDate={setExaminationDate}
        selectedModule={selectedModule}
        setModule={setModuleId}
        allModules={allModules}
        selectedAssignment={selectedAssignment}
        setAssignment={setAssignmentId}
        allAssignments={allAssignments}
        courseUrl={courseUrl}
      />
    )
  } else if (currentPage === 2) {
    return (
      <WizardConfirm
        setCurrentPage={setCurrentPage}
        selectedAssignment={selectedAssignment}
        selectedModule={selectedModule}
        examinationDate={examinationDate}
      />
    )
  } else if (currentPage === 3) {
    return (
      <WizardResult
        selectedAssignment={selectedAssignment}
        selectedModule={selectedModule}
        examinationDate={examinationDate}
        setCurrentPage={setCurrentPage}
      />
    )
  }
}

export default hot(App)
