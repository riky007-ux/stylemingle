#!/usr/bin/env node

const rawBaseUrl = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const VERCEL_PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

const nowUtc = new Date().toISOString();

function normalizeBaseUrl(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, "");
  return `https://${trimmed}`.replace(/\/$/, "");
}

const BASE_URL = normalizeBaseUrl(rawBaseUrl);

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 450;
const REQUEST_TIMEOUT_MS = 15_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printUsage() {
  console.error("Usage:");
  console.error('BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-10.2x-smoke.mjs');
  console.error('Optional: VERCEL_PROTECTION_BYPASS="..."');
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

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  absorb(headers) {
    let setCookies = [];

    if (typeof headers.getSetCookie === "function") {
      setCookies = headers.getSetCookie();
    } else {
      const single = headers.get("set-cookie");
      if (single) setCookies = [single];
    }

    for (const entry of setCookies) {
      const pair = String(entry).split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name) this.cookies.set(name, value);
      }
    }
  }

  header() {
    if (this.cookies.size === 0) return "";
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  hasAny() {
    return this.cookies.size > 0;
  }
}

const truncate = (value, max = 500) => {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}...<truncated>` : str;
};

function getAppCode(body) {
  if (!body || typeof body !== "object") return undefined;
  if (typeof body.code === "string") return body.code;
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object" && typeof body.error.code === "string") return body.error.code;
  return undefined;
}

async function request(path, { method = "GET", body, cookieJar, useCookies = false } = {}) {
  const headers = {
    accept: "application/json",
  };

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (VERCEL_PROTECTION_BYPASS) {
    headers["x-vercel-protection-bypass"] = VERCEL_PROTECTION_BYPASS;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }

  if (useCookies && cookieJar) {
    const cookieHeader = cookieJar.header();
    if (cookieHeader) headers.cookie = cookieHeader;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (cookieJar) cookieJar.absorb(res.headers);

      if (TRANSIENT_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * 2 ** attempt;
        console.log(`retrying ${method} ${path} after transient status ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }

      let json;
      let text;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          json = await res.json();
        } catch {
          text = truncate(await res.text());
        }
      } else {
        text = truncate(await res.text());
        try {
          json = JSON.parse(text);
        } catch {}
      }

      return {
        status: res.status,
        ok: res.ok,
        json,
        text,
        headers: res.headers,
        endpoint: `${method} ${path}`,
        url: `${BASE_URL}${path}`,
      };
    } catch (error) {
      clearTimeout(timeout);
      const isNetworkish = error?.name === "AbortError" || String(error?.message || error).toLowerCase().includes("fetch");
      if (isNetworkish && attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * 2 ** attempt;
        console.log(`retrying ${method} ${path} after network/timeout error (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }

      return {
        status: 0,
        ok: false,
        json: null,
        text: truncate(`network_error: ${String(error?.message || error)}`),
        headers: new Headers(),
        endpoint: `${method} ${path}`,
        url: `${BASE_URL}${path}`,
      };
    }
  }

  return {
    status: 0,
    ok: false,
    json: null,
    text: "network_error: retry_exhausted",
    headers: new Headers(),
    endpoint: `${method} ${path}`,
    url: `${BASE_URL}${path}`,
  };
}

const results = [];
const addResult = (area, ok, detail, extra = {}) => results.push({ area, ok, detail, ...extra });

(async () => {
  const authedJar = new CookieJar();

  const root = await request("/");
  addResult("A) Reachability /", root.status === 200, `GET / -> ${root.status}`, { response: root.json ?? root.text, endpoint: root.endpoint, status: root.status, url: root.url });

  const loginPage = await request("/login");
  addResult("A) Reachability /login", [200, 304].includes(loginPage.status), `GET /login -> ${loginPage.status}`, { response: loginPage.json ?? loginPage.text, endpoint: loginPage.endpoint, status: loginPage.status, url: loginPage.url });

  const signupPage = await request("/signup");
  addResult("A) Reachability /signup", [200, 304].includes(signupPage.status), `GET /signup -> ${signupPage.status}`, { response: signupPage.json ?? signupPage.text, endpoint: signupPage.endpoint, status: signupPage.status, url: signupPage.url });

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
    cookieJar: authedJar,
  });

  const loginHasCookie = authedJar.hasAny();
  addResult(
    "B) Auth (login + cookie)",
    login.status === 200 && loginHasCookie,
    `POST /api/auth/login -> ${login.status}; cookie=${loginHasCookie ? "present" : "missing"}`,
    { response: login.json ?? login.text, endpoint: login.endpoint, status: login.status, url: login.url }
  );

  const unauthCalls = [
    { name: "items", path: "/api/wardrobe/items", method: "GET" },
    { name: "tag", path: "/api/ai/wardrobe/tag", method: "POST", body: { itemId: "00000000-0000-0000-0000-000000000000" } },
    { name: "tag-batch", path: "/api/ai/wardrobe/tag-batch", method: "POST", body: { itemIds: ["00000000-0000-0000-0000-000000000000"] } },
    { name: "outfit", path: "/api/ai/outfit", method: "POST", body: { occasion: "smoke", weather: "mild", mood: "casual" } },
  ];

  for (const c of unauthCalls) {
    const r = await request(c.path, { method: c.method, body: c.body });
    const ok = r.status === 401 || r.status === 403;
    addResult(`C) Unauth guard ${c.name}`, ok, `${c.method} ${c.path} -> ${r.status}`, { response: r.json ?? r.text, endpoint: r.endpoint, status: r.status, url: r.url });
  }

  const itemsRes = await request("/api/wardrobe/items", { method: "GET", cookieJar: authedJar, useCookies: true });
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
    {
      response: hasItems ? undefined : itemsRes.json ?? itemsRes.text ?? "Smoke account has no wardrobe items; add at least 3 (top/bottom/shoes) and re-run.",
      endpoint: itemsRes.endpoint,
      status: itemsRes.status,
      url: itemsRes.url,
    }
  );

  if (!hasItems) {
    addResult("D) Wardrobe readiness", false, "Smoke account has no wardrobe items; add at least 3 (top/bottom/shoes) and re-run.");
  }

  const tagBatchIds = (missingMeta.length > 0 ? missingMeta : itemIds).slice(0, 6);
  let tagBatchRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/wardrobe/tag-batch", url: `${BASE_URL}/api/ai/wardrobe/tag-batch` };
  if (login.status === 200 && tagBatchIds.length > 0) {
    tagBatchRes = await request("/api/ai/wardrobe/tag-batch", {
      method: "POST",
      cookieJar: authedJar,
      useCookies: true,
      body: { itemIds: tagBatchIds, force: false },
    });
  }

  const tagBatchCode = getAppCode(tagBatchRes.json);
  const tagBatchOk =
    tagBatchRes.status === 200 ||
    (tagBatchRes.status === 503 && ["AI_UNAVAILABLE", "DB_MIGRATION_REQUIRED"].includes(tagBatchCode));
  addResult(
    "E) Tag-batch",
    tagBatchOk,
    `POST /api/ai/wardrobe/tag-batch -> ${tagBatchRes.status}${tagBatchCode ? ` (${tagBatchCode})` : ""}`,
    { response: tagBatchRes.json ?? tagBatchRes.text, endpoint: tagBatchRes.endpoint, status: tagBatchRes.status, url: tagBatchRes.url }
  );

  const singleTagId = tagBatchIds[0] || itemIds[0];
  let tagRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/wardrobe/tag", url: `${BASE_URL}/api/ai/wardrobe/tag` };
  if (login.status === 200 && singleTagId) {
    tagRes = await request("/api/ai/wardrobe/tag", {
      method: "POST",
      cookieJar: authedJar,
      useCookies: true,
      body: { itemId: singleTagId, force: false },
    });
  }
  const tagCode = getAppCode(tagRes.json);
  const tagOk =
    tagRes.status === 200 ||
    (tagRes.status === 503 && ["AI_UNAVAILABLE", "DB_MIGRATION_REQUIRED"].includes(tagCode));
  addResult(
    "F) Single tag",
    tagOk,
    `POST /api/ai/wardrobe/tag -> ${tagRes.status}${tagCode ? ` (${tagCode})` : ""}`,
    { response: tagRes.json ?? tagRes.text, endpoint: tagRes.endpoint, status: tagRes.status, url: tagRes.url }
  );

  let outfitRes = { status: 0, json: null, text: "skipped", endpoint: "POST /api/ai/outfit", url: `${BASE_URL}/api/ai/outfit` };
  if (login.status === 200) {
    outfitRes = await request("/api/ai/outfit", {
      method: "POST",
      cookieJar: authedJar,
      useCookies: true,
      body: { occasion: "daily errands", weather: "mild", mood: "confident" },
    });
  }

  const explanation = outfitRes.json?.explanation;
  const explanationStringArray =
    explanation === undefined || (Array.isArray(explanation) && explanation.every((x) => typeof x === "string"));

  const outfitOk =
    (outfitRes.status === 200 && explanationStringArray) ||
    (outfitRes.status === 400 &&
      outfitRes.json?.code === "INSUFFICIENT_WARDROBE_METADATA" &&
      Array.isArray(outfitRes.json?.explanation) &&
      outfitRes.json.explanation.every((x) => typeof x === "string"));

  addResult(
    "G) Outfit",
    outfitOk,
    `POST /api/ai/outfit -> ${outfitRes.status}${outfitRes.json?.code ? ` (${outfitRes.json.code})` : ""}`,
    { response: outfitRes.json ?? outfitRes.text, endpoint: outfitRes.endpoint, status: outfitRes.status, url: outfitRes.url }
  );

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
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.area} | ${r.detail}`);
  }
  console.log("-".repeat(60));
  console.log(`TOTAL: ${passCount} PASS / ${failCount} FAIL`);

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.log("\nFailing endpoint details (truncated):");
    for (const f of failures) {
      const responseText = f.response !== undefined ? truncate(f.response) : "<none>";
      const endpoint = f.endpoint || "unknown endpoint";
      const status = f.status ?? "unknown";
      const url = f.url || "unknown url";
      console.log(`- ${f.area}: endpoint=${endpoint}; status=${status}; url=${url}; body=${responseText}`);
      const lowered = String(responseText).toLowerCase();
      if (lowered.includes("insufficient_quota") || lowered.includes("you exceeded your current quota")) {
        console.log("  hint: OpenAI quota/credits issue (API billing), not app logic.");
      }
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
