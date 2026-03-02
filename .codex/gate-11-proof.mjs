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

function parseCookieName(setCookieLine) {
  const pair = String(setCookieLine || "").split(";")[0];
  const idx = pair.indexOf("=");
  if (idx <= 0) return "";
  return pair.slice(0, idx).trim();
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
}

const BASE_URL = normalizeBaseUrl(rawBaseUrl);
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 15_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!BASE_URL) {
  console.error("Missing required env var: BASE_URL");
  process.exit(2);
}
if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error("Missing required env vars: SMOKE_EMAIL and/or SMOKE_PASSWORD");
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
    if (PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = PROTECTION_BYPASS;
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
        finalUrl: url,
        location: "",
        cookieNamesAdded: [...addedNames],
        text: `network_error: ${String(error?.message || error)}`,
        json: null,
      };
    }
    clearTimeout(timeout);

    const names = jar.absorb(res.headers);
    names.forEach((n) => addedNames.add(n));

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
      finalUrl: url,
      location,
      cookieNamesAdded: [...addedNames],
      text,
      json,
    };
  }
}

function htmlSnippet(html, max = 220) {
  return String(html || "").replace(/\s+/g, " ").slice(0, max);
}

const checks = [];
function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function checkSelectors(docName, page, selectors) {
  for (const selector of selectors) {
    const exists = page.status === 200 && page.text.includes(`data-testid="${selector}"`);
    const detail = `${docName} missing selector=${selector}; status=${page.status}; final_url=${page.finalUrl}; html_length=${page.text.length}; snippet="${htmlSnippet(page.text)}"`;
    add(`${docName} selector ${selector}`, exists, exists ? `${docName} has selector ${selector}` : detail);
  }
}

(async () => {
  const jar = new CookieJar();

  console.log(`INFO: bypass_present=${Boolean(PROTECTION_BYPASS)}`);
  if (!PROTECTION_BYPASS) {
    console.log("ROOT_CAUSE: no protection bypass secret available in env; cannot access protected preview");
    process.exit(1);
  }

  const bypass = await fetchWithJar(`${BASE_URL}/login`, {
    method: "GET",
    headers: { accept: "text/html,application/json" },
  }, jar, { setBypassCookie: true });

  const jarNamesAfterBypass = jar.names();
  const hasVercelCookie = jarNamesAfterBypass.some((n) => n.includes("_vercel_jwt") || n.startsWith("__vercel") || n.includes("vercel"));
  console.log(`INFO: bypass_cookie_names=${jarNamesAfterBypass.join(",") || "<none>"}`);

  const bypassOk = bypass.status === 200 || hasVercelCookie;
  add("Bypass session established", bypassOk, `GET /login handshake -> ${bypass.status}; final_url=${bypass.finalUrl}`);

  const loginPage = await fetchWithJar(`${BASE_URL}/login`, {
    method: "GET",
    headers: { accept: "text/html,application/json" },
  }, jar);
  const loginReachable = loginPage.status === 200;
  add("Reachability /login", loginReachable, `GET /login -> ${loginPage.status}; final_url=${loginPage.finalUrl}`);
  if (!loginReachable) {
    console.log(`ROOT_CAUSE: /login unreachable after redirects; status=${loginPage.status}; location=${loginPage.location || "<none>"}; cookie_names=${jar.names().join(",") || "<none>"}`);
  }

  const login = await fetchWithJar(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  }, jar);

  const loginStatusOk = login.status === 200 || login.status === 204;
  const appCookiePresent = jar.has(APP_AUTH_COOKIE_NAME);
  const loginOk = loginStatusOk && appCookiePresent;
  add(
    "Auth login + app cookie",
    loginOk,
    `POST /api/auth/login -> ${login.status}; location=${login.location || "<none>"}; cookie_names=${jar.names().join(",") || "<none>"}`,
  );
  if (!loginOk) {
    console.log(`ROOT_CAUSE: login did not set app auth cookie; status=${login.status}; location=${login.location || "<none>"}; cookie_names=${jar.names().join(",") || "<none>"}`);
  }

  const wardrobePage = await fetchWithJar(`${BASE_URL}/dashboard/wardrobe?debug=1`, {
    method: "GET",
    headers: { accept: "text/html,application/json" },
  }, jar);
  add("Wardrobe page load", wardrobePage.status === 200, `GET /dashboard/wardrobe?debug=1 -> ${wardrobePage.status}; final_url=${wardrobePage.finalUrl}`);
  checkSelectors("Wardrobe page", wardrobePage, ["wardrobe-upload-multi", "wardrobe-upload-camera", "upload-queue-panel"]);

  const avatarPage = await fetchWithJar(`${BASE_URL}/dashboard/avatar?debug=1`, {
    method: "GET",
    headers: { accept: "text/html,application/json" },
  }, jar);
  add("Avatar page load", avatarPage.status === 200, `GET /dashboard/avatar?debug=1 -> ${avatarPage.status}; final_url=${avatarPage.finalUrl}`);
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
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${c.detail}`);

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  console.log("-".repeat(60));
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Proof run crashed:", err?.stack || String(err));
  process.exit(1);
});
