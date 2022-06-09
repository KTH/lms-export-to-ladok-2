/**
 * Basic API test.
 * It tries to fetch course information
 */
require("dotenv").config();
const { getCourseStructure } = require("../../lib/get-course-structure");

async function start() {
  const token = process.env.CANVAS_ADMIN_API_TOKEN;
  // const data = await getCourseStructure(1, token)
  const data = await getCourseStructure(22936, token);
  // const data = await getCourseStructure(11555, token)
  console.log(data);
  console.log("=== Modules ===");
  console.log(data.modules);
  console.log("=== Examinations ===");
  console.log(data.examinations);
}

start().catch((err) => console.error(err));
