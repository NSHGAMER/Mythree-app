import { fetchRetry, log } from './http.ts'

// SMS_PROVIDER = msg91 | twilio | console
//  msg91  : MSG91_AUTH_KEY, MSG91_TEMPLATE_ID (DLT-approved OTP template using the ##OTP## variable)
//  twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM
//  console: development only; requires OTP_ALLOW_CONSOLE=true and only writes the code to function logs.
const provider = () => (Deno.env.get('SMS_PROVIDER') ?? '').toLowerCase()

export function smsConfigured() {
  switch (provider()) {
    case 'msg91':
      return Boolean(Deno.env.get('MSG91_AUTH_KEY') && Deno.env.get('MSG91_TEMPLATE_ID'))
    case 'twilio':
      return Boolean(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && (Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || Deno.env.get('TWILIO_FROM')))
    case 'console':
      return Deno.env.get('OTP_ALLOW_CONSOLE') === 'true'
    default:
      return false
  }
}

export async function sendOtpSms(phoneE164: string, code: string) {
  const p = provider()
  if (p === 'msg91') {
    const res = await fetchRetry('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: Deno.env.get('MSG91_AUTH_KEY')!, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: Deno.env.get('MSG91_TEMPLATE_ID'), short_url: '0', recipients: [{ mobiles: phoneE164.replace('+', ''), OTP: code, otp: code }] }),
    })
    if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`)
    return
  }
  if (p === 'twilio') {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const form = new URLSearchParams({ To: phoneE164, Body: `${code} is your Mythree verification code. It expires in 10 minutes. Do not share it.` })
    const ms = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')
    if (ms) form.set('MessagingServiceSid', ms)
    else form.set('From', Deno.env.get('TWILIO_FROM')!)
    const res = await fetchRetry(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`)
    return
  }
  if (p === 'console' && Deno.env.get('OTP_ALLOW_CONSOLE') === 'true') {
    log('otp_console_delivery', { phone_suffix: phoneE164.slice(-4), code })
    return
  }
  throw new Error('SMS_NOT_CONFIGURED')
}
