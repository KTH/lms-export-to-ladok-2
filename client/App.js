import { hot } from 'react-hot-loader/root'
import React, { useState } from 'react'
import WizardResult from './WizardResult'
import { useFetch } from './react-hooks'
import WizardForm from './WizardForm'
import WizardConfirm from './WizardConfirm'

function App () {
  const { loading, error, data } = useFetch(`api/course-info`)

  const [selectedAssignmentIndex, setAssignment] = useState(-1)
  const [selectedModuleIndex, setModule] = useState(-1)
  const [currentPage, setCurrentPage] = useState(1)
  const [examinationDate, setExaminationDate] = useState('')

  if (loading) return <div className='loader'>Loading...</div>
  if (error) return <div>An error occurred: {error.error}</div>

  const allAssignments = data.assignments
  const allModules = data.modules

  /*if (
    !examinationDate &&
    allModules.length === 1 &&
    allModules[0].examinationDate
  ) {
    setExaminationDate(allModules[0].examinationDate)
  }*/

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
        //
        examinationDate={examinationDate}
        setExaminationDate={setExaminationDate}
        //
        selectedModule={selectedModuleIndex}
        setModule={setModule}
        allModules={allModules}
        //
        selectedAssignment={selectedAssignmentIndex}
        setAssignment={setAssignment}
        allAssignments={allAssignments}
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
