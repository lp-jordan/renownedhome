import { useEffect } from "react";

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

export function useSeo(title, description, canonicalUrl, noindex, ogImage) {
  useEffect(() => {
    document.title = title || "Renowned";

    setMetaTag("description", description);
    setMetaTag("robots", noindex ? "noindex,nofollow" : "index,follow");
    setMetaProperty("og:title", title);
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
  }, [canonicalUrl, description, noindex, ogImage, title]);
}

export function usePageSeo(page) {
  useSeo(
    page.seo.title,
    page.seo.description,
    page.seo.canonicalUrl,
    page.seo.noindex,
    page.seo.ogImage
  );
}
