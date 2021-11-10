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
  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray();

  log.info(`Course ${courseId} has ${sections.length} sections`);

  const courseRounds = sections
    .filter((s) => s.integration_id)
    .map((s) => s.integration_id);

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray();

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
  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray();
  const { body: user } = await canvas.get("/users/self");
  const sections = await canvas.list(`/courses/${courseId}/sections`).toArray();

  log.info(`Course ${courseId} has ${sections.length} sections`);

  const courseRounds = sections
    .filter((s) => s.integration_id)
    .map((s) => s.integration_id);

  const transferObject1 = {
    LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
    Resultat: [],
  };

  const transferObject2 = {
    Resultat: [],
  };

  const grades = submissions.map((s) => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
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

    if (ladokGrade && ladokGrade.ID) {
      transferObject1.Resultat.push({
        Uid: result.Uid,
        StudieresultatUID: result.Uid,
        UtbildningsinstansUID: moduleId,
        Betygsgrad: ladokGrade.ID,
        BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
        Examinationsdatum: examinationDate,
      });
    }
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
      ladokGrade &&
      existingResult.Arbetsunderlag.Betygsgrad !== ladokGrade.ID
    ) {
      transferObject2.Resultat.push({
        Uid: result.Student.Uid,
        ResultatUID: existingResult.Arbetsunderlag.Uid,
        Betygsgrad: ladokGrade.ID,
        BetygsskalaID: result.Rapporteringskontext.BetygsskalaID,
        Examinationsdatum: examinationDate,
        SenasteResultatandring:
          existingResult.Arbetsunderlag.SenasteResultatandring,
      });
    }
  }

  const dataLog = {
    transfer_timestamp: Date.now(),
    user_canvas_id: user.id,
    from_course_id: courseId,
    from_assignment_id: assignmentId,

    to_module: moduleId,
    examination_date: examinationDate,
    new_grades: transferObject1.Resultat,
    updated_grades: transferObject2.Resultat,
  };
  mongo.write(dataLog);

  const r1 = await ladokGot
    .post("/resultat/studieresultat/skapa", {
      body: transferObject1,
    })
    .catch(ladokGenericErrorHandler);

  const r2 = await ladokGot
    .put("/resultat/studieresultat/uppdatera", {
      body: transferObject2,
    })
    .catch(ladokGenericErrorHandler);

  return [...r1.body.Resultat, ...r2.body.Resultat];
}

module.exports = {
  getResults,
  transferResults,
};
