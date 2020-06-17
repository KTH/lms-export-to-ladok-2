const inquirer = require('inquirer')
const Canvas = require('@kth/canvas-api')

async function start () {
  console.log(
    'This is the "button-account" script.\n\n' +
      'Here you will create or edit a button for the Transfer to Ladok app\n' +
      'as top-level account-level button. It means that the button is visible\n' +
      'for all courses in Canvas\n\n' +
      'Use "button-course.js" for creating or editing course-level buttons'
  )

  const { answer } = await inquirer.prompt({
    type: 'confirm',
    message: 'Do you want to continue?',
    name: 'answer'
  })

  if (!answer) return

  const { canvasRoot } = await inquirer.prompt({
    type: 'list',
    name: 'canvasRoot',
    message: 'Select a Canvas instance',
    choices: [
      {
        name: 'Canvas test (kth.test.instructure.com)',
        value: 'https://kth.test.instructure.com/',
        short: 'test'
      },
      {
        name: 'Canvas beta (kth.beta.instructure.com)',
        value: 'https://kth.beta.instructure.com/',
        short: 'beta'
      },
      {
        name: 'Canvas production (canvas.kth.se)',
        value: 'https://canvas.kth.se/',
        short: 'production'
      }
    ]
  })

  console.log()
  console.log(`Go to ${canvasRoot}profile/settings to get a Canvas API token.`)

  const { canvasApiToken } = await inquirer.prompt({
    name: 'canvasApiToken',
    message: `Paste the API token here`,
    type: 'password'
  })

  const canvas = Canvas(`${canvasRoot}api/v1`, canvasApiToken)
  const tools = (
    await canvas.get('accounts/1/external_tools?per_page=100')
  ).body.map(tool => ({
    short: tool.id,
    name: `Edit the button "${tool.name}" (${tool.url})`,
    value: tool.id
  }))

  tools.unshift(new inquirer.Separator())
  tools.unshift({
    short: 'new',
    name: 'Create a new button',
    value: 'new'
  })

  const { buttonId } = await inquirer.prompt({
    type: 'list',
    name: 'buttonId',
    message: 'Choose a button to edit or create a new one',
    choices: tools
  })

  const { buttonUrl } = await inquirer.prompt({
    type: 'list',
    name: 'buttonUrl',
    message: 'What application do you want to open with the button?',
    choices: [
      {
        name: 'localhost',
        value: 'http://localhost:3001/api/lms-export-to-ladok-2/export'
      },
      {
        name: 'stage (referens)',
        value:
          'https://api-r.referens.sys.kth.se/api/lms-export-to-ladok-2/export'
      },
      {
        name: 'production (app.kth.se)',
        value: 'https://api.kth.se/api/lms-export-to-ladok-2/export'
      }
    ]
  })

  let defaultName = 'KTH Transfer to Ladok'

  if (buttonUrl === 'http://localhost:3001/api/lms-export-to-ladok-2/export') {
    defaultName = 'Transfer to Ladok - localhost'
  } else if (
    buttonUrl ===
    'https://api-r.referens.sys.kth.se/api/lms-export-to-ladok-2/export'
  ) {
    defaultName = 'Transfer to Ladok - referens'
  }

  const { buttonName } = await inquirer.prompt({
    name: 'buttonName',
    message: 'Write a name for the button',
    default: defaultName
  })

  const body = {
    name: buttonName,
    consumer_key: 'not_used',
    shared_secret: 'not_used',
    url: buttonUrl,
    privacy_level: 'public',
    course_navigation: {
      visibility: 'admins',
      windowTarget: '_blank',
      text: buttonName,
      default: false,
      enabled: true
    }
  }

  if (buttonId === 'new') {
    console.log()
    console.log(JSON.stringify(body, null, 2))
    console.log()
    console.log('You are going to make a POST request')
    console.log(`to ${canvasRoot}api/v1/accounts/1/external_tools`)
    console.log('with the body printed above')
    const { proceed } = await inquirer.prompt({
      type: 'confirm',
      name: 'proceed',
      message: `Is it correct?`
    })

    if (!proceed) return

    await canvas.requestUrl('/accounts/1/external_tools', 'POST', body)

    console.log(
      `New button created. You can see it in any course at ${canvasRoot}accounts/1`
    )
  } else {
    console.log()
    console.log(JSON.stringify(body, null, 2))
    console.log()
    console.log('You are going to make a PUT request')
    console.log(`to ${canvasRoot}api/v1/accounts/1/external_tools/${buttonId}`)
    console.log('with the body printed above')
    const { proceed } = await inquirer.prompt({
      type: 'confirm',
      name: 'proceed',
      message: `Is it correct?`
    })

    if (!proceed) return

    await canvas.requestUrl(
      `/accounts/1/external_tools/${buttonId}`,
      'PUT',
      body
    )

    console.log(
      `Button edited. You can see it in any course at ${canvasRoot}accounts/1`
    )
  }
}

start()
