/**
 * Escape HTML entities in text content.
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape HTML attribute values.
 */
export function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse HANDLE, PUBLICATION_RKEY, and BASE_PATH from viewer HTML.
 */
export function parseConfig(html) {
  const handleMatch = html.match(/const HANDLE = "([^"]+)"/);
  const rkeyMatch = html.match(/const PUBLICATION_RKEY = "([^"]*)"/);
  const basePathMatch = html.match(/const BASE_PATH = "([^"]*)"/);
  return {
    handle: handleMatch?.[1] || "",
    publicationRkey: rkeyMatch?.[1] || "",
    basePath: basePathMatch?.[1] || "",
  };
}

/**
 * Find a document matching the given route path.
 * Matches by document path field first, then falls back to rkey.
 */
export function findDocument(documents, path, publicationUri) {
  const filtered = publicationUri
    ? documents.filter((d) => d.value.site === publicationUri)
    : documents;

  const byPath = filtered.find((d) => d.value.path === path);
  if (byPath) return byPath;

  const segment = path.split("/").pop();
  if (segment) {
    const byRkey = filtered.find((d) => d.uri.split("/").pop() === segment);
    if (byRkey) return byRkey;
  }

  return null;
}

/**
 * Build OG meta tags object for a given route.
 */
export function buildMetaTags({ routePath, publication, document, siteName, siteUrl, pdsUrl, did }) {
  if (routePath === "/" || routePath === "") {
    return {
      title: siteName,
      ogTitle: siteName,
      ogDescription: publication?.description || "",
      ogType: "website",
      ogUrl: siteUrl,
      ogImage: null,
      twitterCard: "summary",
    };
  }

  if (document) {
    const postTitle = document.value.title || "Untitled";
    const postDesc = document.value.description || "";
    let ogImage = null;
    if (document.value.coverImage?.ref?.$link && pdsUrl && did) {
      ogImage = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(document.value.coverImage.ref.$link)}`;
    }
    return {
      title: `${postTitle} \u2014 ${siteName}`,
      ogTitle: postTitle,
      ogDescription: postDesc,
      ogType: "article",
      ogUrl: siteUrl + routePath,
      ogImage,
      twitterCard: ogImage ? "summary_large_image" : "summary",
    };
  }

  // Not found — fallback to site-level tags
  return {
    title: siteName,
    ogTitle: siteName,
    ogDescription: publication?.description || "",
    ogType: "website",
    ogUrl: siteUrl,
    ogImage: null,
    twitterCard: "summary",
  };
}

/**
 * Inject OG meta tags into viewer HTML by replacing placeholder values.
 */
export function injectMetaTags(html, tags) {
  let result = html;

  // Replace <title>
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(tags.title)}</title>`);

  // Replace existing OG meta tags
  result = result.replace(
    /(<meta property="og:title" content=")[^"]*(">)/,
    `$1${escapeAttr(tags.ogTitle)}$2`
  );
  result = result.replace(
    /(<meta property="og:description" content=")[^"]*(">)/,
    `$1${escapeAttr(tags.ogDescription || "")}$2`
  );
  result = result.replace(
    /(<meta property="og:type" content=")[^"]*(">)/,
    `$1${escapeAttr(tags.ogType || "website")}$2`
  );
  result = result.replace(
    /(<meta property="og:url" content=")[^"]*(">)/,
    `$1${escapeAttr(tags.ogUrl || "")}$2`
  );
  result = result.replace(
    /(<meta name="twitter:card" content=")[^"]*(">)/,
    `$1${escapeAttr(tags.twitterCard || "summary")}$2`
  );

  // Add og:image if present (insert after og:url line)
  if (tags.ogImage) {
    result = result.replace(
      /(<meta property="og:url" content="[^"]*">)/,
      `$1\n<meta property="og:image" content="${escapeAttr(tags.ogImage)}">`
    );
  }

  return result;
}
