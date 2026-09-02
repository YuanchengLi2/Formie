import Image from "next/image";

import { DownloadButton, SiteShell } from "@/components/site-shell";

const benefits = [
  "Whole-set movement breakdowns",
  "Visible evidence and timestamps",
  "One personalized cue for your next set",
  "Progress that stays connected over time",
];

export default function HomePage() {
  return (
    <SiteShell>
      <section className="v2-hero" id="hero">
        <div className="v2-hero-copy">
          <span className="v2-kicker">Video form review for your next rep</span>
          <h1>See your form differently.</h1>
          <p>Record a short set. Formie returns to the exact moments that matter and turns them into clear corrections for your next attempt.</p>
          <DownloadButton />
        </div>
        <div className="v2-hero-art">
          <Image
            src="/assets/formie-hero-product-v4.png"
            width={1536}
            height={1024}
            sizes="(max-width: 900px) 100vw, 68vw"
            alt="Formie dashboard and coaching review shown on two complete phones"
            priority
          />
        </div>
      </section>

      <section className="v2-dark v2-journey" id="how-it-works">
        <div className="v2-section-intro light">
          <span className="v2-kicker">From recording to correction</span>
          <h2>One set becomes your next move.</h2>
          <p>Choose the exercise, capture the complete set, and return to the exact evidence behind each correction.</p>
        </div>
        <Image
          className="v2-journey-image"
          src="/assets/formie-how-it-works-v2.png"
          width={1536}
          height={1024}
          sizes="100vw"
          alt="Formie screens for choosing an exercise, recording a set, reviewing a correction, and understanding muscle focus"
        />
        <div className="v2-journey-rail" aria-label="Formie workflow">
          <span>Choose the movement</span>
          <span>Capture one complete set</span>
          <span>Return to the visible moment</span>
        </div>
      </section>

      <section className="v2-coaching" id="coaching">
        <div className="v2-section-intro">
          <span className="v2-kicker">Every correction stays connected to the evidence</span>
          <h2>See the moment. Know what to change.</h2>
          <p>Start with four whole-lift corrections across stance, distance, posture, lean, grip, load, equipment, balance, safety, and movement. Four is the minimum, not the limit.</p>
        </div>
        <div
          className="v2-coaching-art"
          aria-label="Formie coaching review with What happened, Why it matters, and What to do next"
        >
          <Image
            src="/assets/formie-coaching-product-v4.png"
            width={1536}
            height={1024}
            sizes="(max-width: 1040px) 100vw, 68vw"
            alt="Formie coaching review with recorded exercise video, correction carousel, muscle map, coach note, and score"
          />
        </div>
        <div className="v2-coaching-points">
          <article><span>01</span><div><strong>Watch the evidence</strong><p>Each correction opens at the visible moment behind it.</p></div></article>
          <article><span>02</span><div><strong>Understand the impact</strong><p>Separate tabs keep the observation, reason, and next cue clear.</p></div></article>
          <article><span>03</span><div><strong>Fix the whole lift</strong><p>Move through every supported setup, equipment, load, safety, and movement correction in one review.</p></div></article>
        </div>
      </section>

      <section className="v2-pricing" id="pricing">
        <div className="v2-pro-visual">
          <Image
            src="/assets/formie-pro-suite-v2.png"
            width={1536}
            height={1024}
            sizes="(max-width: 960px) 100vw, 68vw"
            alt="Formie dashboard, saved analyses, progress, and a clearly labeled Formie Coach preview"
          />
          <p className="v2-preview-note">Formie Coach shown in this concept is a preview and is not included in Formie Pro yet.</p>
        </div>
        <article className="v2-pro-card">
          <header>
            <span className="v2-kicker">Formie Pro</span>
            <div className="v2-plan-options">
              <div><span>Monthly</span><h2>$9.99 <small>/ month</small></h2><p>10 analyses/month</p></div>
            </div>
            <p>Choose the monthly plan in the Formie app. It includes 10 complete analyses each month, resetting without carryover.</p>
          </header>
          <div className="v2-plan-meter" aria-label="Ten analyses included">
            {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          </div>
          <ul>
            {benefits.map((benefit) => <li key={benefit}><span>Included</span>{benefit}</li>)}
          </ul>
          <DownloadButton />
        </article>
      </section>
    </SiteShell>
  );
}
