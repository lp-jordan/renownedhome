import { useEffect } from "react";

const DEFAULT_TITLE = "Renowned";
const DESCRIPTION_MAX_LENGTH = 160;
const KEYWORD_LIMIT = 12;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
]);

function setMetaTag(name, content) {
  let tag = document.querySelector(`meta[name='${name}']`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content || "");
}

function setMetaProperty(property, content) {
  let tag = document.querySelector(`meta[property='${property}']`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content || "");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateDescription(value, maxLength = DESCRIPTION_MAX_LENGTH) {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength + 1);
  const safeCut = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(", "), truncated.lastIndexOf(" "));
  return `${truncated.slice(0, safeCut > 80 ? safeCut : maxLength).trim()}...`;
}

function collectText(value, bucket = [], seen = new WeakSet()) {
  if (!value) {
    return bucket;
  }

  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    if (normalized) {
      bucket.push(normalized);
    }
    return bucket;
  }

  if (typeof value !== "object") {
    return bucket;
  }

  if (seen.has(value)) {
    return bucket;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, bucket, seen));
    return bucket;
  }

  Object.entries(value).forEach(([key, entry]) => {
    if (["seo", "canonicalUrl", "ogImage", "previewUrl", "ctaUrl", "url", "image", "backgroundImage", "titleImage", "iconUrl", "readerPdfUrl"].includes(key)) {
      return;
    }
    collectText(entry, bucket, seen);
  });

  return bucket;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildTitleSegments(entity, siteSettings) {
  const fallbackHomeTitle = entity?.slug === "/" ? siteSettings?.brandName : "";
  const baseTitle = normalizeWhitespace(
    entity?.hero?.title || entity?.shortLabel || entity?.title || fallbackHomeTitle
  );
  const brand = normalizeWhitespace(siteSettings?.siteTitleSuffix || siteSettings?.brandName || DEFAULT_TITLE);

  if (!baseTitle) {
    return brand || DEFAULT_TITLE;
  }

  if (!brand || baseTitle.toLowerCase() === brand.toLowerCase()) {
    return baseTitle;
  }

  return `${baseTitle} | ${brand}`;
}

function buildDescription(entity) {
  const candidates = uniqueItems([
    entity?.hero?.subtitle,
    entity?.hero?.intro,
    entity?.content?.intro,
    entity?.content?.heading,
    entity?.description,
    ...collectText(entity?.content || {}).slice(0, 8),
  ]);

  return truncateDescription(candidates.join(" "));
}

function buildCanonicalUrl(entity, siteSettings) {
  const explicitCanonical = normalizeWhitespace(entity?.seo?.canonicalUrl);
  if (explicitCanonical) {
    return explicitCanonical;
  }

  const slug = normalizeWhitespace(entity?.slug);
  if (!slug) {
    return window.location.href;
  }

  const siteOrigin =
    normalizeWhitespace(siteSettings?.publicSiteOrigin) ||
    normalizeWhitespace(window.location.origin);

  if (!siteOrigin) {
    return slug;
  }

  return new URL(slug, `${siteOrigin.replace(/\/$/, "")}/`).toString();
}

function buildOgImage(entity, siteSettings) {
  return (
    normalizeWhitespace(entity?.seo?.ogImage) ||
    normalizeWhitespace(entity?.coverImage) ||
    normalizeWhitespace(entity?.hero?.backgroundImage) ||
    normalizeWhitespace(entity?.heroAssets?.[0]) ||
    normalizeWhitespace(siteSettings?.defaultOgImage)
  );
}

function buildKeywords(entity, siteSettings) {
  const sourceText = uniqueItems([
    entity?.title,
    entity?.shortLabel,
    entity?.hero?.title,
    entity?.hero?.subtitle,
    entity?.hero?.intro,
    entity?.content?.heading,
    entity?.content?.intro,
    entity?.description,
    entity?.writer,
    entity?.artist,
    entity?.colorist,
    siteSettings?.brandName,
  ]).join(" ");

  const tokens = sourceText
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];

  return uniqueItems(
    tokens.filter((token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token))
  )
    .slice(0, KEYWORD_LIMIT)
    .join(", ");
}

export function resolveSeo(entity, options = {}) {
  const siteSettings = options.siteSettings || {};
  const title = normalizeWhitespace(entity?.seo?.title) || buildTitleSegments(entity, siteSettings);
  const description = normalizeWhitespace(entity?.seo?.description) || buildDescription(entity);
  const canonicalUrl = buildCanonicalUrl(entity, siteSettings);
  const ogImage = buildOgImage(entity, siteSettings);
  const keywords = buildKeywords(entity, siteSettings);

  return {
    title: title || DEFAULT_TITLE,
    description,
    canonicalUrl,
    noindex: Boolean(entity?.seo?.noindex),
    ogImage,
    keywords,
  };
}

export function useSeo(title, description, canonicalUrl, noindex, ogImage, keywords = "") {
  useEffect(() => {
    document.title = title || "Renowned";

    setMetaTag("description", description);
    setMetaTag("keywords", keywords);
    setMetaTag("robots", noindex ? "noindex,nofollow" : "index,follow");
    setMetaTag("twitter:card", ogImage ? "summary_large_image" : "summary");
    setMetaTag("twitter:title", title);
    setMetaTag("twitter:description", description);
    setMetaTag("twitter:image", ogImage);
    setMetaProperty("og:title", title);
    setMetaProperty("og:type", "website");
    setMetaProperty("og:url", canonicalUrl);
    setMetaProperty("og:description", description);
    setMetaProperty("og:image", ogImage);

    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    if (canonicalUrl) {
      canonical.setAttribute("href", canonicalUrl);
    }
  }, [canonicalUrl, description, keywords, noindex, ogImage, title]);
}

export function usePageSeo(page, options = {}) {
  const metadata = resolveSeo(page, options);
  useSeo(
    metadata.title,
    metadata.description,
    metadata.canonicalUrl,
    metadata.noindex,
    metadata.ogImage,
    metadata.keywords
  );
}
