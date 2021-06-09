import React, { useState } from "react";
import AssignmentSelector from "./assignment-selector";
import ModuleSelector from "./module-selector";
import SelectDate from "./select-date";

function NextButton({ assignment, module, examinationDate, onClick }) {
  let disabled = false;
  let title = "";
  let buttonClassNames = "btn btn-next btn-success grid-col-3";

  if (assignment === -1) {
    disabled = true;
    title = "Select an assignment in Canvas first";
    buttonClassNames += " disabled";
  } else if (module === -1) {
    disabled = true;
    title = "Select a module in Ladok first";
    buttonClassNames += " disabled";
  } else if (!examinationDate) {
    disabled = true;
    title = "Select an examination date first";
    buttonClassNames += " disabled";
  }

  return (
    <button
      className={buttonClassNames}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      Students
    </button>
  );
}

export default function WizardForm({ options, selection, onSubmit, onCancel }) {
  const [assignment, setAssignment] = useState(selection.assignment);
  const [module, setModule] = useState(selection.module);
  const [examinationDate, setExaminationDate] = useState(
    selection.examinationDate
  );

  function handleNextClick() {
    onSubmit({
      assignment,
      module,
      examinationDate,
    });
  }

  return (
    <div className="form-group form-select">
      <h1>Select assignment and date (Step 1 of 2)</h1>
      <p>
        To be able to transfer grades from Canvas to Ladok, you need to map a
        Canvas assignment to a Ladok module or examination. Please select both a
        Canvas assignment as source, a Ladok module as target and an examination
        date for the grades to be transfered, before you can proceed.
      </p>
      <h2>Canvas assignment</h2>
      <p>
        Note that only letter grades will be transfered to Ladok (A-F & P/F)
      </p>
      <AssignmentSelector
        assignments={options.assignments}
        onChange={setAssignment}
        value={assignment}
      />

      {options.modules.length > 0 && (
        <>
          <h2>Ladok Module</h2>
          <p>To which Ladok module do you want the grades to be transferred?</p>

          <ModuleSelector
            modules={options.modules}
            onChange={setModule}
            value={module}
          />
        </>
      )}
      <h2>Examination Date</h2>
      <p>
        When transferring to Ladok, all affected grades will receive the same
        Examination Date. If you need to set a different date on an individual
        level, please change it in Ladok after transferring.
      </p>
      <SelectDate
        examinationDate={examinationDate}
        setExaminationDate={setExaminationDate}
      />
      <div className="button-section">
        <button
          className="btn btn-secondary grid-col-2"
          onClick={() => onCancel()}
        >
          Cancel
        </button>
        <NextButton
          assignment={assignment}
          module={module}
          examinationDate={examinationDate}
          onClick={handleNextClick}
        />
      </div>
    </div>
  );
}
