import type { Metadata } from 'next'

import { Hero } from '@/components/home/hero'
import { HomeEffects } from '@/components/home/home-effects'
import { Footer, FooterCta } from '@/components/home/lower'
import { SiteHead } from '@/components/home/nav'
import { Chapters, Faq, FindPath, People, Season, Sides } from '@/components/home/sections'

import './home.css'

/*
 * Landing page, after attio.com: white and hairline-framed, a pinned hero the product window rises
 * over, a pinned chapter rail beside statements and product panels, a dark section on review and
 * privacy, then the season, both sides, the FAQ and a dark close. Fully static: no
 * cookies, no database. Every claim on it is a real product rule (no invented customers, figures or
 * quotes). Markup is server-rendered; one small island (<HomeEffects>) loads the behavior (effects/*)
 * after first paint, so the page's first-load JS stays within budget. The only other island reads the
 * session cookie for the top bar.
 */

export const metadata: Metadata = {
  title: { absolute: 'FTC Pitfund · Sponsorship pitches companies actually read' },
  description:
    'FIRST® Tech Challenge teams pitch companies that already sponsor robotics. Answer each company’s own questions, and a real person checks every pitch before it lands.',
  alternates: { canonical: '/' },
}

export default function LandingPage() {
  return (
    <div className="hp" data-hp-root>
      <SiteHead />
      <main id="main">
        <Hero />
        <Chapters />
        <People />
        <Season />
        <Sides />
        <Faq />
        <FindPath />
        <FooterCta />
      </main>
      <Footer />
      <HomeEffects />
    </div>
  )
}
