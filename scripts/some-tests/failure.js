/**
 * Basic test.
 * It tries to send grades to Ladok (without Canvas)
 */
require("dotenv").config();
require("../../lib/ladok/api").init();

const ladok = require("../../lib/ladok");

async function set1(sectionId, moduleId, withFailure = false) {
  const gradeableResults = await ladok.listGradeableResults(
    sectionId,
    moduleId
  );
  const draft = ladok.createDraft(moduleId);

  await draft.setGrade(gradeableResults[0], "P", "2019-12-01");
  await draft.setGrade(gradeableResults[1], "F", "2019-12-01");

  if (withFailure) {
    await draft.setGrade(gradeableResults[6], "F", "2019-12-01"); // This one fails
  }

  return ladok.sendDraft(draft);
}

async function set2(sectionId, moduleId, withFailure = false) {
  const gradeableResults = await ladok.listGradeableResults(
    sectionId,
    moduleId
  );
  const draft = ladok.createDraft(moduleId);

  await draft.setGrade(gradeableResults[0], "P", "2019-12-01"); // Same
  await draft.setGrade(gradeableResults[1], "P", "2019-12-01"); // Update
  await draft.setGrade(gradeableResults[2], "F", "2019-12-01"); // New

  if (withFailure) {
    await draft.setGrade(gradeableResults[6], "F", "2019-12-01"); // This one fails
  }

  return ladok.sendDraft(draft);
}

async function start() {
  // Assume a specific Ladok module, Kurstilfälle, etc.
  // Clean up the "utkast"
  const moduleId = "7fcb7332-73d8-11e8-b4e0-063f9afb40e3";
  const sectionId = "5c6ca54e-f792-11e8-9614-d09e533d4323";
  await ladok.emptyDraft(sectionId, moduleId);

  try {
    const r1 = await set1(sectionId, moduleId, true);

    // createResponse should be length 2
    console.log('==== Expects that "createResponse" is a length-2 array');
    console.log(r1.createResponse);

    // updateResponse should be length 0
    console.log('==== Expects that "updateResponse" is an empty array');
    console.log(r1.updateResponse);
  } catch (err) {
    console.error("==== FAILURE");
    console.error(err);
  }

  await set1(sectionId, moduleId);

  try {
    const r2 = await set2(sectionId, moduleId, true);

    console.log('==== Expects that "createResponse" is a length-1 array');
    console.log(r2.createResponse);

    console.log('==== Expects that "updateResponse" is a length-1 array');
    console.log(r2.updateResponse);
  } catch (err) {
    console.error("==== FAILURE");
    console.error(err);
  }
}

start();
