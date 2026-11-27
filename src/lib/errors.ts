const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Please sign in again to continue.',
  FORBIDDEN: 'You do not have permission to do that.',
  RATE_LIMITED: 'Too many requests. Please wait a little and try again.',
  CHAPTER_LOCKED: 'Complete the previous chapters first to unlock this one.',
  CHAPTER_NOT_FOUND: 'This chapter is not available.',
  NO_QUESTIONS: 'No questions are available yet. Please check back soon.',
  ATTEMPT_NOT_FOUND: 'This test attempt could not be found. Please start the test again.',
  CHALLENGE_NOT_FOUND: 'This challenge could not be found.',
  CHALLENGE_EXPIRED: 'This challenge period has ended. A new challenge is ready for you.',
  INVALID_ANSWERS: 'Your answers could not be read. Please try again.',
  NOT_ELIGIBLE: 'Complete all chapters to request the final exam.',
  ADDRESS_REQUIRED: 'Please add your full residential address in Account Settings first. The question paper is posted to it.',
  INVALID_PHONE: 'Please enter a valid mobile number.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  LAST_ADMIN: 'At least one admin must remain.',
  ANSWER_REQUIRED: 'Please provide the correct answer.',
  OPTIONS_REQUIRED: 'Multiple-choice questions need at least two options.',
  INVALID_MCQ_ANSWER: 'Choose which option is correct.',
  INVALID_TF_ANSWER: 'Choose True or False as the correct answer.',
  SMS_NOT_CONFIGURED: 'Mobile OTP is not available yet. You can verify your number later from Account Settings.',
  PAYMENTS_NOT_CONFIGURED: 'Online contributions are being set up. Please check back soon.',
  OTP_INVALID: 'That code is not correct. Please check and try again.',
  OTP_EXPIRED: 'That code has expired. Please request a new one.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Please request a new code.',
  EXAM_NOT_APPROVED: 'Your exam readiness has not been approved yet.',
  EXAM_NOT_SCHEDULED: 'Your exam date has not been published yet.',
  EXAM_NOT_OPEN: 'The examination has not opened yet.',
  EXAM_ENTRY_CLOSED: 'The time to start this examination has passed. Please contact the organisation.',
  EXAM_CLOSED: 'The examination time is over – uploads and submission are closed.',
  NOT_ONLINE_EXAM: 'Your exam preference is offline (paper by post).',
  PAPER_NOT_READY: 'The question paper is not available yet.',
  NO_PAGES: 'Upload at least one answer-sheet page before submitting.',
  UPLOAD_NOT_FOUND: 'The upload did not reach the server. Please retry this page.',
  RESULT_ALREADY_PUBLISHED: 'This result is already published. Confirm “overwrite published result” to change it.',
  INVALID_MARKS: 'Marks must be between 0 and the maximum marks.',
  EVALUATE_BEFORE_PURGE: 'Save the evaluation before removing the answer sheets.',
  VIDEO_NOT_AVAILABLE: 'This lesson is not available yet.',
  REGISTRATION_PENDING: 'Please complete your ₹151 registration payment to unlock learning.',
  ENGLISH_NAME_REQUIRED: 'Please also enter your name in English letters – it is used for your member ID.',
  ENGLISH_NAME_INVALID: 'Write the English name with letters A–Z only.',
  GUARDIAN_PHONE_REQUIRED: 'Members under 18 must give a parent or guardian mobile number.',
  PHONE_REQUIRED: 'Please enter your mobile number.',
  PAYMENT_PENDING: 'Your payment is still being processed by the bank. Please check the status again in a minute.',
  STATUS_CHECK_FAILED: 'We could not reach the payment gateway. Please try “Check payment status” again shortly.',
  REFERENCE_REQUIRED: 'Enter the payment reference (receipt or transaction number).',
  ORDER_FAILED: 'We could not start the payment. Please try again.',
  PAYMENT_VERIFICATION_FAILED: 'We could not verify this payment. If money was deducted, it will be reconciled automatically.',
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  const raw =
    typeof err === 'string'
      ? err
      : (err as { message?: string; error?: string; code?: string }).message ??
        (err as { error?: string }).error ??
        ''
  for (const key of Object.keys(MESSAGES)) {
    if (raw.includes(key)) return MESSAGES[key]
  }
  if (/Failed to fetch|NetworkError|network/i.test(raw)) {
    return 'You appear to be offline. Nothing was saved – please reconnect and try again.'
  }
  if (/Invalid login credentials/i.test(raw)) return 'Incorrect email or password.'
  if (/Email not confirmed/i.test(raw)) return 'Please verify your email first. Check your inbox for the verification link.'
  if (/User already registered/i.test(raw)) return 'An account with this email already exists. Try signing in.'
  if (/Password should be/i.test(raw)) return raw
  if (/rate limit|over_email_send_rate_limit|too many/i.test(raw)) return MESSAGES.RATE_LIMITED
  if (/duplicate key.*phone|profiles_phone_key/i.test(raw)) return 'This mobile number is already registered.'
  if (/Database error saving new user/i.test(raw)) return 'We could not create your account. This email or mobile number may already be registered.'
  return raw && raw.length < 160 ? raw : fallback
}
