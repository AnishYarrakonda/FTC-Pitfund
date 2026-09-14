/*
 * Website normalization shared by forms and actions: people type "exodiusftc.com" or
 * "www.example.org/team", so a missing scheme becomes https://. Only http(s) URLs with a real
 * hostname (a dot, no spaces) are accepted.
 */

export const MAX_WEBSITE_LENGTH = 300

export function normalizeWebsite(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || /\s/.test(trimmed)) return null
  // Drop a lone trailing slash so "example.org" and "example.org/" are the same site.
  const href = url.pathname === '/' && !url.search && !url.hash ? url.origin : url.href
  return href.length <= MAX_WEBSITE_LENGTH ? href : null
}

/** "https://www.exodiusftc.com/team" → "exodiusftc.com/team" for display. */
export function displayWebsite(href: string): string {
  return href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}
