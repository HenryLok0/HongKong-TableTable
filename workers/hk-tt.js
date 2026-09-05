const GITHUB_BASE = "https://henrylok0.github.io/HongKong-TableTable/";
const MAX_NAMES = 400;
const SHORT_ID_LEN = 8;
// Bind a KV namespace as LINKS in the Worker dashboard for short share URLs.

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
  if (!env.LINKS) return { id, stored: false };
  await env.LINKS.put(id, token);
  return { id, stored: true };
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

    if (path === "/api/lookup") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST") {
        return new Response("POST only", { status: 405 });
      }
      try {
        const body = await request.json();
        const index = await getIndex(ctx);
        return json(lookupNames(index, Array.isArray(body.names) ? body.names : []));
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    return proxy(request);
  },
};
