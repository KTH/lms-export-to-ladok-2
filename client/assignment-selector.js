import React from 'react'

export default function AssignmentSelector ({ assignments, onChange, value }) {
  let assignmentWarning = <p />

  if (value !== -1) {
    const selectedAssignment = assignments.find(a => a.id === value)

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
          </a>
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
          onChange={event => onChange(parseInt(event.target.value, 10))}
        >
          <option value={-1} disabled hidden>
            Select assignment
          </option>
          {// sort letter grade first, then the rest grouped by grading type
          assignments
            .slice()
            .sort((a, b) => {
              if (a.type === 'letter_grade') {
                return -1
              } else if (b.type === 'letter_grade') {
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
