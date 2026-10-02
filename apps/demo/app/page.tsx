const events = [
  ["09:41:02", "MAIL_RECEIVED", "agent@mermail.app", "Incoming service request"],
  ["09:41:03", "SENTINEL", "CLEAR", "No high-risk signal detected"],
  ["09:41:04", "NORMALIZED", "WEB_RESEARCH", "0.10 USDC quote prepared"],
  ["09:41:05", "APPROVAL", "WAITING", "Human approval required"],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">MERMAIL AGENT SUITE</p>
          <h1>Trust the workflow.<br /><span>Not the inbox.</span></h1>
          <p className="lede">Two composable skills for safer autonomous email workflows: Sentinel protects the agent boundary; Commerce Bridge turns approved requests into auditable service transactions.</p>
        </div>
        <div className="status"><span /> DEMO MODE</div>
      </header>

      <section className="grid two">
        <article className="card accent">
          <div className="cardhead"><span>01</span><strong>Mermail Sentinel</strong><b>CLEAR</b></div>
          <p>Security gate for untrusted inbound agent mail.</p>
          <div className="signals"><span>Identity</span><span>Intent</span><span>Injection</span><span>Secrets</span><span>Payment</span><span>Links</span></div>
        </article>
        <article className="card">
          <div className="cardhead"><span>02</span><strong>Commerce Bridge</strong><b>APPROVAL</b></div>
          <p>Transforms a cleared request into a quote → approval → execution → receipt workflow.</p>
          <div className="flow"><i>QUOTE</i><em>→</em><i>APPROVE</i><em>→</em><i>EXECUTE</i><em>→</em><i>RECEIPT</i></div>
        </article>
      </section>

      <section className="card timeline">
        <div className="sectiontitle"><span>LIVE TRACE</span><small>MERMAIL → SENTINEL → COMMERCE</small></div>
        {events.map(([time, type, actor, message]) => <div className="event" key={time}><time>{time}</time><b>{type}</b><span>{actor}</span><p>{message}</p></div>)}
      </section>

      <section className="card principle">
        <div><p className="eyebrow">SAFETY CONTRACT</p><h2>Email can request.<br />Email cannot authorize.</h2></div>
        <div className="rules"><p>✓ External effects require explicit approval</p><p>✓ Payment requests remain untrusted</p><p>✓ Sentinel evidence is preserved</p><p>✓ Ambiguous execution fails closed</p></div>
      </section>
    </main>
  );
}
