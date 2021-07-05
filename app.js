require("dotenv").config();
require("@kth/reqvars").check();
require("skog/bunyan").createLogger({
  name: "lms-export-to-ladok-2",
  app: "lms-export-to-ladok-2",
  serializers: require("bunyan").stdSerializers,
  level: process.env.LOG_LEVEL || "info",
});
require("./lib/mongo").init();

const log = require("skog");
const server = require("./server");

process.on("uncaughtException", (err) => {
  log.fatal(err, "Uncaught Exception thrown");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  throw reason;
});

server.listen(process.env.PORT || 3001, async () => {
  log.info(
    "Server started. Go to http://localhost:%s",
    process.env.PORT || 3001
  );
});
