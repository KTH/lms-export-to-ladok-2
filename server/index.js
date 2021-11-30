const express = require("express");
const expressHandlebars = require("express-handlebars");
const Router = require("express-promise-router");
const log = require("skog");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cuid = require("cuid");
const system = require("./system");
const { oauth1, oauth2 } = require("./oauth")("/export3");
const authorization = require("./authorization");
const { startPage, showForm } = require("./export-to-ladok");
const getCourseStructure = require("../lib/get-course-structure");
const transferExamination = require("../lib/transfer-examination");
const transferModule = require("../lib/transfer-module");
const { errorHandler } = require("../lib/errors");

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

server.use((req, res, next) => {
  log.child(
    {
      req_id: cuid(),
    },
    next
  );
});

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
    const msg = `Problems getting course info`;
    log.error(msg, err);
    res.status(500).send({
      code: "ladok_fetch_course_info_error",
      message: `${msg} - ${err.message}`,
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
    const msg = `Problems fetching results`;
    log.error(msg, err);
    res.status(500).send({
      code: "ladok_fetch_results_error",
      message: `${msg} - ${err.message}`,
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
    if (err.body && err.body.Meddelande) {
      log.warn(
        `Known error when transferring results to Ladok: ${err.body.Meddelande}`
      );

      res.status(400).send({
        code: "ladok_error",
        message: err.body.Meddelande,
      });
    } else {
      const msg = "Unknown error when transferring results to Ladok";
      log.error(msg, err);
      res.status(500).send({
        code: "unknown_ladok_error",
        message: `${msg} - ${err.message}`,
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
