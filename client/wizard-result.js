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
    let errTitle;
    let errDescription;
    if (
      ["ladok_rule_error", "ladok_auth_error"].indexOf(
        submissionResponse.error.type
      ) >= 0
    ) {
      errTitle = submissionResponse.error.message;
      errDescription = undefined;
    } else {
      errTitle = "An error has occurred during the transfer.";
      errDescription = submissionResponse.error.message;
    }
    return (
      <>
        <div className="alert alert-danger" aria-live="polite" role="alert">
          <h2>{errTitle}</h2>
          <p>
            No grades were transferred.
            <br />
            From: <strong>{origin}</strong>
            <br />
            To: <strong>{destination}</strong>
            <br />
            Examination date: <strong>{examinationDate}</strong>
          </p>
          {errDescription && (
            <p>
              <strong>{errDescription}</strong>
            </p>
          )}
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
            type="button"
          >
            Start over
          </button>
        </div>
      </> /* fix syntax highlight */
    );
  }
  const submissionIssues = submissionResponse.data.filter(
    (t) => t.type === "transfer_error"
  );
  const nrofSuccess = submissionResponse.data.filter(
    (t) => t.type !== "transfer_error"
  ).length;
  const hasIssues = submissionIssues.length !== nrofSuccess;

  return (
    <>
      <div
        className={`alert ${hasIssues ? "alert-info" : "alert-success"}`}
        role="alert"
      >
        {hasIssues ? (
          <h2>The transfer had issues, some grades were not transferred.</h2>
        ) : (
          <h2>The transfer was successful.</h2>
        )}
        <p>
          {nrofSuccess} results have been transferred.
          <br />
          From: <strong>{origin}</strong>
          <br />
          To: <strong>{destination}</strong>
          <br />
          Examination date: <strong>{examinationDate}</strong>
        </p>
      </div>
      {submissionIssues.length > 0 && (
        <div className="table-container">
          <table>
            <caption>We could not transfer the following grades:</caption>
            <thead>
              <tr>
                <th>Student</th>
                <th>PersonNr</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {submissionIssues.map((item) => (
                <tr key={item.studentLadokId}>
                  <td>{item.studentName}</td>
                  <td>{item.studentPersonNr}</td>
                  <td>{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="success-h2">Continue the grading process in Ladok</h2>
      <p>The rest of the grading process is carried out in Ladok</p>
      <div className="button-section">
        <button
          className="btn btn-primary grid-col-3"
          onClick={() => onContinue()}
          type="button"
        >
          Transfer more results
        </button>
      </div>
    </>
  );
}

export default WizardResult;
