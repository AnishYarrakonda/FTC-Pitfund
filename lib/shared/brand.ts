export const PRODUCT_NAME = 'FTC Pitfund'
// The public support address, shown in the footer, legal pages, emails and error screens. Set
// NEXT_PUBLIC_SUPPORT_EMAIL to change it everywhere (it is read at build time, so redeploy after).
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'ftcexodius@gmail.com'
// One light theme, no toggle (app/globals.css): near-black ink on white, one blue accent. Used where
// CSS tokens can't reach: the share cards and app icons (lib/server/og.tsx, app/icon.svg).
export const ACCENT = '#2463E2'
export const INK = '#1C1D1F'
export const FIRST_DISCLAIMER = 'Not affiliated with or endorsed by FIRST®.'
