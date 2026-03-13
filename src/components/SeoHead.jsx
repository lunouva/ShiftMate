import { useEffect } from "react";

const DEFAULT_IMAGE = "https://shiftway.app/logo512.png";

const setMetaTag = (selector, attributes, content) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const setLinkTag = (selector, rel, href) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
};

export default function SeoHead({ title, description, path = "/", faq = [] }) {
  useEffect(() => {
    const canonicalUrl = `https://shiftway.app${path}`;

    document.title = title;
    setMetaTag('meta[name="description"]', { name: "description" }, description);
    setMetaTag('meta[property="og:title"]', { property: "og:title" }, title);
    setMetaTag('meta[property="og:description"]', { property: "og:description" }, description);
    setMetaTag('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    setMetaTag('meta[property="og:image"]', { property: "og:image" }, DEFAULT_IMAGE);
    setMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    setMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    setMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, DEFAULT_IMAGE);
    setLinkTag('link[rel="canonical"]', "canonical", canonicalUrl);

    const faqSchemaId = "shiftway-faq-schema";
    const existingFaqScript = document.getElementById(faqSchemaId);
    if (existingFaqScript) existingFaqScript.remove();

    if (faq.length > 0) {
      const script = document.createElement("script");
      script.id = faqSchemaId;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.answer,
          },
        })),
      });
      document.head.appendChild(script);
    }

    return () => {
      const faqScript = document.getElementById(faqSchemaId);
      if (faqScript) faqScript.remove();
    };
  }, [description, faq, path, title]);

  return null;
}
