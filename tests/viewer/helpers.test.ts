import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  escapeAttr,
  parseConfig,
  findDocument,
  buildMetaTags,
  injectMetaTags,
} from "../../viewer/functions/_lib/helpers.js";

describe("escapeHtml", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });

  it("passes through normal text", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(undefined)).toBe("undefined");
  });
});

describe("escapeAttr", () => {
  it("escapes double quotes", () => {
    expect(escapeAttr('value with "quotes"')).toBe(
      "value with &quot;quotes&quot;"
    );
  });
});

describe("parseConfig", () => {
  const sampleHtml = `
<script>
const HANDLE = "alice.bsky.social";
const PUBLICATION_RKEY = "self";
const BASE_PATH = "/my-blog";
</script>`;

  it("extracts handle, rkey, and basePath", () => {
    const config = parseConfig(sampleHtml);
    expect(config.handle).toBe("alice.bsky.social");
    expect(config.publicationRkey).toBe("self");
    expect(config.basePath).toBe("/my-blog");
  });

  it("returns empty strings for missing values", () => {
    const config = parseConfig("<html></html>");
    expect(config.handle).toBe("");
    expect(config.publicationRkey).toBe("");
    expect(config.basePath).toBe("");
  });

  it("handles empty PUBLICATION_RKEY", () => {
    const html = `const HANDLE = "alice.bsky.social";\nconst PUBLICATION_RKEY = "";`;
    const config = parseConfig(html);
    expect(config.publicationRkey).toBe("");
  });
});

describe("findDocument", () => {
  const docs = [
    {
      uri: "at://did:plc:abc/site.standard.document/post1",
      value: { path: "/hello-world", title: "Hello", site: "at://did:plc:abc/site.standard.publication/self" },
    },
    {
      uri: "at://did:plc:abc/site.standard.document/post2",
      value: { path: "/second-post", title: "Second", site: "at://did:plc:abc/site.standard.publication/self" },
    },
    {
      uri: "at://did:plc:abc/site.standard.document/orphan",
      value: { path: "/orphan", title: "Orphan", site: "at://did:plc:abc/site.standard.publication/other" },
    },
  ];

  it("finds by path", () => {
    const doc = findDocument(docs, "/hello-world", null);
    expect(doc?.value.title).toBe("Hello");
  });

  it("finds by rkey fallback", () => {
    const doc = findDocument(docs, "/post2", null);
    expect(doc?.value.title).toBe("Second");
  });

  it("returns null for no match", () => {
    expect(findDocument(docs, "/nonexistent", null)).toBeNull();
  });

  it("filters by publication URI", () => {
    const pubUri = "at://did:plc:abc/site.standard.publication/self";
    const doc = findDocument(docs, "/orphan", pubUri);
    expect(doc).toBeNull();
  });

  it("finds across all docs when no publication URI", () => {
    const doc = findDocument(docs, "/orphan", null);
    expect(doc?.value.title).toBe("Orphan");
  });
});

describe("buildMetaTags", () => {
  const base = {
    publication: { name: "My Blog", description: "A blog about things" },
    siteName: "My Blog",
    siteUrl: "https://example.com/blog",
    pdsUrl: "https://pds.example.com",
    did: "did:plc:abc",
  };

  it("returns site-level tags for homepage", () => {
    const tags = buildMetaTags({ ...base, routePath: "/", document: null });
    expect(tags.title).toBe("My Blog");
    expect(tags.ogType).toBe("website");
    expect(tags.ogDescription).toBe("A blog about things");
  });

  it("returns post-level tags when document found", () => {
    const doc = {
      uri: "at://did:plc:abc/site.standard.document/post1",
      value: { title: "My Post", description: "About stuff", path: "/my-post" },
    };
    const tags = buildMetaTags({ ...base, routePath: "/my-post", document: doc });
    expect(tags.title).toBe("My Post \u2014 My Blog");
    expect(tags.ogType).toBe("article");
    expect(tags.ogUrl).toBe("https://example.com/blog/my-post");
    expect(tags.twitterCard).toBe("summary");
  });

  it("includes og:image for posts with cover images", () => {
    const doc = {
      uri: "at://did:plc:abc/site.standard.document/post1",
      value: {
        title: "My Post",
        description: "About stuff",
        path: "/my-post",
        coverImage: { ref: { $link: "bafyreiabc123" } },
      },
    };
    const tags = buildMetaTags({ ...base, routePath: "/my-post", document: doc });
    expect(tags.ogImage).toContain("com.atproto.sync.getBlob");
    expect(tags.ogImage).toContain("bafyreiabc123");
    expect(tags.twitterCard).toBe("summary_large_image");
  });

  it("returns site-level fallback for not-found routes", () => {
    const tags = buildMetaTags({ ...base, routePath: "/nope", document: null });
    expect(tags.title).toBe("My Blog");
    expect(tags.ogType).toBe("website");
  });
});

describe("injectMetaTags", () => {
  const templateHtml = `<!DOCTYPE html>
<html>
<head>
<title>Standard Site</title>
<meta property="og:title" content="Standard Site">
<meta property="og:description" content="">
<meta property="og:type" content="website">
<meta property="og:url" content="">
<meta name="twitter:card" content="summary">
</head>
<body></body>
</html>`;

  it("replaces title and OG tags", () => {
    const tags = {
      title: "My Blog",
      ogTitle: "My Blog",
      ogDescription: "A great blog",
      ogType: "website",
      ogUrl: "https://example.com",
      twitterCard: "summary",
      ogImage: null,
    };
    const result = injectMetaTags(templateHtml, tags);
    expect(result).toContain("<title>My Blog</title>");
    expect(result).toContain('og:title" content="My Blog"');
    expect(result).toContain('og:description" content="A great blog"');
    expect(result).toContain('og:url" content="https://example.com"');
  });

  it("injects og:image when present", () => {
    const tags = {
      title: "Post",
      ogTitle: "Post",
      ogDescription: "",
      ogType: "article",
      ogUrl: "https://example.com/post",
      twitterCard: "summary_large_image",
      ogImage: "https://cdn.example.com/image.jpg",
    };
    const result = injectMetaTags(templateHtml, tags);
    expect(result).toContain('og:image" content="https://cdn.example.com/image.jpg"');
  });

  it("does not add og:image when null", () => {
    const tags = {
      title: "Post",
      ogTitle: "Post",
      ogDescription: "",
      ogType: "article",
      ogUrl: "https://example.com",
      twitterCard: "summary",
      ogImage: null,
    };
    const result = injectMetaTags(templateHtml, tags);
    expect(result).not.toContain("og:image");
  });

  it("escapes HTML in title", () => {
    const tags = {
      title: 'Post with <script> & "quotes"',
      ogTitle: "Post",
      ogDescription: "",
      ogType: "article",
      ogUrl: "",
      twitterCard: "summary",
      ogImage: null,
    };
    const result = injectMetaTags(templateHtml, tags);
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });
});
