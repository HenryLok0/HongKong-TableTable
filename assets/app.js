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
const AGE_ASC = [...AGE_BANDS].sort((a, b) => a.min - b.min || a.max - b.max);
const ADULT_AGE_FLOOR = 19;
const AGE_NAME_MIN_SAMPLES = 3;
const AGE_COVER_MASS = 0.75;
const AGE_MAX_SPAN = 18;

const HKTTA_AGE = {
  U9: "u9",
  U11: "10-11",
  U13: "12-13",
  U15: "14-15",
  U17: "16-18",
  U19: "16-18",
  U21: "19-24",
};

const HKTTA_AGE_RANGE = {
  U9: { min: 0, max: 9 },
  U11: { min: 10, max: 11 },
  U13: { min: 12, max: 13 },
  U15: { min: 14, max: 15 },
  U17: { min: 16, max: 17 },
  U19: { min: 18, max: 19 },
  U21: { min: 19, max: 21 },
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
  { group: "extra", id: "has-coach", label: "教練" },
  { group: "extra", id: "has-club", label: "球會" },
  { group: "extra", id: "has-school", label: "學校" },
  { group: "bucket", id: "none", label: "完全沒有任何紀錄" },
  ...BADGE_FILTERS.map((b) => ({ group: "badge", id: b.id, label: b.label })),
  ...AGE_BANDS.map((b) => ({ group: "age", id: b.id, label: b.label })),
  { group: "age", id: "none", label: "冇資料" },
];

const FILTER_GROUP_LABELS = {
  gender: "性別",
  bucket: "組別",
  extra: "其他",
  badge: "章別",
  age: "年齡",
};
const FILTER_GROUP_ORDER = ["gender", "bucket", "extra", "badge", "age"];

let snapshot = null;
let playerByName = new Map();
let sourceMeta = null;
let edgeLookup = false;
let lcsdIndex = { players: {} };
let badgeIndex = { players: {} };
let lcsdDocCodes = new Map();
let lcsdAgeMaps = { maps: {} };
let lastResults = [];
let nameStats = {
  gender: new Map(),
  givenAge: new Map(),
  bandN: new Map(),
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem("hktt-settings") || "{}");
  } catch {
    return {};
  }
}

function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  if ("theme" in partial) delete next.dark;
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

function apiUrl(path) {
  return new URL(path, pageBase()).href;
}

function applyMeta(meta) {
  sourceMeta = meta;
  lcsdDocCodes = new Map();
  for (const [url, codes] of Object.entries(meta.lcsdDocCodes || {})) {
    lcsdDocCodes.set(url, new Set(codes));
  }
  snapshot = {
    players: snapshot?.players || [],
    period: meta.period || snapshot?.period || "",
    updated: meta.updated || snapshot?.updated || "",
    totals: meta.totals || snapshot?.totals || {},
    prior: {
      period: meta.priorPeriod || snapshot?.prior?.period || "",
      all: snapshot?.prior?.all || {},
    },
  };
}

function applyLookupData(data) {
  if (data.totals) snapshot.totals = data.totals;
  if (data.period) snapshot.period = data.period;
  if (data.updated) snapshot.updated = data.updated;
  if (data.prior) {
    snapshot.prior = {
      period: data.prior.period || snapshot.prior?.period || "",
      all: { ...(snapshot.prior?.all || {}), ...(data.prior.all || {}) },
    };
  }
  lastResults = data.results || [];
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

function alphabetPack(names) {
  const unique = [...new Set(names.join(""))];
  if (!unique.length || unique.length > 254) return null;
  const index = new Map(unique.map((ch, i) => [ch, i]));
  const bytes = [unique.length];
  for (const ch of unique) {
    const code = ch.charCodeAt(0);
    bytes.push(code >> 8, code & 255);
  }
  names.forEach((name, i) => {
    if (i) bytes.push(255);
    for (const ch of name) bytes.push(index.get(ch));
  });
  return Uint8Array.from(bytes);
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
  return parseNames(names.join("\n"));
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
  const candidates = ["1" + toBase64Url(namesToBytes(names))];
  const packed = alphabetPack(names);
  if (packed) candidates.push("3" + toBase64Url(packed));
  if (typeof CompressionStream === "function") {
    for (const [kind, bytes] of [["2", namesToBytes(names)], ["4", packed]]) {
      if (!bytes) continue;
      try {
        candidates.push(kind + toBase64Url(await deflateRaw(bytes)));
      } catch {
        // Skip this variant.
      }
    }
  }
  return candidates.reduce((best, token) => (token.length < best.length ? token : best));
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

function givenNameChars(name) {
  const chars = Array.from(normalizeName(name));
  if (chars.length < 2) return [];
  return chars.slice(1);
}

function bumpCountMap(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function bumpGenderStat(ch, gender) {
  const row = nameStats.gender.get(ch) || { M: 0, F: 0 };
  row[gender] += 1;
  nameStats.gender.set(ch, row);
}

function bumpGivenAge(givenKey, band) {
  if (!givenKey || !band) return;
  const row = nameStats.givenAge.get(givenKey) || new Map();
  bumpCountMap(row, band);
  nameStats.givenAge.set(givenKey, row);
  bumpCountMap(nameStats.bandN, band);
}

function recordNameAge(name, band) {
  bumpGivenAge(givenNameChars(name).join(""), band);
}

function buildNameStats() {
  nameStats = {
    gender: new Map(),
    givenAge: new Map(),
    bandN: new Map(),
  };
  for (const player of snapshot.players || []) {
    const given = givenNameChars(player.name);
    if (player.gender === "M" || player.gender === "F") {
      given.forEach((ch) => bumpGenderStat(ch, player.gender));
    }
    recordNameAge(player.name, HKTTA_AGE[player.age?.youngestGroup] || "");
  }
  for (const [name, recs] of Object.entries(lcsdIndex.players || {})) {
    const item = { query: name, matches: [], lcsd: recs };
    const given = givenNameChars(name);
    const gender = recordedGender(item);
    if (gender) given.forEach((ch) => bumpGenderStat(ch, gender));
    const key = normalizeName(name);
    const onHkttaYouth = (snapshot.players || []).some(
      (p) => normalizeName(p.name) === key && HKTTA_AGE[p.age?.youngestGroup]
    );
    if (onHkttaYouth) continue;
    const age = lcsdAgeFromItem(item);
    if (age.doubles) continue;
    recordNameAge(name, age.band || "");
  }
}

function estimateGenderFromName(name) {
  const given = givenNameChars(name);
  if (!given.length) return "";
  let male = 0;
  let female = 0;
  given.forEach((ch, i) => {
    const weight = i === given.length - 1 ? 2 : 1;
    const row = nameStats.gender.get(ch);
    if (!row) return;
    male += weight * row.M;
    female += weight * row.F;
  });
  const total = male + female;
  if (total >= 1) {
    if (male !== female) return male > female ? "M" : "F";
  }
  for (let i = given.length - 1; i >= 0; i -= 1) {
    const ch = given[i];
    const isMale = MALE_CHARS.has(ch);
    const isFemale = FEMALE_CHARS.has(ch);
    if (isMale && !isFemale) return "M";
    if (isFemale && !isMale) return "F";
  }
  return "";
}

function filledField(player, key) {
  return Boolean(String(player?.[key] || "").trim());
}

function affiliationPrior(item) {
  const player = item.matches?.[0];
  if (!player) return "none";
  const school = filledField(player, "school");
  const club = filledField(player, "club");
  const coach = filledField(player, "coach");
  if (school && !club) return "youth";
  if ((club || coach) && !school) return "adult";
  return "none";
}

function badgeAgePrior(item) {
  const records = item.badges || [];
  if (!records.length) return "none";
  const best = bestBadge(records);
  if (best && badgeRank(best.badge) >= badgeRank("金章")) return "older";
  return "none";
}

function hkttaAdultFloor(item) {
  if (!item.matches?.length) return 0;
  if (item.matches.some((p) => HKTTA_AGE[p.age?.youngestGroup])) return 0;
  return ADULT_AGE_FLOOR;
}

function ageSpanYears(min, max) {
  if (max === OPEN) return 80 - min;
  return max - min;
}

function formatAgeRange(min, max) {
  const same = AGE_BANDS.find((b) => b.min === min && b.max === max);
  if (same) return same.label;
  if (max === OPEN) return `${min}歲或以上`;
  if (min <= 0) return `${max}歲或以下`;
  return `${min}–${max}歲`;
}

function makeAgeGuess(min, max) {
  const ids = AGE_BANDS.filter((b) => b.max >= min && b.min <= max).map((b) => b.id);
  const filterIds = max === OPEN
    ? AGE_BANDS.filter((b) => min >= b.min && min <= b.max).map((b) => b.id)
    : ids;
  return {
    estimated: true,
    min,
    max,
    ids: filterIds,
    label: formatAgeRange(min, max),
  };
}

function adultFloorGuess() {
  return makeAgeGuess(ADULT_AGE_FLOOR, OPEN);
}

function reweightedNameScores(rawMap) {
  const scores = Object.fromEntries(AGE_BANDS.map((b) => [b.id, 0]));
  let rawN = 0;
  for (const [band, count] of rawMap) {
    rawN += count;
    const pop = nameStats.bandN.get(band) || 0;
    scores[band] = pop > 0 ? count / pop : 0;
  }
  return { scores, rawN };
}

function applyAgePriors(scores, item) {
  const next = { ...scores };
  const aff = affiliationPrior(item);
  if (aff === "youth") {
    for (const band of AGE_BANDS) if (band.min >= ADULT_AGE_FLOOR) next[band.id] *= 0.25;
  } else if (aff === "adult") {
    for (const band of AGE_BANDS) if (band.max < ADULT_AGE_FLOOR) next[band.id] *= 0.25;
  }
  if (badgeAgePrior(item) === "older") {
    for (const band of AGE_BANDS) if (band.max <= 13) next[band.id] *= 0.45;
  }
  const floor = hkttaAdultFloor(item);
  if (floor) {
    for (const band of AGE_BANDS) if (band.max < floor) next[band.id] = 0;
  }
  return next;
}

function coveringAgeRange(scores) {
  const total = AGE_ASC.reduce((sum, band) => sum + (scores[band.id] || 0), 0);
  if (total <= 0) return null;
  let best = null;
  for (let i = 0; i < AGE_ASC.length; i += 1) {
    let mass = 0;
    for (let j = i; j < AGE_ASC.length; j += 1) {
      mass += scores[AGE_ASC[j].id] || 0;
      if (mass / total < AGE_COVER_MASS) continue;
      const min = AGE_ASC[i].min;
      const max = AGE_ASC[j].max;
      const span = ageSpanYears(min, max);
      if (!best || span < best.span) best = { min, max, span };
      break;
    }
  }
  return best;
}

function estimateAge(item) {
  const floor = hkttaAdultFloor(item);
  const rawMap = nameStats.givenAge.get(givenNameChars(item.query).join(""));
  if (!rawMap || !rawMap.size) return floor ? adultFloorGuess() : null;
  const { scores: rawScores, rawN } = reweightedNameScores(rawMap);
  const scores = applyAgePriors(rawScores, item);
  if (rawN < AGE_NAME_MIN_SAMPLES) return floor ? adultFloorGuess() : null;
  const cover = coveringAgeRange(scores);
  if (!cover) return floor ? adultFloorGuess() : null;
  if (cover.span > AGE_MAX_SPAN) return floor ? adultFloorGuess() : null;
  if (floor && cover.max < floor) return adultFloorGuess();
  const min = floor ? Math.max(cover.min, floor) : cover.min;
  return makeAgeGuess(min, cover.max);
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

function priorAll(player) {
  return snapshot.prior?.all?.[`${player.gender}|${player.name}|${player.club || ""}|${player.school || ""}`] || null;
}

function rankMoveClass(now, prev) {
  if (typeof now !== "number" || typeof prev !== "number") return "";
  const diff = prev - now;
  if (diff > 0) return "delta-up";
  if (diff < 0) return "delta-down";
  return "delta-same";
}

function rankDeltaHtml(now, prev) {
  if (typeof now !== "number" || typeof prev !== "number") return "";
  const diff = prev - now;
  const cls = rankMoveClass(now, prev);
  const label = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : "持平";
  return ` <span class="${cls}">${label}</span><span class="muted">（上期第 ${prev}）</span>`;
}

function pointsDeltaHtml(player) {
  const nowPts = player.points ?? overall(player)?.points;
  const prior = priorAll(player);
  if (!prior || typeof prior.points !== "number" || typeof nowPts !== "number") return "";
  const diff = nowPts - prior.points;
  const cls = diff > 0 ? "delta-up" : diff < 0 ? "delta-down" : "delta-same";
  const label = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "持平";
  return ` <span class="${cls}">${label}</span><span class="muted">（上期 ${prior.points}）</span>`;
}

function formatPointsCell(player) {
  const pts = player.points ?? overall(player)?.points;
  return `<b>${pts == null ? "—" : pts}${pointsDeltaHtml(player)}</b>`;
}

function formatRankCell(player) {
  const all = overall(player);
  if (!all) return "<b>今期總榜未見</b>";
  const label = player.gender === "F" ? "女子" : "男子";
  const points = playerPoints(player);
  let note = "";
  if (points < 1) {
    note = `<span class="rank-note">0分，不計入有積分排名</span>`;
  } else if (player.scoredRank && player.scoredTotal) {
    const pct = Math.max(0, Math.round((1 - player.scoredRank / player.scoredTotal) * 1000) / 10);
    note = `<span class="rank-note">有積分第 ${player.scoredRank} / ${player.scoredTotal}（約高於 ${pct}%）</span>`;
  }
  return `<b>${label}官方第 ${all.rank}${rankDeltaHtml(all.rank, all.prev)}</b>${note}`;
}

function levelText(player) {
  const all = overall(player);
  const points = player.points ?? all?.points;
  if (points == null) return "有年齡榜紀錄，但積分未讀到。";
  if (points >= 800) return "全港頂尖註冊球員，公開賽常規種子前列。";
  if (points >= 400) return "高水平註冊球員，接近地區頂尖／公開賽常規種子區。";
  if (points >= 220) return "公開賽有穩定競爭力，屬地區前列。";
  if (points >= 120) return "有穩定乒總計分賽紀錄，屬註冊球員中上游。";
  if (points >= 70) return "持續參加計分賽，屬註冊球員中游。";
  if (points >= 40) return "已有公開計分賽積分，屬有系統參賽嘅註冊球員。";
  if (points >= 20) return "積分開始累積，仍屬初段上榜。";
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

function indexPlayers() {
  playerByName = new Map();
  for (const player of snapshot.players || []) {
    const key = player._nk || (player._nk = normalizeName(player.name));
    const list = playerByName.get(key);
    if (list) list.push(player);
    else playerByName.set(key, [player]);
  }
}

function findMatches(query) {
  return playerByName.get(normalizeName(query)) || [];
}

function findPossible(query) {
  const key = normalizeName(query);
  if (key.length < 2) return [];
  const hits = [];
  for (const player of snapshot.players || []) {
    const name = player._nk || (player._nk = normalizeName(player.name));
    if (name === key || !name.includes(key)) continue;
    hits.push(player);
    if (hits.length >= 8) break;
  }
  return hits;
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
  const top = nowMax === OPEN ? nowMin : nowMax;
  const exact = AGE_BANDS.find((b) => nowMin >= b.min && top <= b.max);
  if (exact) return exact.id;
  const mid = nowMax === OPEN ? nowMin : (nowMin + nowMax) / 2;
  const hit = AGE_BANDS.find((b) => mid >= b.min && mid <= b.max);
  return hit?.id || "";
}

function isDoublesGroup(code, doublesFlag) {
  if (doublesFlag) return true;
  return /^[MF]([KLM]|D[SAYBC])$/.test(String(code || "").toUpperCase());
}

function fineBandContaining(min, max) {
  if (!Number.isFinite(min)) return null;
  const top = max === OPEN || max == null ? min : max;
  return AGE_BANDS.find((b) => min >= b.min && top <= b.max) || null;
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

function overlappingFineIds(min, max) {
  if (!Number.isFinite(min)) return [];
  const top = max === OPEN || max == null ? min : max;
  return AGE_BANDS.filter((b) => b.max >= min && b.min <= top).map((b) => b.id);
}

function ageRowSpan(row) {
  const top = row.nowMax === OPEN ? row.nowMin + 40 : row.nowMax;
  return top - row.nowMin;
}

function mergeAgeRows(rows) {
  if (!rows.length) return null;
  const nowMin = Math.max(...rows.map((r) => r.nowMin));
  const caps = rows.map((r) => (r.nowMax === OPEN ? Infinity : r.nowMax));
  const cap = Math.min(...caps);
  if (nowMin > cap) return pickMappedAge(rows);
  const cite = [...rows].sort((a, b) => ageRowSpan(a) - ageRowSpan(b) || b.year - a.year)[0];
  const nowMax = cap === Infinity ? OPEN : cap;
  return {
    ...cite,
    nowMin,
    nowMax,
    band: bandFromEstimatedAge(nowMin, nowMax),
  };
}

function hkttaAgeRow(item) {
  const player = (item.matches || []).find((p) => HKTTA_AGE_RANGE[p.age?.youngestGroup]);
  if (!player) return null;
  const group = player.age.youngestGroup;
  const { min, max } = HKTTA_AGE_RANGE[group];
  return {
    band: bandFromEstimatedAge(min, max) || overlappingFineIds(min, max)[0] || "",
    code: group,
    year: 0,
    delta: 0,
    doubles: false,
    nowMin: min,
    nowMax: max,
  };
}

function mapLcsdRecord(rec) {
  const mapped = storedAgeInfo(rec) || mappedFromAgeMap(rec) || resolveLcsdGroup(rec.group, schemeForRecord(rec));
  if (!mapped) return null;
  const year = recYear(rec);
  const delta = year ? Math.max(0, currentYear() - year) : 0;
  const nowMin = mapped.min + delta;
  const nowMax = mapped.max === OPEN ? OPEN : mapped.max + delta;
  const band = bandFromEstimatedAge(nowMin, nowMax);
  if (!Number.isFinite(nowMin)) return null;
  return {
    band,
    code: mapped.code,
    year,
    delta,
    doubles: isDoublesGroup(mapped.code, mapped.doubles),
    nowMin,
    nowMax,
  };
}

function pickMappedAge(rows) {
  const valid = rows.filter((row) => row && (row.band || Number.isFinite(row.nowMin)));
  if (!valid.length) return null;
  return [...valid].sort((a, b) => {
    const year = recYear({ year: b.year }) - recYear({ year: a.year });
    if (year) return year;
    return ageRowSpan(a) - ageRowSpan(b);
  })[0];
}

function lcsdAgeFromItem(item) {
  const records = Array.isArray(item.lcsd) ? item.lcsd : [];
  const mapped = records.map(mapLcsdRecord).filter(Boolean);
  const singles = mapped.filter((row) => !row.doubles);
  const doubles = mapped.filter((row) => row.doubles);
  return mergeAgeRows(singles) || mergeAgeRows(doubles) || {
    band: "",
    code: "",
    year: 0,
    delta: 0,
    doubles: false,
  };
}

function recordedAgeBand(item) {
  const hktta = hkttaAgeRow(item);
  if (hktta) return { id: hktta.band, estimated: false, lcsd: hktta };
  const lcsd = lcsdAgeFromItem(item);
  if (Number.isFinite(lcsd.nowMin) || lcsd.band) {
    const fine = fineBandContaining(lcsd.nowMin, lcsd.nowMax);
    return { id: fine?.id || lcsd.band || "", estimated: false, lcsd };
  }
  return { id: "", estimated: false, lcsd };
}

function resolvedAge(item) {
  const recorded = recordedAgeBand(item);
  const lcsd = recorded.lcsd;
  if (Number.isFinite(lcsd?.nowMin) || recorded.id) {
    const min = Number.isFinite(lcsd?.nowMin) ? lcsd.nowMin : AGE_BANDS.find((b) => b.id === recorded.id)?.min;
    const max = lcsd && "nowMax" in lcsd ? lcsd.nowMax : AGE_BANDS.find((b) => b.id === recorded.id)?.max;
    const fine = fineBandContaining(min, max) || AGE_BANDS.find((b) => b.id === recorded.id);
    const ids = overlappingFineIds(min, max);
    return {
      estimated: false,
      id: fine?.id || recorded.id,
      ids: ids.length ? ids : recorded.id ? [recorded.id] : [],
      min,
      max,
      label: fine?.label || (Number.isFinite(min) ? formatAgeRange(min, max) : recorded.id),
      lcsd,
    };
  }
  if (!guessGenderEnabled()) return null;
  const guessed = estimateAge(item);
  if (!guessed) return null;
  return { ...guessed, lcsd };
}

function ageBandIds(item) {
  const ids = resolvedAge(item)?.ids || [];
  return ids.length ? ids : ["none"];
}

function ageBadge(item) {
  const resolved = resolvedAge(item);
  if (!resolved?.label) return "";
  if (resolved.estimated) {
    return `<span class="badge warn">估計${escapeHtml(resolved.label)}</span>`;
  }
  const lcsd = resolved.lcsd;
  if (!lcsd?.code) return `<span class="badge ok">${escapeHtml(resolved.label)}</span>`;
  const bits = [lcsd.code];
  if (lcsd.year) bits.push(String(lcsd.year));
  if (lcsd.delta) bits.push(`+${lcsd.delta}年`);
  return `<span class="badge ok">${escapeHtml(`${resolved.label}（${bits.join(" · ")}）`)}</span>`;
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
      const now = row.rank;
      const prev = row.prev;
      let move = "";
      if (typeof now === "number" && typeof prev === "number") {
        const diff = prev - now;
        if (diff > 0) move = `<span class="delta-up"> ↑${diff}</span>`;
        else if (diff < 0) move = `<span class="delta-down"> ↓${Math.abs(diff)}</span>`;
      }
      return `<span class="rank-chip">${label} 第 ${row.rank}${move}${row.points != null ? ` · ${row.points}分` : ""}</span>`;
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
          <div><span>乒總積分</span>${formatPointsCell(player)}</div>
          <div><span>全港排名</span>${formatRankCell(player)}</div>
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
        <div><span>乒總積分</span>${formatPointsCell(player)}</div>
        <div><span>全港排名</span>${formatRankCell(player)}</div>
      </div>
    </article>`;
  }).join("");
  return `<details class="possible-fold"><summary>可能係其他人（${possible.length}）</summary>${cards}</details>`;
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

function hasHkttaField(item, key) {
  return (item.matches || []).some((p) => String(p[key] || "").trim());
}

function extraHas(item, id) {
  if (id === "has-lcsd") return Boolean(item.lcsd.length);
  if (id === "has-badge") return Boolean((item.badges || []).length);
  if (id === "has-coach") return hasHkttaField(item, "coach");
  if (id === "has-club") return hasHkttaField(item, "club");
  if (id === "has-school") return hasHkttaField(item, "school");
  return false;
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
  if (ages.length && !ageBandIds(item).some((id) => ages.includes(id))) return false;
  if (badges.length && !badges.includes(itemBadgeId(item))) return false;
  if (extras.some((id) => !extraHas(item, id))) return false;
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
    return results.some((item) => ageBandIds(item).includes(filter.id));
  }
  if (filter.group === "badge") {
    return results.some((item) => itemBadgeId(item) === filter.id);
  }
  if (filter.group === "extra") {
    return results.some((item) => extraHas(item, filter.id));
  }
  return true;
}

function filterPeopleCount(filter, results) {
  return results.filter((item) => {
    if (filter.group === "gender") return inferGender(item).gender === filter.id;
    if (filter.group === "bucket") return classify(item) === filter.id;
    if (filter.group === "age") return ageBandIds(item).includes(filter.id);
    if (filter.group === "badge") return itemBadgeId(item) === filter.id;
    if (filter.group === "extra") return extraHas(item, filter.id);
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
          const mark = selected.has(key) ? "✓ " : "";
          return `<label class="filter-chip${tone}"><input type="checkbox" data-group="${f.group}" value="${f.id}" data-label="${escapeHtml(f.label)}"${checked} /> <span>${mark}${escapeHtml(f.label)}<i>${count}</i></span></label>`;
        })
        .join("");
      const active = row.items.some((f) => selected.has(`${f.group}:${f.id}`));
      return `<div class="filter-group${active ? " is-active" : ""}"><span class="filter-group-label">${escapeHtml(row.label)}</span><div class="filter-chips">${options}</div></div>`;
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

function uniqueSourceNameCount() {
  if (sourceMeta && Number.isFinite(sourceMeta.unique)) return sourceMeta.unique;
  const keys = new Set();
  for (const player of snapshot.players || []) {
    const key = normalizeName(player.name);
    if (key) keys.add(key);
  }
  for (const name of Object.keys(lcsdIndex.players || {})) {
    const key = normalizeName(name);
    if (key) keys.add(key);
  }
  for (const name of Object.keys(badgeIndex.players || {})) {
    const key = normalizeName(name);
    if (key) keys.add(key);
  }
  return keys.size;
}

function formatPeriod(period) {
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(period || ""));
  return match ? `${match[1]}年第${Number(match[2])}期` : String(period || "");
}

function periodLabel() {
  const main = formatPeriod(snapshot.period || "");
  const updated = dateOnly(snapshot.updated);
  return updated ? `${main}（${updated}）` : main;
}

function renderDataMeta() {
  const meta = document.getElementById("data-meta");
  if (!meta) return;
  const hkttaCount = sourceMeta?.hktta ?? snapshot.players.length;
  const lcsdCount = sourceMeta?.lcsd ?? Object.keys(lcsdIndex.players || {}).length;
  const badgeCount = sourceMeta?.badges ?? Object.keys(badgeIndex.players || {}).length;
  const uniqueCount = uniqueSourceNameCount();
  const prior = snapshot.prior?.period
    ? `積分對照 ${formatPeriod(snapshot.prior.period)}`
    : "未有上期積分對照";
  meta.innerHTML = `
    <div class="stat"><span>乒總</span><b>${hkttaCount}</b><span class="stat-sub">${escapeHtml(periodLabel())}</span><span class="stat-sub">${escapeHtml(prior)}</span></div>
    <div class="stat"><span>康文署</span><b>${lcsdCount}</b><span class="stat-sub">PDF 姓名</span></div>
    <div class="stat"><span>恒生章別</span><b>${badgeCount}</b><span class="stat-sub">考試姓名</span></div>
    <div class="stat"><span>不重複</span><b>${uniqueCount}</b><span class="stat-sub">三個來源合計</span></div>
  `;
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
  ageCounts.none = 0;
  for (const item of results) {
    for (const id of ageBandIds(item)) ageCounts[id] = (ageCounts[id] || 0) + 1;
  }
  const ageRows = [
    ...AGE_BANDS.filter((b) => ageCounts[b.id] > 0).map((b) => `${escapeHtml(b.label)}（${ageCounts[b.id]}）`),
    ...(ageCounts.none ? [`冇資料（${ageCounts.none}）`] : []),
  ];
  document.getElementById("age-list").innerHTML = ageRows.map((row) => `<li>${row}</li>`).join("");

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
        ? `貼上第 ${listIndex + 1}`
        : `實力梯級第 ${strengthMap.get(item.query)}`;
      return renderCard(item, snapshot.totals, label);
    })
    .join("") || `<p class="hint">呢組篩選冇符合嘅球員。</p>`;
  fillExportTable(sorted.map(({ item }) => item));
  const status = document.getElementById("filter-status");
  if (status) {
    const picked = [...document.querySelectorAll("#filter-box input:checked")].map((el) => el.getAttribute("data-label"));
    if (!picked.length) {
      status.textContent = `顯示全部 ${lastResults.length} 人`;
    } else {
      status.textContent = `已剔：${picked.join("、")} · 顯示 ${filtered.length}／${lastResults.length} 人`;
    }
  }
}

function openHkttaSearch(name) {
  document.getElementById("hktta-chi-name").value = name;
  document.getElementById("hktta-search").submit();
}

function setNamesEditorOpen(open, focus = false) {
  const editor = document.getElementById("names-editor");
  const compact = document.getElementById("names-compact");
  const searchBtn = document.getElementById("search-btn");
  const names = parseNames(document.getElementById("names").value);
  editor.classList.toggle("hidden", !open);
  compact.classList.toggle("hidden", open);
  searchBtn.classList.toggle("hidden", !open);
  document.getElementById("names-count").textContent = String(names.length);
  if (open && focus) document.getElementById("names").focus();
}

async function runSearch() {
  const names = parseNames(document.getElementById("names").value);
  if (!names.length) {
    lastResults = [];
    setNamesEditorOpen(true);
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
    fillExportTable([]);
    syncShareUrl([]).catch(() => {});
    return;
  }
  if (edgeLookup) {
    try {
      const res = await fetch(apiUrl("api/lookup"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (!res.ok) throw new Error(res.statusText);
      applyLookupData(await res.json());
      setNamesEditorOpen(false);
      renderResults();
      syncShareUrl(names).catch(() => {});
      return;
    } catch (err) {
      console.error(err);
      edgeLookup = false;
    }
  }
  lastResults = names.map((query) => {
    const matches = findMatches(query);
    return {
      query,
      matches,
      possible: matches.length ? [] : findPossible(query),
      lcsd: findLcsd(query),
      badges: findBadges(query),
    };
  });
  setNamesEditorOpen(false);
  renderResults();
  syncShareUrl(names).catch(() => {});
}

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function themePreference(saved = loadSettings()) {
  if (saved.theme === "light" || saved.theme === "dark" || saved.theme === "system") {
    return saved.theme;
  }
  if (Object.prototype.hasOwnProperty.call(saved, "dark")) {
    return saved.dark ? "dark" : "light";
  }
  return "system";
}

function applyThemePreference(pref) {
  if (pref === "dark") applyTheme(true);
  else if (pref === "light") applyTheme(false);
  else applyTheme(prefersDark());
}

function syncThemeRadios(pref) {
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.checked = el.value === pref;
  });
}

const EXPORT_HEADERS = ["姓名", "組別", "全港排名", "排名升跌", "積分", "積分升跌", "恒生章別"];

function exportBadgeLabel(item) {
  const best = bestBadge(item.badges || []);
  if (!best) return "";
  return best.passed ? best.badge : `報考${best.badge}`;
}

function exportMove(item) {
  const player = item.matches[0];
  if (!player) return { rank: "", points: "" };
  const all = overall(player);
  let rank = "";
  if (all && typeof all.rank === "number" && typeof all.prev === "number") {
    const diff = all.prev - all.rank;
    rank = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : "持平";
  }
  const prior = priorAll(player);
  const nowPts = player.points ?? all?.points;
  let points = "";
  if (prior && typeof prior.points === "number" && typeof nowPts === "number") {
    const diff = nowPts - prior.points;
    points = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "持平";
  }
  return { rank, points };
}

function exportRows(items) {
  return items.map((item) => {
    const rank = bestRank(item);
    const points = bestPoints(item.matches);
    const move = exportMove(item);
    return [
      item.query,
      divisionLabel(classify(item)),
      rank < 9e9 ? String(rank) : "",
      move.rank,
      points < 0 ? "" : String(points),
      move.points,
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
  const guessEl = document.getElementById("guess-gender");
  const pref = themePreference(saved);
  guessEl.checked = Boolean(saved.guessGender);
  syncThemeRadios(pref);
  applyThemePreference(pref);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (themePreference() !== "system") return;
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
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      saveSettings({ theme: el.value });
      applyThemePreference(el.value);
    });
  });
  guessEl.addEventListener("change", () => {
    saveSettings({ guessGender: guessEl.checked });
    renderResults();
  });
}

async function detectEdgeLookup() {
  if (/github\.io$/i.test(location.hostname)) return false;
  try {
    const res = await fetch(apiUrl("api/meta"), { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !Number.isFinite(data.hktta)) return false;
    applyMeta(data);
    return true;
  } catch {
    return false;
  }
}

async function bootLocal(shared) {
  const meta = document.getElementById("data-meta");
  try {
    const rankRes = await fetch(dataUrl("rankings.json"));
    if (!rankRes.ok) throw new Error(rankRes.statusText);
    snapshot = await rankRes.json();
    indexPlayers();
    buildScoredRanks();
    renderDataMeta();
  } catch (err) {
    meta.textContent = "排名資料載入失敗。請先執行 python scripts/fetch_rankings.py";
    console.error(err);
    return false;
  }
  bindUi();
  if (shared.length) await runSearch();
  try {
    const [lcsdRes, ageMapRes, badgeRes] = await Promise.all([
      fetch(dataUrl("lcsd.json")),
      fetch(dataUrl("lcsd_age_maps.json")),
      fetch(dataUrl("badges.json")),
    ]);
    if (lcsdRes.ok) lcsdIndex = await lcsdRes.json();
    if (ageMapRes.ok) lcsdAgeMaps = await ageMapRes.json();
    if (badgeRes.ok) badgeIndex = await badgeRes.json();
    indexLcsdDocCodes();
    buildNameStats();
    renderDataMeta();
    if (lastResults.length) {
      lastResults = lastResults.map((item) => ({
        ...item,
        lcsd: findLcsd(item.query),
        badges: findBadges(item.query),
      }));
      renderResults();
    }
  } catch (err) {
    console.error(err);
  }
  return true;
}

async function boot() {
  bootSettings();
  const shared = await readSharedNames();
  if (shared.length) document.getElementById("names").value = shared.join("\n");
  edgeLookup = await detectEdgeLookup();
  if (edgeLookup) {
    fetch(dataUrl("lcsd_age_maps.json"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) lcsdAgeMaps = data;
        if (lastResults.length) renderResults();
      })
      .catch(() => {});
    renderDataMeta();
    bindUi();
    if (shared.length) await runSearch();
    return;
  }
  await bootLocal(shared);
}

function bindUi() {
  document.getElementById("search-btn").addEventListener("click", runSearch);
  document.getElementById("edit-names-btn")?.addEventListener("click", () => setNamesEditorOpen(true, true));
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
    setNamesEditorOpen(true, true);
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
}

boot();
