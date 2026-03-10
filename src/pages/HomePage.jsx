import React from 'react';
import { Link } from 'react-router-dom';
import shiftwayLogo from '../assets/logos/logo-wordmark.webp';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-brand-lightest">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-brand-light bg-white">
        <div className="flex items-center">
          <img src={shiftwayLogo} alt="Shiftway" className="h-24 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pricing" className="text-sm font-medium text-brand-dark hover:text-brand-darker transition">Pricing</Link>
          <Link
            to="/signup"
            className="rounded-xl border border-brand-dark bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-darker"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="inline-flex items-center rounded-full border border-brand-light bg-white px-4 py-1.5 text-xs font-semibold text-brand-dark shadow-sm mb-6">
          🚀 Now in early access
        </div>
        <h1 className="text-5xl font-black text-brand-text leading-tight mb-6">
          Employee scheduling<br />your team will actually love
        </h1>
        <p className="text-lg text-brand-dark/80 max-w-2xl mx-auto mb-10">
          Shiftway makes it easy to build schedules, manage time-off, and keep your whole team in sync — no spreadsheets required.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="rounded-2xl bg-brand-dark px-8 py-3 text-base font-bold text-white shadow-lg transition hover:bg-brand-darker hover:shadow-xl"
          >
            Start free trial
          </Link>
          <Link
            to="/pricing"
            className="rounded-2xl border border-brand-light bg-white px-8 py-3 text-base font-semibold text-brand-dark shadow-sm transition hover:border-brand hover:bg-brand-lightest"
          >
            See pricing
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-20 grid gap-6 md:grid-cols-3 text-left">
          {[
            { icon: '📅', title: 'Visual scheduling', desc: 'Drag-and-drop week grid. Build the whole week in minutes.' },
            { icon: '📲', title: 'Team notifications', desc: 'Employees get notified of shifts, swaps, and time-off approvals automatically.' },
            { icon: '💼', title: 'Built for shift work', desc: 'Swap requests, open shifts, unavailability, time-off — all in one place.' },
          ].map((f) => (
            <div key={f.title} className="rounded-[1.5rem] border border-brand-light bg-white p-6 shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-bold text-brand-text mb-1">{f.title}</div>
              <div className="text-sm text-brand-dark/80">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-8 text-xs text-brand-dark/50">
        © {new Date().getFullYear()} Shiftway. All rights reserved.
      </footer>
    </div>
  );
}
