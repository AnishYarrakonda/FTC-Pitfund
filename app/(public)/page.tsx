import type { Metadata } from 'next'

import { Audiences } from '@/components/home/audiences'
import { Bento } from '@/components/home/bento'
import { HomeEffects } from '@/components/home/home-effects'
import { Hero } from '@/components/home/hero'
import { Footer, FooterCta } from '@/components/home/lower'
import { FindPath, Stats } from '@/components/home/middle'
import { HomeNav } from '@/components/home/nav'

import './home.css'

/*
 * Landing page. Fully static: no cookies, no database. Its structure, type, spacing and interactions are
 * a close reconstruction of a reference fintech homepage, adapted to FTC Pitfund's real rules and flows (no
 * invented customers, figures or quotes). Markup is server-rendered; one small island
 * (<HomeEffects>) loads the behavior (effects/*) after first paint, so the page's first-load JS stays
 * within budget. The only other island reads the session cookie for the top bar.
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
      <HomeNav />
      <main id="main">
        <Hero />
        <Bento />
        <FindPath />
        <Stats />
        <Audiences />
        <FooterCta />
      </main>
      <Footer />
      <HomeEffects />
    </div>
  )
}
