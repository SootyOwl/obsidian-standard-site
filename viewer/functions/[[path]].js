import {
  parseConfig,
  findDocument,
  buildMetaTags,
  injectMetaTags,
} from "./_lib/helpers.js";

const CACHE_TTL = 300; // 5 minutes

async function resolveHandle(handle) {
  const res = await fetch(
    `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!res.ok) throw new Error(`Could not resolve handle "${handle}"`);
  return (await res.json()).did;
}

async function resolvePDS(did) {
  let url;
  if (did.startsWith("did:plc:")) {
    url = `https://plc.directory/${encodeURIComponent(did)}`;
  } else if (did.startsWith("did:web:")) {
    const host = did.replace("did:web:", "").replaceAll(":", "/");
    url = `https://${host}/.well-known/did.json`;
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
  const doc = await (await fetch(url)).json();
  const svc = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer"
  );
  if (!svc?.serviceEndpoint) throw new Error("No PDS found");
  return svc.serviceEndpoint;
}

async function getPublication(pdsUrl, did, rkey) {
  const res = await fetch(
    `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=site.standard.publication&rkey=${encodeURIComponent(rkey)}`
  );
  if (!res.ok) return null;
  return (await res.json()).value;
}

async function listAllDocuments(pdsUrl, did) {
  const all = [];
  let cursor;
  do {
    let url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=site.standard.document&limit=100`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to list documents");
    const data = await res.json();
    for (const r of data.records) all.push(r);
    cursor = data.cursor;
  } while (cursor);
  return all;
}

async function fetchSiteData(config) {
  const did = await resolveHandle(config.handle);
  const pdsUrl = await resolvePDS(did);
  const publication = config.publicationRkey
    ? await getPublication(pdsUrl, did, config.publicationRkey)
    : null;
  const publicationUri = config.publicationRkey
    ? `at://${did}/site.standard.publication/${config.publicationRkey}`
    : null;
  const documents = await listAllDocuments(pdsUrl, did);
  return { did, pdsUrl, publication, publicationUri, documents };
}

async function getCachedSiteData(config, cacheKey, waitUntil) {
  const cache = caches.default;
  const cacheUrl = new URL(`https://cache.internal/${cacheKey}`);

  const cached = await cache.match(cacheUrl);
  if (cached) {
    return await cached.json();
  }

  const data = await fetchSiteData(config);

  const cacheResponse = new Response(JSON.stringify(data), {
    headers: { "Cache-Control": `s-maxage=${CACHE_TTL}` },
  });
  waitUntil(cache.put(cacheUrl, cacheResponse));

  return data;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Pass through static assets and well-known files
  if (
    /\.(css|js|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|xml|txt|webp|avif)$/.test(path) ||
    path.startsWith("/.well-known/")
  ) {
    return context.next();
  }

  // Fetch static index.html
  const assetUrl = new URL("/", url.origin);
  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  const html = await assetResponse.text();

  // Parse config from HTML
  const config = parseConfig(html);
  if (!config.handle || config.handle === "your-handle.bsky.social") {
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const cacheKey = `atproto-${config.handle}-${config.publicationRkey}`;
    const data = await getCachedSiteData(config, cacheKey, context.waitUntil.bind(context));

    const routePath = config.basePath
      ? path.slice(config.basePath.length) || "/"
      : path;

    const siteName = data.publication?.name || config.handle;
    const siteUrl =
      data.publication?.url || url.origin + config.basePath;

    const doc = routePath !== "/" && routePath !== ""
      ? findDocument(data.documents, routePath, data.publicationUri)
      : null;

    const tags = buildMetaTags({
      routePath,
      publication: data.publication,
      document: doc,
      siteName,
      siteUrl,
      pdsUrl: data.pdsUrl,
      did: data.did,
    });

    const status =
      routePath !== "/" && routePath !== "" && !doc ? 404 : 200;

    return new Response(injectMetaTags(html, tags), {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    // ATProto fetch failed — return unmodified static HTML
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
