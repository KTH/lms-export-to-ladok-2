import React from 'react'
import AssignmentSelector from './assignment-selector'
import ModuleSelector from './module-selector'

function WizardForm ({
  setCurrentPage,
  examinationDate,
  setExaminationDate,
  selectedModule,
  setModule,
  allModules,
  selectedAssignment,
  setAssignment,
  allAssignments
}) {
  let disabled = false
  let title = ''
  let buttonClassNames = 'btn btn-next btn-success grid-col-3'

  if (selectedAssignment === -1) {
    disabled = true
    title = 'Select an assignment in Canvas first'
    buttonClassNames += ' disabled'
  } else if (selectedModule === -1) {
    disabled = true
    title = 'Select a module in Ladok first'
    buttonClassNames += ' disabled'
  } else if (!examinationDate) {
    disabled = true
    title = 'Select an examination date first'
    buttonClassNames += ' disabled'
  }

  const nextButton = (
    <button
      className={buttonClassNames}
      disabled={disabled}
      title={title}
      onClick={() => setCurrentPage(2)}
    >
      Students
    </button>
  )

  return (
    <div className='form-group form-select'>
      <h1>Select assignment and date (Step 1 of 2)</h1>
      <p>
        To be able to transfer grades to from Canvas to Ladok, you need to map a
        Canvas assignment to a Ladok module. Please select both a Canvas
        assignment as source, a Ladok module as target and an examination date
        for the grades to be transfered, before you can proceed.
      </p>
      <h2>Canvas assignment</h2>
      <p>
        Note that only letter grades will be transfered to Ladok (A-F & P/F)
      </p>
      <AssignmentSelector
        assignments={allAssignments}
        onChange={setAssignment}
        value={selectedAssignment}
      />

      <h2>Ladok Module</h2>
      <p>To which Ladok module do you want the grades to be transferred?</p>

      <ModuleSelector
        modules={allModules}
        onChange={setModule}
        value={selectedModule}
      />
      <h2>Examination Date</h2>
      <p>
        When transferring to Ladok, all affected grades will receive the same
        Examination Date. If you need to set a different date on an individual
        level, please change it in Ladok after transferring.
      </p>
      <input
        name='examination_date '
        className='form-control'
        type='date'
        value={examinationDate}
        onChange={event => setExaminationDate(event.target.value)}
        required
      />
      <div className='button-section'>
        <button
          className='btn btn-secondary grid-col-2'
          onClick={event => setCurrentPage(0)}
        >
          Cancel
        </button>
        {nextButton}
      </div>
    </div>
  )
}

export default WizardForm
