import AfricasTalking from 'africastalking'

let client = null

function getClient() {
  if (!client && process.env.AT_API_KEY) {
    client = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME || 'sandbox',
    })
  }
  return client
}

export async function sendSms(to, message) {
  const c = getClient()
  if (!c) {
    console.warn('SMS not configured (AT_API_KEY missing). Would send:', to, message)
    return
  }
  const sms = c.SMS
  return sms.send({ to: [to], message, from: process.env.AT_SENDER_ID || '' })
}
