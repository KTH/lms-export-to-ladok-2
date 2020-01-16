/* eslint-env mocha */
/* global cy, Cypress */
describe('Verify that users without correct permissions are denied access', function () {
  // Tried to add another test that verifies some functionality within the app.
  // Couldn't get it to work without using a callback hell + wait because of the usage of an iframe.
  // Plus it's a lot of duplicated code from the other smoke test function.

  it('Should should deny access if user has not write access in Ladok', function () {
    cy.request('https://kth.test.instructure.com/login/canvas')
      .its('body')
      .then(body => {
        const csrfToken = Cypress.$(body)
          .find('input[name=authenticity_token]')
          .val()

        cy.request({
          method: 'post',
          url: 'https://kth.test.instructure.com/login/canvas',
          form: true,
          body: {
            pseudonym_session: {
              unique_id: 'integration_test',
              password: Cypress.env('CANVAS_TEST_PASSWORD')
            },
            authenticity_token: csrfToken
          }
        })
      })

    cy.visit(
      'https://kth.test.instructure.com/courses/sis_course_id:TEST_LMSC2L'
    )
    cy.get(`a[title=${Cypress.env('CANVAS_BUTTON_NAME')}]`).click()
    cy.get('iframe#tool_content').then($iframe => {
      const doc = $iframe.contents()
      // start the app
      cy.wrap(doc.find('.start_C2L2_button')).click()

      // Wait until the iframe has loaded.
      cy.wait(2000)
      cy.get('iframe#tool_content').then($iframe2 => {
        cy.wrap($iframe2.contents().find('input[type=submit]')).click()
      })
      cy.wait(2000)
      cy.get('iframe#tool_content').then($iframe3 => {
        cy.wrap($iframe3.contents()).should(
          'contain',
          'You must have permissions to write results in Ladok to use this function.'
        )
      })
    })
  })
})
