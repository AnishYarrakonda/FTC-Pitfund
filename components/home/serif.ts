import { Newsreader } from 'next/font/google'

/*
 * The serif for the homepage's pinned principle, the one place the page sets a sentence like a quote
 * (the reference uses a commercial text serif there; Newsreader is the open one closest to it). Loaded
 * only by the homepage, not preloaded, and optional: a slow connection keeps the fallback serif.
 */
export const newsreader = Newsreader({ subsets: ['latin'], weight: '400', display: 'optional', preload: false, variable: '--font-serif', fallback: ['Georgia', 'Times New Roman', 'serif'] })
