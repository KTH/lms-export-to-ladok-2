import React from 'react'

export default function AssignmentSelector ({ assignments, onChange, value }) {
  let assignmentWarning = <p />

  if (value !== -1) {
    const selectedAssignment = assignments[value]

    if (selectedAssignment.type !== 'letter_grade') {
      assignmentWarning = (
        <div
          className='alert alert-danger fadein'
          aria-live='polite'
          role='alert'
        >
          You have chosen an assignment with{' '}
          <strong>{selectedAssignment.type}</strong> grading type. Only{' '}
          <strong>letter grades</strong> can be transferred to Ladok. If you
          want to use this assignment, you should{' '}
          <a href={selectedAssignment.link} target='_top'>
            edit the assignment
          </a>{' '}
          , change "Display Grade as" to letter grade, and choose either the
          <strong>"A-F grading scheme (including Fx)"</strong> or the{' '}
          <strong>"Pass/Fail grading scheme 80%".</strong>
        </div>
      )
    }
  }

  return (
    <div>
      <div className='select-wrapper'>
        <select
          className='custom-select'
          value={value}
          name='canvas_assignment'
          onChange={event => onChange(event.target.value)}
        >
          <option value={-1} disabled hidden>
            Select assignment
          </option>
          {// sort letter grade first, then the rest grouped by grading type
          assignments
            .sort((a, b) => {
              if (a.type === 'letter_grade') {
                return -1
              } else if (b.type === 'letter_grade') {
                return 1
              } else {
                return a.name.localeCompare(b.name)
              }
            })
            .map((assignment, i) => (
              <option key={i} value={i} disabled={!assignment.published}>
                {assignment.name}: {assignment.type.replace('_', ' ')}
                {assignment.published ? '' : ' NOT PUBLISHED'}
              </option>
            ))}
        </select>
      </div>
      {assignmentWarning}
    </div>
  )
}