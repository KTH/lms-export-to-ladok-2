/* eslint-env mocha */

/* global cy, Cypress */
describe("Basic smoke testing of the app in Canvas", function () {
  it("Should be able to launch the app", function () {
    cy.visit(`${Cypress.env("PROXY_BASE")}/api/lms-export-to-ladok-2/app`);

    cy.get("title").should("contain", "Transfer to Ladok");
  });
});
