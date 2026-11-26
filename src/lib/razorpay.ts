let loader: Promise<void> | null = null

/** Loads Razorpay Checkout on demand (never on page load). */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (loader) return loader
  loader = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loader = null
      reject(new Error('Could not load the payment window. Check your connection and try again.'))
    }
    document.body.appendChild(s)
  })
  return loader
}

export interface RazorpaySuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}
