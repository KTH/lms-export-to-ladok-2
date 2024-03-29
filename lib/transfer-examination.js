/* eslint-disable no-await-in-loop,no-continue */
const CanvasAPI = require("@kth/canvas-api");
const log = require("skog").default;
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

function getLadokId(section) {
  // eslint-disable-next-line camelcase
  if (section.sis_section_id && section.sis_section_id.startsWith("AKT.")) {
    return section.sis_section_id.split(".")[1];
  }

  return null;
}

async function getCourseRounds(examinationRoundId) {
  let amount = 0;
  let currentPage = 0;
  let allRounds = [];

  do {
    currentPage++;
    const { body } = await ladokGot
      .get(
        `/resultat/aktivitetstillfallesmojlighet/aktivitetstillfallesmojlighet/filtrera/utananonymbehorighet?aktivitetstillfalleUID=${examinationRoundId}&page=${currentPage}&limit=400`
      )
      .catch(ladokGenericErrorHandler);

    amount = body.TotaltAntalPoster;

    const rounds = body.Resultat.map(
      (r) => r.Rapporteringskontext.KurstillfalleUID
    );

    allRounds = [...allRounds, ...rounds];
  } while (currentPage * 400 <= amount);

  return Array.from(new Set(allRounds));
}

/**
 *
 * @param courseId
 * @param sectionIds
 * @param moduleId
 * @param assignmentId
 * @param token
 */

async function getResults(courseId, assignmentId, token) {
  log.info(
    `Getting results for course ${courseId} - assignment ${assignmentId}`
  );

  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  const sections = await canvas
    .list(`/courses/${courseId}/sections`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  const examinationRounds = new Set(
    sections.map(getLadokId).filter((id) => id)
  ); // diff

  log.info(
    `Course ${courseId} is mapped to ${examinationRounds.size} examination rounds`
  ); // diff

  const grades = await getCanvasGrades(
    courseId,
    assignmentId.toString(10),
    token
  );

  for (const examinationRoundId of examinationRounds) {
    // diff
    const courseRounds = await getCourseRounds(examinationRoundId); // diff

    let resultsCreate = await searchLadokResults({
      examinationRoundId, // diff
      courseRounds,
      mode: "create",
    });
    let resultsUpdate = await searchLadokResults({
      examinationRoundId, // diff
      courseRounds,
      mode: "update",
    });

    log.info(
      `Found ${resultsCreate.length} results in Ladok for Create in examination ${examinationRoundId}`
    ); // diff
    log.info(
      `Found ${resultsUpdate.length} results in Ladok for Update in examination ${examinationRoundId}`
    ); // diff

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
          examinationRoundId,
        })
      )
    );
  }

  return grades;
}

/**
 * @param courseId
 * @param examinationRoundId
 * @param assignmentId
 * @param examinationDate
 * @param token
 */
async function transferResults(courseId, assignmentId, examinationDate, token) {
  log.info(
    `Transferring results for course ${courseId} - assignment ${assignmentId}`
  );
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  // 1. Get in data from Canvas and LADOK
  const grades = await getCanvasGrades(
    courseId,
    assignmentId.toString(10),
    token
  );

  // User performing transfer of grades
  const { body: submittingUser } = await canvas
    .get("/users/self")
    .catch(canvasGenericErrorHandler);

  const sections = await canvas
    .list(`/courses/${courseId}/sections`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  const examinationRounds = new Set(
    sections.map(getLadokId).filter((id) => id)
  );

  log.info(
    `Course ${courseId} is mapped to ${examinationRounds.size} examination rounds`
  );

  const resultsForFunctionReturnValue = [];

  // **** CREATE ****
  const resultsForLogCreated = [];
  for (const examinationRoundId of examinationRounds) {
    const courseRounds = await getCourseRounds(examinationRoundId);
    const resultsCreate = await searchLadokResults({
      examinationRoundId,
      courseRounds,
      mode: "create",
    });

    log.info(
      `Found ${resultsCreate.length} results in Ladok for Create in examination ${examinationRoundId}`
    );

    for (const result of resultsCreate) {
      let resultObj;
      try {
        resultObj = await createLadokResultObject({
          actionType: "create",
          grades,
          result,
          utbildningsinstansUID:
            result.Rapporteringskontext.UtbildningsinstansUID,
          examinationDate,
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
  }

  // **** UPDATE ****
  const resultsForLogUpdated = [];
  for (const examinationRoundId of examinationRounds) {
    const courseRounds = await getCourseRounds(examinationRoundId);
    const resultsUpdate = await searchLadokResults({
      examinationRoundId,
      courseRounds,
      mode: "update",
    });

    log.info(
      `Found ${resultsUpdate.length} results in Ladok for Update in examination ${examinationRoundId}`
    );

    for (const result of resultsUpdate) {
      let resultObj;
      try {
        resultObj = await createLadokResultObject({
          actionType: "update",
          grades,
          result,
          utbildningsinstansUID:
            result.Rapporteringskontext.UtbildningsinstansUID,
          examinationDate,
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
  }

  // 3. Log and return results of operation
  const dataLog = {
    transfer_timestamp: Date.now(),
    user_canvas_id: submittingUser.id,
    from_course_id: courseId,
    from_assignment_id: assignmentId,

    to_examination_rounds: examinationRounds,
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
