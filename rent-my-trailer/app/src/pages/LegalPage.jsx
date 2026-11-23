export default function LegalPage({
  title,
  subtitle,
  lead,
  sections = [],
  aside,
  lastUpdated = "October 15, 2026",
}) {
  return (
    <section className="page" style={{ maxWidth: 1080 }}>
      <div className="legal-head">
        <div>
          <p className="legal-kicker">{title}</p>
          <h1 className="sec-title">{subtitle}</h1>
          {lead && <p className="sec-sub">{lead}</p>}
        </div>
        {aside && <div className="legal-aside">{aside}</div>}
      </div>

      <p className="legal-updated">Last updated: {lastUpdated}</p>

      <div className="legal-prose">
        {sections.map(({ heading, content, bullets }, index) => (
          <article className="legal-section" key={`${heading}-${index}`}>
            <h3>{heading}</h3>
            {content && <p>{content}</p>}
            {bullets && (
              <ul>
                {bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="legal-links">
        <a href="#/terms">Terms</a>
        <a href="#/privacy">Privacy</a>
        <a href="#/refund">Refunds</a>
        <a href="#/faq">FAQ</a>
        <a href="#/contact">Contact</a>
      </div>
    </section>
  );
}
