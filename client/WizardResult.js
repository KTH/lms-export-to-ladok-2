import React from 'react'
import { useFetch } from './react-hooks'

function WizardResult ({
  selectedAssignment,
  selectedModule,
  examinationDate,
  setCurrentPage
}) {
  const body = {
    canvas_assignment: selectedAssignment.id,
    ladok_module: selectedModule.id,
    examination_date: examinationDate
  }
  const { loading, error, data } = useFetch(`api/submitGrades`, 'POST', body)
  if (loading) return <div className='loader'>Loading...</div>
  if (error) {
    return (
      <>
        <div className='alert alert-danger' aria-live='polite' role='alert'>
          <h2>An error has occurred during the transfer.</h2>
          <p>
            No grades were transferred.
            <br />
            From: <strong>{selectedAssignment.name}</strong>
            <br />
            To: <strong>{selectedModule.name}</strong>
            <br />
            Examination date: <strong>{examinationDate}</strong>
          </p>
          <p>
            <strong>{error.error}</strong>
          </p>
          <p>
            <em>
              If you need help,{' '}
              <a href='mailto:it-support@kth.se'>contact IT support</a>, and
              include the error description.
            </em>
          </p>
        </div>
        <div className='button-section'>
          <button
            className='btn btn-success grid-col-3'
            onClick={() => setCurrentPage(1)}
          >
            Done
          </button>
        </div>
      </>
    )
  }
  //
  return (
    <>
      <div className='alert alert-success' role='alert'>
        <h2>The transfer was successful.</h2>
        <p>
          {data.newLadokGrades.length} results have been transferred.
          <br />
          From: <strong>{selectedAssignment.name}</strong>
          <br />
          To: <strong>{selectedModule.name}</strong>
          <br />
          Examination date: <strong>{examinationDate}</strong>
        </p>
      </div>
      <h2 className='success-h2'>Continue the grading process in Ladok</h2>
      <p>
        The rest of the grading process is carried out in Ladok. Here is a{' '}
        <a href={data.ladokLink} target='_blank' rel='noreferrer noopener'>
          direct link
        </a>{' '}
        to the module in Ladok to which the grades have been transferred. <br />
        <b>Note:</b> If you are prompted to log in to Ladok the first time you
        click the link you will have to click it again to arrive at the module
        in Ladok.
      </p>
      <div className='button-section'>
        <button
          className='btn btn-success grid-col-3'
          onClick={event => setCurrentPage(1)}
        >
          Done
        </button>
      </div>
    </>
  )
}

export default WizardResult
