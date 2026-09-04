const VARIANT = {
  鸣: "鳴",
  证: "証",
  杰: "傑",
  启: "啟",
  升: "陞",
  恒: "恆",
};

const GROUP_ORDER = ["ALL", "U21", "U19", "U17", "U15", "U13", "U11", "U9"];

const BUCKETS = [
  { id: "hktta-a", label: "乒總甲組" },
  { id: "hktta-b", label: "乒總乙組" },
  { id: "hktta-c", label: "乒總丙組" },
  { id: "hktta-d", label: "乒總丁組" },
  { id: "hktta-e", label: "乒總戊組" },
  { id: "lcsd-only", label: "只有參加過康文署比賽" },
  { id: "none", label: "完全沒有任何紀錄" },
];

const OPEN = Infinity;

const AGE_BANDS = [
  { id: "65+", min: 65, max: OPEN, label: "65歲或以上" },
  { id: "55-64", min: 55, max: 64, label: "55-64歲" },
  { id: "45-54", min: 45, max: 54, label: "45-54歲" },
  { id: "35-44", min: 35, max: 44, label: "35-44歲" },
  { id: "25-34", min: 25, max: 34, label: "25-34歲" },
  { id: "19-24", min: 19, max: 24, label: "19-24歲" },
  { id: "16-18", min: 16, max: 18, label: "16-18歲" },
  { id: "14-15", min: 14, max: 15, label: "14-15歲" },
  { id: "12-13", min: 12, max: 13, label: "12-13歲" },
  { id: "10-11", min: 10, max: 11, label: "10-11歲" },
  { id: "u9", min: 0, max: 9, label: "9歲或以下" },
];

const HKTTA_AGE = {
  U9: "u9",
  U11: "10-11",
  U13: "12-13",
  U15: "14-15",
  U17: "16-18",
  U19: "16-18",
  U21: "19-24",
};

function ageRange(min, max, doubles = false) {
  return { min, max, doubles };
}

const LCSD_CORE = {
  MB: ageRange(45, 54),
  FB: ageRange(45, 54),
  MC: ageRange(35, 44),
  FC: ageRange(35, 44),
  MD: ageRange(25, 34),
  FD: ageRange(25, 34),
  ME: ageRange(19, 24),
  FE: ageRange(19, 24),
  MF: ageRange(16, 18),
  FF: ageRange(16, 18),
  MG: ageRange(14, 15),
  FG: ageRange(14, 15),
  MH: ageRange(12, 13),
  FH: ageRange(12, 13),
  MI: ageRange(10, 11),
  FI: ageRange(10, 11),
  MJ: ageRange(0, 9),
  FJ: ageRange(0, 9),
  MK: ageRange(35, OPEN, true),
  FK: ageRange(35, OPEN, true),
  ML: ageRange(19, 34, true),
  FL: ageRange(19, 34, true),
  MM: ageRange(0, 18, true),
  FM: ageRange(0, 18, true),
};

const LCSD_SCHEMES = {
  maa: {
    MAA: ageRange(65, OPEN),
    FAA: ageRange(65, OPEN),
    MA: ageRange(55, 64),
    FA: ageRange(55, 64),
    ...LCSD_CORE,
  },
  classic: {
    MA: ageRange(55, OPEN),
    FA: ageRange(55, OPEN),
    ...LCSD_CORE,
  },
  wts: {
    MAA: ageRange(65, OPEN),
    FAA: ageRange(65, OPEN),
    MS1: ageRange(55, OPEN),
    FS1: ageRange(55, OPEN),
    MS2: ageRange(45, 54),
    FS2: ageRange(45, 54),
    MS3: ageRange(35, 44),
    FS3: ageRange(35, 44),
    MA1: ageRange(25, 34),
    FA1: ageRange(25, 34),
    MA2: ageRange(19, 24),
    FA2: ageRange(19, 24),
    MY1: ageRange(16, 18),
    FY1: ageRange(16, 18),
    MY2: ageRange(14, 15),
    FY2: ageRange(14, 15),
    MY3: ageRange(12, 13),
    FY3: ageRange(12, 13),
    MY4: ageRange(10, 11),
    FY4: ageRange(10, 11),
    MY5: ageRange(0, 9),
    FY5: ageRange(0, 9),
    MDS: ageRange(35, OPEN, true),
    FDS: ageRange(35, OPEN, true),
    MDA: ageRange(19, 34, true),
    FDA: ageRange(19, 34, true),
    MDY: ageRange(0, 18, true),
    FDY: ageRange(0, 18, true),
  },
  eleven: {
    MA: ageRange(65, OPEN),
    FA: ageRange(65, OPEN),
    MB: ageRange(55, 64),
    FB: ageRange(55, 64),
    MC: ageRange(45, 54),
    FC: ageRange(45, 54),
    MD: ageRange(35, 44),
    FD: ageRange(35, 44),
    ME: ageRange(25, 34),
    FE: ageRange(25, 34),
    MF: ageRange(19, 24),
    FF: ageRange(19, 24),
    MG: ageRange(16, 18),
    FG: ageRange(16, 18),
    MH: ageRange(14, 15),
    FH: ageRange(14, 15),
    MI: ageRange(12, 13),
    FI: ageRange(12, 13),
    MJ: ageRange(10, 11),
    FJ: ageRange(10, 11),
    MK: ageRange(0, 9),
    FK: ageRange(0, 9),
  },
};

const MALE_CHARS = new Set(
  "軒熙賢亨程澄熹佑洋傑杰文生元鳴陞予培謙洛衡朗進柏逸卓銘景俊豪偉強明輝國德志成安平東永建家華龍斌宇浩天樂霆睿朗軒雄傑鋒鈞韜禮祺澤軒軒".split("")
);
const FEMALE_CHARS = new Set(
  "晴婷欣怡詩韻瑤琳慧敏靜芳麗美娟玲燕霞蓉君萍紅玉蘭鳳珍珠秀梅薇萱穎彤妮娜珊琪瑩璇蕾兒雯雪月心語恩雅琳瑩".split("")
);

const BADGE_FILTERS = [
  { id: "d2", label: "鑽章（二）" },
  { id: "d", label: "鑽章" },
  { id: "p", label: "白金章" },
  { id: "g", label: "金章" },
  { id: "s", label: "銀章" },
  { id: "b", label: "銅章" },
];

const FILTERS = [
  { group: "gender", id: "M", label: "男" },
  { group: "gender", id: "F", label: "女" },
  { group: "bucket", id: "hktta-a", label: "乒總甲組" },
  { group: "bucket", id: "hktta-b", label: "乒總乙組" },
  { group: "bucket", id: "hktta-c", label: "乒總丙組" },
  { group: "bucket", id: "hktta-d", label: "乒總丁組" },
  { group: "bucket", id: "hktta-e", label: "乒總戊組" },
  { group: "bucket", id: "lcsd-only", label: "只有康文署比賽" },
  { group: "extra", id: "has-lcsd", label: "有康文署紀錄" },
  { group: "extra", id: "has-badge", label: "有恒生章別紀錄" },
  { group: "bucket", id: "none", label: "完全沒有任何紀錄" },
  ...BADGE_FILTERS.map((b) => ({ group: "badge", id: b.id, label: b.label })),
  ...AGE_BANDS.map((b) => ({ group: "age", id: b.id, label: b.label })),
];

const FILTER_GROUP_LABELS = {
  gender: "性別",
  bucket: "組別",
  extra: "紀錄",
  badge: "章別",
  age: "年齡",
};
const FILTER_GROUP_ORDER = ["gender", "bucket", "extra", "badge", "age"];

let snapshot = null;
let lcsdIndex = { players: {} };
let badgeIndex = { players: {} };
let lcsdDocCodes = new Map();
let lcsdAgeMaps = { maps: {} };
let lastResults = [];

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem("hktt-settings") || "{}");
  } catch {
    return {};
  }
}

function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem("hktt-settings", JSON.stringify(next));
}

function guessGenderEnabled() {
  return document.getElementById("guess-gender")?.checked;
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

function normalizeName(name) {
  return Array.from(String(name).replace(/\s+/g, ""))
    .map((ch) => VARIANT[ch] || ch)
    .join("");
}

function parseNames(raw) {
  const seen = new Set();
  const names = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    let text = line.trim();
    if (!text) continue;
    text = text.replace(/^[\d０-９]+[\.．、\)）]\s*/, "");
    text = text.replace(/^[•\-]\s*/, "").trim();
    if (!text || text.startsWith("#")) continue;
    const key = normalizeName(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(text);
  }
  return names;
}

function pageBase() {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/") && !/\.html?$/i.test(url.pathname)) {
    url.pathname += "/";
  }
  return url;
}

function dataUrl(file) {
  const script = document.querySelector("script[src*='app.js']")?.src;
  const fromScript = script ? new URL("../data/", script) : new URL("data/", pageBase());
  return new URL(file, fromScript).href;
}

function shareParams() {
  const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  const search = new URLSearchParams(location.search);
  return {
    s: search.get("s") || hash.get("s") || "",
    n: search.get("n") || hash.get("n") || "",
  };
}

function toBase64Url(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const pad = "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

function bytesToNames(bytes) {
  let text = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return parseNames(text);
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encodeSharePayload(names) {
  const raw = namesToBytes(names);
  let best = "1" + toBase64Url(raw);
  if (typeof CompressionStream === "function") {
    try {
      const packed = "2" + toBase64Url(await deflateRaw(raw));
      if (packed.length < best.length) best = packed;
    } catch {
      // Keep the uncompressed payload.
    }
  }
  return best;
}

async function decodeSharePayload(token) {
  if (!token) return [];
  try {
    const kind = token[0];
    const bytes = fromBase64Url(token.slice(1));
    const raw = kind === "2" ? await inflateRaw(bytes) : bytes;
    return bytesToNames(raw);
  } catch {
    return [];
  }
}

async function readSharedNames() {
  const { s, n } = shareParams();
  if (s) return decodeSharePayload(s);
  return parseNames(n.replace(/[,，]/g, "\n"));
}

async function shareUrlFor(names) {
  const url = pageBase();
  if (names.length) url.searchParams.set("s", await encodeSharePayload(names));
  return url;
}

async function syncShareUrl(names) {
  const url = await shareUrlFor(names);
  if (url.href !== location.href) history.replaceState(null, "", url);
  return url;
}

function setShareStatus(text) {
  const el = document.getElementById("share-status");
  if (el) el.textContent = text || "";
}

async function copyShareLink() {
  const names = parseNames(document.getElementById("names").value);
  if (!names.length) {
    setShareStatus("請先輸入球員名單。");
    return;
  }
  const url = await syncShareUrl(names);
  try {
    await navigator.clipboard.writeText(url.href);
    setShareStatus("已複製分享連結，對方打開就會自動查詢呢份名單。");
  } catch {
    setShareStatus(url.href);
  }
}

function estimateGenderFromName(name) {
  const chars = Array.from(normalizeName(name));
  if (chars.length < 2) return "";
  const given = chars.slice(1);
  for (let i = given.length - 1; i >= 0; i -= 1) {
    const ch = given[i];
    const male = MALE_CHARS.has(ch);
    const female = FEMALE_CHARS.has(ch);
    if (male && !female) return "M";
    if (female && !male) return "F";
  }
  return "";
}

function overall(player) {
  return player.rankings.ALL || null;
}

function playerPoints(player) {
  return player.points ?? overall(player)?.points ?? 0;
}

function buildScoredRanks() {
  for (const gender of ["M", "F"]) {
    const list = snapshot.players.filter((p) => p.gender === gender && playerPoints(p) >= 1);
    list.sort((a, b) => (overall(a)?.rank || 9e9) - (overall(b)?.rank || 9e9));
    const total = list.length;
    list.forEach((player, idx) => {
      player.scoredRank = idx + 1;
      player.scoredTotal = total;
    });
  }
}

function formatRank(player) {
  const all = overall(player);
  if (!all) return "今期總榜未見";
  const label = player.gender === "F" ? "女子" : "男子";
  const points = playerPoints(player);
  if (points < 1) {
    return `${label}官方第 ${all.rank}（0分，不計入有積分排名）`;
  }
  const rank = player.scoredRank || all.rank;
  const total = player.scoredTotal;
  if (!total) return `${label}第 ${rank}`;
  const pct = Math.max(0, Math.round((1 - rank / total) * 1000) / 10);
  return `${label}第 ${rank} / ${total}（約高於 ${pct}% 有積分球員）`;
}

function levelText(player) {
  const all = overall(player);
  const points = player.points ?? all?.points;
  if (points == null) return "有年齡榜紀錄，但積分未讀到。";
  if (points >= 400) return "高水平註冊球員，接近地區頂尖／公開賽常規種子區。";
  if (points >= 120) return "有穩定乒總計分賽紀錄，屬註冊球員中上游。";
  if (points >= 40) return "已有公開計分賽積分，屬有系統參賽嘅註冊球員。";
  if (points >= 10) return "已上榜，但積分仍低，多數只打過少量計分賽。";
  return "積分極低或幾乎只得上榜分，程度要以實際對賽同地區賽補充判斷。";
}

function hkttaDivision(player) {
  const rank = overall(player)?.rank;
  if (!rank) return null;
  if (player.gender === "F") {
    if (rank <= 60) return "hktta-a";
    if (rank <= 180) return "hktta-b";
    if (rank <= 300) return "hktta-c";
    return "hktta-d";
  }
  if (rank <= 120) return "hktta-a";
  if (rank <= 360) return "hktta-b";
  if (rank <= 600) return "hktta-c";
  if (rank <= 840) return "hktta-d";
  return "hktta-e";
}

function divisionLabel(id) {
  return BUCKETS.find((b) => b.id === id)?.label || "";
}

function findMatches(query, players) {
  const key = normalizeName(query);
  return players.filter((p) => normalizeName(p.name) === key);
}

function findPossible(query, players) {
  const key = normalizeName(query);
  if (key.length < 2) return [];
  return players
    .filter((p) => {
      const name = normalizeName(p.name);
      return name !== key && name.includes(key);
    })
    .slice(0, 8);
}

function findLcsd(query) {
  const key = normalizeName(query);
  return lcsdIndex.players[key] || [];
}

function findBadges(query) {
  const key = normalizeName(query);
  return badgeIndex.players[key] || [];
}

function lcsdGenderFromGroup(rec) {
  const code = String(rec.group || "").toUpperCase();
  if (!code) return "";
  if (code[1] === "X" || code === "DN") return "";
  if (schemeForRecord(rec) === "wts" && code === "MF") return "";
  if (code.startsWith("M")) return "M";
  if (code.startsWith("F")) return "F";
  return "";
}

function recordedGender(item) {
  if (item.matches[0]?.gender) return item.matches[0].gender;
  const genders = new Set((item.lcsd || []).map(lcsdGenderFromGroup).filter(Boolean));
  if (genders.size === 1) return [...genders][0];
  return "";
}

function inferGender(item) {
  const recorded = recordedGender(item);
  if (recorded) return { gender: recorded, estimated: false };
  if (!guessGenderEnabled()) return { gender: "", estimated: false };
  const guessed = estimateGenderFromName(item.query);
  return { gender: guessed, estimated: Boolean(guessed) };
}

function classify(item) {
  const ranked = item.matches.filter((p) => overall(p)?.rank);
  if (ranked.length) {
    ranked.sort((a, b) => (overall(a).rank || 9e9) - (overall(b).rank || 9e9));
    return hkttaDivision(ranked[0]);
  }
  if (item.lcsd.length) return "lcsd-only";
  return "none";
}

function ageRank(id) {
  const idx = AGE_BANDS.findIndex((b) => b.id === id);
  return idx < 0 ? 99 : idx;
}

function recYear(rec) {
  const year = Number.parseInt(rec.year, 10);
  return Number.isFinite(year) ? year : 0;
}

function currentYear() {
  return new Date().getFullYear();
}

function indexLcsdDocCodes() {
  lcsdDocCodes = new Map();
  for (const recs of Object.values(lcsdIndex.players || {})) {
    for (const rec of recs) {
      const url = rec.url || `${rec.district}|${rec.year}`;
      if (!url) continue;
      const code = String(rec.group || "").toUpperCase();
      if (!code) continue;
      if (!lcsdDocCodes.has(url)) lcsdDocCodes.set(url, new Set());
      lcsdDocCodes.get(url).add(code);
    }
  }
}

function schemeFromCodes(codes) {
  const list = [...(codes || [])];
  if (list.some((c) => /^[MF](Y[1-5]|S[1-3]|DS|DA|DY)$/.test(c))) return "wts";
  const hasDoublesLadder = codes?.has("ML") || codes?.has("FL") || codes?.has("MM") || codes?.has("FM");
  const hasK = codes?.has("MK") || codes?.has("FK");
  if (hasK && !hasDoublesLadder) return "eleven";
  if (codes?.has("MAA") || codes?.has("FAA")) return "maa";
  return "classic";
}

function schemeForRecord(rec) {
  const url = rec.url || `${rec.district}|${rec.year}`;
  return schemeFromCodes(lcsdDocCodes.get(url));
}

function bandFromEstimatedAge(nowMin, nowMax) {
  const age = nowMax === OPEN ? nowMin : nowMax;
  const hit = AGE_BANDS.find((b) => age >= b.min && age <= b.max);
  return hit?.id || "";
}

function storedAgeInfo(rec) {
  const min = Number(rec.ageMin);
  if (!Number.isFinite(min)) return null;
  const maxRaw = rec.ageMax;
  const max = maxRaw == null || maxRaw === "" ? OPEN : Number(maxRaw);
  return {
    min,
    max: Number.isFinite(max) ? max : OPEN,
    doubles: Boolean(rec.doubles),
    code: String(rec.group || "").toUpperCase(),
  };
}

function ageMapGroups(rec) {
  const maps = lcsdAgeMaps.maps || {};
  const byUrl = rec.url && maps[rec.url]?.groups;
  if (byUrl) return byUrl;
  return maps[`${rec.district || ""}|${rec.year || ""}`]?.groups || null;
}

function mappedFromAgeMap(rec) {
  const groups = ageMapGroups(rec);
  if (!groups) return null;
  const code = String(rec.group || "").toUpperCase();
  const info = groups[code] || groups[code.replace(/\d+$/, "")];
  if (!info || !Number.isFinite(Number(info.ageMin))) return null;
  const maxRaw = info.ageMax;
  return {
    code,
    min: Number(info.ageMin),
    max: maxRaw == null || maxRaw === "" ? OPEN : Number(maxRaw),
    doubles: Boolean(info.doubles),
  };
}

function resolveLcsdGroup(raw, scheme) {
  const code = String(raw || "").toUpperCase();
  if (!code) return null;
  const table = LCSD_SCHEMES[scheme] || LCSD_SCHEMES.classic;
  if (table[code]) return { code, ...table[code] };
  const base = code.replace(/\d+$/, "");
  if (base !== code && table[base]) return { code: base, ...table[base] };
  return null;
}

function mapLcsdRecord(rec) {
  const mapped = storedAgeInfo(rec) || mappedFromAgeMap(rec) || resolveLcsdGroup(rec.group, schemeForRecord(rec));
  if (!mapped) return null;
  const year = recYear(rec);
  const delta = year ? Math.max(0, currentYear() - year) : 0;
  const nowMin = mapped.min + delta;
  const nowMax = mapped.max === OPEN ? OPEN : mapped.max + delta;
  const band = bandFromEstimatedAge(nowMin, nowMax);
  if (!band) return null;
  return {
    band,
    code: mapped.code,
    year,
    delta,
    doubles: Boolean(mapped.doubles),
  };
}

function pickMappedAge(rows) {
  let best = null;
  for (const row of rows) {
    if (!row?.band) continue;
    if (!best || recYear({ year: row.year }) > recYear({ year: best.year })) {
      best = row;
      continue;
    }
    if (row.year === best.year && ageRank(row.band) < ageRank(best.band)) best = row;
  }
  return best;
}

function lcsdAgeFromItem(item) {
  const records = Array.isArray(item.lcsd) ? item.lcsd : [];
  const mapped = records.map(mapLcsdRecord).filter(Boolean);
  const singles = mapped.filter((row) => !row.doubles);
  const doubles = mapped.filter((row) => row.doubles);
  return pickMappedAge(singles) || pickMappedAge(doubles) || {
    band: "",
    code: "",
    year: 0,
    delta: 0,
    doubles: false,
  };
}

function ageBand(item) {
  const lcsd = lcsdAgeFromItem(item);
  const hktta = HKTTA_AGE[item.matches[0]?.age?.youngestGroup] || "";
  if (lcsd.band) return lcsd.band;
  return hktta || "";
}

function ageBadge(item) {
  const id = ageBand(item);
  const band = AGE_BANDS.find((b) => b.id === id);
  if (!band) return "";
  const lcsd = lcsdAgeFromItem(item);
  if (!lcsd.code) return `<span class="badge ok">${escapeHtml(band.label)}</span>`;
  const bits = [lcsd.code];
  if (lcsd.year) bits.push(String(lcsd.year));
  if (lcsd.delta) bits.push(`+${lcsd.delta}年`);
  return `<span class="badge ok">${escapeHtml(`${band.label}（${bits.join(" · ")}）`)}</span>`;
}

function searchLinks(name) {
  const q = encodeURIComponent(name);
  return [
    { label: "乒總球員搜尋", kind: "hktta" },
    {
      label: "恒生章別考試",
      href: "https://hstta.hktta.org.hk/training_detail.php?id=10",
    },
    {
      label: "Google：康文署分齡",
      href: `https://www.google.com/search?q=${q}+site%3Alcsd.gov.hk+乒乓球+分齡`,
    },
    {
      label: "Google：乒總",
      href: `https://www.google.com/search?q=${q}+site%3Ahktta.org.hk+乒乓球`,
    },
  ];
}

function renderLinks(name) {
  return searchLinks(name)
    .map((l) =>
      l.kind === "hktta"
        ? `<button type="button" class="linkish" data-hktta="${escapeHtml(name)}">${l.label}</button>`
        : `<a href="${l.href}" target="_blank" rel="noreferrer">${l.label}</a>`
    )
    .join("");
}

function rankChips(player) {
  return GROUP_ORDER.filter((g) => player.rankings[g])
    .map((g) => {
      const row = player.rankings[g];
      const label = g === "ALL" ? "全港" : g;
      return `<span class="rank-chip">${label} 第 ${row.rank}${row.points != null ? ` · ${row.points}分` : ""}</span>`;
    })
    .join("");
}

function lcsdKindLabel(kind) {
  if (kind === "result") return "成績";
  if (kind === "schedule") return "賽程表";
  return kind || "文件";
}

function badgeId(label) {
  const text = String(label || "");
  if (text.includes("鑽章（二）") || text.includes("鑽章(二)")) return "d2";
  if (text.includes("鑽")) return "d";
  if (text.includes("白金")) return "p";
  if (text.includes("金")) return "g";
  if (text.includes("銀")) return "s";
  if (text.includes("銅")) return "b";
  return "";
}

function badgeRank(label) {
  if (label.includes("鑽章（二）") || label.includes("鑽章(二)")) return 6;
  if (label.includes("鑽")) return 5;
  if (label.includes("白金")) return 4;
  if (label.includes("金")) return 3;
  if (label.includes("銀")) return 2;
  if (label.includes("銅")) return 1;
  return 0;
}

function bestBadge(records) {
  const passed = records.filter((r) => r.passed);
  const pool = passed.length ? passed : records;
  return [...pool].sort((a, b) => {
    const rank = badgeRank(b.badge) - badgeRank(a.badge);
    if (rank) return rank;
    return String(b.session).localeCompare(String(a.session));
  })[0] || null;
}

function bucketTone(id) {
  if (id === "hktta-a") return "tone-a";
  if (id === "hktta-b") return "tone-b";
  if (id === "hktta-c") return "tone-c";
  if (id === "hktta-d") return "tone-d";
  if (id === "hktta-e") return "tone-e";
  if (id === "none") return "miss";
  return "ok";
}

function badgeTone(id) {
  return id ? `hs-${id}` : "ok";
}

function itemBadgeId(item) {
  const best = bestBadge(item.badges || []);
  return best ? badgeId(best.badge) : "";
}

function badgeChip(item) {
  const best = bestBadge(item.badges || []);
  if (!best) return "";
  const text = best.passed ? `恒生${best.badge}` : `報考${best.badge}`;
  return `<span class="badge ${badgeTone(badgeId(best.badge))}">${escapeHtml(text)}</span>`;
}

function renderBadges(records) {
  if (!records.length) return "";
  const items = [...records]
    .sort((a, b) => String(b.session).localeCompare(String(a.session)))
    .map((r) => {
      let status = "已報考";
      if (r.passed === true) status = "考獲資格";
      else if (r.absent) status = "缺席";
      else if (r.passed === false) status = "未合格";
      const bits = [r.session, r.badge, status].filter(Boolean);
      const href = r.listUrl || r.url;
      return `<li><a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(bits.join(" · "))}</a></li>`;
    })
    .join("");
  return `<div class="lcsd-box"><span>恒生乒乓球學院公開章別考試</span><ul>${items}</ul></div>`;
}

function renderLcsd(records) {
  if (!records.length) return "";
  const items = [...records]
    .sort((a, b) => recYear(b) - recYear(a))
    .map((r) => {
      const bits = [r.district, r.year, lcsdKindLabel(r.kind), r.group].filter(Boolean);
      return `<li><a href="${r.url}" target="_blank" rel="noreferrer">${escapeHtml(bits.join(" · "))}</a></li>`;
    })
    .join("");
  return `<div class="lcsd-box"><span>康文署地區分齡紀錄</span><ul>${items}</ul></div>`;
}

function genderBadge(item) {
  const info = inferGender(item);
  if (!info.gender) return "";
  const text = info.gender === "F"
    ? (info.estimated ? "估計女子" : "女子")
    : (info.estimated ? "估計男子" : "男子");
  return `<span class="badge ${info.gender === "F" ? "f" : "m"}">${text}</span>`;
}

function renderCard(item, totals, orderLabel) {
  const bucket = classify(item);
  const bucketText = divisionLabel(bucket);
  const lcsdHtml = renderLcsd(item.lcsd);
  const badgeHtml = renderBadges(item.badges || []);

  if (!item.matches.length) {
    const hasExtra = item.lcsd.length || (item.badges || []).length;
    const tone = hasExtra ? "lcsd" : "missing";
    return `<article class="card ${tone}">
      <div class="card-top">
        <div>
          <h2>${escapeHtml(item.query)}</h2>
          ${genderBadge(item)}
          ${ageBadge(item)}
          ${badgeChip(item)}
          <span class="badge ${bucketTone(bucket)}">${escapeHtml(bucketText)}</span>
        </div>
        <div>${escapeHtml(orderLabel)}</div>
      </div>
      <p>${item.lcsd.length
        ? "今期乒總公布榜未見精確姓名，但康文署分齡賽程／成績 PDF 有呢個名。"
        : (item.badges || []).length
          ? "今期乒總公布榜未見精確姓名，但恒生公開章別考試時間表有呢個名。"
          : "今期乒總公布榜未見精確姓名。可能未註冊、一年無計分賽、或者只打過未公開／未收入嘅地區賽。"}</p>
      ${lcsdHtml}
      ${badgeHtml}
      <div class="links">${renderLinks(item.query)}</div>
    </article>${renderPossibleCards(item)}`;
  }

  return item.matches
    .map((player, idx) => {
      const all = overall(player);
      const sameName = item.matches.length > 1 ? `<p>找到 ${item.matches.length} 個同名紀錄，呢張係第 ${idx + 1} 個。</p>` : "";
      return `<article class="card">
        <div class="card-top">
          <div>
            <h2><button type="button" class="name-link" data-hktta="${escapeHtml(player.name)}">${escapeHtml(player.name)}</button></h2>
            ${genderBadge(item)}
            ${ageBadge(item)}
            ${badgeChip(item)}
            <span class="badge ${bucketTone(bucket)}">${escapeHtml(bucketText)}</span>
          </div>
          <div>${escapeHtml(orderLabel)}</div>
        </div>
        ${sameName}
        <div class="grid">
          <div><span>乒總積分</span><b>${player.points ?? all?.points ?? "—"}</b></div>
          <div><span>全港排名</span><b>${formatRank(player)}</b></div>
          <div><span>教練／球會／學校</span><b>${escapeHtml([player.coach, player.club, player.school].filter(Boolean).join(" · ") || "榜上未列")}</b></div>
        </div>
        <p>${levelText(player)}</p>
        <div class="ranks">${rankChips(player)}</div>
        ${lcsdHtml}
        ${badgeHtml}
        <div class="links">${renderLinks(player.name)}</div>
      </article>`;
    })
    .join("");
}

function renderPossibleCards(item) {
  const possible = item.possible || [];
  if (item.matches.length || !possible.length) return "";
  const cards = possible.map((player) => {
    const fake = { query: player.name, matches: [player], lcsd: [], badges: [] };
    const all = overall(player);
    const division = hkttaDivision(player) || "none";
    return `<article class="card possible">
      <div class="card-top">
        <div>
          <h2><button type="button" class="name-link" data-hktta="${escapeHtml(player.name)}">${escapeHtml(player.name)}</button></h2>
          <span class="badge miss">可能係其他人</span>
          ${genderBadge(fake)}
          <span class="badge ${bucketTone(division)}">${escapeHtml(divisionLabel(division))}</span>
        </div>
      </div>
      <p>乒總榜上有包含「${escapeHtml(item.query)}」嘅姓名，唔會計入上面名單統計。</p>
      <div class="grid">
        <div><span>乒總積分</span><b>${player.points ?? all?.points ?? "—"}</b></div>
        <div><span>全港排名</span><b>${formatRank(player)}</b></div>
      </div>
    </article>`;
  }).join("");
  return `<p class="hint">以下 ${possible.length} 個相似姓名可能係其他人：</p>${cards}`;
}

function bestPoints(matches) {
  const values = matches.map((p) => p.points).filter((n) => typeof n === "number");
  return values.length ? Math.max(...values) : -1;
}

function bestRank(item) {
  const ranks = item.matches.map((p) => overall(p)?.rank).filter((n) => typeof n === "number");
  return ranks.length ? Math.min(...ranks) : 9e9;
}

function hasRecord(item) {
  return Boolean(item.matches.length || item.lcsd.length || (item.badges || []).length);
}

function listRankTier(item) {
  if (item.matches.length) return 1;
  const badges = item.badges || [];
  if (badges.some((r) => r.passed)) return 2;
  if (badges.length) return 3;
  if (item.lcsd.length) return 4;
  return 5;
}

function compareBadgeStrength(a, b) {
  const left = bestBadge(a) || { badge: "", session: "" };
  const right = bestBadge(b) || { badge: "", session: "" };
  const level = badgeRank(right.badge) - badgeRank(left.badge);
  if (level) return level;
  return String(right.session).localeCompare(String(left.session));
}

function compareByListRank(a, b) {
  const tierA = listRankTier(a);
  const tier = tierA - listRankTier(b);
  if (tier) return tier;
  if (tierA === 1) {
    const rankDiff = bestRank(a) - bestRank(b);
    if (rankDiff) return rankDiff;
    return bestPoints(b.matches) - bestPoints(a.matches);
  }
  if (tierA === 2) {
    return compareBadgeStrength(
      (a.badges || []).filter((r) => r.passed),
      (b.badges || []).filter((r) => r.passed)
    );
  }
  if (tierA === 3) {
    return compareBadgeStrength(a.badges || [], b.badges || []);
  }
  return 0;
}

function selectedFilters(group) {
  return [...document.querySelectorAll(`#filter-box input[data-group="${group}"]:checked`)].map((el) => el.value);
}

function sortMode() {
  return document.querySelector("input[name='sort-mode']:checked")?.value || "list";
}

function passesFilter(item) {
  const genders = selectedFilters("gender");
  const buckets = selectedFilters("bucket");
  const ages = selectedFilters("age");
  const badges = selectedFilters("badge");
  const extras = selectedFilters("extra");
  const gender = inferGender(item).gender;
  if (genders.length && !genders.includes(gender)) return false;
  if (buckets.length && !buckets.includes(classify(item))) return false;
  if (ages.length && !ages.includes(ageBand(item))) return false;
  if (badges.length && !badges.includes(itemBadgeId(item))) return false;
  if (extras.includes("has-lcsd") && !item.lcsd.length) return false;
  if (extras.includes("has-badge") && !(item.badges || []).length) return false;
  return true;
}

function filterHasPeople(filter, results) {
  if (filter.group === "gender") {
    return results.some((item) => inferGender(item).gender === filter.id);
  }
  if (filter.group === "bucket") {
    return results.some((item) => classify(item) === filter.id);
  }
  if (filter.group === "age") {
    return results.some((item) => ageBand(item) === filter.id);
  }
  if (filter.group === "badge") {
    return results.some((item) => itemBadgeId(item) === filter.id);
  }
  if (filter.id === "has-lcsd") {
    return results.some((item) => item.lcsd.length);
  }
  if (filter.id === "has-badge") {
    return results.some((item) => (item.badges || []).length);
  }
  return true;
}

function filterPeopleCount(filter, results) {
  return results.filter((item) => {
    if (filter.group === "gender") return inferGender(item).gender === filter.id;
    if (filter.group === "bucket") return classify(item) === filter.id;
    if (filter.group === "age") return ageBand(item) === filter.id;
    if (filter.group === "badge") return itemBadgeId(item) === filter.id;
    if (filter.id === "has-lcsd") return Boolean(item.lcsd.length);
    if (filter.id === "has-badge") return Boolean((item.badges || []).length);
    return false;
  }).length;
}

function buildFilters(results) {
  const box = document.getElementById("filter-box");
  const selected = new Set(
    [...box.querySelectorAll("input:checked")].map((el) => `${el.dataset.group}:${el.value}`)
  );
  const visible = FILTERS.filter((f) => filterHasPeople(f, results));
  const groups = FILTER_GROUP_ORDER
    .map((group) => ({
      group,
      label: FILTER_GROUP_LABELS[group],
      items: visible.filter((f) => f.group === group),
    }))
    .filter((row) => row.items.length);

  const chips = groups
    .map((row) => {
      const options = row.items
        .map((f) => {
          const key = `${f.group}:${f.id}`;
          const checked = selected.has(key) ? " checked" : "";
          const count = filterPeopleCount(f, results);
          const tone = f.group === "bucket" ? ` ${bucketTone(f.id)}` : f.group === "badge" ? ` ${badgeTone(f.id)}` : "";
          return `<label class="filter-chip${tone}"><input type="checkbox" data-group="${f.group}" value="${f.id}"${checked} /> <span>${escapeHtml(f.label)}<i>${count}</i></span></label>`;
        })
        .join("");
      return `<div class="filter-group"><span class="filter-group-label">${escapeHtml(row.label)}</span><div class="filter-chips">${options}</div></div>`;
    })
    .join("");

  const hasSelection = selected.size > 0;
  const clear = hasSelection
    ? `<button type="button" id="clear-filters" class="ghost filter-clear">清除篩選</button>`
    : "";
  box.innerHTML = `${clear}${chips}` || `<p class="hint">呢份名單暫時冇可篩選嘅組別。</p>`;
}

function dateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, 10);
}

function periodLabel() {
  const period = snapshot.period || "";
  const match = /^(\d{4})-(\d{1,2})$/.exec(period);
  const main = match ? `${match[1]}年第${Number(match[2])}期` : period;
  const updated = dateOnly(snapshot.updated);
  return updated ? `${main}（${updated}）` : main;
}

function updateStats(results) {
  const found = results.filter((r) => r.matches.length);
  const men = results.filter((r) => inferGender(r).gender === "M").length;
  const women = results.filter((r) => inferGender(r).gender === "F").length;
  const unknown = results.length - men - women;
  const genderMain = `男 ${men}／女 ${women}`;
  const genderText = unknown
    ? `${genderMain}<span class="stat-sub">（未知 ${unknown}）</span>`
    : genderMain;

  const bucketCounts = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]));
  for (const item of results) bucketCounts[classify(item)] += 1;
  document.getElementById("bucket-list").innerHTML = BUCKETS.filter((b) => bucketCounts[b.id] > 0)
    .map((b) => `<li><span class="badge ${bucketTone(b.id)}">${escapeHtml(b.label)}</span>（${bucketCounts[b.id]}）</li>`)
    .join("");

  const badgeCounts = Object.fromEntries(BADGE_FILTERS.map((b) => [b.id, 0]));
  for (const item of results) {
    const id = itemBadgeId(item);
    if (id) badgeCounts[id] += 1;
  }
  const badgeRows = BADGE_FILTERS.filter((b) => badgeCounts[b.id] > 0);
  const badgeBox = document.getElementById("badge-stats");
  if (!badgeRows.length) {
    badgeBox.classList.add("hidden");
  } else {
    badgeBox.classList.remove("hidden");
    document.getElementById("badge-list").innerHTML = badgeRows
      .map((b) => `<li><span class="badge ${badgeTone(b.id)}">${escapeHtml(b.label)}</span>（${badgeCounts[b.id]}）</li>`)
      .join("");
  }

  const ageCounts = Object.fromEntries(AGE_BANDS.map((b) => [b.id, 0]));
  for (const item of results) {
    const id = ageBand(item);
    if (id) ageCounts[id] += 1;
  }
  document.getElementById("age-list").innerHTML = AGE_BANDS.filter((b) => ageCounts[b.id] > 0)
    .map((b) => `<li>${escapeHtml(b.label)}（${ageCounts[b.id]}）</li>`)
    .join("");

  document.getElementById("summary").classList.remove("hidden");
  document.getElementById("summary").innerHTML = `
    <div class="stat"><span>查詢人數</span><b>${results.length}</b></div>
    <div class="stat"><span>乒總上榜</span><b>${found.length}</b></div>
    <div class="stat"><span>男女比例</span><b>${genderText}</b></div>
    <div class="stat"><span>資料期數</span><b>${escapeHtml(periodLabel())}</b></div>
  `;
}

function renderResults() {
  if (!lastResults.length) return;
  buildFilters(lastResults);
  document.getElementById("breakdown").classList.remove("hidden");
  updateStats(lastResults);

  const filtered = lastResults.filter(passesFilter);
  const mode = sortMode();
  const sorted = filtered.map((item) => ({ item, listIndex: lastResults.indexOf(item) }));
  if (mode === "rank") {
    sorted.sort((a, b) => compareByListRank(a.item, b.item));
  } else {
    sorted.sort((a, b) => {
      const dataDiff = Number(hasRecord(b.item)) - Number(hasRecord(a.item));
      if (dataDiff) return dataDiff;
      return a.listIndex - b.listIndex;
    });
  }

  const strengthOrder = [...lastResults]
    .sort(compareByListRank)
    .map((item, i) => [item.query, i + 1]);
  const strengthMap = new Map(strengthOrder);

  document.getElementById("results").innerHTML = sorted
    .map(({ item, listIndex }) => {
      const label = mode === "list"
        ? `球員名單第 ${listIndex + 1}`
        : `名單內排名 ${strengthMap.get(item.query)}`;
      return renderCard(item, snapshot.totals, label);
    })
    .join("") || `<p class="hint">呢組篩選冇符合嘅球員。</p>`;
  fillExportTable(sorted.map(({ item }) => item));
  const status = document.getElementById("filter-status");
  if (status) {
    status.textContent = filtered.length === lastResults.length
      ? `顯示全部 ${lastResults.length} 人`
      : `顯示 ${filtered.length}／${lastResults.length} 人`;
  }
}

function openHkttaSearch(name) {
  document.getElementById("hktta-chi-name").value = name;
  document.getElementById("hktta-search").submit();
}

async function runSearch() {
  const names = parseNames(document.getElementById("names").value);
  if (!names.length) {
    lastResults = [];
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
    fillExportTable([]);
    syncShareUrl([]).catch(() => {});
    return;
  }
  lastResults = names.map((query) => {
    const matches = findMatches(query, snapshot.players);
    return {
      query,
      matches,
      possible: matches.length ? [] : findPossible(query, snapshot.players),
      lcsd: findLcsd(query),
      badges: findBadges(query),
    };
  });
  renderResults();
  syncShareUrl(names).catch(() => {});
}

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function hasStoredTheme() {
  return Object.prototype.hasOwnProperty.call(loadSettings(), "dark");
}

const EXPORT_HEADERS = ["姓名", "組別", "全港排名", "積分", "恒生章別"];

function exportBadgeLabel(item) {
  const best = bestBadge(item.badges || []);
  if (!best) return "";
  return best.passed ? best.badge : `報考${best.badge}`;
}

function exportRows(items) {
  return items.map((item) => {
    const rank = bestRank(item);
    const points = bestPoints(item.matches);
    return [
      item.query,
      divisionLabel(classify(item)),
      rank < 9e9 ? String(rank) : "",
      points < 0 ? "" : String(points),
      exportBadgeLabel(item),
    ];
  });
}

function fillExportTable(items) {
  const table = document.getElementById("export-print");
  if (!table) return;
  const rows = exportRows(items);
  table.innerHTML = `<thead><tr>${EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell || "—")}</td>`).join("")}</tr>`).join("")
  }</tbody>`;
}

function setExportStatus(text) {
  const el = document.getElementById("export-status");
  if (el) el.textContent = text || "";
}

async function copyResultsTable() {
  const items = lastResults.filter(passesFilter);
  if (!items.length) {
    setExportStatus("冇結果可以複製。");
    return;
  }
  const text = [EXPORT_HEADERS, ...exportRows(items)].map((row) => row.join("\t")).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    setExportStatus("已複製表格，可貼去 Excel／試算表。");
  } catch {
    setExportStatus("複製失敗，請改用列印。");
  }
}

function printResultsTable() {
  const items = lastResults.filter(passesFilter);
  if (!items.length) {
    setExportStatus("冇結果可以列印。");
    return;
  }
  fillExportTable(items);
  window.print();
}

function bootSettings() {
  const saved = loadSettings();
  const themeEl = document.getElementById("theme-toggle");
  const guessEl = document.getElementById("guess-gender");
  const dark = hasStoredTheme() ? Boolean(saved.dark) : prefersDark();
  themeEl.checked = dark;
  guessEl.checked = Boolean(saved.guessGender);
  applyTheme(dark);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (hasStoredTheme()) return;
    themeEl.checked = event.matches;
    applyTheme(event.matches);
  });

  document.getElementById("settings-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("settings-panel").classList.toggle("hidden");
  });
  document.addEventListener("click", (event) => {
    const box = document.querySelector(".settings");
    if (!box.contains(event.target)) {
      document.getElementById("settings-panel").classList.add("hidden");
    }
  });
  themeEl.addEventListener("change", () => {
    applyTheme(themeEl.checked);
    saveSettings({ dark: themeEl.checked });
  });
  guessEl.addEventListener("change", () => {
    saveSettings({ guessGender: guessEl.checked });
    renderResults();
  });
}

async function boot() {
  bootSettings();
  const meta = document.getElementById("data-meta");
  try {
    const [rankRes, lcsdRes, ageMapRes, badgeRes] = await Promise.all([
      fetch(dataUrl("rankings.json")),
      fetch(dataUrl("lcsd.json")),
      fetch(dataUrl("lcsd_age_maps.json")),
      fetch(dataUrl("badges.json")),
    ]);
    if (!rankRes.ok) throw new Error(rankRes.statusText);
    snapshot = await rankRes.json();
    buildScoredRanks();
    if (lcsdRes.ok) lcsdIndex = await lcsdRes.json();
    if (ageMapRes.ok) lcsdAgeMaps = await ageMapRes.json();
    if (badgeRes.ok) badgeIndex = await badgeRes.json();
    indexLcsdDocCodes();
    const lcsdCount = Object.keys(lcsdIndex.players || {}).length;
    const badgeCount = Object.keys(badgeIndex.players || {}).length;
    meta.textContent = `目前資料：乒總 ${periodLabel()}，${snapshot.players.length} 人 · 康文署 PDF ${lcsdCount} 個姓名 · 恒生章別 ${badgeCount} 人`;
  } catch (err) {
    meta.textContent = "排名資料載入失敗。請先執行 python scripts/fetch_rankings.py";
    console.error(err);
    return;
  }

  const shared = await readSharedNames();
  if (shared.length) {
    document.getElementById("names").value = shared.join("\n");
  }

  document.getElementById("search-btn").addEventListener("click", runSearch);
  document.getElementById("share-btn")?.addEventListener("click", copyShareLink);
  document.getElementById("copy-table-btn")?.addEventListener("click", copyResultsTable);
  document.getElementById("print-btn")?.addEventListener("click", printResultsTable);
  document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("names").value = "";
    lastResults = [];
    setShareStatus("");
    setExportStatus("");
    fillExportTable([]);
    syncShareUrl([]);
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
  });
  document.getElementById("breakdown").addEventListener("change", (event) => {
    if (event.target.matches("input")) renderResults();
  });
  document.getElementById("breakdown").addEventListener("click", (event) => {
    if (event.target.id !== "clear-filters") return;
    document.querySelectorAll("#filter-box input:checked").forEach((el) => {
      el.checked = false;
    });
    renderResults();
  });
  document.getElementById("results").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hktta]");
    if (!btn) return;
    openHkttaSearch(btn.getAttribute("data-hktta"));
  });
  await runSearch();
}

boot();
