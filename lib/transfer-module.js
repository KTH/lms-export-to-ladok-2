/* eslint-disable no-continue, no-await-in-loop */
/**
 * This module exports to functions: getResults and transferResults.
 * - `getResults` obtain a list of "results"
 * - `transferResults` submits the actual results to the Ladok API
 */

const CanvasAPI = require("@kth/canvas-api");
const log = require("skog");
const {
  ladokGot,
  createLadokResultObject,
  mutateSubmissionModeForGrades,
  searchLadokResults,
  ResultObjectError,
  getCanvasGrades,
} = require("./utils");
const mongo = require("./mongo");
const {
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
  LadokApiError,
} = require("./errors");

const { getSectionType } = require("./get-course-structure");
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

  log.info(`Course ${courseId} has ${sections.length} sections`); // diff

  const courseRounds = sections
    .filter((s) => getSectionType(s.sis_section_id) === "course round")
    .map((s) => s.sis_section_id);

  const grades = await getCanvasGrades(
    courseId,
    assignmentId.toString(10),
    token
  );

  let resultsCreate = await searchLadokResults({
    moduleId, // diff
    courseRounds,
    mode: "create",
  });
  let resultsUpdate = await searchLadokResults({
    moduleId, // diff
    courseRounds,
    mode: "update",
  });

  log.info(`Found ${resultsCreate.length} results in Ladok for Create`); // diff
  log.info(`Found ${resultsUpdate.length} results in Ladok for Update`); // diff

  // ***** CREATE *****
  resultsCreate = await Promise.all(
    resultsCreate.map((result) =>
      mutateSubmissionModeForGrades({ grades, type: "create", result })
    )
  );

  // ***** UPDATE *****
  resultsUpdate = await Promise.all(
    resultsUpdate.map((result) =>
      mutateSubmissionModeForGrades({
        grades,
        type: "update",
        result,
        moduleId,
      })
    )
  );

  return grades;
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
  const grades = await getCanvasGrades(
    courseId,
    assignmentId.toString(10),
    token
  );

  // TODO: Missing "log.info", see transfer-examination.js:205

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
    .filter((s) => getSectionType(s.sis_section_id) === "course round")
    .map((s) => s.sis_section_id);

  // New results to be created
  const resultsCreate = await searchLadokResults({
    moduleId,
    courseRounds,
    mode: "create",
  });

  // Existing results to be updated
  const resultsUpdate = await searchLadokResults({
    moduleId,
    courseRounds,
    mode: "update",
  });

  log.info(`Found ${resultsCreate.length} results in Ladok for Create`);
  log.info(`Found ${resultsUpdate.length} results in Ladok for Update`);

  // 2. Process results and send create/update instructions to LADOK
  // Data skall ej lagras
  const resultsForFunctionReturnValue = [];

  const commonParams = {
    grades,
    utbildningsinstansUID: moduleId,
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

    let res;
    try {
      res = await ladokGot
        .post("/resultat/studieresultat/skapa", {
          body: {
            LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
            Resultat: [resultObj],
          },
        })
        .catch(ladokGenericErrorHandler);
    } catch (err) {
      if (err instanceof LadokApiError && err.type === "rule_error") {
        // This error should not prevent us from continuing
        resultsForFunctionReturnValue.push({
          type: "transfer_error",
          studentName: `${result.Student.Fornamn} ${result.Student.Efternamn}`,
          studentLadokId: result.Student.Uid,
          studentPersonNr: result.Student.Personnummer, // Data skall ej lagras
          message: err.message,
        });
        continue;
      }
      // Throw all other errors
      throw err;
    }
    // TODO: Handle errors differently
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

    let res;
    try {
      res = await ladokGot
        .put("/resultat/studieresultat/uppdatera", {
          body: {
            Resultat: [resultObj],
          },
        })
        .catch(ladokGenericErrorHandler);
    } catch (err) {
      if (err instanceof LadokApiError && err.type === "rule_error") {
        // This error should not prevent us from continuing
        resultsForFunctionReturnValue.push({
          type: "transfer_error",
          studentName: `${result.Student.Fornamn} ${result.Student.Efternamn}`,
          studentLadokId: result.Student.Uid,
          studentPersonNr: result.Student.Personnummer, // Data skall ej lagras
          message: err.message,
        });
        continue;
      }
      // Throw all other errors
      throw err;
    }
    // TODO: Handle errors differently
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
