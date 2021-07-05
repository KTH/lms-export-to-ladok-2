const log = require("skog");
const got = require("got");
const memoizee = require("memoizee");

const CanvasAPI = require("@kth/canvas-api");

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
  const { body } = await ladokGot.get(
    `/kataloginformation/behorighetsprofil/${process.env.LADOK_REPORTER_PROFILE_UID}/koppladeanvandare`
  );

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
    .toArray();

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
      isAllowedInCanvas(token, courseId),
      isAllowedInLadok(token, courseId),
    ]);

    return results[0] && results[1];
  } catch (e) {
    log.error(e);
    return false;
  }
}

module.exports = {
  isAllowedInCanvas,
  isAllowedInLadok,
  isAllowed,
};
