import React from 'react'

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
  let buttonClassNames = 'btn btn-success grid-col-3'
  if (!selectedAssignment) {
    disabled = true
    title = 'Select an assignment in Canvas first'
    buttonClassNames += ' disabled'
  } else if (!selectedModule) {
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
      Students →
    </button>
  )

  return (
    <div className='form-group form-select'>
      <h1>Select assignment and date (Step 1 of 2)</h1>
      <h2>Canvas assignment</h2>
      <p>Note that only letter grades will be sent to Ladok</p>
      <div className='select-wrapper'>
        <select
          className='custom-select'
          value={(selectedAssignment && selectedAssignment.id) || ''}
          name='canvas_assignment'
          onChange={event =>
            setAssignment({
              id: event.target.value,
              name: event.target.selectedOptions[0].text
            })
          }
        >
          <option value='' disabled hidden>
            Select assignment
          </option>
          {// sort letter grade first, then the rest grouped by grading type
          allAssignments
            .sort((a, b) => {
              if (a.grading_type === 'letter_grade') {
                return -1
              } else if (b.grading_type === 'letter_grade') {
                return 1
              } else {
                return a.name.localeCompare(b.name)
              }
            })
            .map(assignment => (
              <option
                key={assignment.id}
                value={assignment.id}
                disabled={!assignment.published}
              >
                {}
                {assignment.name}: {assignment.grading_type.replace('_', ' ')}
                {assignment.published ? '' : ' NOT PUBLISHED'}
              </option>
            ))}
        </select>
      </div>
      <h2>Ladok Module</h2>
      <p>To which Ladok module do you want the results to be exported?</p>
      <div className='select-wrapper'>
        <select
          className='custom-select'
          name='ladok_module'
          value={(selectedModule && selectedModule.id) || ''}
          onChange={event =>
            setModule({
              id: event.target.value,
              name: event.target.selectedOptions[0].text
            })
          }
        >
          <option value='' disabled hidden>
            Select Ladok module
          </option>
          {allModules.map(ladokModule => (
            <option key={ladokModule.id} value={ladokModule.id}>
              {ladokModule.name} - {ladokModule.title}
            </option>
          ))}
        </select>
      </div>
      <h2>Examination Date</h2>
      <p>
        Required field. When exporting to Ladok, all effected results will
        receive the same Examination Date. If you need to set a different date
        individually, please change it in Ladok after exporting. Note that only
        changed results will get this examination date.
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
