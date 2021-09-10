const packageFile = require("../package.json");
const version = require("../config/version");
const { ladokGot2 } = require("../lib/utils");

async function about(req, res) {
  const { body } = await ladokGot2.get(
    "/kataloginformation/anvandare/autentiserad"
  );
  const { Anvandarnamn } = JSON.parse(body);

  res.setHeader("Content-Type", "text/plain");
  res.send(`
    Ladok.user:${Anvandarnamn} 
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
  const statusStr = "APPLICATION_STATUS: OK";

  res.setHeader("Content-Type", "text/plain");
  res.send(statusStr);
}

module.exports = {
  about,
  monitor,
};
