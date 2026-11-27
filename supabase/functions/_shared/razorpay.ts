import { fetchRetry } from './http.ts'

export function razorpayKeys() {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') ?? ''
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
  return { keyId, keySecret, enabled: Boolean(keyId && keySecret), testMode: keyId.startsWith('rzp_test_') }
}

async function rz<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = razorpayKeys()
  const res = await fetchRetry(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const desc = (body as { error?: { description?: string } })?.error?.description ?? res.statusText
    throw new Error(`RAZORPAY_${res.status}: ${desc}`)
  }
  return body as T
}

export interface RzOrder {
  id: string
  amount: number
  currency: string
  status: string
}
export interface RzPayment {
  id: string
  order_id: string
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  method: string
}

export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  rz<RzOrder>('/orders', { method: 'POST', body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes, payment_capture: 1 }) })

export const fetchPayment = (id: string) => rz<RzPayment>(`/payments/${encodeURIComponent(id)}`)

export const fetchOrderPayments = async (orderId: string) =>
  (await rz<{ items: RzPayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`)).items ?? []

export const capturePayment =(id: string, amountPaise: number) =>
  rz<RzPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: 'POST', body: JSON.stringify({ amount: amountPaise, currency: 'INR' }) })
