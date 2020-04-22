require('dotenv').config()
const inquirer = require('inquirer')
const Canvas = require('@kth/canvas-api')

async function start () {
  const { canvasApiUrl } = await inquirer.prompt({
    type: 'list',
    name: 'canvasApiUrl',
    message: 'Select a Canvas instance',
    choices: [
      {
        name: 'test',
        value: 'https://kth.test.instructure.com/api/v1',
        short: 'test'
      },
      {
        name: 'beta',
        value: 'https://kth.beta.instructure.com/api/v1',
        short: 'beta'
      },
      {
        name: 'prod',
        value: 'https://kth.instructure.com/api/v1',
        short: 'prod'
      }
    ]
  })

  const canvasApiToken =
    process.env.CANVAS_API_TOKEN ||
    (
      await inquirer.prompt({
        name: 'value',
        message: 'Paste the Canvas API token'
      })
    ).value

  const canvas = Canvas(canvasApiUrl, canvasApiToken)
  const tools = (
    await canvas.get('accounts/1/external_tools?per_page=100')
  ).body.map(tool => ({
    short: tool.id,
    name: `ID: ${tool.id}. NAME: ${tool.name}. URL: ${tool.url}`,
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
    message: 'Replace an existing button or create a new one?',
    choices: tools
  })

  const { buttonUrl } = await inquirer.prompt({
    type: 'list',
    name: 'buttonUrl',
    message: 'Where is the app deployed?',
    choices: [
      'http://localhost:3001/api/lms-export-to-ladok-2/export',
      'https://api-r.referens.sys.kth.se/api/lms-export-to-ladok-2/export',
      'https://api.kth.se/api/lms-export-to-ladok-2/export'
    ]
  })

  const { courseId } = await inquirer.prompt({
    name: 'courseId',
    message: 'Enter the course id (use sis_course_id:xxx if you prefer)'
  })

  const { buttonName } = await inquirer.prompt({
    name: 'buttonName',
    message: 'Select a name for the button',
    default: 'KTH Överföring till Ladok (Beta)'
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
    },
    editor_button: {
      enabled: true
    }
  }
  if (buttonId === 'new') {
    const newButton = await canvas.requestUrl(
      `/courses/${courseId}/external_tools`,
      'POST',
      body
    )

    console.log(`New button created with ID: ${newButton.body.id}`)
  } else {
    return canvas.requestUrl(
      `/accounts/1/external_tools/${buttonId}`,
      'PUT',
      body
    )
  }
}

start()
