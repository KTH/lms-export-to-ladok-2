const express = require("express");
const expressHandlebars = require("express-handlebars");
const Router = require("express-promise-router");
const { skogMiddleware, default: log } = require("skog");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const system = require("./system");
const { oauth1, oauth2 } = require("./oauth")("/export3");
const authorization = require("./authorization");
const { startPage, showForm } = require("./export-to-ladok");
const { getCourseStructure } = require("../lib/get-course-structure");
const transferExamination = require("../lib/transfer-examination");
const transferModule = require("../lib/transfer-module");
const { errorHandler, EndpointError } = require("../lib/errors");

const server = express();
server.set("views", path.join(__dirname, "/views"));
server.engine("handlebars", expressHandlebars());
server.set("view engine", "handlebars");

server.use(bodyParser.json());
server.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
server.use(cookieParser(process.env.COOKIE_SIGNATURE_SECRET));
server.use(skogMiddleware);

const PROXY_PATH = process.env.PROXY_PATH || "";

// Define the router as map between routes and a set of middlewares & handlers
const apiRouter = Router();
const router = Router();

if (process.env.NODE_ENV === "development") {
  const webpack = require("webpack");
  const webpackDevMiddleware = require("webpack-dev-middleware");
  const config = require("../webpack.dev.config.js");
  const compiler = webpack(config);

  server.use(
    webpackDevMiddleware(compiler, {
      publicPath: `${process.env.PROXY_PATH}/dist`,
    })
  );

  server.use(require("webpack-hot-middleware")(compiler));
} else {
  router.use("/dist", express.static(path.resolve(process.cwd(), "dist")));
}
router.post("/export", startPage);
router.post("/export2", oauth1);
router.get("/export3", oauth2, (req, res) => {
  res.redirect("app");
});
router.get("/app", showForm);

router.get("/_monitor", system.monitor);
router.get("/_monitor_all", system.monitor);
router.get("/_about", system.about);
router.use("/api", apiRouter);

apiRouter.get("/course-info", async (req, res) => {
  const { token } = req.signedCookies.access_data;
  const { courseId } = req.signedCookies.access_data;

  try {
    const response = await getCourseStructure(courseId, token);
    res.send(response);
  } catch (err) {
    throw new EndpointError({
      type: "ladok_fetch_course_info_error",
      statusCode: 500,
      message: `Problems fetching results - ${err.message}`,
      err,
    });
  }
});
apiRouter.get("/table", async (req, res) => {
  const { token } = req.signedCookies.access_data;
  const { courseId } = req.signedCookies.access_data;

  const { assignmentId } = req.query;
  const { moduleId } = req.query;

  try {
    if (moduleId) {
      const result = await transferModule.getResults(
        courseId,
        moduleId,
        assignmentId,
        token
      );
      res.send(result);
    } else {
      const result = await transferExamination.getResults(
        courseId,
        assignmentId,
        token
      );
      res.send(result);
    }
  } catch (err) {
    throw new EndpointError({
      type: "ladok_fetch_results_error",
      statusCode: 500,
      message: `Problems fetching results - ${err.message}`,
      err,
    });
  }
});

apiRouter.post("/submit-grades", authorization.denyActAs, async (req, res) => {
  const { token } = req.signedCookies.access_data;
  const { courseId } = req.signedCookies.access_data;

  const { assignmentId } = req.body;
  const { moduleId } = req.body;
  const { examinationDate } = req.body;

  try {
    if (moduleId) {
      const result = await transferModule.transferResults(
        courseId,
        moduleId,
        assignmentId,
        examinationDate,
        token
      );

      res.send(result);
    } else {
      const result = await transferExamination.transferResults(
        courseId,
        assignmentId,
        examinationDate,
        token
      );

      res.send(result);
    }
  } catch (err) {
    switch (err.type) {
      case "rule_error":
        throw new EndpointError({
          type: "ladok_rule_error",
          statusCode: 403,
          message: err.message,
          err,
        });
      case "auth_error":
        throw new EndpointError({
          type: "ladok_auth_error",
          statusCode: 401,
          message: err.message,
          err,
        });
      default:
        throw new EndpointError({
          type: "ladok_unhandled_error",
          statusCode: 400,
          message: err.message,
          err,
        });
    }
  }
});

server.use(PROXY_PATH, router);
server.use((err, req, res, next) => {
  if (err.name === "ClientError") {
    log.warn({
      req,
      res,
      err,
    });
    res.render("error", {
      prefix_path: process.env.PROXY_PATH,
      message: err.message,
      layout: false,
    });
  } else {
    next(err);
  }
});

/**
 * Generic error handler.
 *
 * This is called only if an unhandled error happened during the execution.
 * In that case, the app response is a 500.
 */
// eslint-disable-next-line no-unused-vars
server.use(errorHandler);
module.exports = server;
