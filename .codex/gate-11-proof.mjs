#!/usr/bin/env node

const rawBaseUrl = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const APP_AUTH_COOKIE_NAME = "auth";

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

function cookieNamesFromHeaders(headers) {
  return extractSetCookieLines(headers)
    .map((entry) => String(entry).split(";")[0])
    .map((pair) => pair.slice(0, pair.indexOf("=")))
    .map((name) => name.trim())
    .filter(Boolean);
}

const BASE_URL = normalizeBaseUrl(rawBaseUrl);

if (!BASE_URL) {
  console.error("Missing required env var: BASE_URL");
  console.error('Usage: BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-11-proof.mjs');
  process.exit(2);
}

if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error("Missing required env vars: SMOKE_EMAIL and/or SMOKE_PASSWORD");
  console.error('Usage: BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-11-proof.mjs');
  process.exit(2);
}

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 450;
const REQUEST_TIMEOUT_MS = 15_000;

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(headers) {
    const setCookies = extractSetCookieLines(headers);
    for (const entry of setCookies) {
      const pair = String(entry).split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name) this.cookies.set(name, value);
      }
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(name) {
    return this.cookies.has(name);
  }
  names() {
    return [...this.cookies.keys()];
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function req(path, { method = "GET", body, jar, auth = false, acceptHtml = false } = {}) {
  const headers = { accept: acceptHtml ? "text/html,application/json" : "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (PROTECTION_BYPASS) {
    headers["x-vercel-protection-bypass"] = PROTECTION_BYPASS;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  if (auth && jar?.names().length) headers.cookie = jar.header();

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
      jar?.absorb(res.headers);

      if (TRANSIENT_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * 2 ** attempt;
        console.log(`retrying ${method} ${path} after transient status ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
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
        text,
        json,
        url: `${BASE_URL}${path}`,
        location: res.headers.get("location") || "",
        cookieNames: cookieNamesFromHeaders(res.headers),
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
        text: `network_error: ${String(error?.message || error)}`,
        json: null,
        url: `${BASE_URL}${path}`,
        location: "",
        cookieNames: [],
      };
    }
  }

  return { status: 0, ok: false, text: "network_error: retry_exhausted", json: null, url: `${BASE_URL}${path}`, location: "", cookieNames: [] };
}

function htmlSnippet(html, max = 200) {
  return String(html || "").replace(/\s+/g, " ").slice(0, max);
}

const checks = [];
function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function checkSelectors(docName, page, selectors) {
  for (const selector of selectors) {
    const exists = page.status === 200 && page.text.includes(`data-testid="${selector}"`);
    const detail = `${docName} missing selector=${selector}; status=${page.status}; url=${page.url}; html_length=${page.text.length}; snippet="${htmlSnippet(page.text)}"`;
    add(`${docName} selector ${selector}`, exists, exists ? `${docName} has selector ${selector}` : detail);
  }
}

(async () => {
  const jar = new CookieJar();

  const loginPage = await req("/login", { acceptHtml: true });
  add("Reachability /login", [200, 304].includes(loginPage.status), `GET /login -> ${loginPage.status}; url=${loginPage.url}`);

  const login = await req("/api/auth/login", {
    method: "POST",
    body: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
    jar,
  });
  const loginStatusOk = login.status === 200 || (login.status >= 300 && login.status < 400);
  const appCookiePresent = jar.has(APP_AUTH_COOKIE_NAME) || login.cookieNames.includes(APP_AUTH_COOKIE_NAME);
  const cookieNames = [...new Set([...login.cookieNames, ...jar.names()])];
  const loginOk = loginStatusOk && appCookiePresent;
  add(
    "Auth login + app cookie",
    loginOk,
    `POST /api/auth/login -> ${login.status}; location=${login.location || "<none>"}; cookie_names=${cookieNames.join(",") || "<none>"}`,
  );

  if (!loginOk) {
    console.log(`ROOT_CAUSE: login did not set app auth cookie; status=${login.status}; location=${login.location || "<none>"}; cookie_names=${cookieNames.join(",") || "<none>"}`);
  }

  const wardrobePage = await req("/dashboard/wardrobe?debug=1", { jar, auth: true, acceptHtml: true });
  add("Wardrobe page load", wardrobePage.status === 200, `GET /dashboard/wardrobe?debug=1 -> ${wardrobePage.status}; url=${wardrobePage.url}`);
  checkSelectors("Wardrobe page", wardrobePage, ["wardrobe-upload-multi", "wardrobe-upload-camera", "upload-queue-panel"]);

  const avatarPage = await req("/dashboard/avatar?debug=1", { jar, auth: true, acceptHtml: true });
  add("Avatar page load", avatarPage.status === 200, `GET /dashboard/avatar?debug=1 -> ${avatarPage.status}; url=${avatarPage.url}`);
  checkSelectors("Avatar page", avatarPage, [
    "avatar-v2-enabled",
    "avatar-fit-controls",
    "outfit-overlay-top",
    "outfit-overlay-bottom",
    "outfit-overlay-shoes",
  ]);

  console.log("\nGate 11 Proof Report");
  console.log("=".repeat(60));
  console.log(`URL tested: ${BASE_URL}`);
  console.log("RESULT | CHECK | DETAIL");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${c.detail}`);
  }

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  console.log("-".repeat(60));
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);

  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Proof run crashed:", err?.stack || String(err));
  process.exit(1);
});
