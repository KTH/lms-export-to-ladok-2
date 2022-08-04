require("dotenv").config();
require("@kth/reqvars").check();
const { default: log, initializeLogger, setFields } = require("skog");

initializeLogger();
setFields({
  app: "lms-export-to-ladok-2",
});

require("./lib/mongo").init();
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
