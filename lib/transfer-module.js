/* eslint-disable no-continue, no-await-in-loop */
/**
 * This module exports to functions: getResults and transferResults.
 * - `getResults` obtain a list of "results"
 * - `transferResults` submits the actual results to the Ladok API
 */

const CanvasAPI = require("@kth/canvas-api");
const log = require("skog");
const { ladokGot, ladokSearch, getLadokGrade } = require("./utils");
const mongo = require("./mongo");
const {
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
} = require("./errors");

async function searchLadokResults(moduleId, courseRounds, mode) {
  return ladokSearch(
    `/resultat/studieresultat/rapportera/utbildningsinstans/${moduleId}/sok`,
    {
      Filtrering: [mode === "create" ? "OBEHANDLADE" : "UTKAST"],
      KurstillfallenUID: courseRounds,
      LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
      OrderBy: ["EFTERNAMN_ASC", "FORNAMN_ASC", "PERSONNUMMER_ASC"],
    }
  );
}

/**
 *
 * @param courseId
 * @param moduleId
 * @param assignmentId
 * @param token
 */
async function getResults(courseId, moduleId, assignmentId, token) {
  log.info(
    `Getting results for course ${courseId} - module ${moduleId} - assignment ${assignmentId}`
  );

  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  const sections = await canvas
    .list(`/courses/${courseId}/sections`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  log.info(`Course ${courseId} has ${sections.length} sections`);

  const courseRounds = sections
    .filter((s) => s.integration_id)
    .map((s) => s.integration_id);

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray()
    .catch(canvasGenericErrorHandler);

  log.info(
    `Course ${courseId} - assignment ${assignmentId} has ${submissions.length} submissions`
  );

  const grades = submissions.map((s) => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
    mode: null,
  }));

  const results1 = await searchLadokResults(moduleId, courseRounds, "create");
  const results2 = await searchLadokResults(moduleId, courseRounds, "update");

  log.info(`Found ${results1.length} results in Ladok for Create`);
  log.info(`Found ${results2.length} results in Ladok for Update`);

  for (const result of results1) {
    const submission = grades.find((s) => s.id === result.Student.Uid);

    if (!submission) {
      log.info(
        `Missing student in Canvas ${result.Student.Uid} (${result.Student.Fornamn} ${result.Student.Efternamn} )`
      );
      continue;
    }
    const ladokGrade =
      submission &&
      submission.grade &&
      (await getLadokGrade(
        result.Rapporteringskontext.BetygsskalaID,
        submission.grade
      ));

    submission.mode = ladokGrade && "create";
  }

  for (const result of results2) {
    const submission = grades.find((s) => s.id === result.Student.Uid);

    if (!submission) {
      log.info(
        `Missing student in Canvas ${result.Student.Uid} (${result.Student.Fornamn} ${result.Student.Efternamn} )`
      );
      continue;
    }

    const ladokGrade =
      submission &&
      submission.grade &&
      (await getLadokGrade(
        result.Rapporteringskontext.BetygsskalaID,
        submission.grade
      ));

    const existingResult = result.ResultatPaUtbildningar.find(
      (rpu) =>
        rpu.Arbetsunderlag &&
        rpu.Arbetsunderlag.UtbildningsinstansUID === moduleId
    );

    if (
      existingResult &&
      ladokGrade &&
      existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID
    ) {
      submission.mode = "update";
    }
  }

  return grades;
}

class ResultObjectError extends Error {
  constructor({ type, message }) {
    super(message);
    this.type = type;
  }
}

/**
 * Create a result object that can be sent to LADOK.
 *
 * @param {string} param0.submissionType [create|update]
 * @param {array} param0.grades
 * @param {object} param0.result
 * @param {string} param0.moduleId
 * @param {string} param0.examinationDate
 * @returns LadokResultObject
 */
async function createLadokResultObject({
  actionType,
  grades,
  result,
  moduleId,
  examinationDate,
}) {
  const submission = grades.find((s) => s.id === result.Student.Uid);
  if (!submission) {
    // This should be logged with log.info
    throw new ResultObjectError({
      type: "missing_student",
      message: `Missing student in Canvas ${result.Student.Uid} (${result.Student.Fornamn} ${result.Student.Efternamn} )`,
    });
  }

  let ladokGrade;
  if (submission?.grade) {
    ladokGrade = await getLadokGrade(
      result.Rapporteringskontext.BetygsskalaID,
      submission.grade
    );
  }
  if (!ladokGrade)
    throw new ResultObjectError({
      type: "missing_grade",
      message: "No ladok grade found for this submission",
    });

  const commonData = {
    Betygsgrad: ladokGrade.ID,
    BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
    Examinationsdatum: examinationDate,
  };

  if (actionType === "create") {
    return {
      ...commonData,
      Uid: result.Uid, // TODO: Why is this different from the update object and same as below?
      StudieresultatUID: result.Uid,
      UtbildningsinstansUID: moduleId,
    };
  }

  if (actionType === "update") {
    const existingResult = result.ResultatPaUtbildningar.find(
      (rpu) => rpu.Arbetsunderlag?.UtbildningsinstansUID === moduleId
    );

    // This submission already exists (NOOP)
    if (existingResult.Arbetsunderlag.Betygsgrad === ladokGrade.ID)
      throw new ResultObjectError({
        type: "result_exists",
        message: "This result already exists in LADOK",
      });

    return {
      ...commonData,
      Uid: result.Student.Uid,
      ResultatUID: existingResult.Arbetsunderlag.Uid,
      SenasteResultatandring:
        existingResult.Arbetsunderlag.SenasteResultatandring,
    };
  }

  throw new Error(
    `Unknown actionType "${actionType}", should match [create|update]`
  );
}

/**
 * @param courseId
 * @param examinationRoundId
 * @param assignmentId
 * @param examinationDate
 * @param token
 */
async function transferResults(
  courseId,
  moduleId,
  assignmentId,
  examinationDate,
  token
) {
  log.info(
    `Transferring results for course ${courseId} - module ${moduleId} - assignment ${assignmentId}`
  );

  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  // 1. Get in data from Canvas and LADOK

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray()
    .catch(canvasGenericErrorHandler);

  // User performing transfer of grades
  const { body: submittingUser } = await canvas
    .get("/users/self")
    .catch(canvasGenericErrorHandler);

  const sections = await canvas
    .list(`/courses/${courseId}/sections`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  log.info(`Course ${courseId} has ${sections.length} sections`);

  const courseRounds = sections
    .filter((s) => s.integration_id)
    .map((s) => s.integration_id);

  const grades = submissions.map((s) => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
  }));

  // New results to be created
  const resultsCreate = await searchLadokResults(
    moduleId,
    courseRounds,
    "create"
  );

  // Existing results to be updated
  const resultsUpdate = await searchLadokResults(
    moduleId,
    courseRounds,
    "update"
  );

  log.info(`Found ${resultsCreate.length} results in Ladok for Create`);
  log.info(`Found ${resultsUpdate.length} results in Ladok for Update`);

  // 2. Process results and send create/update instructions to LADOK
  const resultsForFunctionReturnValue = [];

  const commonParams = {
    grades,
    moduleId,
    examinationDate,
  };

  // **** CREATE ****
  const resultsForLogCreated = [];
  for (const result of resultsCreate) {
    let resultObj;
    try {
      resultObj = await createLadokResultObject({
        actionType: "create",
        result,
        ...commonParams,
      });
    } catch (err) {
      if (err instanceof ResultObjectError) {
        log.info(err, err.message);
        // Skip this user due to error
        continue;
      } else {
        throw err;
      }
    }
    resultsForLogCreated.push(resultObj);

    const res = await ladokGot
      .post("/resultat/studieresultat/skapa", {
        body: {
          LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
          Resultat: [resultObj],
        },
      })
      .catch(ladokGenericErrorHandler);
    resultsForFunctionReturnValue.push(res.body.Resultat);
  }

  // **** UPDATE ****
  const resultsForLogUpdated = [];
  for (const result of resultsUpdate) {
    let resultObj;
    try {
      resultObj = await createLadokResultObject({
        actionType: "update",
        result,
        ...commonParams,
      });
    } catch (err) {
      if (err instanceof ResultObjectError) {
        log.info(err, err.message);
        // Skip this user due to error
        continue;
      } else {
        throw err;
      }
    }
    resultsForLogUpdated.push(resultObj);

    const res = await ladokGot
      .put("/resultat/studieresultat/uppdatera", {
        body: {
          Resultat: [resultObj],
        },
      })
      .catch(ladokGenericErrorHandler);
    resultsForFunctionReturnValue.push(res.body.Resultat);
  }

  // 3. Log and return results of operation
  const dataLog = {
    transfer_timestamp: Date.now(),
    user_canvas_id: submittingUser.id,
    from_course_id: courseId,
    from_assignment_id: assignmentId,

    to_module: moduleId,
    examination_date: examinationDate,
    new_grades: resultsForLogCreated,
    updated_grades: resultsForLogUpdated,
  };
  mongo.write(dataLog);

  // Return list of results from LADOK
  return resultsForFunctionReturnValue;
}

module.exports = {
  getResults,
  transferResults,
};
