const GITHUB_BASE = "https://henrylok0.github.io/HongKong-TableTable/";
const MAX_NAMES = 400;
const SHORT_ID_LEN = 8;
// Bind KV as LINKS. Set Worker secret ADMIN_SECRET for /admin query logs.
const QUERY_PREFIX = "q:";
const QUERY_LOG_LIMIT = 300;

function normalizeName(name) {
  return String(name).replace(/\s+/g, "");
}

function playerPoints(player) {
  return player.points ?? player.rankings?.ALL?.points ?? 0;
}

function priorKey(player) {
  return `${player.gender}|${player.name}|${player.club || ""}|${player.school || ""}`;
}

function toBase64Url(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenId(token) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(buf)).slice(0, SHORT_ID_LEN);
}

async function saveShort(env, token) {
  const id = await tokenId(token);
  if (!env.LINKS) return { id, stored: false, reason: "missing LINKS kv" };
  try {
    const existing = await env.LINKS.get(id);
    if (existing === token) return { id, stored: true };
    await env.LINKS.put(id, token);
    return { id, stored: true };
  } catch {
    return { id, stored: false, reason: "kv write failed" };
  }
}

async function loadShort(env, id) {
  if (!env.LINKS || !id) return null;
  return env.LINKS.get(id);
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function logQueries(env, names) {
  if (!env.LINKS) return;
  const clean = [];
  const seen = new Set();
  for (const raw of names || []) {
    const query = String(raw || "").replace(/\s+/g, "").trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    clean.push(query);
    if (clean.length >= MAX_NAMES) break;
  }
  if (!clean.length) return;
  const id = `${QUERY_PREFIX}${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
  try {
    await env.LINKS.put(id, JSON.stringify({ at: Date.now(), names: clean }));
  } catch {
    // Daily KV write quota; skip this log.
  }
}

function adminOk(request, env, extraK) {
  const secret = env.ADMIN_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  if (url.searchParams.get("k") === secret) return true;
  if (extraK && extraK === secret) return true;
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").some((part) => part.trim() === `hktt_admin=${secret}`);
}

function adminCookie(env) {
  return `hktt_admin=${env.ADMIN_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function formatHkt(ms) {
  return new Date(ms).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });
}

async function readQueryLogs(env) {
  const rows = [];
  let cursor;
  do {
    const page = await env.LINKS.list({ prefix: QUERY_PREFIX, limit: 100, cursor });
    for (const key of page.keys) {
      const raw = await env.LINKS.get(key.name);
      if (!raw) continue;
      try {
        const row = JSON.parse(raw);
        if (Array.isArray(row.names) && row.names.length) rows.push({ ...row, key: key.name });
      } catch {
        // Skip bad rows.
      }
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor && rows.length < QUERY_LOG_LIMIT * 2);
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  return rows.slice(0, QUERY_LOG_LIMIT);
}

async function deleteAllQueryLogs(env) {
  let cursor;
  let deleted = 0;
  do {
    const page = await env.LINKS.list({ prefix: QUERY_PREFIX, limit: 100, cursor });
    await Promise.all(page.keys.map((key) => env.LINKS.delete(key.name)));
    deleted += page.keys.length;
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return deleted;
}

function namesToBytes(names) {
  const text = names.join("\n");
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[i * 2] = code >> 8;
    bytes[i * 2 + 1] = code & 255;
  }
  return bytes;
}

function resultHref(names) {
  const params = new URLSearchParams();
  params.set("n", names.join("\n"));
  params.set("log", "0");
  return `/?${params}`;
}

function resultHrefS(name) {
  const params = new URLSearchParams();
  params.set("s", `1${toBase64Url(namesToBytes([name]))}`);
  params.set("log", "0");
  return `/?${params}`;
}

function adminPage(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const name of row.names) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-HK")).slice(0, 40);
  const topHtml = top.length
    ? top.map(([name, n]) => `<a class="chip" href="${escapeHtml(resultHrefS(name))}" target="_blank" rel="noreferrer">${escapeHtml(name)}<span>${n}</span></a>`).join("")
    : `<p class="empty">未有紀錄</p>`;
  const listHtml = rows.length
    ? rows.map((row) => {
      const names = row.names.map((n) => escapeHtml(n)).join("、");
      return `<article class="card">
        <label class="pick"><input type="checkbox" value="${escapeHtml(row.key || "")}" /></label>
        <div>
          <time>${escapeHtml(formatHkt(row.at))}</time>
          <p>${names}</p>
        </div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(resultHref(row.names))}" target="_blank" rel="noreferrer">結果(${row.names.length}人)</a>
          <button class="btn danger" type="button" data-del="${escapeHtml(row.key || "")}">剷除</button>
        </div>
      </article>`;
    }).join("")
    : `<p class="empty">未有查詢紀錄。只有經 hktt.henrylok.me 嘅查詢會記入。</p>`;
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>查詢紀錄</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700&family=Noto+Serif+TC:wght@600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f4efe6; --ink: #1c2430; --muted: #5b6573; --card: #fffdf8;
      --line: #ddd4c6; --accent: #d85a1a; --miss: #8a3b3b; --wash: #ffe2c8;
      --heading: #16324f; --btn: #16324f; --chip: #f3eee4;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #12161c; --ink: #e8e4dc; --muted: #b4bcc6; --card: #1c222b;
        --line: #3d4654; --accent: #f08a4c; --miss: #f0c0c0; --wash: #2a221c;
        --heading: #f3efe8; --btn: #e8e4dc; --chip: #2a3038;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; color: var(--ink);
      background-color: var(--bg);
      background-image: radial-gradient(circle at 12% -10%, var(--wash) 0, transparent 32%);
      font-family: "Noto Sans TC", sans-serif; line-height: 1.55;
    }
    main { width: min(44rem, calc(100% - 32px)); margin: 0 auto; padding: 2.5rem 0 4rem; }
    .eyebrow { margin: 0 0 .4rem; letter-spacing: .14em; text-transform: uppercase; font-size: .75rem; color: var(--accent); font-weight: 700; }
    h1 { margin: 0; font-family: "Noto Serif TC", serif; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--heading); }
    h2 { margin: 0; font-size: 1.05rem; color: var(--heading); }
    .hint, .empty { color: var(--muted); }
    .stat { display: inline-block; margin: 1rem 0 0; padding: .45rem .8rem; background: var(--card); border: 1px solid var(--line); border-radius: 10px; font-size: .9rem; }
    .panel { margin-top: 1.4rem; padding: 1rem 1.1rem 1.15rem; background: var(--card); border: 1px solid var(--line); border-radius: 16px; }
    .head-actions { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
    .head-row { display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: .25rem; }
    .pick { display: flex; padding-top: .2rem; }
    .pick input { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); }
    .card { display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; border-top: 1px solid var(--line); padding: .9rem 0; }
    .card:first-of-type { border-top: 0; }
    .card p { margin: .3rem 0 0; }
    time { color: var(--muted); font-size: .82rem; }
    .actions { display: flex; flex-direction: column; gap: .4rem; min-width: 7.2rem; }
    .btn {
      display: inline-flex; justify-content: center; align-items: center;
      padding: .4rem .7rem; border-radius: 999px; text-decoration: none; font: inherit; font-size: .85rem;
      background: var(--btn); color: #fff; border: 1px solid var(--btn); cursor: pointer; white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) { .btn { color: #12161c; } }
    .btn.danger { color: var(--miss); border-color: var(--miss); background: transparent; }
    .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .8rem; }
    .chip {
      display: inline-flex; gap: .4rem; align-items: center;
      padding: .35rem .7rem; background: var(--chip); border: 1px solid var(--line);
      border-radius: 999px; color: var(--ink); text-decoration: none; font-size: .9rem;
    }
    .chip span { color: var(--muted); font-size: .8rem; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Admin</p>
    <h1>查詢紀錄</h1>
    <p class="hint">只有你睇到。主站冇呢頁連結。</p>
    <p class="stat">共 <b>${rows.length}</b> 次查詢</p>
    <section class="panel">
      <div class="head-row">
        <h2>最近查詢</h2>
        <div class="head-actions">
          <label class="pick"><input type="checkbox" id="pick-all" /> 全選</label>
          <button class="btn danger" type="button" id="del-picked">剷除已選</button>
          <button class="btn danger" type="button" id="del-all">剷除全部</button>
        </div>
      </div>
      ${listHtml}
    </section>
    <section class="panel">
      <h2>最常被查</h2>
      <div class="chips">${topHtml}</div>
    </section>
  </main>
  <script>
    const k = new URLSearchParams(location.search).get("k") || "";
    async function send(body) {
      const res = await fetch("/api/admin/queries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, k }),
      });
      if (!res.ok) {
        alert("剷除失敗");
        return;
      }
      location.reload();
    }
    document.getElementById("pick-all")?.addEventListener("change", (event) => {
      const on = event.target.checked;
      document.querySelectorAll(".card .pick input").forEach((el) => { el.checked = on; });
    });
    document.getElementById("del-picked")?.addEventListener("click", () => {
      const keys = [...document.querySelectorAll(".card .pick input:checked")].map((el) => el.value).filter(Boolean);
      if (!keys.length) {
        alert("未有剔選紀錄。");
        return;
      }
      if (!confirm(`剷除已選 ${keys.length} 次查詢？`)) return;
      send({ keys });
    });
    document.getElementById("del-all")?.addEventListener("click", () => {
      if (!confirm("剷除全部查詢紀錄？短連結唔會刪。")) return;
      send({ all: true });
    });
    document.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-del");
        if (!key || !confirm("剷除呢次查詢？")) return;
        send({ key });
      });
    });
  </script>
</body>
</html>`;
}

async function originJson(file, ctx) {
  const url = new URL(file, GITHUB_BASE).href;
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  let res = await cache.match(cacheKey);
  if (!res) {
    res = await fetch(url, {
      headers: { "User-Agent": "hk-tt-worker", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${file} ${res.status}`);
    const cached = new Response(res.clone().body, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=1800",
      },
    });
    ctx.waitUntil(cache.put(cacheKey, cached));
  }
  return res.json();
}

function scorePlayers(players) {
  for (const gender of ["M", "F"]) {
    const list = players.filter((p) => p.gender === gender && playerPoints(p) >= 1);
    list.sort((a, b) => (a.rankings?.ALL?.rank || 9e9) - (b.rankings?.ALL?.rank || 9e9));
    const total = list.length;
    list.forEach((player, idx) => {
      player.scoredRank = idx + 1;
      player.scoredTotal = total;
    });
  }
}

async function buildIndex(ctx) {
  const [rankings, lcsd, badges] = await Promise.all([
    originJson("data/rankings.json", ctx),
    originJson("data/lcsd.json", ctx),
    originJson("data/badges.json", ctx),
  ]);
  const players = rankings.players || [];
  scorePlayers(players);
  for (const player of players) player._nk = normalizeName(player.name);

  const playerByName = new Map();
  const unique = new Set();
  for (const player of players) {
    if (player._nk) unique.add(player._nk);
    const list = playerByName.get(player._nk);
    if (list) list.push(player);
    else playerByName.set(player._nk, [player]);
  }

  const lcsdPlayers = lcsd.players || {};
  const badgePlayers = badges.players || {};
  const lcsdByName = new Map();
  for (const [name, recs] of Object.entries(lcsdPlayers)) {
    const key = normalizeName(name) || name;
    unique.add(key);
    lcsdByName.set(key, recs);
  }
  const badgeByName = new Map();
  for (const [name, recs] of Object.entries(badgePlayers)) {
    const key = normalizeName(name) || name;
    unique.add(key);
    badgeByName.set(key, recs);
  }

  const lcsdDocCodes = {};
  for (const recs of Object.values(lcsdPlayers)) {
    for (const rec of recs) {
      const url = rec.url || `${rec.district}|${rec.year}`;
      const code = String(rec.group || "").toUpperCase();
      if (!url || !code) continue;
      if (!lcsdDocCodes[url]) lcsdDocCodes[url] = [];
      if (!lcsdDocCodes[url].includes(code)) lcsdDocCodes[url].push(code);
    }
  }

  return {
    period: rankings.period || "",
    updated: rankings.updated || "",
    totals: rankings.totals || {},
    priorPeriod: rankings.prior?.period || "",
    priorAll: rankings.prior?.all || {},
    hktta: players.length,
    lcsd: Object.keys(lcsdPlayers).length,
    badges: Object.keys(badgePlayers).length,
    unique: unique.size,
    players,
    playerByName,
    lcsdByName,
    badgeByName,
    lcsdDocCodes,
  };
}

function getIndex(ctx) {
  if (!globalThis.__HKTT_INDEX) {
    globalThis.__HKTT_INDEX = buildIndex(ctx).catch((err) => {
      globalThis.__HKTT_INDEX = null;
      throw err;
    });
  }
  return globalThis.__HKTT_INDEX;
}

function findPossible(index, key) {
  if (key.length < 2) return [];
  const hits = [];
  for (const player of index.players) {
    const name = player._nk || "";
    if (name === key || !name.includes(key)) continue;
    hits.push(player);
    if (hits.length >= 8) break;
  }
  return hits;
}

function lookupNames(index, names) {
  const queries = [];
  const seen = new Set();
  for (const raw of names) {
    const query = String(raw || "").trim();
    const key = normalizeName(query);
    if (!query || !key || seen.has(key)) continue;
    seen.add(key);
    queries.push({ query, key });
    if (queries.length >= MAX_NAMES) break;
  }

  const priorAll = {};
  const results = queries.map(({ query, key }) => {
    const matches = (index.playerByName.get(key) || []).map((player) => {
      const pk = priorKey(player);
      if (index.priorAll[pk]) priorAll[pk] = index.priorAll[pk];
      return player;
    });
    return {
      query,
      matches,
      possible: matches.length ? [] : findPossible(index, key),
      lcsd: index.lcsdByName.get(key) || [],
      badges: index.badgeByName.get(key) || [],
    };
  });

  return {
    period: index.period,
    updated: index.updated,
    totals: index.totals,
    prior: { period: index.priorPeriod, all: priorAll },
    results,
  };
}

function metaPayload(index) {
  return {
    hktta: index.hktta,
    lcsd: index.lcsd,
    badges: index.badges,
    unique: index.unique,
    period: index.period,
    updated: index.updated,
    totals: index.totals,
    priorPeriod: index.priorPeriod,
    lcsdDocCodes: index.lcsdDocCodes,
  };
}

async function proxy(request) {
  const incoming = new URL(request.url);
  const rel = incoming.pathname.replace(/^\//, "");
  const target = new URL(rel, GITHUB_BASE);
  target.search = incoming.search;
  return fetch(target.href, {
    method: request.method,
    headers: {
      "User-Agent": "hk-tt-worker",
      Accept: request.headers.get("Accept") || "*/*",
    },
    redirect: "follow",
  });
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const path = incoming.pathname;

    if (path === "/api/short") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      try {
        const body = await request.json();
        const token = String(body.s || "");
        if (token.length < 2 || token.length > 8000) {
          return json({ error: "bad token" }, { status: 400 });
        }
        return json(await saveShort(env, token));
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    const shortGet = /^\/api\/short\/([A-Za-z0-9_-]{6,16})$/.exec(path);
    if (shortGet && request.method === "GET") {
      const token = await loadShort(env, shortGet[1]);
      if (!token) return json({ error: "not found" }, { status: 404 });
      return json({ s: token });
    }

    if (path === "/api/meta") {
      try {
        const index = await getIndex(ctx);
        return json(metaPayload(index));
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    if (path === "/api/admin/queries") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      try {
        const body = await request.json();
        if (!adminOk(request, env, body.k)) {
          return json({ error: "unauthorized" }, { status: 401 });
        }
        if (!env.LINKS) return json({ error: "LINKS kv missing" }, { status: 503 });
        if (body.all) {
          const deleted = await deleteAllQueryLogs(env);
          return json({ ok: true, deleted });
        }
        const keys = Array.isArray(body.keys) ? body.keys : body.key ? [body.key] : [];
        const valid = keys.map((key) => String(key || "")).filter((key) => key.startsWith(QUERY_PREFIX));
        if (!valid.length) return json({ error: "bad key" }, { status: 400 });
        await Promise.all(valid.map((key) => env.LINKS.delete(key)));
        return json({ ok: true, deleted: valid.length });
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    if (path === "/admin") {
      if (!env.ADMIN_SECRET) {
        return new Response("Set Worker secret ADMIN_SECRET", { status: 503 });
      }
      if (!adminOk(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (!env.LINKS) {
        return new Response("LINKS kv missing", { status: 503 });
      }
      const rows = await readQueryLogs(env);
      const headers = {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "X-Robots-Tag": "noindex",
      };
      if (incoming.searchParams.get("k") === env.ADMIN_SECRET) {
        headers["Set-Cookie"] = adminCookie(env);
      }
      return new Response(adminPage(rows), { headers });
    }

    if (path === "/api/lookup") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST") {
        return new Response("POST only", { status: 405 });
      }
      try {
        const body = await request.json();
        const names = Array.isArray(body.names) ? body.names : [];
        if (body.log !== false) ctx.waitUntil(logQueries(env, names));
        const index = await getIndex(ctx);
        return json(lookupNames(index, names));
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    return proxy(request);
  },
};
