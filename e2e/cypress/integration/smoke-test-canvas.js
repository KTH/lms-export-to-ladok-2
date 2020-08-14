/* eslint-env mocha */
/* global cy, Cypress */
describe('Basic smoke testing of the app in Canvas', function () {
  it('Should be able to launch the app', function () {
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
    cy.get(`a:contains(${Cypress.env('CANVAS_BUTTON_NAME')})`).click()
    cy.get('iframe#tool_content').then($iframe => {
      const doc = $iframe.contents()
      cy.wrap(doc.find('h1')).should('contain', 'Transfer to Ladok')
    })
  })
})
