import type { ErrorEvent } from '@sentry/nextjs'

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const OTP = /\b\d{6}\b/g

function scrub(value: string) {
  return value.replace(EMAIL, '[email]').replace(OTP, '[code]')
}

/** Strip emails, sign-in codes, cookies and request bodies before an event leaves the app. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies
    delete event.request.data
    if (event.request.headers) {
      delete event.request.headers.cookie
      delete event.request.headers.authorization
    }
    if (event.request.query_string && typeof event.request.query_string === 'string') {
      event.request.query_string = scrub(event.request.query_string)
    }
  }
  if (event.user) event.user = { id: event.user.id }
  if (event.message) event.message = scrub(event.message)
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrub(exception.value)
  }
  return event
}
