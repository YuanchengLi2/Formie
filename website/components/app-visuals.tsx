import Image from "next/image";

export function Score({ value = 76 }: { value?: number }) {
  return (
    <div className="score-card">
      <span>Overall form</span>
      <strong>{value}</strong>
      <div className="meter"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function AnalysisPanel() {
  return (
    <div className="analysis-panel">
      <div className="panel-eyebrow">Issue 1 of 4</div>
      <h3>Shortened Bottom Range</h3>
      <div className="timeline"><span>00:00</span><i /><b /><span>00:08</span></div>
      <div className="tabs"><strong>What happened</strong><span>Why it matters</span><span>What to do next</span></div>
      <p>The dumbbells stop descending at ear level rather than reaching the shoulder line.</p>
    </div>
  );
}

export function PhoneDashboard() {
  return (
    <div className="phone">
      <div className="phone-island" />
      <div className="phone-brand">Formie</div>
      <h3>Your Formie<br />dashboard</h3>
      <p>4 analyses this week</p>
      <div className="phone-stats"><div><small>Current streak</small><strong>3 days</strong></div><div><small>Average score</small><strong>78</strong></div></div>
      <div className="latest"><small>Latest analysis</small><strong>Dumbbell Shoulder Press</strong><b>76</b></div>
      <div className="phone-actions"><span>Coach Preview</span><span>View Progress</span></div>
    </div>
  );
}

export function CoachingCards() {
  return (
    <div className="coaching-cards">
      <article><span>What happened</span><p>The dumbbells stop descending at ear level rather than reaching the shoulder line.</p></article>
      <article><span>Why it matters</span><p>The shortened path makes the next repetition harder to match and repeat.</p></article>
      <article><span>What to do next</span><p>Lower until your upper arm is level with your shoulder, then press smoothly.</p></article>
    </div>
  );
}

export function AnatomyVisual() {
  return (
    <div className="anatomy-card">
      <div><small>Exercise muscle focus</small><strong>Target muscles</strong></div>
      <Image src="/assets/anatomy-body.png" alt="Front and back muscle anatomy view" width={800} height={620} />
    </div>
  );
}
