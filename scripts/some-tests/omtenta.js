/**
 * Basic test.
 * It tries to send grades to Ladok (without Canvas)
 */
require("dotenv").config();
require("../../lib/ladok/api").init();
const ladok = require("../../lib/ladok");

async function start() {
  // Assume a specific Ladok examination
  // Aktitivitetstillfälle ID
  const examId = "d3289b77-6780-11ea-bbe9-d6135c344c05";

  // From Kopps Course HF1008 TEN2
  // "Modul ID" = Aktivitets ID
  const moduleId = "4cb831ea-73d8-11e8-b4e0-063f9afb40e3";
  try {
    const gradeableResults = await ladok.listExamGradeableResults(examId);
    const draft = ladok.createDraft(moduleId);
    console.log(gradeableResults[0]);

    await draft.setGrade(gradeableResults[0], "B", "2020-04-13");
    // await draft.setGrade(gradeableResults[1], 'F', '2019-12-01')

    const r = ladok.sendDraft(draft);
    console.log(r);
  } catch (err) {
    console.error(err);
  }
}

start();
