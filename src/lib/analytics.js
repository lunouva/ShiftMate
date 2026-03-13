export function trackMarketingEvent(eventName, payload = {}) {
  if (typeof window === "undefined" || !eventName) return;

  const eventPayload = {
    event: eventName,
    page_path: window.location.pathname,
    page_url: window.location.href,
    ...payload,
  };

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
  }

  if (window.analytics && typeof window.analytics.track === "function") {
    window.analytics.track(eventName, payload);
  }

  window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
  window.dataLayer.push(eventPayload);

  window.dispatchEvent(
    new CustomEvent("shiftway:analytics", {
      detail: eventPayload,
    })
  );
}
