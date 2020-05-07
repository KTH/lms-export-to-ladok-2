import { hot } from 'react-hot-loader/root'
import React, { useState } from 'react'
import WizardResult from './wizard-result'
import { useFetch } from './react-hooks'
import WizardFormWithoutModule from './wizard-form-without-module'
import WizardFormWithModule from './wizard-form-with-module'
import WizardPreview from './wizard-preview'

function useFetchCourseInfo (initialState) {
  return useFetch({ url: 'api/course-info' }, initialState)[0]
}

function useFetchGrades (initialState) {
  const [response, fetch] = useFetch(null, initialState)

  function fetchGrades (assignmentId, moduleId) {
    if (moduleId) {
      fetch({
        url: `api/table?assignmentId=${assignmentId}&moduleId=${moduleId}`
      })
    } else {
      fetch({ url: `api/table?assignmentId=${assignmentId}` })
    }
  }

  return [response, fetchGrades]
}

function useSubmitGrades (initialState) {
  const [response, fetch] = useFetch(null, initialState)

  function submitGrades (body) {
    fetch({ url: `api/submit-grades`, method: 'POST', body })
  }

  return [response, submitGrades]
}

function App () {
  // Definition of the state

  // Current page of the app
  // What the user is seeing right now
  // 1 = the form to choose assignment, module and examination date
  // 2 = a table to see the grades to be transferred
  // 3 = a final screen as a result of the transfer
  const [currentPage, setCurrentPage] = useState(1)

  // Information about the course.
  // What assignments and modules can the user choose from
  const course = useFetchCourseInfo({
    assignments: [],
    modules: []
  })

  // User selection.
  // What the user has chosen
  const [userSelection, setSelection] = useState({
    assignment: -1,
    module: -1,
    examinationDate: ''
  })

  // Grades
  // What are the grades that the app will try to transfer
  const [grades, fetchGrades] = useFetchGrades([])

  // Result of the transfer
  // How the actual transfer is going on
  const [submissionResponse, submitGrades] = useSubmitGrades(null)

  function previewResult (selection) {
    console.log(selection)
    const assignmentId = course.data.assignments[selection.assignment].id
    const moduleId =
      course.data.modules.length === 0
        ? null
        : course.data.modules[selection.module].uid

    fetchGrades(assignmentId, moduleId)

    setSelection(selection)
    setCurrentPage(2)
  }

  function confirmTransfer () {
    const selectedAssignment = course.data.assignments[userSelection.assignment]
    const examinationDate = userSelection.examinationDate

    if (course.data.modules.length > 0) {
      const selectedModule = course.data.modules[userSelection.module]
      const confirm = window.confirm(
        `
        You are about to transfer grades for:
        Canvas assignment:${selectedAssignment.name}
        Ladok module: ${selectedModule.code}
        Examination Date: ${examinationDate}

        Do you want to proceed?`
      )

      if (confirm) {
        submitGrades({
          assignmentId: selectedAssignment.id,
          moduleId: selectedModule.uid,
          examinationDate
        })
        setCurrentPage(3)
      }
    } else {
      const confirm = window.confirm(
        `
        You are about to transfer grades for:
        Canvas assignment: ${selectedAssignment.name}
        Examination Date: ${examinationDate}

        Do you want to proceed?`
      )

      if (confirm) {
        submitGrades({
          assignmentId: selectedAssignment.id,
          examinationDate
        })
        setCurrentPage(3)
      }
    }
  }

  function startOver () {
    setSelection({
      assignment: -1,
      module: -1,
      examinationDate: ''
    })
    setCurrentPage(1)
  }

  //
  // From here everything is visualization
  //

  if (course.loading) return <div className='loader'>Loading...</div>
  if (course.error) return <div>An error occurred: {course.error}</div>

  if (currentPage === 0) {
    return (
      <h1 className='alert alert-success'>
        Transfer cancelled. You can safely leave this page.
      </h1>
    )
  } else if (currentPage === 1 && course.data.examinations.length > 0) {
    return (
      <WizardFormWithoutModule
        options={course.data}
        selection={userSelection}
        onSubmit={selection => {
          previewResult(selection)
        }}
        onCancel={() => setCurrentPage(0)}
      />
    )
  } else if (currentPage === 1 && course.data.modules.length > 0) {
    return (
      <WizardFormWithModule
        options={course.data}
        selection={userSelection}
        onSubmit={selection => {
          previewResult(selection)
        }}
        onCancel={() => setCurrentPage(0)}
      />
    )
  } else if (currentPage === 2) {
    const origin = course.data.assignments[userSelection.assignment].name
    const destination =
      course.data.modules.length > 0
        ? course.data.modules[userSelection.module].code
        : `${course.data.examinations.length} examinations`

    return (
      <WizardPreview
        origin={origin}
        destination={destination}
        examinationDate={userSelection.examinationDate}
        onBack={() => setCurrentPage(1)}
        onCancel={() => setCurrentPage(0)}
        onSubmit={() => confirmTransfer()}
        grades={grades}
      />
    )
  } else if (currentPage === 3) {
    const origin = course.data.assignments[userSelection.assignment].name
    const destination =
      course.data.modules.length > 0
        ? course.data.modules[userSelection.module].code
        : `${course.data.examinations.length} examinations`

    return (
      <WizardResult
        origin={origin}
        destination={destination}
        examinationDate={userSelection.examinationDate}
        onContinue={startOver}
        submissionResponse={submissionResponse}
      />
    )
  }
}

export default hot(App)
