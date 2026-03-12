import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import shiftwayLogo from '../assets/logos/logo-wordmark.webp';

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-brand-light">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-base font-semibold text-brand-text transition hover:text-brand-dark"
      >
        {question}
        <span className={`ml-4 text-brand-dark/60 transition-transform ${open ? 'rotate-180' : ''}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="pb-5 text-sm text-brand-dark/80 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

const TESTIMONIALS = [
  {
    quote: "Shiftway has completely transformed how we handle scheduling. It not only has made us more efficient, but it actually saves time in creating the schedules.",
    name: "Sarah Mitchell",
    title: "General Manager",
    company: "Brew & Bite Cafe",
  },
  {
    quote: "I love how easy it is to keep up with our staff's different requests. It serves as a platform for all internal communication and scheduling needs.",
    name: "James Park",
    title: "Operations Manager",
    company: "City Health Clinic",
  },
  {
    quote: "The app replicates exactly what I need without having to create schedules from scratch. The automatic updates keep my team in sync effortlessly.",
    name: "Maria Gonzalez",
    title: "Shift Supervisor",
    company: "FreshMart Retail",
  },
];

const INDUSTRIES = [
  { icon: '🍽️', name: 'Food & Beverage' },
  { icon: '🏪', name: 'Retail' },
  { icon: '🏨', name: 'Hospitality' },
  { icon: '🏥', name: 'Healthcare' },
  { icon: '🎪', name: 'Events & Entertainment' },
  { icon: '📞', name: 'Call Centers' },
  { icon: '🎓', name: 'Education' },
  { icon: '💜', name: 'Nonprofits' },
  { icon: '🚒', name: 'Emergency Services' },
  { icon: '🤝', name: 'Caregiving' },
];

const FAQS = [
  {
    question: 'How can I track employee hours with a time clock?',
    answer: 'Shiftway includes a built-in time clock that lets employees clock in and out from any device. Managers can review timesheets, approve hours, and export data for payroll — all from one dashboard.',
  },
  {
    question: 'How do I calculate labor costs?',
    answer: 'Shiftway automatically calculates labor costs as you build your schedule, so you can see projected costs in real time and make adjustments before publishing.',
  },
  {
    question: 'How do employees access Shiftway?',
    answer: 'Employees access Shiftway through your dedicated workspace URL on any web browser or mobile device. They receive an invitation link via email to create their account.',
  },
  {
    question: 'Are there different levels of access?',
    answer: 'Yes. Shiftway supports owner, manager, and employee roles. Owners and managers can create schedules, approve requests, and manage the team. Employees can view their shifts, request time off, and swap shifts.',
  },
  {
    question: 'Why choose Shiftway?',
    answer: 'Shiftway is built specifically for shift-based teams. It combines scheduling, time-off management, shift swaps, and team communication in one simple tool — no spreadsheets or complicated software required.',
  },
  {
    question: 'Does Shiftway integrate with other tools?',
    answer: 'Shiftway supports CSV and payroll export so you can easily integrate with your existing payroll provider. We are continuously adding new integrations based on customer feedback.',
  },
  {
    question: 'How can I try Shiftway for free?',
    answer: 'Sign up for a 14-day free trial — no credit card required. You get full access to all features so you can see how Shiftway works for your team before committing.',
  },
];

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#' },
    { label: 'Employee scheduling', href: '#' },
    { label: 'Time clock', href: '#' },
    { label: 'Communication', href: '#' },
    { label: 'Pricing', to: '/pricing' },
  ],
  Industries: [
    { label: 'Healthcare', href: '#' },
    { label: 'Restaurants', href: '#' },
    { label: 'Retail', href: '#' },
    { label: 'Education', href: '#' },
    { label: 'Hotels', href: '#' },
  ],
  Support: [
    { label: 'Help center', href: '#' },
    { label: 'Contact support', href: 'mailto:hello@shiftway.app' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
  ],
};

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
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
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
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-black text-brand-text text-center mb-12">
            Loved by teams everywhere
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-[1.5rem] border border-brand-light bg-white p-6 shadow-sm">
                <p className="text-sm text-brand-dark/80 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="font-bold text-brand-text text-sm">{t.name}</div>
                <div className="text-xs text-brand-dark/60">{t.title}, {t.company}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Works from anywhere */}
      <section className="px-6 py-16 bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-5xl mb-6">💻 📱</div>
          <h2 className="text-3xl font-black text-brand-text mb-4">
            Works, from anywhere
          </h2>
          <p className="text-brand-dark/80 max-w-xl mx-auto">
            Shiftway is available everywhere you work — on Web, iOS, and Android, so you and your team are aligned wherever you are.
          </p>
        </div>
      </section>

      {/* Built for your industry */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-black text-brand-text text-center mb-4">
            Built for your industry
          </h2>
          <p className="text-brand-dark/80 text-center max-w-2xl mx-auto mb-12">
            Shiftway helps you manage your team more efficiently, regardless of your industry. From local restaurants and coffee shops to regional hotels and retail stores, give your team the power of Shiftway.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.name}
                className="rounded-[1.5rem] border border-brand-light bg-white p-5 text-center shadow-sm transition hover:shadow-md hover:border-brand"
              >
                <div className="text-3xl mb-2">{ind.icon}</div>
                <div className="text-sm font-semibold text-brand-text">{ind.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-dark px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black text-white mb-4">
            Get started today
          </h2>
          <p className="text-brand-light mb-8">
            Schedule faster, communicate better, get things done.
          </p>
          <Link
            to="/signup"
            className="inline-block rounded-2xl bg-white px-10 py-4 text-base font-bold text-brand-dark shadow-lg transition hover:bg-brand-lightest hover:shadow-xl"
          >
            Start free trial
          </Link>
          <p className="mt-4 text-xs text-brand-light/70">14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black text-brand-text text-center mb-12">
            Frequently asked questions
          </h2>
          <div>
            {FAQS.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-text px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <div className="text-sm font-bold text-white mb-4">{category}</div>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link to={link.to} className="text-sm text-brand-light/70 hover:text-white transition">
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-brand-light/70 hover:text-white transition">
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-xs text-brand-light/50">
            &copy; {new Date().getFullYear()} Shiftway. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
