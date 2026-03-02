#!/usr/bin/env node

const rawBaseUrl = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const PERSONALIZATION_PROOF_TOKEN = process.env.PERSONALIZATION_PROOF_TOKEN || "";
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

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(headers) {
    for (const line of extractSetCookieLines(headers)) {
      const pair = String(line).split(";")[0];
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(name) {
    return this.cookies.has(name);
  }
}

const BASE_URL = normalizeBaseUrl(rawBaseUrl);
const checks = [];
function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

async function withJar(path, init, jar, setBypassCookie = false) {
  const headers = { ...(init?.headers || {}) };
  if (PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = PROTECTION_BYPASS;
  if (setBypassCookie) headers["x-vercel-set-bypass-cookie"] = "true";
  const cookieHeader = jar.header();
  if (cookieHeader) headers.cookie = cookieHeader;
  if (PERSONALIZATION_PROOF_TOKEN) headers["x-stylemingle-proof-token"] = PERSONALIZATION_PROOF_TOKEN;

  const res = await fetch(new URL(path, BASE_URL), { ...init, headers, redirect: "manual" });
  jar.absorb(res.headers);
  const data = await res.text();
  let json = null;
  try {
    json = JSON.parse(data);
  } catch {}
  return { status: res.status, ok: res.ok, text: data, json };
}

(async () => {
  if (!BASE_URL || !SMOKE_EMAIL || !SMOKE_PASSWORD) process.exit(2);
  const jar = new CookieJar();

  const bypass = await withJar("/login", { method: "GET" }, jar, true);
  add("Bypass session established", bypass.status === 200, `GET /login -> ${bypass.status}`);

  const login = await withJar(
    "/api/auth/login",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }) },
    jar,
  );
  add("Login + app cookie", login.ok && jar.has(APP_AUTH_COOKIE_NAME), `POST /api/auth/login -> ${login.status}`);

  const profile0 = await withJar("/api/style-profile", { method: "GET" }, jar);
  add("GET style profile", profile0.status === 200, `GET /api/style-profile -> ${profile0.status}`);

  const patch = await withJar(
    "/api/style-profile",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ styleVibes: ["minimalist", "classic"], colorsAvoid: ["neon green"], fitPreference: "tailored", comfortFashion: 62 }),
    },
    jar,
  );
  add("PATCH style profile", patch.status === 200, `PATCH /api/style-profile -> ${patch.status}`);

  const profile1 = await withJar("/api/style-profile", { method: "GET" }, jar);
  const persisted = profile1.json?.profile?.colorsAvoid?.includes?.("neon green") === true;
  add("Style profile persistence", profile1.status === 200 && persisted, `persisted=${persisted}; status=${profile1.status}`);

  const gen1 = await withJar(
    "/api/ai/outfit",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occasion: "work", weather: "cool", mood: "minimalist" }) },
    jar,
  );
  const used1 = gen1.json?.meta?.personalizationUsed === true;
  add("Generation uses profile", gen1.status === 200 && used1, `status=${gen1.status}; personalizationUsed=${String(used1)}`);

  const outfitId = gen1.json?.outfitId;
  const beforeCount = Number(gen1.json?.meta?.biasSignals?.recentFeedbackCount || 0);
  const fb = await withJar(
    `/api/outfits/${outfitId}/feedback`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 2, reasons: ["too-formal", "color-clash"], note: "Needs less contrast" }),
    },
    jar,
  );
  add("Feedback saved", fb.status === 200, `POST /api/outfits/:id/feedback -> ${fb.status}`);

  const gen2 = await withJar(
    "/api/ai/outfit",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occasion: "work", weather: "cool", mood: "minimalist" }) },
    jar,
  );
  const afterCount = Number(gen2.json?.meta?.biasSignals?.recentFeedbackCount || 0);
  add("Bias signal changed", gen2.status === 200 && afterCount > beforeCount, `before=${beforeCount}; after=${afterCount}; status=${gen2.status}`);

  console.log("\nGate 12 Proof Report");
  console.log("=".repeat(60));
  console.log("RESULT | CHECK | DETAIL");
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${c.detail}`);
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
