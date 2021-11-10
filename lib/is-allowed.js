const log = require("skog");
const got = require("got");
const memoizee = require("memoizee");

const CanvasAPI = require("@kth/canvas-api");
const {
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
} = require("./errors");

const ladokGot = got.extend({
  baseUrl: process.env.LADOK_API_BASEURL,
  json: true,
  pfx: Buffer.from(process.env.LADOK_API_PFX_BASE64, "base64"),
  passphrase: process.env.LADOK_API_PFX_PASSPHRASE,
  headers: {
    Accept: "application/vnd.ladok-kataloginformation+json",
  },
});

async function listReportersRaw() {
  const { body } = await ladokGot
    .get(
      `/kataloginformation/behorighetsprofil/${process.env.LADOK_REPORTER_PROFILE_UID}/koppladeanvandare`
    )
    .catch(ladokGenericErrorHandler);

  const users = {};
  body.Anvandare.forEach((user) => {
    users[user.Anvandarnamn] = {
      Uid: user.Uid,
      Fornamn: user.Fornamn,
      efternamn: user.Efternamn,
    };
  });

  return users;
}

/** Get all Ladok reporters */
const listReporters = memoizee(listReportersRaw, {
  maxAge: 15 * 60 * 1000,
});

async function isAllowedInCanvas(token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);

  // These are role IDs mapped to roles in Canvas.
  const EXAMINER = 10;
  const TEACHER = 4;
  const COURSE_RESPONSIBLE = 9;

  const enrollments = await canvas
    .list(`/courses/${courseId}/enrollments`, { user_id: "self" })
    .toArray()
    .catch(canvasGenericErrorHandler);

  const allowedRoles = enrollments
    .map((enrollment) => parseInt(enrollment.role_id, 10))
    .filter(
      (role) =>
        role === EXAMINER || role === TEACHER || role === COURSE_RESPONSIBLE
    );

  log.info(`The user has the roles: ${allowedRoles}`);

  if (allowedRoles.length === 0) {
    log.info(
      "The user is not allowed in Canvas. Only teachers and similar roles can use this app."
    );
    return false;
  }

  return true;
}

async function isAllowedInLadok(token, courseId) {
  const canvas = CanvasAPI(`${process.env.CANVAS_HOST}/api/v1`, token);
  log.info("Checking if user is allowed in Ladok");

  let loginId;
  try {
    const { body: user } = await canvas.get(`/courses/${courseId}/users/self`);
    log.info("Login ID for currentUser:", user.login_id);
    loginId = user.login_id;
  } catch (err) {
    log.error("Cannot get login ID from this user");

    return false;
  }

  const reporters = await listReporters();
  const reporters = await listReporters(); // Error handler in called function
  const ladokReporter = reporters[loginId];
  if (ladokReporter) {
    log.info("The user is one of the result reporters in Ladok", ladokReporter);

    return true;
  }
  log.info(
    "Could not find this user among the ladok reporters in Ladok. The user is probably missing the profile in Ladok, and is not allowed to run the report"
  );
  return false;
}

async function isAllowed(token, courseId) {
  try {
    const results = await Promise.all([
      isAllowedInCanvas(token, courseId), // Error handler in called function
      isAllowedInLadok(token, courseId), // Error handler in called function
    ]);

    return results[0] && results[1];
  } catch (e) {
    // TODO: Should this really be logged as error?
    Error.captureStackTrace(e);
    log.error(e.err || e, e.message);
    return false;
  }
}

module.exports = {
  isAllowedInCanvas,
  isAllowedInLadok,
  isAllowed,
};
