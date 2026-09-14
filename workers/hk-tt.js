const GITHUB_BASE = "https://henrylok0.github.io/HongKong-TableTable/";
const SITE_ORIGIN = "https://hktt.henrylok.me";
const MAX_NAMES = 400;
const SHORT_ID_LEN = 8;
// Snapshots update about once a day. Keep the in-memory lookup index for an hour.
const INDEX_TTL_MS = 60 * 60 * 1000;
const ORIGIN_JSON_MAX_AGE = 3600;
const META_MAX_AGE = 300;
// Bind KV as LINKS. Set Worker secret ADMIN_SECRET for /admin query logs.
const QUERY_PREFIX = "q:";
const QUERY_LOG_LIMIT = 300;

function normalizeName(name) {
  return String(name).replace(/\s+/g, "");
}

function currentHktYear() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
  }).formatToParts(new Date());
  return parts.find((part) => part.type === "year")?.value || String(new Date().getFullYear());
}

function badgeInYear(recs, year) {
  const prefix = String(year);
  return (recs || []).some((rec) => String(rec.session || "").startsWith(prefix));
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
      "cache-control": init.cache || "no-store",
    },
  });
}

function edgeCacheControl(path) {
  if (path.startsWith("/data/") && path.endsWith(".json")) return `public, max-age=${ORIGIN_JSON_MAX_AGE}`;
  if (/\.(js|css)$/.test(path)) return "public, max-age=86400";
  if (/\.(png|svg|ico|webp|jpe?g|woff2?)$/.test(path)) return "public, max-age=604800";
  if (path === "/" || path.endsWith(".html")) return "public, max-age=120";
  return "public, max-age=300";
}

async function logQueries(env, names, request) {
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
  const row = { at: Date.now(), names: clean, ...clientMeta(request) };
  try {
    await env.LINKS.put(id, JSON.stringify(row));
  } catch {
    // Daily KV write quota; skip this log.
  }
}

function clientMeta(request) {
  if (!request) return {};
  const forwarded = (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim();
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("True-Client-IP") || forwarded;
  const ua = request.headers.get("User-Agent") || "";
  const cf = request.cf || {};
  const lang = (request.headers.get("Accept-Language") || "").split(",")[0].trim().slice(0, 16);
  const out = {};
  if (ip) out.ip = ip;
  const device = deviceLabel(ua);
  if (device) out.device = device;
  const browser = browserLabel(ua);
  if (browser) out.browser = browser;
  if (cf.country) out.country = String(cf.country);
  if (cf.city) out.city = String(cf.city).slice(0, 40);
  if (cf.region) out.region = String(cf.region).slice(0, 40);
  const district = hkDistrict(out.country, out.city, out.region)
    || nearestHkDistrict(out.country, cf.latitude, cf.longitude);
  if (district) out.district = district;
  if (cf.asOrganization) out.org = String(cf.asOrganization).slice(0, 48);
  if (cf.asn) out.asn = String(cf.asn);
  if (cf.timezone) out.tz = String(cf.timezone).slice(0, 40);
  if (cf.httpProtocol) out.proto = String(cf.httpProtocol);
  if (lang) out.lang = lang;
  const ref = refererHost(request);
  if (ref) out.ref = ref;
  return out;
}

function browserLabel(ua) {
  const text = String(ua || "");
  if (!text) return "";
  if (/Edg\//i.test(text)) return "Edge";
  if (/OPR\/|Opera/i.test(text)) return "Opera";
  if (/SamsungBrowser/i.test(text)) return "Samsung";
  if (/Firefox\//i.test(text)) return "Firefox";
  if (/CriOS|Chrome\//i.test(text) && !/Edg\//i.test(text)) return "Chrome";
  if (/Safari\//i.test(text) && !/Chrome|CriOS|Android/i.test(text)) return "Safari";
  return "";
}

function refererHost(request) {
  const raw = request.headers.get("Referer") || "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host === "hktt.henrylok.me" || host.endsWith(".henrylok.me") || host.endsWith("github.io")) return "";
    return (host + url.pathname).slice(0, 80);
  } catch {
    return "";
  }
}

function countryLabel(code) {
  const map = {
    HK: "香港", MO: "澳門", TW: "台灣", CN: "中國", JP: "日本", KR: "韓國",
    SG: "新加坡", MY: "馬來西亞", US: "美國", GB: "英國", AU: "澳洲", CA: "加拿大",
  };
  const key = String(code || "").toUpperCase();
  return map[key] || key;
}

function foldGeo(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

const HK_DISTRICTS = [
  ["中西區", ["中西", "centralandwestern", "central", "sheungwan", "saiyingpun", "kennedytown", "midlevels", "thepeak", "上環", "西營盤", "堅尼地城", "半山", "太平山"]],
  ["灣仔區", ["灣仔", "wanchai", "wanchai", "causewaybay", "happyvalley", "admiralty", "銅鑼灣", "跑馬地", "金鐘"]],
  ["東區", ["東區", "eastern", "northpoint", "quarrybay", "chaiban", "shaukeiwan", "saiwanho", "taikoo", "北角", "鰂魚涌", "柴灣", "筲箕灣", "西灣河", "太古"]],
  ["南區", ["南區", "southern", "aberdeen", "stanley", "pokfulam", "wahfu", "aplei", "香港仔", "赤柱", "薄扶林", "華富", "鴨脷洲"]],
  ["油尖旺區", ["油尖旺", "yautsimmong", "yaumatei", "tsimshatsui", "mongkok", "jordan", "taikoktsui", "尖沙咀", "油麻地", "旺角", "佐敦", "大角咀"]],
  ["深水埗區", ["深水埗", "shamshuipo", "cheungshawan", "meifoo", "長沙灣", "美孚"]],
  ["九龍城區", ["九龍城", "kowlooncity", "hunghom", "tokwawan", "homantin", "kaitak", "kowloontong", "紅磡", "土瓜灣", "何文田", "啟德", "九龍塘"]],
  ["黃大仙區", ["黃大仙", "wongtaisin", "diamondhill", "sanpokong", "tszwanshan", "lokfu", "鑽石山", "新蒲崗", "慈雲山", "樂富"]],
  ["觀塘區", ["觀塘", "kwuntong", "ngautaukok", "lamtin", "yautong", "kowloonbay", "牛頭角", "藍田", "油塘", "九龍灣"]],
  ["荃灣區", ["荃灣", "tsuenwan", "shamtseng", "深井"]],
  ["屯門區", ["屯門", "tuenmun"]],
  ["元朗區", ["元朗", "yuenlong", "tinshuiwai", "天水圍", "kamtin", "錦田"]],
  ["北區", ["北區", "northdistrict", "sheungshui", "fanling", "taikuiling", "上水", "粉嶺", "打鼓嶺"]],
  ["大埔區", ["大埔", "taipo"]],
  ["沙田區", ["沙田", "shatin", "sha tin", "maonshan", "fotan", "馬鞍山", "火炭"]],
  ["西貢區", ["西貢", "saikung", "tseungkwano", "hanghau", "polam", "將軍澳", "坑口", "寶琳", "調景嶺", "tiukengling"]],
  ["葵青區", ["葵青", "kwaitsing", "kwaichung", "tsingyi", "葵涌", "青衣"]],
  ["離島區", ["離島", "islands", "tungchung", "cheungchau", "lantau", "discoverybay", "muiwo", "pengchau", "東涌", "長洲", "大嶼山", "愉景灣", "梅窩", "坪洲"]],
];

function nearestHkDistrict(country, lat, lon) {
  if (String(country || "").toUpperCase() !== "HK") return "";
  const y = Number(lat);
  const x = Number(lon);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return "";
  if (y < 22.12 || y > 22.58 || x < 113.75 || x > 114.52) return "";
  const points = [
    ["中西區", 22.282, 114.150],
    ["灣仔區", 22.279, 114.173],
    ["東區", 22.284, 114.224],
    ["南區", 22.247, 114.159],
    ["油尖旺區", 22.312, 114.170],
    ["深水埗區", 22.331, 114.162],
    ["九龍城區", 22.330, 114.191],
    ["黃大仙區", 22.342, 114.194],
    ["觀塘區", 22.313, 114.225],
    ["葵青區", 22.354, 114.128],
    ["荃灣區", 22.371, 114.114],
    ["屯門區", 22.391, 113.976],
    ["元朗區", 22.444, 114.022],
    ["北區", 22.494, 114.138],
    ["大埔區", 22.451, 114.169],
    ["沙田區", 22.383, 114.188],
    ["西貢區", 22.382, 114.273],
    ["離島區", 22.289, 113.941],
  ];
  let best = "";
  let bestD = Infinity;
  for (const [name, py, px] of points) {
    const d = (y - py) ** 2 + (x - px) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

function hkDistrict(country, city, region) {
  if (String(country || "").toUpperCase() !== "HK") return "";
  const blob = foldGeo(`${city} ${region}`);
  if (!blob || blob === "hongkong" || blob === "hk" || blob === "香港") return "";
  for (const [label, aliases] of HK_DISTRICTS) {
    for (const alias of aliases) {
      const key = foldGeo(alias);
      if (key && blob.includes(key)) return label;
    }
  }
  if (blob.includes("kowloon") || blob.includes("九龍")) return "九龍";
  if (blob.includes("newterritor") || blob.includes("新界")) return "新界";
  if (blob.includes("hongkongisland") || blob.includes("港島") || blob.includes("香港島")) return "港島";
  return "";
}

function placeLabel(row) {
  if (row.district) {
    return String(row.country || "").toUpperCase() === "HK" ? `香港${row.district}` : row.district;
  }
  const mapped = hkDistrict(row.country, row.city, row.region);
  if (mapped) return `香港${mapped}`;
  const place = [...new Set([row.city, row.region, countryLabel(row.country)].filter(Boolean))];
  return place.filter((bit) => !/^hong\s*kong$/i.test(bit) && bit !== "HK").join(" ") || countryLabel(row.country);
}

function formatVisitor(row) {
  const place = placeLabel(row);
  const ip = row.ip ? (place ? `${row.ip}（${place}）` : row.ip) : (place || "");
  const net = [row.asn ? "AS" + row.asn : "", row.org].filter(Boolean).join(" ");
  return [
    row.device,
    row.browser,
    ip,
    net,
    row.lang,
    row.proto,
    row.ref ? "來源 " + row.ref : "",
  ].map((bit) => String(bit || "").trim()).filter(Boolean).join(" · ");
}

function formatLogWhen(row) {
  return formatHkt(row.at);
}

function deviceLabel(ua) {
  const text = String(ua || "");
  if (!text) return "";
  if (/bot|crawler|spider|slurp/i.test(text)) return "Bot";
  if (/iPad/i.test(text) || (/Macintosh/i.test(text) && /Mobile/i.test(text))) return "iPad";
  if (/iPhone|iPod/i.test(text)) return "iPhone";
  if (/Android/i.test(text)) return /Mobile/i.test(text) ? "Android" : "Android平板";
  if (/Windows/i.test(text)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(text)) return "Mac";
  if (/Linux/i.test(text)) return "Linux";
  return "其他";
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

async function listAllKeys(env, opts = {}) {
  const keys = [];
  let cursor;
  do {
    const page = await env.LINKS.list({ limit: 1000, cursor, ...opts });
    keys.push(...page.keys);
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return keys;
}

async function readQueryLogs(env, keyNames) {
  const names = (keyNames || (await listAllKeys(env, { prefix: QUERY_PREFIX })).map((key) => key.name))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, QUERY_LOG_LIMIT);
  const rows = [];
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    const got = await Promise.all(chunk.map(async (name) => ({ name, raw: await env.LINKS.get(name) })));
    for (const { name, raw } of got) {
      if (!raw) continue;
      try {
        const row = JSON.parse(raw);
        if (Array.isArray(row.names) && row.names.length) rows.push({ ...row, key: name });
      } catch {
        // Skip bad rows.
      }
    }
  }
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  return rows.slice(0, QUERY_LOG_LIMIT);
}

async function adminKvIndex(env) {
  const keys = await listAllKeys(env);
  const qKeys = [];
  let shortCount = 0;
  for (const key of keys) {
    if (key.name.startsWith(QUERY_PREFIX)) qKeys.push(key.name);
    else shortCount += 1;
  }
  return { qKeys, shortCount };
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

async function deleteAllShortKeys(env) {
  let cursor;
  let deleted = 0;
  do {
    const page = await env.LINKS.list({ limit: 1000, cursor });
    const shorts = page.keys.filter((key) => !key.name.startsWith(QUERY_PREFIX));
    await Promise.all(shorts.map((key) => env.LINKS.delete(key.name)));
    deleted += shorts.length;
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return deleted;
}

function fromBase64Url(text) {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function parseNameList(text) {
  const seen = new Set();
  const names = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const item = line.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    names.push(item);
  }
  return names;
}

function bytesToNames(bytes) {
  let text = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return parseNameList(text);
}

function alphabetUnpack(bytes) {
  if (!bytes.length) return [];
  const count = bytes[0];
  let offset = 1;
  const alphabet = [];
  for (let i = 0; i < count; i += 1) {
    if (offset + 1 >= bytes.length) return [];
    alphabet.push(String.fromCharCode((bytes[offset] << 8) | bytes[offset + 1]));
    offset += 2;
  }
  const names = [];
  let current = "";
  for (; offset < bytes.length; offset += 1) {
    const value = bytes[offset];
    if (value === 255) {
      names.push(current);
      current = "";
      continue;
    }
    current += alphabet[value] || "";
  }
  if (current) names.push(current);
  return parseNameList(names.join("\n"));
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodeSharePayload(token) {
  if (!token) return [];
  try {
    const kind = token[0];
    const bytes = fromBase64Url(token.slice(1));
    if (kind === "3") return alphabetUnpack(bytes);
    if (kind === "4") return alphabetUnpack(await inflateRaw(bytes));
    const raw = kind === "2" ? await inflateRaw(bytes) : bytes;
    return bytesToNames(raw);
  } catch {
    return [];
  }
}

function namesSig(names) {
  return names.join("\n");
}

async function restoreQueryLogsFromShorts(env) {
  const existing = await readQueryLogs(env);
  const have = new Set(existing.map((row) => namesSig(row.names)));
  let restored = 0;
  let cursor;
  do {
    const page = await env.LINKS.list({ limit: 100, cursor });
    for (const key of page.keys) {
      if (key.name.startsWith(QUERY_PREFIX)) continue;
      const token = await env.LINKS.get(key.name);
      if (!token) continue;
      const names = await decodeSharePayload(token);
      const sig = namesSig(names);
      if (!sig || have.has(sig)) continue;
      have.add(sig);
      await logQueries(env, names);
      restored += 1;
    }
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return restored;
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

function snapshotDelta(now, prev) {
  const n = Number(now);
  const p = Number(prev);
  const main = Number.isFinite(n) ? String(n) : "—";
  if (!Number.isFinite(n) || !Number.isFinite(p) || n === p) return main;
  const up = n > p;
  return `${main} <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"}${Math.abs(n - p)}</span>`;
}

function snapshotsTable(snaps) {
  if (!snaps.length) {
    return `<p class="empty">未有更新紀錄。等 GitHub 排程跑完，或者去 Actions 撳 Run workflow。</p>`;
  }
  const rows = [...snaps].reverse().map((row, idx) => {
    const prev = row.prev || {};
    const tag = idx === 0 ? `<span class="now">今次</span> ` : "";
    return `<tr>
      <td>${tag}${escapeHtml(row.at || "")}</td>
      <td>${snapshotDelta(row.hktta, prev.hktta)}</td>
      <td>${snapshotDelta(row.lcsd, prev.lcsd)}</td>
      <td>${snapshotDelta(row.badges, prev.badges)}</td>
      <td>${snapshotDelta(row.unique, prev.unique)}</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="snap-table">
    <thead><tr><th>時間</th><th>乒總</th><th>康文署</th><th>恒生章別</th><th>不重複</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function loadSnapshots() {
  try {
    const url = new URL("data/source_history.json", GITHUB_BASE);
    url.searchParams.set("cb", String(Math.floor(Date.now() / 30000)));
    const res = await fetch(url.href, {
      headers: { "User-Agent": "hk-tt-worker", Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.snapshots) ? data.snapshots : [];
  } catch {
    return [];
  }
}

function adminPage(rows, shortCount, snaps) {
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
      const shown = row.names.slice(0, 8).map((n) => escapeHtml(n)).join("、");
      const extra = row.names.length > 8 ? ` <span class="more">等${row.names.length}人</span>` : "";
      const visitor = formatVisitor(row);
      const hay = escapeHtml([row.names.join(" "), visitor, row.ip, row.device, row.country].filter(Boolean).join(" "));
      return `<article class="card" data-q="${hay}">
        <label class="pick"><input type="checkbox" value="${escapeHtml(row.key || "")}" /></label>
        <div class="body">
          <time>${escapeHtml(formatLogWhen(row))}</time>
          ${visitor ? `<p class="who">${escapeHtml(visitor)}</p>` : ""}
          <p>${shown}${extra}</p>
        </div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(resultHref(row.names))}" target="_blank" rel="noreferrer">結果(${row.names.length}人)</a>
          <button class="link danger" type="button" data-del="${escapeHtml(row.key || "")}">剷除呢次</button>
        </div>
      </article>`;
    }).join("")
    : `<p class="empty" id="empty-logs">未有查詢紀錄。只有經 hktt.henrylok.me 嘅查詢會記入。KV 入面嘅短英數係分享短碼，唔係呢份日誌。</p>`;
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
    .hint, .empty, .more { color: var(--muted); }
    .flash {
      display: none; margin: 1rem 0 0; padding: .55rem .85rem;
      background: var(--wash); border: 1px solid var(--line); border-radius: 10px; font-size: .9rem;
    }
    .flash.on { display: block; }
    .stats { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0 0; }
    .stat { padding: .45rem .8rem; background: var(--card); border: 1px solid var(--line); border-radius: 10px; font-size: .88rem; }
    .stat b { font-weight: 700; }
    .panel { margin-top: 1.4rem; padding: 1rem 1.1rem 1.15rem; background: var(--card); border: 1px solid var(--line); border-radius: 16px; }
    .head-row { display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: .55rem; }
    .head-actions { display: flex; flex-wrap: wrap; gap: .4rem; }
    .tools { display: flex; flex-wrap: wrap; gap: .45rem; align-items: center; margin-bottom: .35rem; }
    .tools input[type="search"] {
      flex: 1; min-width: 10rem; padding: .4rem .7rem; border: 1px solid var(--line);
      border-radius: 999px; background: var(--bg); color: var(--ink); font: inherit;
    }
    .pick { display: flex; align-items: center; gap: .35rem; }
    .pick input { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); }
    .card { display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; border-top: 1px solid var(--line); padding: .9rem 0; }
    .card:first-of-type { border-top: 0; }
    .card .body { flex: 1; min-width: 0; }
    .card p { margin: .3rem 0 0; }
    .who { color: var(--muted); font-size: .8rem; line-height: 1.4; }
    time { color: var(--muted); font-size: .82rem; }
    .actions { display: flex; flex-direction: column; align-items: stretch; gap: .25rem; min-width: 7.2rem; }
    .btn {
      display: inline-flex; justify-content: center; align-items: center;
      padding: .4rem .7rem; border-radius: 999px; text-decoration: none; font: inherit; font-size: .85rem;
      background: var(--btn); color: #fff; border: 1px solid var(--btn); cursor: pointer; white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) { .btn { color: #12161c; } }
    .btn.ghost { background: transparent; color: var(--btn); }
    @media (prefers-color-scheme: dark) { .btn.ghost { color: var(--ink); } }
    .btn.danger { color: #fff; border-color: var(--miss); background: var(--miss); }
    @media (prefers-color-scheme: dark) { .btn.danger { color: #12161c; } }
    .btn:disabled, .link:disabled { opacity: .4; cursor: not-allowed; }
    .link {
      display: inline-flex; justify-content: center; align-items: center;
      padding: .15rem .2rem; border: 0; background: none; font: inherit; font-size: .8rem;
      color: var(--muted); cursor: pointer; text-decoration: underline; text-underline-offset: .18em;
    }
    .link.danger { color: var(--miss); }
    .link.armed, .btn.armed { box-shadow: 0 0 0 2px var(--wash), 0 0 0 4px var(--miss); }
    .foot-danger {
      display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between;
      margin-top: .6rem; padding-top: .85rem; border-top: 1px dashed var(--line);
    }
    .busy { pointer-events: none; opacity: .55; }
    .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .8rem; }
    .chip {
      display: inline-flex; gap: .4rem; align-items: center;
      padding: .35rem .7rem; background: var(--chip); border: 1px solid var(--line);
      border-radius: 999px; color: var(--ink); text-decoration: none; font-size: .9rem;
    }
    .chip span { color: var(--muted); font-size: .8rem; }
    .table-wrap { overflow-x: auto; margin-top: .7rem; }
    .snap-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
    .snap-table th, .snap-table td { padding: .45rem .5rem; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
    .snap-table th { color: var(--muted); font-weight: 600; }
    .snap-table .up { color: #1f6b4a; font-weight: 700; }
    .snap-table .down { color: var(--miss); font-weight: 700; }
    @media (prefers-color-scheme: dark) { .snap-table .up { color: #9ddbb8; } }
    .now { display: inline-block; margin-right: .35rem; padding: .05rem .4rem; border-radius: 999px; background: var(--wash); color: var(--accent); font-size: .72rem; font-weight: 700; }
    @media (max-width: 640px) {
      .card { flex-wrap: wrap; }
      .actions { flex-direction: row; min-width: 0; width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Admin</p>
    <h1>查詢紀錄</h1>
    <p class="hint">只有你睇到。主站冇呢頁連結。用家喺 hktt.henrylok.me 一查詢就會記入，唔使撳分享。Cloudflare KV 入面嘅短英數係分享短碼，同呢份日誌分開；剷除日誌唔會刪短碼。</p>
    <p class="flash" id="flash"></p>
    <div class="stats">
      <span class="stat">日誌 <b>${rows.length}</b> 次</span>
      <span class="stat">名單 <b>${counts.size}</b> 個名</span>
      <span class="stat">短連結 <b>${shortCount}</b> 個</span>
      <button class="btn ghost" type="button" id="restore-all"${shortCount ? "" : " disabled"}>由短連結還原日誌</button>
      <button class="btn danger" type="button" id="del-shorts"${shortCount ? "" : " disabled"}>剷除全部短連結</button>
      <button class="btn ghost" type="button" id="reload-admin">重新整理</button>
    </div>
    <section class="panel">
      <div class="head-row">
        <h2>資料人數</h2>
      </div>
      <p class="hint">每日香港 12:30、00:30 由 GitHub Actions 抓檔後會加一行。急嘅話去 Actions 撳 Run workflow。</p>
      ${snapshotsTable(snaps)}
    </section>
    <section class="panel" id="log-panel">
      <div class="head-row">
        <h2>最近查詢</h2>
      </div>
      <div class="tools">
        <label class="pick"><input type="checkbox" id="pick-all" /> 全選可見</label>
        <input type="search" id="filter" placeholder="篩選姓名／IP／裝置" autocomplete="off" />
        <button class="btn danger" type="button" id="del-picked" disabled>剷除已選</button>
      </div>
      ${listHtml}
      <div class="foot-danger">
        <span class="hint">清空只刪呢頁日誌，KV 短連結會留低。</span>
        <button class="link danger" type="button" id="del-all"${rows.length ? "" : " disabled"}>清空全部日誌</button>
      </div>
    </section>
    <section class="panel">
      <h2>最常被查</h2>
      <p class="hint">按出現次數。撳名會開主站結果，唔會再記入。</p>
      <div class="chips">${topHtml}</div>
    </section>
  </main>
  <script>
    const k = new URLSearchParams(location.search).get("k") || "";
    if (k) history.replaceState({}, "", "/admin");
    const flash = document.getElementById("flash");
    const saved = sessionStorage.getItem("hktt_admin_flash");
    if (saved && flash) {
      sessionStorage.removeItem("hktt_admin_flash");
      flash.textContent = saved;
      flash.classList.add("on");
    }
    function selectedKeys() {
      return [...document.querySelectorAll(".card:not([hidden]) .pick input:checked")].map((el) => el.value).filter(Boolean);
    }
    function syncPicked() {
      const n = selectedKeys().length;
      const btn = document.getElementById("del-picked");
      if (!btn) return;
      btn.disabled = !n;
      btn.textContent = n ? "剷除已選 (" + n + ")" : "剷除已選";
      btn.classList.remove("armed");
      btn.dataset.armed = "";
    }
    function arm(btn, nextLabel, run) {
      if (!btn || btn.disabled) return;
      if (btn.dataset.armed === "1") {
        btn.dataset.armed = "";
        btn.classList.remove("armed");
        run();
        return;
      }
      document.querySelectorAll("[data-arm]").forEach((other) => {
        if (other === btn) return;
        other.dataset.armed = "";
        other.classList.remove("armed");
        if (other.dataset.label) other.textContent = other.dataset.label;
        clearTimeout(other._arm);
      });
      btn.dataset.label = btn.textContent;
      btn.dataset.armed = "1";
      btn.classList.add("armed");
      btn.textContent = nextLabel;
      clearTimeout(btn._arm);
      btn._arm = setTimeout(() => {
        btn.dataset.armed = "";
        btn.classList.remove("armed");
        btn.textContent = btn.dataset.label || btn.textContent;
        if (btn.id === "del-picked") syncPicked();
      }, 4000);
    }
    async function send(body) {
      const panel = document.getElementById("log-panel");
      panel?.classList.add("busy");
      try {
        const res = await fetch("/api/admin/queries", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, k }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.error === "unauthorized" ? "未授權" : (data.error || "操作失敗"));
          return;
        }
        const msg = data.restored != null
          ? "由短連結還原咗 " + data.restored + " 次查詢。時間會記成而家。"
          : data.shorts
            ? "已剷除 " + (data.deleted || 0) + " 個短連結。已分享嘅 ?x= 會失效。查詢日誌仍然喺。"
            : "已剷除 " + (data.deleted || 0) + " 次查詢。短連結仍然喺 KV。";
        sessionStorage.setItem("hktt_admin_flash", msg);
        location.reload();
      } catch {
        alert("操作失敗");
      } finally {
        panel?.classList.remove("busy");
      }
    }
    document.getElementById("reload-admin")?.addEventListener("click", () => location.reload());
    document.getElementById("filter")?.addEventListener("input", (event) => {
      const q = String(event.target.value || "").replace(/\\s+/g, "").toLowerCase();
      let shown = 0;
      document.querySelectorAll(".card").forEach((card) => {
        const hit = !q || String(card.dataset.q || "").replace(/\\s+/g, "").toLowerCase().includes(q);
        card.hidden = !hit;
        if (!hit) {
          const box = card.querySelector(".pick input");
          if (box) box.checked = false;
        }
        if (hit) shown += 1;
      });
      const old = document.getElementById("empty-filter");
      if (old) old.remove();
      if (q && !shown) {
        const p = document.createElement("p");
        p.className = "empty";
        p.id = "empty-filter";
        p.textContent = "篩選冇結果";
        document.getElementById("log-panel")?.querySelector(".foot-danger")?.before(p);
      }
      const pickAll = document.getElementById("pick-all");
      if (pickAll) pickAll.checked = false;
      syncPicked();
    });
    document.getElementById("pick-all")?.addEventListener("change", (event) => {
      const on = event.target.checked;
      document.querySelectorAll(".card:not([hidden]) .pick input").forEach((el) => { el.checked = on; });
      syncPicked();
    });
    document.querySelectorAll(".card .pick input").forEach((el) => {
      el.addEventListener("change", syncPicked);
    });
    document.getElementById("del-picked")?.addEventListener("click", (event) => {
      const keys = selectedKeys();
      if (!keys.length) return;
      arm(event.currentTarget, "再撳確認剷除 " + keys.length + " 次", () => send({ keys }));
    });
    document.getElementById("del-all")?.addEventListener("click", (event) => {
      arm(event.currentTarget, "再撳確認清空全部日誌", () => send({ all: true }));
    });
    document.getElementById("restore-all")?.addEventListener("click", (event) => {
      arm(event.currentTarget, "再撳確認還原（時間記成而家）", () => send({ restore: true }));
    });
    document.getElementById("del-shorts")?.addEventListener("click", (event) => {
      arm(event.currentTarget, "再撳確認剷除全部短連結", () => send({ shorts: true }));
    });
    document.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const key = btn.getAttribute("data-del");
        if (!key) return;
        arm(event.currentTarget, "再撳確認剷除", () => send({ key }));
      });
    });
    ["restore-all", "del-picked", "del-all", "del-shorts"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("data-arm", "1");
    });
    document.querySelectorAll("[data-del]").forEach((el) => el.setAttribute("data-arm", "1"));
    syncPicked();
  </script>
</body>
</html>`;
}

function recoverConflictJson(text) {
  const raw = String(text || "");
  if (!raw.includes("<<<<<<<")) return null;
  const parts = raw.split(/^=======+\s*$/m);
  const incoming = parts.length > 1 ? parts[parts.length - 1] : raw;
  const candidate = incoming.replace(/^<<<<<<<[^\n]*\n/, "").replace(/^>>>>>>>[^\n]*\n?/m, "").trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function parseOriginJson(text, file) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const recovered = recoverConflictJson(text);
    if (recovered) return recovered;
    throw new Error(`${file} ${err}`);
  }
}

async function originJson(file, ctx) {
  const url = new URL(file, GITHUB_BASE).href;
  const cache = caches.default;
  const cacheKey = new Request(`https://hktt.henrylok.me/__origin/${file}?v=clean1`, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();
  const res = await fetch(url, {
    headers: { "User-Agent": "hk-tt-worker", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${file} ${res.status}`);
  const data = parseOriginJson(await res.text(), file);
  const cached = new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${ORIGIN_JSON_MAX_AGE}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, cached.clone()));
  return data;
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
  const [rankings, lcsd, badges, history] = await Promise.all([
    originJson("data/rankings.json", ctx),
    originJson("data/lcsd.json", ctx),
    originJson("data/badges.json", ctx),
    originJson("data/hktta_history.json", ctx).catch(() => ({ players: {} })),
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
  const year = currentHktYear();
  let badgeYearCount = 0;
  const badgeByName = new Map();
  for (const [name, recs] of Object.entries(badgePlayers)) {
    const key = normalizeName(name) || name;
    badgeByName.set(key, recs);
    if (badgeInYear(recs, year)) {
      unique.add(key);
      badgeYearCount += 1;
    }
  }

  const hkttaPastByName = new Map();
  for (const [name, recs] of Object.entries(history.players || {})) {
    const key = normalizeName(name) || name;
    hkttaPastByName.set(key, recs);
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
    badges: badgeYearCount,
    unique: unique.size,
    hkttaPrev: rankings.prevCount,
    lcsdPrev: lcsd.prevCount,
    badgesPrev: badges.prevCount,
    uniquePrev: rankings.uniquePrev,
    lcsdUpdated: lcsd.updated || "",
    badgesUpdated: badges.updated || "",
    players,
    playerByName,
    lcsdByName,
    badgeByName,
    hkttaPastByName,
    lcsdDocCodes,
  };
}

function getIndex(ctx) {
  const slot = globalThis.__HKTT_INDEX;
  if (slot?.promise && slot.exp > Date.now()) return slot.promise;
  const promise = buildIndex(ctx).catch((err) => {
    if (globalThis.__HKTT_INDEX?.promise === promise) globalThis.__HKTT_INDEX = null;
    throw err;
  });
  globalThis.__HKTT_INDEX = { exp: Date.now() + INDEX_TTL_MS, promise };
  return promise;
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

function decodeHkttaPast(raw, currentPeriod) {
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 3) continue;
    const period = String(item[0] || "");
    if (!period || period === currentPeriod) continue;
    rows.push({
      period,
      gender: item[1] || "",
      group: item[2] || "ALL",
      rank: item[3] ?? null,
      points: item[4] ?? null,
    });
  }
  rows.sort((a, b) => String(b.period).localeCompare(String(a.period)) || String(a.group).localeCompare(String(b.group)));
  return rows;
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
      hkttaPast: decodeHkttaPast(index.hkttaPastByName.get(key) || [], index.period),
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
    uniquePrev: index.uniquePrev,
    period: index.period,
    updated: index.updated,
    totals: index.totals,
    priorPeriod: index.priorPeriod,
    hkttaPrev: index.hkttaPrev,
    lcsdPrev: index.lcsdPrev,
    badgesPrev: index.badgesPrev,
    lcsdUpdated: index.lcsdUpdated,
    badgesUpdated: index.badgesUpdated,
    lcsdDocCodes: index.lcsdDocCodes,
  };
}

async function loadMeta(ctx) {
  try {
    const meta = await originJson("data/meta.json", ctx);
    if (meta && Number.isFinite(meta.hktta)) return meta;
  } catch {
    // Pages may not have published meta.json yet.
  }
  return metaPayload(await getIndex(ctx));
}

async function proxy(request, ctx) {
  const incoming = new URL(request.url);
  const rel = incoming.pathname.replace(/^\//, "");
  const target = new URL(rel, GITHUB_BASE);
  target.search = incoming.search;
  const path = incoming.pathname;
  const cache = caches.default;
  const cacheable = request.method === "GET" && !path.startsWith("/api/") && path !== "/admin";
  const cacheKey = new Request(incoming.href, { method: "GET" });
  if (cacheable) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const res = await fetch(target.href, {
    method: request.method,
    headers: {
      "User-Agent": "hk-tt-worker",
      Accept: request.headers.get("Accept") || "*/*",
    },
    redirect: "follow",
  });
  if (res.status === 404 && !path.startsWith("/api/") && !path.startsWith("/assets/") && path !== "/favicon.ico") {
    return Response.redirect(`${SITE_ORIGIN}/`, 302);
  }
  const type = res.headers.get("content-type") || "";
  let out = res;
  if (request.method === "GET" && type.includes("text/html")) {
    let html = await res.text();
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>/gi, "");
    html = html.replace(/<script>\s*if\s*\(\/github\\.io\$\/i[\s\S]*?<\/script>/i, "");
    html = html.replace("</head>", `  <meta name="robots" content="index, follow" />\n</head>`);
    const headers = new Headers(res.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.delete("x-robots-tag");
    headers.set("cache-control", edgeCacheControl(path === "" ? "/" : path));
    out = new Response(html, { status: res.status, headers });
  } else if (cacheable && res.ok) {
    const headers = new Headers(res.headers);
    headers.set("cache-control", edgeCacheControl(path));
    out = new Response(res.body, { status: res.status, headers });
  }
  if (cacheable && out.ok && ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

async function warmIndex(ctx) {
  await originJson("data/meta.json", ctx).catch(() => null);
  await getIndex(ctx);
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const path = incoming.pathname;

    if (path === "/favicon.ico") {
      return proxy(new Request(new URL("/assets/favicon.ico", incoming.origin), request), ctx);
    }
    if (path === "/apple-touch-icon.png" || path === "/apple-touch-icon-precomposed.png") {
      return proxy(new Request(new URL("/assets/apple-touch-icon.png", incoming.origin), request), ctx);
    }

    if (path === "/robots.txt") {
      const body = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
        "",
      ].join("\n");
      return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    if (path === "/sitemap.xml") {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_ORIGIN}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
      return new Response(body, {
        headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

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
        return json(await loadMeta(ctx), { cache: `public, max-age=${META_MAX_AGE}` });
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
        if (body.restore) {
          const restored = await restoreQueryLogsFromShorts(env);
          return json({ ok: true, restored });
        }
        if (body.shorts) {
          const deleted = await deleteAllShortKeys(env);
          return json({ ok: true, shorts: true, deleted });
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
      const [index, snaps] = await Promise.all([
        adminKvIndex(env),
        loadSnapshots(),
      ]);
      const rows = await readQueryLogs(env, index.qKeys);
      const shortCount = index.shortCount;
      const headers = {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "X-Robots-Tag": "noindex",
      };
      if (incoming.searchParams.get("k") === env.ADMIN_SECRET) {
        headers["Set-Cookie"] = adminCookie(env);
      }
      return new Response(adminPage(rows, shortCount, snaps), { headers });
    }

    if (path === "/api/log") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      try {
        const body = await request.json();
        await logQueries(env, Array.isArray(body.names) ? body.names : [], request);
        return json({ ok: true });
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    if (path === "/api/lookup") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST") {
        return new Response("POST only", {
          status: 405,
          headers: { "cache-control": "public, max-age=3600", allow: "POST, OPTIONS" },
        });
      }
      try {
        const body = await request.json();
        const names = Array.isArray(body.names) ? body.names : [];
        const index = await getIndex(ctx);
        return json(lookupNames(index, names));
      } catch (err) {
        return json({ error: String(err) }, { status: 502 });
      }
    }

    return proxy(request, ctx);
  },

  // Dashboard: Triggers → Cron → 10 * * * * (hourly). Fills Cache API so lookups skip GitHub.
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(warmIndex(ctx));
  },
};
