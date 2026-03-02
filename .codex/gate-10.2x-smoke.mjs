#!/usr/bin/env node

const rawBaseUrl = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const VERCEL_PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const APP_AUTH_COOKIE_NAME = "auth";

const nowUtc = new Date().toISOString();

function normalizeBaseUrl(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, "");
  return `https://${trimmed}`.replace(/\/$/, "");
}

function extractSetCookieLines(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  absorb(headers) {
    const added = [];
    for (const line of extractSetCookieLines(headers)) {
      const pair = String(line).split(";")[0];
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name) continue;
      this.cookies.set(name, value);
      added.push(name);
    }
    return added;
  }

  header() {
    if (this.cookies.size === 0) return "";
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name) {
    return this.cookies.has(name);
  }

  names() {
    return [...this.cookies.keys()];
  }

  cloneWithout(nameToDrop) {
    const next = new CookieJar();
    for (const [name, value] of this.cookies.entries()) {
      if (name === nameToDrop) continue;
      next.cookies.set(name, value);
    }
    return next;
  }
}

const BASE_URL = normalizeBaseUrl(rawBaseUrl);
const REQUEST_TIMEOUT_MS = 15_000;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function truncate(value, max = 500) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}...<truncated>` : str;
}

function printUsage() {
  console.error("Usage:");
  console.error('BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-10.2x-smoke.mjs');
}

if (!BASE_URL) {
  console.error("Missing required env var: BASE_URL");
  printUsage();
  process.exit(2);
}
if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error("Missing required env vars: SMOKE_EMAIL and/or SMOKE_PASSWORD");
  printUsage();
  process.exit(2);
}

async function fetchWithJar(inputUrl, init, jar, { maxRedirects = 6, maxSameUrlRetries = 3, setBypassCookie = false } = {}) {
  let url = new URL(inputUrl, BASE_URL).toString();
  let method = (init?.method || "GET").toUpperCase();
  let body = init?.body;
  const baseHeaders = { ...(init?.headers || {}) };
  const addedNames = new Set();
  let redirects = 0;
  let sameUrlRetries = 0;

  while (true) {
    const headers = { ...baseHeaders };
    if (VERCEL_PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = VERCEL_PROTECTION_BYPASS;
    if (setBypassCookie) headers["x-vercel-set-bypass-cookie"] = "true";

    const cookieHeader = jar.header();
    if (cookieHeader) headers.cookie = cookieHeader;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      return {
        status: 0,
        ok: false,
        json: null,
        text: `network_error: ${String(error?.message || error)}`,
        endpoint: `${method} ${new URL(url).pathname}`,
        finalUrl: url,
        location: "",
        cookieNamesAdded: [...addedNames],
      };
    }
    clearTimeout(timeout);

    jar.absorb(res.headers).forEach((n) => addedNames.add(n));

    if (TRANSIENT_STATUS.has(res.status)) {
      await sleep(300);
    }

    const location = res.headers.get("location") || "";
    const redirectStatus = [301, 302, 303, 307, 308].includes(res.status);

    if (redirectStatus) {
      let nextUrl = "";
      if (location) {
        try {
          nextUrl = new URL(location, url).toString();
        } catch {
          nextUrl = "";
        }
      }

      if ((res.status === 307 || res.status === 308) && (!nextUrl || nextUrl === url)) {
        if (sameUrlRetries < maxSameUrlRetries) {
          sameUrlRetries += 1;
          continue;
        }
      }

      if (nextUrl && redirects < maxRedirects) {
        redirects += 1;
        const shouldSwitchToGet = res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET" && method !== "HEAD");
        if (shouldSwitchToGet) {
          method = "GET";
          body = undefined;
          delete baseHeaders["content-type"];
        }
        url = nextUrl;
        sameUrlRetries = 0;
        continue;
      }
    }

    const ct = res.headers.get("content-type") || "";
    let text = "";
    let json = null;
    if (ct.includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        text = await res.text();
      }
    } else {
      text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {}
    }

    return {
      status: res.status,
      ok: res.ok,
      json,
      text,
      endpoint: `${method} ${new URL(url).pathname}`,
      finalUrl: url,
      location,
      cookieNamesAdded: [...addedNames],
    };
  }
}

function getAppCode(body) {
  if (!body || typeof body !== "object") return undefined;
  if (typeof body.code === "string") return body.code;
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object" && typeof body.error.code === "string") return body.error.code;
  return undefined;
}

const results = [];
const addResult = (area, ok, detail, extra = {}) => results.push({ area, ok, detail, ...extra });

function reportUnauthorizedIfNeeded(resp, authedJar) {
  if (resp.status !== 401) return;
  console.log(`ROOT_CAUSE: unauthorized after login (cookie_names=${authedJar.names().join(",") || "<none>"}, endpoint=${resp.endpoint}, status=401)`);
}

(async () => {
  const authedJar = new CookieJar();

  console.log(`INFO: bypass_present=${Boolean(VERCEL_PROTECTION_BYPASS)}`);
  if (!VERCEL_PROTECTION_BYPASS) {
    console.log("ROOT_CAUSE: no protection bypass secret available in env; cannot access protected preview");
    process.exit(1);
  }

  const bypass = await fetchWithJar(`${BASE_URL}/login`, { method: "GET", headers: { accept: "text/html,application/json" } }, authedJar, { setBypassCookie: true });
  const bypassNames = authedJar.names();
  const hasVercelCookie = bypassNames.some((n) => n.includes("_vercel_jwt") || n.startsWith("__vercel") || n.includes("vercel"));
  console.log(`INFO: bypass_cookie_names=${bypassNames.join(",") || "<none>"}`);
  addResult("A0) Bypass session", bypass.status === 200 || hasVercelCookie, `GET /login handshake -> ${bypass.status}; final_url=${bypass.finalUrl}`);

  const root = await fetchWithJar(`${BASE_URL}/`, { method: "GET", headers: { accept: "text/html,application/json" } }, authedJar);
  addResult("A) Reachability /", root.status === 200, `GET / -> ${root.status}`, { response: root.json ?? root.text, endpoint: root.endpoint, status: root.status, url: root.finalUrl });

  const loginPage = await fetchWithJar(`${BASE_URL}/login`, { method: "GET", headers: { accept: "text/html,application/json" } }, authedJar);
  addResult("A) Reachability /login", loginPage.status === 200, `GET /login -> ${loginPage.status}`, { response: loginPage.json ?? loginPage.text, endpoint: loginPage.endpoint, status: loginPage.status, url: loginPage.finalUrl });
  if (loginPage.status !== 200) {
    console.log(`ROOT_CAUSE: /login unreachable after redirects; status=${loginPage.status}; location=${loginPage.location || "<none>"}; cookie_names=${authedJar.names().join(",") || "<none>"}`);
  }

  const signupPage = await fetchWithJar(`${BASE_URL}/signup`, { method: "GET", headers: { accept: "text/html,application/json" } }, authedJar);
  addResult("A) Reachability /signup", [200, 304].includes(signupPage.status), `GET /signup -> ${signupPage.status}`, { response: signupPage.json ?? signupPage.text, endpoint: signupPage.endpoint, status: signupPage.status, url: signupPage.finalUrl });

  const unauthJar = authedJar.cloneWithout(APP_AUTH_COOKIE_NAME);
  const unauthCalls = [
    { name: "items", path: "/api/wardrobe/items", method: "GET" },
    { name: "tag", path: "/api/ai/wardrobe/tag", method: "POST", body: { itemId: "00000000-0000-0000-0000-000000000000" } },
    { name: "tag-batch", path: "/api/ai/wardrobe/tag-batch", method: "POST", body: { itemIds: ["00000000-0000-0000-0000-000000000000"] } },
    { name: "outfit", path: "/api/ai/outfit", method: "POST", body: { occasion: "smoke", weather: "mild", mood: "casual" } },
  ];

  for (const c of unauthCalls) {
    const r = await fetchWithJar(`${BASE_URL}${c.path}`, {
      method: c.method,
      headers: c.body ? { accept: "application/json", "content-type": "application/json" } : { accept: "application/json" },
      body: c.body ? JSON.stringify(c.body) : undefined,
    }, unauthJar);
    const ok = r.status === 401 || r.status === 403;
    addResult(`C) Unauth guard ${c.name}`, ok, `${c.method} ${c.path} -> ${r.status}`, { response: r.json ?? r.text, endpoint: r.endpoint, status: r.status, url: r.finalUrl });
  }

  const login = await fetchWithJar(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  }, authedJar);

  const loginStatusOk = login.status === 200 || login.status === 204;
  const appCookiePresent = authedJar.has(APP_AUTH_COOKIE_NAME);
  const loginOk = loginStatusOk && appCookiePresent;
  addResult(
    "B) Auth (login + app cookie)",
    loginOk,
    `POST /api/auth/login -> ${login.status}; location=${login.location || "<none>"}; cookie_names=${authedJar.names().join(",") || "<none>"}`,
    { response: login.json ?? login.text, endpoint: login.endpoint, status: login.status, url: login.finalUrl }
  );
  if (!loginOk) {
    console.log(`ROOT_CAUSE: login did not set app auth cookie; status=${login.status}; location=${login.location || "<none>"}; cookie_names=${authedJar.names().join(",") || "<none>"}`);
  }

  const itemsRes = await fetchWithJar(`${BASE_URL}/api/wardrobe/items`, { method: "GET", headers: { accept: "application/json" } }, authedJar);
  reportUnauthorizedIfNeeded(itemsRes, authedJar);
  const items = Array.isArray(itemsRes.json) ? itemsRes.json : [];
  const itemIds = items.map((it) => it?.id).filter((id) => typeof id === "string");
  const missingMeta = items
    .filter((it) => it && typeof it.id === "string")
    .filter((it) => it.category == null || it.primaryColor == null || it.styleTag == null)
    .map((it) => it.id);

  const hasItems = itemsRes.status === 200 && itemIds.length >= 1;
  addResult(
    "D) Wardrobe items list",
    hasItems,
    `GET /api/wardrobe/items -> ${itemsRes.status}; count=${itemIds.length}`,
    { response: hasItems ? undefined : itemsRes.json ?? itemsRes.text ?? "Smoke account has no wardrobe items; add at least 3 (top/bottom/shoes) and re-run.", endpoint: itemsRes.endpoint, status: itemsRes.status, url: itemsRes.finalUrl }
  );

  if (!hasItems) addResult("D) Wardrobe readiness", false, "Smoke account has no wardrobe items; add at least 3 (top/bottom/shoes) and re-run.");

  const tagBatchIds = (missingMeta.length > 0 ? missingMeta : itemIds).slice(0, 6);
  let tagBatchRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/wardrobe/tag-batch", finalUrl: `${BASE_URL}/api/ai/wardrobe/tag-batch` };
  if (loginOk && tagBatchIds.length > 0) {
    tagBatchRes = await fetchWithJar(`${BASE_URL}/api/ai/wardrobe/tag-batch`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ itemIds: tagBatchIds, force: false }),
    }, authedJar);
    reportUnauthorizedIfNeeded(tagBatchRes, authedJar);
  }

  const tagBatchCode = getAppCode(tagBatchRes.json);
  const tagBatchOk = tagBatchRes.status === 200 || (tagBatchRes.status === 503 && ["AI_UNAVAILABLE", "DB_MIGRATION_REQUIRED"].includes(tagBatchCode));
  addResult("E) Tag-batch", tagBatchOk, `POST /api/ai/wardrobe/tag-batch -> ${tagBatchRes.status}${tagBatchCode ? ` (${tagBatchCode})` : ""}`, { response: tagBatchRes.json ?? tagBatchRes.text, endpoint: tagBatchRes.endpoint, status: tagBatchRes.status, url: tagBatchRes.finalUrl });

  const singleTagId = tagBatchIds[0] || itemIds[0];
  let tagRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/wardrobe/tag", finalUrl: `${BASE_URL}/api/ai/wardrobe/tag` };
  if (loginOk && singleTagId) {
    tagRes = await fetchWithJar(`${BASE_URL}/api/ai/wardrobe/tag`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ itemId: singleTagId, force: false }),
    }, authedJar);
    reportUnauthorizedIfNeeded(tagRes, authedJar);
  }

  const tagCode = getAppCode(tagRes.json);
  const tagOk = tagRes.status === 200 || (tagRes.status === 503 && ["AI_UNAVAILABLE", "DB_MIGRATION_REQUIRED"].includes(tagCode));
  addResult("F) Single tag", tagOk, `POST /api/ai/wardrobe/tag -> ${tagRes.status}${tagCode ? ` (${tagCode})` : ""}`, { response: tagRes.json ?? tagRes.text, endpoint: tagRes.endpoint, status: tagRes.status, url: tagRes.finalUrl });

  let outfitRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/outfit", finalUrl: `${BASE_URL}/api/ai/outfit` };
  if (loginOk) {
    outfitRes = await fetchWithJar(`${BASE_URL}/api/ai/outfit`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ occasion: "daily errands", weather: "mild", mood: "confident" }),
    }, authedJar);
    reportUnauthorizedIfNeeded(outfitRes, authedJar);
  }

  const explanation = outfitRes.json?.explanation;
  const explanationStringArray = explanation === undefined || (Array.isArray(explanation) && explanation.every((x) => typeof x === "string"));
  const outfitOk =
    (outfitRes.status === 200 && explanationStringArray) ||
    (outfitRes.status === 400 && outfitRes.json?.code === "INSUFFICIENT_WARDROBE_METADATA" && Array.isArray(outfitRes.json?.explanation) && outfitRes.json.explanation.every((x) => typeof x === "string"));

  addResult("G) Outfit", outfitOk, `POST /api/ai/outfit -> ${outfitRes.status}${outfitRes.json?.code ? ` (${outfitRes.json.code})` : ""}`, { response: outfitRes.json ?? outfitRes.text, endpoint: outfitRes.endpoint, status: outfitRes.status, url: outfitRes.finalUrl });

  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;

  console.log("\nGate 10.2.x Smoke Sprint Report");
  console.log("=".repeat(60));
  console.log(`URL tested: ${BASE_URL}`);
  console.log(`Timestamp UTC: ${nowUtc}`);
  console.log(`Wardrobe items found: ${itemIds.length}`);
  console.log(`IDs sent to tag-batch: ${tagBatchIds.length}`);
  console.log("-".repeat(60));
  console.log("RESULT | CHECK | DETAIL");
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.area} | ${r.detail}`);
  console.log("-".repeat(60));
  console.log(`TOTAL: ${passCount} PASS / ${failCount} FAIL`);

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.log("\nFailing endpoint details (truncated):");
    for (const f of failures) {
      const responseText = f.response !== undefined ? truncate(f.response) : "<none>";
      console.log(`- ${f.area}: endpoint=${f.endpoint || "unknown"}; status=${f.status ?? "unknown"}; url=${f.url || "unknown"}; body=${responseText}`);
    }
    const first = failures[0];
    const firstReason = first.response !== undefined ? truncate(first.response, 200) : first.detail;
    console.log(`\nROOT_CAUSE: ${first.area} failed (${first.detail}). endpoint=${first.endpoint || "unknown"}; status=${first.status ?? "unknown"}; reason=${firstReason}`);
  }

  process.exit(failCount === 0 ? 0 : 1);
})().catch((error) => {
  console.error("Smoke run crashed:", error?.stack || String(error));
  process.exit(1);
});
