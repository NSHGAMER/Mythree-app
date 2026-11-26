import { corsHeaders, json } from '../_shared/http.ts'
import { razorpayKeys } from '../_shared/razorpay.ts'

// Public: tells the app whether online contributions are switched on. Never returns the secret.
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  const { keyId, enabled, testMode } = razorpayKeys()
  return json(req, { enabled, key_id: enabled ? keyId : null, test_mode: testMode })
})
