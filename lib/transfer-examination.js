/* eslint-disable no-await-in-loop,no-continue */
const CanvasAPI = require("@kth/canvas-api");
const log = require("skog");
const { ladokGot, ladokSearch, getLadokGrade } = require("./utils");
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

async function searchLadokResults(examinationRoundId, mode) {
  const courseRounds = await getCourseRounds(examinationRoundId);

  if (courseRounds.length === 0) {
    return [];
  }

  return ladokSearch(
    `/resultat/studieresultat/rapportera/aktivitetstillfalle/${examinationRoundId}/sok`,
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
  );

  log.info(
    `Course ${courseId} is mapped to ${examinationRounds.size} examination rounds`
  );

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

  for (const examination of examinationRounds) {
    const results1 = await searchLadokResults(examination, "create");
    const results2 = await searchLadokResults(examination, "update");

    log.info(
      `Found ${results1.length} results in Ladok for Create in examination ${examination}`
    );
    log.info(
      `Found ${results2.length} results in Ladok for Update in examination ${examination}`
    );

    for (const result of results1) {
      const submission = grades.find((s) => s.id === result.Student.Uid);

      if (!submission) {
        log.warn(
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

      if (ladokGrade) {
        submission.mode = "create";
      }
    }

    for (const result of results2) {
      const submission = grades.find((s) => s.id === result.Student.Uid);

      if (!submission) {
        log.warn(
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
          rpu.Arbetsunderlag.AktivitetstillfalleUID === examination
      );

      if (
        ladokGrade &&
        existingResult &&
        existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID
      ) {
        submission.mode = "update";
      }
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
  utbildningsinstansUID,
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
      UtbildningsinstansUID: utbildningsinstansUID,
    };
  }

  if (actionType === "update") {
    const existingResult = result.ResultatPaUtbildningar.find(
      (rpu) =>
        rpu.Arbetsunderlag?.UtbildningsinstansUID === utbildningsinstansUID
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
async function transferResults(courseId, assignmentId, examinationDate, token) {
  log.info(
    `Transferring results for course ${courseId} - assignment ${assignmentId}`
  );
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  // 1. Get in data from Canvas and LADOK

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray()
    .catch(canvasGenericErrorHandler);

  log.info(
    `Course ${courseId} - assignment ${assignmentId} has ${submissions.length} submissions`
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

  const grades = submissions.map((s) => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
  }));

  const resultsForFunctionReturnValue = [];

  // **** CREATE ****
  const resultsForLogCreated = [];
  for (const examination of examinationRounds) {
    const resultsCreate = await searchLadokResults(examination, "create");

    log.info(
      `Found ${resultsCreate.length} results in Ladok for Create in examination ${examination}`
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
  for (const examination of examinationRounds) {
    const resultsUpdate = await searchLadokResults(examination, "update");

    log.info(
      `Found ${resultsUpdate.length} results in Ladok for Update in examination ${examination}`
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
