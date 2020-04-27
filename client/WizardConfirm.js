import React from 'react'
import Table from './Table'

function WizardConfirm ({
  setCurrentPage,
  selectedAssignment,
  selectedModule,
  examinationDate
}) {
  const showTable = selectedAssignment && selectedModule

  const tableFooter = (
    <div className='button-section'>
      <button
        type='button'
        className='btn btn-back btn-secondary grid-col-1'
        onClick={() => setCurrentPage(1)}
      >
        Assignments and Date
      </button>
      <button
        type='button'
        className='btn btn-secondary grid-col-2'
        onClick={() => setCurrentPage(0)}
      >
        Cancel
      </button>
      <button
        className='btn btn-primary grid-col-3'
        onClick={() => {
          if (
            window.confirm(
              `
              You are about to transfer grades for:
              Canvas assignment:${selectedAssignment.name}
              Ladok module: ${selectedModule.name}
              Examination Date: ${examinationDate}

              Do you want to proceed?`
            )
          ) {
            setCurrentPage(3)
          } else {
            setCurrentPage(1)
          }
        }}
      >
        Transfer to Ladok
      </button>
    </div>
  )

  return (
    <div className='form'>
      <h2>Transfer grades (Step 2 of 2)</h2>
      <p>
        The list below represents what the application will transfer from Canvas
        to draft status in Ladok once you click the <i>Transfer to Ladok</i>{' '}
        button.
      </p>
      <div className='alert alert-info' aria-live='polite' role='alert'>
        <p>
          Note that the grades of students are based on data fetched from Canvas
          Gradebook during launch of this application. If you have entered a
          grade very recently and it is missing, you might have to relaunch the
          application.
        </p>
      </div>
      {showTable && (
        <Table
          assignment={selectedAssignment}
          module={selectedModule}
          date={examinationDate}
        />
      )}
      {showTable && tableFooter}
    </div>
  )
}

export default WizardConfirm
