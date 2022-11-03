const fetch = require('node-fetch')

const URL = 'https://api.sendinblue.com/v3/smtp/email'

if (!process.env.SEND_IN_BLUE_KEY) throw new Error('Expected a SEND_IN_BLUE_KEY env var to be set')
if (!process.env.FROM_EMAIL) throw new Error('Expected a FROM_EMAIL env var to be set')

module.exports.sendEmail = async ({ email, name, subject, content }) => {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.SEND_IN_BLUE_KEY
    },
    body: JSON.stringify({
      sender: {
        name: 'Faithfully Yours Labradors',
        email: process.env.FROM_EMAIL
      },
      to: [
        {
          email,
          name
        }
      ],
      subject: subject,
      textContent: content
    })
  })

  if (res.ok) return

  throw new Error('Failed to send email:', await res.text())
}
