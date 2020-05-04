import React from 'react'
import Table from './table'

function TableFooter ({ onBack, onSubmit, onCancel }) {
  return (
    <div className='button-section'>
      <button
        type='button'
        className='btn btn-back btn-secondary grid-col-1'
        onClick={onBack}
      >
        Assignments and Date
      </button>
      <button
        type='button'
        className='btn btn-secondary grid-col-2'
        onClick={onCancel}
      >
        Cancel
      </button>
      <button className='btn btn-primary grid-col-3' onClick={onSubmit}>
        Transfer to Ladok
      </button>
    </div>
  )
}

function WizardConfirm ({
  origin,
  destination,
  examinationDate,
  grades,
  onBack,
  onSubmit,
  onCancel
}) {
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
      <p>
        From: <span className='font-weight-bold'>{origin}</span>
        <br />
        To: <span className='font-weight-bold'>{destination}</span>
        <br />
        Selected examination date:&nbsp;
        <span className='font-weight-bold'>{examinationDate}</span>
      </p>
      <Table {...grades} />
      <TableFooter {...{ onCancel, onBack, onSubmit }} />
    </div>
  )
}

export default WizardConfirm
