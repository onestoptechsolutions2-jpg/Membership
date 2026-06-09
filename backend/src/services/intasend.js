import axios from 'axios'
import crypto from 'crypto'

const BASE = 'https://sandbox.intasend.com/api/v1' // swap to live.intasend.com in prod

export async function triggerSTKPush({ phone, amount, accountRef, description, paymentId }) {
  const res = await axios.post(
    `${BASE}/payment/mpesa-stk-push/`,
    {
      phone_number: phone,
      amount,
      account_reference: accountRef,
      narrative: description,
      api_ref: paymentId,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )
  return res.data
}

export function verifyWebhookSignature(payload, signature) {
  if (!signature || !process.env.INTASEND_WEBHOOK_SECRET) return false
  const hmac = crypto.createHmac('sha256', process.env.INTASEND_WEBHOOK_SECRET)
  hmac.update(JSON.stringify(payload))
  const expected = hmac.digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
