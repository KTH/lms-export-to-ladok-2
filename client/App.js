import { hot } from 'react-hot-loader/root'
import React, { useState } from 'react'
import WizardResult from './WizardResult'
import { useFetch } from './react-hooks'
import WizardFormWithoutModule from './wizard-form-without-module'
import WizardFormWithModule from './wizard-form-with-module'
import WizardConfirm from './WizardConfirm'

function App () {
  const { loading, error, data } = useFetch(`api/course-info`)

  const [userSelection, setSelection] = useState({
    assignment: -1,
    module: -1,
    examinationDate: ''
  })

  const [currentPage, setCurrentPage] = useState(1)

  if (loading) return <div className='loader'>Loading...</div>
  if (error) return <div>An error occurred: {error.error}</div>

  if (currentPage === 0) {
    return (
      <h1 className='alert alert-success'>
        Transfer cancelled. You can safely leave this page.
      </h1>
    )
  } else if (currentPage === 1 && data.examinations.length > 0) {
    return (
      <WizardFormWithoutModule
        options={data}
        selection={userSelection}
        onSubmit={selection => setSelection(selection)}
        onCancel={() => setCurrentPage(0)}
      />
    )
  } else if (currentPage === 1 && data.modules.length > 0) {
    return (
      <WizardFormWithModule
        options={data}
        selection={userSelection}
        onSubmit={selection => setSelection(selection)}
        onCancel={() => setCurrentPage(0)}
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
