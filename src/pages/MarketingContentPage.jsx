import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import MarketingShell from "../components/marketing/MarketingShell.jsx";
import { marketingPages } from "../content/marketingPages.js";

function ActionLink({ action, primary = false }) {
  const className = primary
    ? "rounded-xl border border-brand-dark bg-brand-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-darker"
    : "rounded-xl border border-brand-light bg-white px-5 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest";

  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    );
  }

  return (
    <Link to={action.to} className={className}>
      {action.label}
    </Link>
  );
}

export default function MarketingContentPage({ page }) {
  const relatedPages = page.groupKey
    ? marketingPages.filter((entry) => entry.groupKey === page.groupKey && entry.path !== page.path).slice(0, 6)
    : [];

  return (
    <MarketingShell>
      <SeoHead title={page.title} description={page.description} path={page.path} faq={page.faq} />

      <main>
        <section className="relative overflow-hidden border-b border-brand-light bg-[radial-gradient(circle_at_top_left,_rgba(130,200,229,0.35),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#f5fbfe_100%)]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">{page.eyebrow}</p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-brand-text md:text-5xl">{page.heroTitle}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-dark/80">{page.heroBody}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink action={page.cta.primary} primary />
                <ActionLink action={page.cta.secondary} />
              </div>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {page.highlights.map((highlight) => (
                <div key={highlight} className="rounded-[1.5rem] border border-brand-light bg-white/90 p-5 shadow-sm">
                  <div className="text-sm font-semibold text-brand-darker">{highlight}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
          <div className="space-y-6">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-[1.75rem] border border-brand-light bg-white p-7 shadow-sm">
                <h2 className="text-2xl font-black text-brand-text">{section.title}</h2>
                <p className="mt-3 text-base leading-7 text-brand-dark/80">{section.body}</p>
                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-sm leading-6 text-brand-dark/80">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-dark" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[1.75rem] border border-brand-light bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Next step</p>
              <h2 className="mt-3 text-xl font-black text-brand-text">{page.cta.title}</h2>
              <p className="mt-3 text-sm leading-6 text-brand-dark/80">{page.cta.body}</p>
              <div className="mt-5 flex flex-col gap-3">
                <ActionLink action={page.cta.primary} primary />
                <ActionLink action={page.cta.secondary} />
              </div>
            </div>

            {relatedPages.length > 0 && (
              <div className="rounded-[1.75rem] border border-brand-light bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Related pages</p>
                <div className="mt-4 space-y-3">
                  {relatedPages.map((entry) => (
                    <Link
                      key={entry.path}
                      to={entry.path}
                      className="block rounded-xl border border-brand-light bg-brand-lightest/45 px-4 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
                    >
                      {entry.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Common questions</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {page.faq.map((entry) => (
                <article key={entry.question} className="rounded-[1.5rem] border border-brand-light bg-brand-lightest/45 p-5">
                  <h3 className="text-base font-black text-brand-text">{entry.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-brand-dark/80">{entry.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
