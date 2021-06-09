const log = require("skog");
const querystring = require("querystring");
const { URL } = require("url");
const got = require("got");
const { isAllowedInCanvas, isAllowedInLadok } = require("../lib/is-allowed");

async function getAccessData(redirectUrl, code) {
  const { body } = await got({
    method: "POST",
    url: `${process.env.CANVAS_HOST}/login/oauth2/token`,
    json: true,
    body: {
      grant_type: "authorization_code",
      client_id: process.env.CANVAS_CLIENT_ID,
      client_secret: process.env.CANVAS_CLIENT_SECRET,
      redirect_url: redirectUrl,
      code: code,
      replace_tokens: true,
    },
  });

  return {
    token: body.access_token,
    userId: body.user.id,
    realUserId: body.real_user && body.real_user.id,
  };
}

const oauth1 = (redirectPath) =>
  function oauth1Middleware(req, res) {
    if (!req.body) {
      res.render("error", {
        layout: false,
        title: "This app needs to be launched from Canvas",
        subtitle:
          'To use this app you need to click on the "Transfer to Ladok" button on the left-hand side of your course in Canvas.',
        code: "missing body",
      });
      return;
    }

    if (!req.body.custom_canvas_course_id) {
      res.render("error", {
        layout: false,
        title: "This app needs to be launched from Canvas",
        subtitle:
          'To use this app you need to click on the "Transfer to Ladok" button on the left-hand side of your course in Canvas.',
        code: 'missing attribute "custom_canvas_course_id"',
      });

      return;
    }

    const courseId = req.body.custom_canvas_course_id;
    log.info(`App launched for course ${courseId}`);

    const callbackUrl = new URL(
      `${req.baseUrl}${redirectPath}`,
      process.env.PROXY_BASE
    );

    callbackUrl.search = querystring.stringify({
      course_id: courseId,
    });

    log.info("Next URL will be %s", callbackUrl);

    const url = new URL("/login/oauth2/auth", process.env.CANVAS_HOST);
    url.search = querystring.stringify({
      client_id: process.env.CANVAS_CLIENT_ID,
      response_type: "code",
      redirect_uri: callbackUrl.toString(),
    });

    log.info("Redirecting to %s", url);

    res.redirect(url);
  };

const oauth2 = (redirectPath) =>
  async function oauth2Middleware(req, res, next) {
    if (!req.query || !req.query.course_id) {
      log.warn("Missing query parameter from Canvas oauth [course_id]");
      res.render("error", {
        layout: false,
        title: "An unexpected error ocurred",
        subtitle: "Please, try again",
        code: "missing query parameter [course_id]",
      });

      return;
    }

    if (req.query.error && req.query.error === "access_denied") {
      log.warn(
        "The user has not authorize the application [error=access_denied]"
      );
      res.render("error", {
        layout: false,
        title: "Authorization required",
        subtitle:
          "This app needs access to your course data in order to transfer the grades from there",
        code: "obtained query parameter [error=access_denied]",
      });

      return;
    }

    if (req.query.error) {
      log.error(`Obtained error from Canvas oauth [error=${req.query.error}]`);
      res.render("error", {
        layout: false,
        title: "Unexpected error",
        subtitle: "Please try again later",
        code: `unexpected query parameter [error=${req.query.error}]`,
      });

      return;
    }

    if (!req.query.code) {
      log.error(`No [code] parameter obtained from Canvas oauth`);
      res.render("error", {
        layout: false,
        title: "Unexpected error",
        subtitle: "Please try again later",
        code: `missing query parameter [code]`,
      });

      return;
    }

    const callbackUrl = new URL(
      `${req.baseUrl}${redirectPath}`,
      process.env.PROXY_BASE
    );

    let token, userId, realUserId;
    const courseId = req.query.course_id;

    try {
      const canvasAccessData = await getAccessData(
        callbackUrl.toString(),
        req.query.code
      );
      token = canvasAccessData.token;
      userId = canvasAccessData.userId;
      realUserId = canvasAccessData.realUserId;
    } catch (err) {
      log.error(`Error getting access data from Canvas`);
      res.render("error", {
        layout: false,
        title: "Unexpected error",
        subtitle:
          "The app must be launched from Canvas. Please close this tab/window and try again",
        code: `missing query parameter [code]`,
      });

      return;
    }

    const allowedIncanvas = await isAllowedInCanvas(token, courseId);

    if (!allowedIncanvas) {
      log.info(`User is not allowed to use the app in Canvas`);
      res.render("error", {
        layout: false,
        title: "Unauthorized",
        subtitle:
          "You must be a teacher or examiner in the Canvas course to use this app",
        code: `user is not allowed in Canvas`,
      });

      return;
    }

    const allowedInLadok = await isAllowedInLadok(token, courseId);

    if (!allowedInLadok) {
      log.info(`User is not allowed to use the app in Ladok`);
      res.render("error", {
        layout: false,
        title: "Unauthorized",
        subtitle: "You must have reporter permissions in Ladok to use this app",
        code: `user is not allowed in Ladok`,
      });

      return;
    }

    const accessData = {
      token,
      userId,
      realUserId,
      courseId,
    };
    res.cookie("access_data", accessData, { signed: true });
    next();
  };

module.exports = (redirectPath) => ({
  oauth1: oauth1(redirectPath),
  oauth2: oauth2(redirectPath),
});
