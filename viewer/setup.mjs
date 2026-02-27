#!/usr/bin/env node

import { createInterface } from "readline/promises";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function resolveHandle(handle) {
  const res = await fetch(
    `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!res.ok) throw new Error(`Could not resolve handle "${handle}"`);
  const data = await res.json();
  return data.did;
}

async function resolvePDS(did) {
  let doc;
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
    if (!res.ok) throw new Error("Could not resolve DID from plc.directory");
    doc = await res.json();
  } else if (did.startsWith("did:web:")) {
    const host = did.replace("did:web:", "").replaceAll(":", "/");
    const res = await fetch(`https://${host}/.well-known/did.json`);
    if (!res.ok) throw new Error("Could not resolve did:web DID document");
    doc = await res.json();
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
  const service = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer"
  );
  if (!service?.serviceEndpoint) {
    throw new Error("No PDS service found in DID document");
  }
  return service.serviceEndpoint;
}

async function listPublications(pdsUrl, did) {
  const allRecords = [];
  let cursor;

  do {
    let url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=site.standard.publication&limit=100`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to list publications from PDS");
    const data = await res.json();

    for (const record of data.records) {
      allRecords.push({
        uri: record.uri,
        rkey: record.uri.split("/").pop(),
        value: record.value,
      });
    }
    cursor = data.cursor;
  } while (cursor);

  return allRecords;
}

async function main() {
  try {
    const handle = (await rl.question("Enter your Bluesky handle: ")).trim();
    if (!handle) {
      console.error("Handle is required.");
      process.exit(1);
    }

    process.stdout.write("Resolving handle... ");
    const did = await resolveHandle(handle);
    console.log(did);

    process.stdout.write("Finding PDS... ");
    const pdsUrl = await resolvePDS(did);
    console.log(pdsUrl);

    console.log("");
    const publications = await listPublications(pdsUrl, did);

    if (publications.length === 0) {
      console.log("No publications found for this account.");
      console.log("Publish from the Obsidian plugin first, then re-run this script.");
      process.exit(1);
    }

    let selected;
    if (publications.length === 1) {
      selected = publications[0];
      console.log(`Found publication: ${selected.value.name || "(untitled)"} (rkey: ${selected.rkey})`);
    } else {
      console.log("Publications:");
      for (let i = 0; i < publications.length; i++) {
        const p = publications[i];
        console.log(`  ${i + 1}. ${p.value.name || "(untitled)"} (rkey: ${p.rkey})`);
      }
      console.log("");
      const choice = (await rl.question(`Select publication [1]: `)).trim() || "1";
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= publications.length) {
        console.error("Invalid selection.");
        process.exit(1);
      }
      selected = publications[idx];
    }

    const rkey = selected.rkey;
    const atUri = `at://${did}/site.standard.publication/${rkey}`;

    // Update viewer/index.html
    const indexPath = join(__dirname, "index.html");
    let indexContent = await readFile(indexPath, "utf-8");
    indexContent = indexContent.replace(
      /const HANDLE = ".*?";/,
      `const HANDLE = "${handle}";`
    );
    indexContent = indexContent.replace(
      /const PUBLICATION_RKEY = ".*?";/,
      `const PUBLICATION_RKEY = "${rkey}";`
    );
    await writeFile(indexPath, indexContent, "utf-8");
    console.log("");
    console.log("\u2713 Updated viewer/index.html");

    // Update .well-known/site.standard.publication
    const wellKnownPath = join(__dirname, ".well-known", "site.standard.publication");
    await writeFile(wellKnownPath, atUri + "\n", "utf-8");
    console.log("\u2713 Updated viewer/.well-known/site.standard.publication");
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
