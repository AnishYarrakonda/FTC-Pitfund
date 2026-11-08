import type { Metadata } from 'next'

import { HomeEffects } from '@/components/home/home-effects'
import { Hero } from '@/components/home/hero'
import { Footer, FooterCta } from '@/components/home/lower'
import { HomeNav, SeasonBanner } from '@/components/home/nav'
import { Faq, Features, FindPath, HowItWorks, Sides, Teamwork } from '@/components/home/sections'

import './home.css'

/*
 * Landing page. Fully static: no cookies, no database. Dark, quiet and type-led: a dot-grid hero with
 * a still of the product, a feature grid, a light panel for how a pitch moves, the two sides, and the
 * FAQ. Everything on it is a real product rule or flow (no invented customers, figures or quotes).
 * Markup is server-rendered; one small island (<HomeEffects>) loads the behavior (effects/*) after
 * first paint, so the page's first-load JS stays within budget. The only other island reads the
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
      <SeasonBanner />
      <HomeNav />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Sides />
        <Teamwork />
        <FindPath />
        <Faq />
        <FooterCta />
      </main>
      <Footer />
      <HomeEffects />
    </div>
  )
}
