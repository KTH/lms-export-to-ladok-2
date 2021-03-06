const packageFile = require("../package.json");
const version = require("../config/version");

function about(req, res) {
  res.setHeader("Content-Type", "text/plain");
  res.send(`
    packageFile.name:${packageFile.name}
    packageFile.version:${packageFile.version}
    packageFile.description:${packageFile.description}
    version.gitBranch:${version.gitBranch}
    version.gitCommit:${version.gitCommit}
    version.gitUrl:${version.gitUrl}
    version.jenkinsBuild:${version.jenkinsBuild}
    version.jenkinsBuildDate:${version.jenkinsBuildDate}
    version.dockerName:${version.dockerName}
    version.dockerVersion:${version.dockerVersion}
    info.canvasInstance:${process.env.CANVAS_HOST}
    info.ladokInstance:${process.env.LADOK_API_BASEURL}
  `);
}

async function monitor(req, res) {
  const statusStr = ["APPLICATION_STATUS: OK"].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.send(statusStr);
}

module.exports = {
  about,
  monitor,
};
