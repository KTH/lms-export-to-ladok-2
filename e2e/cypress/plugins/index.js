// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

module.exports = (on, config) => {
  try {
    require("dotenv").config();
  } catch (e) {
    console.log(
      "dotenv package not installed, presupposing env vars already set"
    );
  }

  config.env.CANVAS_TEST_PASSWORD = process.env.CANVAS_TEST_PASSWORD;
  config.env.CANVAS_CLIENT_ID = process.env.CANVAS_CLIENT_ID;
  config.env.PROXY_BASE = process.env.PROXY_BASE;

  return config;
};
