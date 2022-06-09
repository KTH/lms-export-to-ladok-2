const CanvasAPI = require("@kth/canvas-api");
const { ladokGot } = require("./utils");
const {
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
} = require("./errors");

/**
 * @typedef {object} Module A module (modul) in Ladok
 *
 * @property {string} uid    Ladok UID of the module
 * @property {string} code   Code of the module
 * @property {string} courseCode Ladok Course code
 * @property {object} name Name of the module in English and Swedish
 * @property {string} name.en
 * @property {string} name.sv
 *
 * @property {object[]} sections Sections in Canvas (eq. to Ladok course rounds)
 *   that are mapped to this module
 * @property {string} sections.id   Canvas SIS ID
 * @property {string} sections.uid  Ladok UID
 * @property {string} sections.code Ladok Code
 * @property {string} sections.name Canvas name
 */

/**
 * Returns a course round structure with the information from Ladok
 * @param {string} ladokId
 * @returns {Promise<Module[]>}
 */
async function getLadokModules(ladokId) {
  const { body } = await ladokGot
    .get(`/resultat/kurstillfalle/${ladokId}/moment`)
    .catch(ladokGenericErrorHandler);

  // Information about Aktivitetstillfälle can be found in the array:
  // body.IngaendeMoment[0].Aktivitetstillfallen

  if (!body.IngaendeMoment) {
    return [];
  }

  return body.IngaendeMoment.map((moment) => ({
    uid: moment.UtbildningsinstansUID,
    code: moment.Utbildningskod,
    name: {
      en: moment.Benamning.en,
      sv: moment.Benamning.sv,
    },
    sections: [
      {
        uid: ladokId,
        code: body.Kurstillfalleskod,
      },
    ],
  }));
}

/**
 * @typedef {object} ExaminationRound A examination round (aktivitetstillfälle)
 * instance in Ladok
 * @property {string} uid  Ladok UID of the examination round
 * @property {object} name Name in English and Swedish
 * @property {string} name.en
 * @property {string} name.sv
 * @property {object} date Start and end date of the examination round
 * @property {string} date.start
 * @property {string} date.end
 *
 * @property {object[]} modules Course modules in Ladok mapped with this
 * examination round
 * @property {string} modules.courseCode Ladok Course code (eg. ID1200)
 * @property {string} modules.examCode Ladok exam code (eg.TEN1)
 * @property {string} modules.courseRoundCode Ladok course round code
 */

/**
 * Get the structure of an examination round
 *
 * @param {string} SIS ID SIS ID from Canvas
 * @returns {Promise<ExaminationRound>}
 */
async function getLadokExaminationRound(sisId) {
  const ladokId = sisId.split(".")[1];

  const { body: round } = await ladokGot
    .get(`/resultat/aktivitetstillfalle/${ladokId}`)
    .catch(ladokGenericErrorHandler);

  const modules = [];
  for (const koppling of round.Kopplingar) {
    for (const kurstillfalle of koppling.Kurstillfallen) {
      modules.push({
        courseCode: koppling.Kursinstans.Utbildningskod,
        examCode: koppling.Aktivitet.Utbildningskod,
        courseRoundCode: kurstillfalle.TillfallesKod,
      });
    }
  }

  return {
    uid: round.Uid,
    name: {
      en: round.Benamning.en,
      sv: round.Benamning.sv,
    },
    date: {
      start: round.Datumperiod.Startdatum,
      end: round.Datumperiod.Slutdatum,
    },
    modules,
  };
}

/**
 * @typedef {object} Assignment Assignment in Canvas
 * @property {number} id
 * @property {string} name
 * @property {string} type Grading type (i.e. "points", etc)
 */

/** @returns {Promise<Assignment[]>} */
async function getAssignments(courseId, token) {
  const canvas = CanvasAPI(process.env.CANVAS_HOST + "/api/v1", token);

  const assignments = await canvas
    .list(`/courses/${courseId}/assignments`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  return assignments.map((assignment) => ({
    id: assignment.id,
    name: assignment.name,
    type: assignment.grading_type,
    link: `${process.env.CANVAS_HOST}/courses/${courseId}/assignments/${assignment.id}`,
    published: assignment.published,
  }));
}

/** Get the type of a section */
function getSectionType(sectionSisId) {
  const EXAM_ROUND_REGEX = /^AKT\.([a-z0-9-]+)(\.FUNKA)?$/;
  const COURSE_ROUND_REGEX = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/;

  if (COURSE_ROUND_REGEX.test(sectionSisId)) {
    return "course round";
  }
  if (EXAM_ROUND_REGEX.test(sectionSisId)) {
    return "examination round";
  }

  return null;
}

/**
 * @param {Module[]} modules
 * @returns {Module[]}
 */
function mergeModules(modules) {
  const merged = [];

  for (const module of modules) {
    const existing = merged.find((m) => m.uid === module.uid);

    if (existing) {
      existing.sections.push(...module.sections);
    } else {
      merged.push(module);
    }
  }

  return merged;
}

/**
 * @param {ExaminationRound[]} modules
 * @returns {ExaminationRound[]}
 */
function mergeExaminationRounds(examinationRounds) {
  const merged = [];

  for (const round of examinationRounds) {
    const existing = merged.find((m) => m.uid === round.uid);

    if (!existing) {
      merged.push(round);
    }
  }

  return merged;
}

/**
 * Get the structure of a Canvas course
 *
 * @returns {Promise<{
 *   name: string,
 *   assignments: Assignment[],
 *   modules: Module[],
 *   examinations: ExaminationRound[]
 * }>}
 */

async function getCourseStructure(courseId, token) {
  const canvas = CanvasAPI(process.env.CANVAS_HOST + "/api/v1", token);
  const { body: course } = await canvas
    .get(`/courses/${courseId}`)
    .catch(canvasGenericErrorHandler);

  const sections = await canvas
    .list(`/courses/${courseId}/sections`)
    .toArray()
    .catch(canvasGenericErrorHandler);

  const assignments = await getAssignments(courseId, token);

  // NOTE: course.grading_standard_id can be "0"
  if (course.grading_standard_id !== null) {
    assignments.push({
      id: 0,
      name: "Total column",
      type: "letter_grade",
      published: true,
    });
  }

  const allModules = [];
  const allExaminations = [];

  for (const section of sections) {
    if (getSectionType(section.sis_section_id) === "examination round") {
      allExaminations.push(
        // eslint-disable-next-line no-await-in-loop
        await getLadokExaminationRound(section.sis_section_id)
      );
    } else if (getSectionType(section.sis_section_id) === "course round") {
      // eslint-disable-next-line no-await-in-loop
      allModules.push(...(await getLadokModules(section.sis_section_id)));
    }
  }

  return {
    name: course.name,
    assignments,
    modules: mergeModules(allModules),
    examinations: mergeExaminationRounds(allExaminations),
  };
}

module.exports = { getCourseStructure, getSectionType };
