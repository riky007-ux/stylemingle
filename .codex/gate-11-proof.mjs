#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const PROTECTION_BYPASS = process.env.VERCEL_PROTECTION_BYPASS || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

if (!BASE_URL) {
  console.error('Missing required env var: BASE_URL');
  console.error('Usage: BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-11-proof.mjs');
  process.exit(2);
}

if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error('Missing required env vars: SMOKE_EMAIL and/or SMOKE_PASSWORD');
  console.error('Usage: BASE_URL="https://..." SMOKE_EMAIL="..." SMOKE_PASSWORD="..." node .codex/gate-11-proof.mjs');
  process.exit(2);
}

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 450;
const REQUEST_TIMEOUT_MS = 15_000;

class CookieJar {
  constructor() { this.cookies = new Map(); }
  absorb(headers) {
    let setCookies = [];
    if (typeof headers.getSetCookie === 'function') setCookies = headers.getSetCookie();
    else {
      const single = headers.get('set-cookie');
      if (single) setCookies = [single];
    }
    for (const entry of setCookies) {
      const pair = String(entry).split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  hasAny() { return this.cookies.size > 0; }
}

function getCode(body) {
  if (!body || typeof body !== 'object') return undefined;
  return body.code || body.error;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function req(path, { method = 'GET', body, jar, auth = false, acceptHtml = false } = {}) {
  const headers = { accept: acceptHtml ? 'text/html,application/json' : 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (PROTECTION_BYPASS) {
    headers['x-vercel-protection-bypass'] = PROTECTION_BYPASS;
    headers['x-vercel-set-bypass-cookie'] = 'true';
  }
  if (auth && jar?.hasAny()) headers.cookie = jar.header();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: 'manual',
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

      const ct = res.headers.get('content-type') || '';
      let text = '';
      let json = null;
      if (ct.includes('application/json')) {
        try { json = await res.json(); } catch { text = await res.text(); }
      } else {
        text = await res.text();
        try { json = JSON.parse(text); } catch {}
      }

      return { status: res.status, ok: res.ok, text, json };
    } catch (error) {
      clearTimeout(timeout);
      const isNetworkish = error?.name === 'AbortError' || String(error?.message || error).toLowerCase().includes('fetch');
      if (isNetworkish && attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * 2 ** attempt;
        console.log(`retrying ${method} ${path} after network/timeout error (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }
      return { status: 0, ok: false, text: `network_error: ${String(error?.message || error)}`, json: null };
    }
  }

  return { status: 0, ok: false, text: 'network_error: retry_exhausted', json: null };
}

const checks = [];
function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

(async () => {
  const jar = new CookieJar();

  const loginPage = await req('/login');
  add('Reachability /login', [200, 304].includes(loginPage.status), `GET /login -> ${loginPage.status}`);

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
    jar,
  });
  add('Auth login + cookie', login.status === 200 && jar.hasAny(), `POST /api/auth/login -> ${login.status}; cookie=${jar.hasAny() ? 'present' : 'missing'}`);

  const items = await req('/api/wardrobe/items', { jar, auth: true });
  const itemRows = Array.isArray(items.json) ? items.json : [];
  add('Wardrobe API loads', items.status === 200, `GET /api/wardrobe/items -> ${items.status}; count=${itemRows.length}`);

  const ids = itemRows.map((x) => x?.id).filter((x) => typeof x === 'string');
  const tagBatch = ids.length > 0
    ? await req('/api/ai/wardrobe/tag-batch', { method: 'POST', jar, auth: true, body: { itemIds: ids.slice(0, 6) } })
    : { status: 0, json: { code: 'SKIPPED_NO_ITEMS' } };
  const tagBatchCode = getCode(tagBatch.json);
  const tagBatchOk = tagBatch.status === 200 || (tagBatch.status === 503 && ['AI_UNAVAILABLE', 'DB_MIGRATION_REQUIRED'].includes(tagBatchCode));
  add('Bulk tag endpoint', tagBatchOk, `POST /api/ai/wardrobe/tag-batch -> ${tagBatch.status}${tagBatchCode ? ` (${tagBatchCode})` : ''}`);

  const outfit = await req('/api/ai/outfit', {
    method: 'POST',
    jar,
    auth: true,
    body: { occasion: 'daily errands', weather: 'mild', mood: 'confident' },
  });
  const outfitCode = getCode(outfit.json);
  const outfitOk = outfit.status === 200 || (outfit.status === 400 && outfitCode === 'INSUFFICIENT_WARDROBE_METADATA');
  add('Outfit endpoint', outfitOk, `POST /api/ai/outfit -> ${outfit.status}${outfitCode ? ` (${outfitCode})` : ''}`);

  const wardrobeDebug = await req('/dashboard/wardrobe?debug=1', { jar, auth: true, acceptHtml: true });
  const flagPanelOk = wardrobeDebug.status === 200 && wardrobeDebug.text.includes('Experimental features') && wardrobeDebug.text.includes('BG Removal:') && wardrobeDebug.text.includes('Avatar v2:');
  add('Debug indicator readout', flagPanelOk, `GET /dashboard/wardrobe?debug=1 -> ${wardrobeDebug.status}`);

  console.log('\nGate 11 Proof Report');
  console.log('='.repeat(60));
  console.log(`URL tested: ${BASE_URL}`);
  console.log('RESULT | CHECK | DETAIL');
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} | ${c.name} | ${c.detail}`);
  }

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  console.log('-'.repeat(60));
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);

  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Proof run crashed:', err?.stack || String(err));
  process.exit(1);
});
