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

const AGE_BANDS = [
  { id: "60+", label: "60歲+" },
  { id: "51-60", label: "51-60歲" },
  { id: "41-50", label: "41-50歲" },
  { id: "31-40", label: "31-40歲" },
  { id: "26-30", label: "26-30歲" },
  { id: "21-25", label: "21-25歲" },
  { id: "16-20", label: "16-20歲" },
  { id: "10-15", label: "10-15歲" },
  { id: "u9", label: "九歲或以下" },
];

const HKTTA_AGE = {
  U9: "u9",
  U11: "10-15",
  U13: "10-15",
  U15: "10-15",
  U17: "16-20",
  U19: "16-20",
  U21: "21-25",
};

// LCSD ranges that span two display bands use the older band.
const LCSD_AGE = {
  MA: "60+",
  FA: "60+",
  MAA: "60+",
  FAA: "60+",
  MB: "51-60",
  FB: "51-60",
  MC: "41-50",
  FC: "41-50",
  MD: "31-40",
  FD: "31-40",
  ME: "21-25",
  FE: "21-25",
  MF: "16-20",
  FF: "16-20",
  MG: "10-15",
  FG: "10-15",
  MH: "10-15",
  FH: "10-15",
  MI: "10-15",
  FI: "10-15",
  MJ: "u9",
  FJ: "u9",
  MY5: "u9",
  FY5: "u9",
  MY4: "10-15",
  FY4: "10-15",
  MY3: "10-15",
  FY3: "10-15",
  MY2: "10-15",
  FY2: "10-15",
  MY1: "16-20",
  FY1: "16-20",
};

const MALE_CHARS = new Set(
  "軒熙賢亨程澄熹佑洋傑杰文生元鳴陞予培謙洛衡朗進柏逸卓銘景俊豪偉強明輝國德志成安平東永建家華龍斌宇浩天樂霆睿朗軒雄傑鋒鈞韜禮祺澤軒軒".split("")
);
const FEMALE_CHARS = new Set(
  "晴婷欣怡詩韻瑤琳慧敏靜芳麗美娟玲燕霞蓉君萍紅玉蘭鳳珍珠秀梅薇萱穎彤妮娜珊琪瑩璇蕾兒雯雪月心語恩雅琳瑩".split("")
);

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
  { group: "bucket", id: "none", label: "完全沒有任何紀錄" },
  ...AGE_BANDS.map((b) => ({ group: "age", id: b.id, label: b.label })),
];

let snapshot = null;
let lcsdIndex = { players: {} };
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
  for (const line of raw.split(/\r?\n/)) {
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
  const exact = players.filter((p) => normalizeName(p.name) === key);
  if (exact.length) return exact;
  return players.filter((p) => normalizeName(p.name).includes(key) && key.length >= 2);
}

function findLcsd(query) {
  const key = normalizeName(query);
  return lcsdIndex.players[key] || [];
}

function recordedGender(item) {
  if (item.matches[0]) return item.matches[0].gender;
  const groups = item.lcsd.map((r) => r.group || "").join(" ");
  if (/\bM[A-Z]/.test(groups)) return "M";
  if (/\bF[A-Z]/.test(groups)) return "F";
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

function olderBand(a, b) {
  if (!a) return b;
  if (!b) return a;
  return ageRank(a) <= ageRank(b) ? a : b;
}

function lcsdAgeFromItem(item) {
  let band = "";
  let code = "";
  for (const rec of item.lcsd) {
    const group = String(rec.group || "").toUpperCase();
    const mapped = LCSD_AGE[group];
    if (!mapped) continue;
    if (!band || ageRank(mapped) < ageRank(band)) {
      band = mapped;
      code = group;
    }
  }
  return { band, code };
}

function ageBand(item) {
  const lcsd = lcsdAgeFromItem(item);
  const hktta = HKTTA_AGE[item.matches[0]?.age?.youngestGroup] || "";
  if (lcsd.band && hktta) return olderBand(lcsd.band, hktta);
  return lcsd.band || hktta || "";
}

function ageBadge(item) {
  const id = ageBand(item);
  const band = AGE_BANDS.find((b) => b.id === id);
  if (!band) return "";
  const lcsd = lcsdAgeFromItem(item);
  const text = lcsd.code ? `${band.label}（${lcsd.code}）` : band.label;
  return `<span class="badge ok">${escapeHtml(text)}</span>`;
}

function searchLinks(name) {
  const q = encodeURIComponent(name);
  return [
    { label: "乒總球員搜尋", kind: "hktta" },
    { label: "康文署分齡比賽頁", href: "https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do" },
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

function renderLcsd(records) {
  if (!records.length) return "";
  const items = records
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

  if (!item.matches.length) {
    const tone = item.lcsd.length ? "lcsd" : "missing";
    return `<article class="card ${tone}">
      <div class="card-top">
        <div>
          <h2>${escapeHtml(item.query)}</h2>
          ${genderBadge(item)}
          ${ageBadge(item)}
          <span class="badge ${item.lcsd.length ? "ok" : "miss"}">${escapeHtml(bucketText)}</span>
        </div>
        <div>${escapeHtml(orderLabel)}</div>
      </div>
      <p>${item.lcsd.length
        ? "今期乒總公布榜未見，但康文署分齡賽程／成績 PDF 有呢個名。"
        : "今期乒總公布榜同已收入嘅康文署 PDF 都未見。可能未註冊、一年無計分賽、或者只打過未公開／未收入嘅地區賽。"}</p>
      ${lcsdHtml}
      <div class="links">${renderLinks(item.query)}</div>
    </article>`;
  }

  return item.matches
    .map((player, idx) => {
      const all = overall(player);
      const sameName = item.matches.length > 1 ? `<p>找到 ${item.matches.length} 個同名紀錄，呢張係第 ${idx + 1} 個。</p>` : "";
      return `<article class="card">
        <div class="card-top">
          <div>
            <h2>${escapeHtml(player.name)}</h2>
            ${genderBadge(item)}
            ${ageBadge(item)}
            <span class="badge ok">${escapeHtml(bucketText)}</span>
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
        <div class="links">${renderLinks(player.name)}</div>
      </article>`;
    })
    .join("");
}

function bestPoints(matches) {
  const values = matches.map((p) => p.points).filter((n) => typeof n === "number");
  return values.length ? Math.max(...values) : -1;
}

function bestRank(item) {
  const ranks = item.matches.map((p) => overall(p)?.rank).filter((n) => typeof n === "number");
  return ranks.length ? Math.min(...ranks) : 9e9;
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
  const extras = selectedFilters("extra");
  const gender = inferGender(item).gender;
  if (genders.length && !genders.includes(gender)) return false;
  if (buckets.length && !buckets.includes(classify(item))) return false;
  if (ages.length && !ages.includes(ageBand(item))) return false;
  if (extras.includes("has-lcsd") && !item.lcsd.length) return false;
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
  if (filter.id === "has-lcsd") {
    return results.some((item) => item.lcsd.length);
  }
  return true;
}

function buildFilters(results) {
  const box = document.getElementById("filter-box");
  const selected = new Set(
    [...box.querySelectorAll("input:checked")].map((el) => `${el.dataset.group}:${el.value}`)
  );
  const visible = FILTERS.filter((f) => filterHasPeople(f, results));
  box.innerHTML = visible
    .map((f) => {
      const key = `${f.group}:${f.id}`;
      const checked = selected.has(key) ? " checked" : "";
      return `<label class="choice"><input type="checkbox" data-group="${f.group}" value="${f.id}"${checked} /> ${escapeHtml(f.label)}</label>`;
    })
    .join("");
}

function updateStats(results) {
  const found = results.filter((r) => r.matches.length);
  const men = results.filter((r) => inferGender(r).gender === "M").length;
  const women = results.filter((r) => inferGender(r).gender === "F").length;
  const unknown = results.length - men - women;
  const genderText = unknown
    ? `男 ${men}／女 ${women}（未知 ${unknown}）`
    : `男 ${men}／女 ${women}`;

  const bucketCounts = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]));
  for (const item of results) bucketCounts[classify(item)] += 1;
  document.getElementById("bucket-list").innerHTML = BUCKETS.filter((b) => bucketCounts[b.id] > 0)
    .map((b) => `<li>${escapeHtml(b.label)}（${bucketCounts[b.id]}）</li>`)
    .join("");

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
    <div class="stat"><span>資料期數</span><b>${snapshot.period}</b></div>
  `;
}

function renderResults() {
  if (!lastResults.length) return;
  buildFilters(lastResults);
  document.getElementById("breakdown").classList.remove("hidden");
  updateStats(lastResults);

  const filtered = lastResults.filter(passesFilter);
  const mode = sortMode();
  const sorted = filtered.map((item, idx) => ({ item, listIndex: lastResults.indexOf(item) }));
  if (mode === "rank") {
    sorted.sort((a, b) => {
      const rankDiff = bestRank(a.item) - bestRank(b.item);
      if (rankDiff) return rankDiff;
      return bestPoints(b.item.matches) - bestPoints(a.item.matches);
    });
  }

  const strengthOrder = [...lastResults]
    .sort((a, b) => {
      const rankDiff = bestRank(a) - bestRank(b);
      if (rankDiff) return rankDiff;
      return bestPoints(b.matches) - bestPoints(a.matches);
    })
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
}

function openHkttaSearch(name) {
  document.getElementById("hktta-chi-name").value = name;
  document.getElementById("hktta-search").submit();
}

function runSearch() {
  const names = parseNames(document.getElementById("names").value);
  if (!names.length) {
    lastResults = [];
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
    return;
  }
  lastResults = names.map((query) => ({
    query,
    matches: findMatches(query, snapshot.players),
    lcsd: findLcsd(query),
  }));
  renderResults();
}

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function bootSettings() {
  const saved = loadSettings();
  const themeEl = document.getElementById("theme-toggle");
  const guessEl = document.getElementById("guess-gender");
  themeEl.checked = Boolean(saved.dark);
  guessEl.checked = Boolean(saved.guessGender);
  applyTheme(themeEl.checked);

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
    const [rankRes, lcsdRes] = await Promise.all([
      fetch("data/rankings.json"),
      fetch("data/lcsd.json"),
    ]);
    if (!rankRes.ok) throw new Error(rankRes.statusText);
    snapshot = await rankRes.json();
    buildScoredRanks();
    if (lcsdRes.ok) lcsdIndex = await lcsdRes.json();
    const lcsdCount = Object.keys(lcsdIndex.players || {}).length;
    const updated = snapshot.updated || lcsdIndex.updated || "—";
    meta.textContent = `目前資料：乒總 ${snapshot.period} 期（列印 ${snapshot.printed || "—"}，${snapshot.players.length} 人）· 康文署 PDF ${lcsdCount} 個姓名 · 上次更新 ${updated}`;
  } catch (err) {
    meta.textContent = "排名資料載入失敗。請先執行 python scripts/fetch_rankings.py";
    console.error(err);
    return;
  }

  document.getElementById("search-btn").addEventListener("click", runSearch);
  document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("names").value = "";
    lastResults = [];
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
  });
  document.getElementById("breakdown").addEventListener("change", (event) => {
    if (event.target.matches("input")) renderResults();
  });
  document.getElementById("results").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hktta]");
    if (!btn) return;
    openHkttaSearch(btn.getAttribute("data-hktta"));
  });
  runSearch();
}

boot();
