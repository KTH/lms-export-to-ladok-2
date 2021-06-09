import React from "react";
import Loader from "./loader";

function WizardResult({
  origin,
  destination,
  examinationDate,
  submissionResponse,
  onContinue,
}) {
  if (submissionResponse.loading)
    return <Loader reason="Transfering results to ladok ..." />;
  if (submissionResponse.error) {
    return (
      <>
        <div className="alert alert-danger" aria-live="polite" role="alert">
          <h2>An error has occurred during the transfer.</h2>
          <p>
            No grades were transferred.
            <br />
            From: <strong>{origin}</strong>
            <br />
            To: <strong>{destination}</strong>
            <br />
            Examination date: <strong>{examinationDate}</strong>
          </p>
          <p>
            <strong>{submissionResponse.error.message}</strong>
          </p>
          <p>
            <em>
              If you need help,{" "}
              <a href="mailto:it-support@kth.se">contact IT support</a>, and
              include the error description.
            </em>
          </p>
        </div>
        <div className="button-section">
          <button
            className="btn btn-primary grid-col-3"
            onClick={() => onContinue()}
          >
            Start over
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="alert alert-success" role="alert">
        <h2>The transfer was successful.</h2>
        <p>
          {submissionResponse.data.length} results have been transferred.
          <br />
          From: <strong>{origin}</strong>
          <br />
          To: <strong>{destination}</strong>
          <br />
          Examination date: <strong>{examinationDate}</strong>
        </p>
      </div>
      <h2 className="success-h2">Continue the grading process in Ladok</h2>
      <p>The rest of the grading process is carried out in Ladok</p>
      <div className="button-section">
        <button
          className="btn btn-primary grid-col-3"
          onClick={() => onContinue()}
        >
          Transfer more results
        </button>
      </div>
    </>
  );
}

export default WizardResult;
