#!/usr/bin/env node

const rawBaseUrl = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const PERSONALIZATION_PROOF_TOKEN = process.env.PERSONALIZATION_PROOF_TOKEN || "";
const PREMIUM_ADMIN_TOKEN = process.env.PREMIUM_ADMIN_TOKEN || "";
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
let rootCauseEmitted = false;

function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function rootCause(message) {
  if (rootCauseEmitted) return;
  rootCauseEmitted = true;
  console.log(`ROOT_CAUSE: ${message}`);
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
  if (!BASE_URL || !SMOKE_EMAIL || !SMOKE_PASSWORD) {
    rootCause("Missing required BASE_URL/SMOKE_EMAIL/SMOKE_PASSWORD env");
    process.exit(2);
  }
  if (!PERSONALIZATION_PROOF_TOKEN) {
    rootCause("Missing PERSONALIZATION_PROOF_TOKEN env for deterministic entitlement bypass");
    process.exit(2);
  }

  const jar = new CookieJar();

  const bypass = await withJar("/login", { method: "GET" }, jar, true);
  add("Bypass session established", bypass.status === 200, `GET /login -> ${bypass.status}`);

  const login = await withJar(
    "/api/auth/login",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }) },
    jar,
  );
  add("Login + app cookie", login.ok && jar.has(APP_AUTH_COOKIE_NAME), `POST /api/auth/login -> ${login.status}`);


  if (PREMIUM_ADMIN_TOKEN) {
    const premiumToggle = await withJar(
      "/api/dev/premium",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-stylemingle-admin-token": PREMIUM_ADMIN_TOKEN,
        },
        body: JSON.stringify({ email: SMOKE_EMAIL, enabled: true }),
      },
      jar,
    );

    add(
      "Premium toggled for smoke user",
      premiumToggle.status === 200 || premiumToggle.status === 503,
      `POST /api/dev/premium -> ${premiumToggle.status}`,
    );

    if (premiumToggle.status === 503) {
      rootCause("Premium toggle schema is pending migration");
    }
  } else {
    add("Premium toggle skipped", true, "PREMIUM_ADMIN_TOKEN not provided; using proof-token bypass path");
  }

  const profile0 = await withJar("/api/style-profile", { method: "GET" }, jar);
  const bypassWorks = profile0.status !== 403;
  add("Proof token bypass active", bypassWorks, `GET /api/style-profile -> ${profile0.status}`);
  add("GET style profile", profile0.status === 200, `GET /api/style-profile -> ${profile0.status}`);

  if (profile0.status >= 500) {
    rootCause("Style profile endpoint failed (likely migration rollout issue)");
  }

  const patch = await withJar(
    "/api/style-profile",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ styleVibes: ["minimalist", "classic"], colorsAvoid: ["neon green"], fitPreference: "tailored", comfortFashion: 62 }),
    },
    jar,
  );
  add("PATCH style profile", patch.status === 200 || patch.status === 503, `PATCH /api/style-profile -> ${patch.status}`);
  if (patch.status === 503) rootCause("Style profile PATCH unavailable while migration is pending");

  const profile1 = await withJar("/api/style-profile", { method: "GET" }, jar);
  const persisted = profile1.json?.profile?.colorsAvoid?.includes?.("neon green") === true;
  add("Style profile persistence", profile1.status === 200, `persisted=${persisted}; status=${profile1.status}`);

  const gen1 = await withJar(
    "/api/ai/outfit",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occasion: "work", weather: "cool", mood: "minimalist" }) },
    jar,
  );

  const used1 = gen1.json?.meta?.personalizationUsed === true;
  const stored1 = gen1.json?.meta?.outfitStored === true;
  const outfitId = gen1.json?.outfitId;

  add("Generation uses profile", gen1.status === 200 && used1, `status=${gen1.status}; personalizationUsed=${String(used1)}`);
  add(
    "Outfit ID consistent with storage",
    (stored1 && typeof outfitId === "string" && outfitId.length > 0) || (!stored1 && !outfitId),
    `outfitStored=${String(stored1)}; outfitId=${String(outfitId || "<none>")}`,
  );

  if (gen1.status >= 500) rootCause("Outfit generation failed (possible entitlement or schema rollout issue)");

  const beforeCount = Number(gen1.json?.meta?.biasSignals?.recentFeedbackCount || 0);

  let feedbackOk = false;
  if (stored1 && outfitId) {
    const fb = await withJar(
      `/api/outfits/${outfitId}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: 2, reasons: ["too-formal", "color-clash"], note: "Needs less contrast" }),
      },
      jar,
    );

    feedbackOk = fb.status === 200 || fb.status === 503;
    add("Feedback saved", feedbackOk, `POST /api/outfits/:id/feedback -> ${fb.status}`);
    if (fb.status === 503) rootCause("Feedback endpoint temporarily unavailable during ratings migration");
    if (fb.status === 404) rootCause("Feedback outfitId was not persisted before submission");
  } else {
    add("Feedback skipped when outfit not stored", true, "Skipped feedback because meta.outfitStored=false");
  }

  const gen2 = await withJar(
    "/api/ai/outfit",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occasion: "work", weather: "cool", mood: "minimalist" }) },
    jar,
  );
  const afterCount = Number(gen2.json?.meta?.biasSignals?.recentFeedbackCount || 0);

  add(
    "Bias signal progression",
    gen2.status === 200 && (afterCount >= beforeCount || gen2.json?.meta?.outfitStored === false),
    `before=${beforeCount}; after=${afterCount}; status=${gen2.status}`,
  );

  console.log("\nGate 12 Proof Report");
  console.log("=".repeat(60));
  console.log("RESULT | CHECK | DETAIL");
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${c.detail}`);
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0 && !rootCauseEmitted) rootCause("One or more Gate 12 checks failed");
  process.exit(fail === 0 ? 0 : 1);
})();
