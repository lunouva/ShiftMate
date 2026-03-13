import React from "react";
import { Link } from "react-router-dom";
import shiftwayLogo from "../../assets/logos/logo-wordmark.webp";
import { marketingFooterGroups, marketingNavLinks } from "../../content/marketingPages.js";

function FooterLink({ item }) {
  if (item.href) {
    return (
      <a href={item.href} className="text-sm text-brand-dark/80 transition hover:text-brand-darker">
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.to} className="text-sm text-brand-dark/80 transition hover:text-brand-darker">
      {item.label}
    </Link>
  );
}

function HeaderLink({ item, className = "" }) {
  if (item.href) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.to} className={className}>
      {item.label}
    </Link>
  );
}

export function MarketingHeader({ variant = "default" }) {
  const isCheckout = variant === "checkout";
  const actionLinks = isCheckout
    ? [
        { label: "Pricing", to: "/pricing" },
        { label: "Sign in", to: "/app" },
      ]
    : [
        { label: "Sign in", to: "/app" },
        { label: "Get started", to: "/signup", primary: true },
      ];

  return (
    <nav className="border-b border-brand-light bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="shrink-0">
          <img src={shiftwayLogo} alt="Shiftway" className="h-10 w-auto md:h-11" />
        </Link>

        <div className="flex items-center gap-3 lg:gap-6">
          {!isCheckout && (
            <div className="hidden lg:flex lg:items-center lg:gap-6">
              {marketingNavLinks.map((link) => (
                <HeaderLink
                  key={link.to}
                  item={link}
                  className="text-sm font-medium text-brand-dark transition hover:text-brand-darker"
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {actionLinks.map((link) => (
              <HeaderLink
                key={link.label}
                item={link}
                className={
                  link.primary
                    ? "rounded-xl border border-brand-dark bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-darker"
                    : "text-sm font-medium text-brand-dark transition hover:text-brand-darker"
                }
              />
            ))}
          </div>
        </div>
      </div>

      {!isCheckout && (
        <div className="border-t border-brand-light/60 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-4 px-6 py-3">
            {marketingNavLinks.map((link) => (
              <HeaderLink
                key={`mobile-${link.to}`}
                item={link}
                className="text-sm font-medium text-brand-dark transition hover:text-brand-darker"
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default function MarketingShell({ children }) {
  return (
    <div className="min-h-screen bg-brand-lightest text-brand-text">
      <MarketingHeader />

      {children}

      <footer className="border-t border-brand-light bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-10 flex flex-col gap-5 rounded-[2rem] border border-brand-light bg-brand-lightest/70 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Search-ready site structure</p>
              <h2 className="mt-2 text-2xl font-black text-brand-text">Build the brand, product, industry, and trust pages buyers expect.</h2>
              <p className="mt-2 text-sm text-brand-dark/75">
                Shiftway now has a footer and route structure that can scale the way larger scheduling software sites do.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/product"
                className="rounded-xl border border-brand-dark bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-darker"
              >
                Browse product pages
              </Link>
              <Link
                to="/industries"
                className="rounded-xl border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
              >
                Browse industries
              </Link>
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-6">
            {marketingFooterGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-brand-text">{group.title}</h3>
                <div className="space-y-2.5">
                  {group.items.map((item) => (
                    <div key={`${group.title}-${item.label}`}>
                      <FooterLink item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-brand-light pt-6 text-xs text-brand-dark/55">
            Copyright {new Date().getFullYear()} Shiftway. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
