const memoizee = require("memoizee");
const got = require("got");
const CanvasAPI = require("@kth/canvas-api");
const log = require("skog");
const {
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
} = require("./errors");

const ladokGot = got.extend({
  baseUrl: process.env.LADOK_API_BASEURL,
  json: true,
  pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, "base64"),
  passphrase: process.env.LADOK_API_PFX_PASSPHRASE,
});

// Uses the non standard Ladok headers. The response body needs to be JSON.parsed
const ladokGot2 = got.extend({
  baseUrl: process.env.LADOK_API_BASEURL,
  headers: {
    Accept:
      "application/vnd.ladok-resultat+json, application/vnd.ladok-kataloginformation+json, application/vnd.ladok-studentinformation+json, application/vnd.ladok-studiedeltagande+json, application/vnd.ladok-utbildningsinformation+json, application/vnd.ladok-examen+json, application/vnd.ladok-extintegration+json, application/vnd.ladok-uppfoljning+json, application/vnd.ladok-extra+json, application/json, text/plain, */*",
  },
  pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, "base64"),
  passphrase: process.env.LADOK_API_PFX_PASSPHRASE,
});

async function gradingScalesRaw() {
  return ladokGot
    .get("/resultat/grunddata/betygsskala")
    .then((r) => r.body.Betygsskala)
    .catch(ladokGenericErrorHandler);
}

const getGradingScales = memoizee(gradingScalesRaw, { maxAge: 3600 * 1000 });

async function getCanvasGrades(courseId, assignmentId, token) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  if (assignmentId === "0") {
    // Final grade

    const enrollments = await canvas
      .list(`/courses/${courseId}/enrollments`)
      .toArray()
      .catch(canvasGenericErrorHandler);

    log.info(
      `Course ${courseId} - total column has ${enrollments.length} grades`
    );

    return enrollments.map((e) => ({
      name: e.user.sortable_name,
      id: e.user.integration_id,
      grade: e.grades?.unposted_current_grade,
      mode: null,
    }));
  }

  const submissions = await canvas
    .list(`/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      include: ["user"],
    })
    .toArray()
    .catch(canvasGenericErrorHandler);

  log.info(
    `Course ${courseId} - assignment ${assignmentId} has ${submissions.length} submissions`
  );

  return submissions.map((s) => ({
    name: s.user.sortable_name,
    id: s.user.integration_id,
    grade: s.grade,
    mode: null,
  }));
}

/**
 * Gets the Ladok "Betyg object" matching a given letter grade in a given scale
 *
 * @param {number} scaleId Scale ID in Ladok
 * @param {string} grade Grade (e.g. "A" or "Fx")
 *
 * @returns {Promise<{
 *   Kod: string,
 *   ID: number
 * }>}
 */
async function getLadokGrade(scaleId, grade) {
  const allScales = await getGradingScales();
  const scale = allScales.find((s) => parseInt(s.ID, 10) === scaleId);

  if (!scale || !scale.Betygsgrad) {
    return null;
  }

  const ladokGrade = scale.Betygsgrad.find(
    (g) => g.Kod && g.Kod.toUpperCase() === grade.toUpperCase()
  );

  return ladokGrade;
}

/**
 * Perform a request to a paginated "/sok" endpoint and returns the list of all
 * results of the search
 */
async function ladokSearch(endpoint, criteria) {
  let result = [];

  let currentPage = 0;
  let totalPages = 0;
  const pageSize = 100;

  do {
    currentPage++;
    // eslint-disable-next-line no-await-in-loop
    const { body } = await ladokGot(endpoint, {
      method: "PUT",
      body: {
        ...criteria,
        Page: currentPage,
        Limit: pageSize,
      },
    }).catch(ladokGenericErrorHandler);

    result = [...result, ...body.Resultat];
    totalPages = Math.ceil(body.TotaltAntalPoster / pageSize);
  } while (currentPage <= totalPages);

  return result;
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
 * @param {string} param0.utbildningsinstansUID moduleId or examinationId
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

async function searchLadokResults({
  moduleId,
  examinationRoundId,
  courseRounds,
  mode,
}) {
  if (courseRounds.length === 0) {
    return [];
  }

  const ladokSearchPath =
    examinationRoundId !== undefined
      ? `/resultat/studieresultat/rapportera/aktivitetstillfalle/${examinationRoundId}/sok`
      : `/resultat/studieresultat/rapportera/utbildningsinstans/${moduleId}/sok`;

  return ladokSearch(ladokSearchPath, {
    Filtrering: [mode === "create" ? "OBEHANDLADE" : "UTKAST"],
    KurstillfallenUID: courseRounds,
    LarosateID: process.env.LADOK_KTH_LAROSATE_ID,
    OrderBy: ["EFTERNAMN_ASC", "FORNAMN_ASC", "PERSONNUMMER_ASC"],
  });
}

async function mutateSubmissionModeForGrades({
  grades,
  type,
  result,
  moduleId,
  examinationRoundId,
}) {
  if (type === "update") {
    if (!moduleId && !examinationRoundId) {
      throw new Error("Update requires moduleId or examinationRoundId");
    }
  }

  const submission = grades.find((s) => s.id === result.Student.Uid);

  if (!submission) {
    log.warn(
      `Missing student in Canvas ${result.Student.Uid} (${result.Student.Fornamn} ${result.Student.Efternamn} )`
    );
    return result;
  }

  if (!submission.grade) {
    return result;
  }

  // Check if student has a grade
  const ladokGrade = await getLadokGrade(
    result.Rapporteringskontext.BetygsskalaID,
    submission.grade
  );

  // End here if we don't find a ladokGrade
  if (!ladokGrade) {
    return result;
  }

  // End here if it is a create operation
  if (type === "create") {
    submission.mode = "create";
    return result;
  }

  // This is for updates
  const existingResult = result.ResultatPaUtbildningar.find(
    (rpu) =>
      rpu.Arbetsunderlag &&
      // Check different params if we get examinationRoundId or moduleId:
      (examinationRoundId
        ? rpu.Arbetsunderlag.AktivitetstillfalleUID === examinationRoundId
        : rpu.Arbetsunderlag.UtbildningsinstansUID === moduleId)
  );

  // End here if we don't find an existing result
  if (!existingResult) {
    return result;
  }

  // End here if the grade hasn't changed
  if (existingResult.Arbetsunderlag.Betygsgrad === ladokGrade.ID) {
    return result;
  }

  // So we have an updated grade, set mode and return result
  submission.mode = "update";
  return result;
}

module.exports = {
  createLadokResultObject,
  ladokSearch,
  ladokGot,
  ladokGot2,
  getGradingScales,
  mutateSubmissionModeForGrades,
  searchLadokResults,
  ResultObjectError,
  getCanvasGrades,
};
