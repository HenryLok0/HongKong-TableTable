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

let snapshot = null;
let lcsdIndex = { players: {} };

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

function genderLabel(gender) {
  return gender === "F" ? "女子" : "男子";
}

function overall(player) {
  return player.rankings.ALL || null;
}

function formatRank(player, totals) {
  const all = overall(player);
  if (!all) return "今期總榜未見";
  const totalKey = `${player.gender}-ALL`;
  const total = totals[totalKey];
  const pct = total ? Math.max(0, Math.round((1 - all.rank / total) * 1000) / 10) : null;
  return total
    ? `${genderLabel(player.gender)}第 ${all.rank} / ${total}（約高於 ${pct}% 上榜球員）`
    : `${genderLabel(player.gender)}第 ${all.rank}`;
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

function inferGender(item) {
  if (item.matches[0]) return item.matches[0].gender;
  const groups = item.lcsd.map((r) => r.group || "").join(" ");
  if (/\bM[A-Z]/.test(groups)) return "M";
  if (/\bF[A-Z]/.test(groups)) return "F";
  return "";
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

function searchLinks(name) {
  const q = encodeURIComponent(name);
  return [
    { label: "乒總球員搜尋", kind: "hktta" },
    {
      label: "康文署分齡比賽頁",
      href: "https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do",
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

function renderCard(item, totals, listRank) {
  const bucket = classify(item);
  const bucketText = divisionLabel(bucket);
  const lcsdHtml = renderLcsd(item.lcsd);

  if (!item.matches.length) {
    const tone = item.lcsd.length ? "lcsd" : "missing";
    return `<article class="card ${tone}">
      <div class="card-top">
        <div>
          <h2>${escapeHtml(item.query)}</h2>
          <span class="badge ${item.lcsd.length ? "ok" : "miss"}">${escapeHtml(bucketText)}</span>
        </div>
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
            <span class="badge ${player.gender === "F" ? "f" : "m"}">${genderLabel(player.gender)}</span>
            <span class="badge ok">${escapeHtml(player.age.label)}</span>
            <span class="badge ok">${escapeHtml(bucketText)}</span>
          </div>
          <div>${listRank ? `名單內積分序 ${listRank}` : ""}</div>
        </div>
        ${sameName}
        <div class="grid">
          <div><span>乒總積分</span><b>${player.points ?? all?.points ?? "—"}</b></div>
          <div><span>全港排名</span><b>${formatRank(player, totals)}</b></div>
          <div><span>教練／球會／學校</span><b>${escapeHtml([player.coach, player.club, player.school].filter(Boolean).join(" · ") || "榜上未列")}</b></div>
        </div>
        <p>${levelText(player)}</p>
        <p>${escapeHtml(player.age.note)}</p>
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

function render(results, totals) {
  const found = results.filter((r) => r.matches.length);
  const ranked = [...found].sort((a, b) => bestPoints(b.matches) - bestPoints(a.matches));
  const rankMap = new Map(ranked.map((r, i) => [r.query, i + 1]));

  const men = results.filter((r) => inferGender(r) === "M").length;
  const women = results.filter((r) => inferGender(r) === "F").length;
  const unknown = results.length - men - women;
  const genderText = unknown
    ? `男 ${men}／女 ${women}（未知 ${unknown}）`
    : `男 ${men}／女 ${women}`;

  const counts = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]));
  for (const item of results) counts[classify(item)] += 1;
  const bucketHtml = BUCKETS.filter((b) => counts[b.id] > 0)
    .map((b) => `<li>${escapeHtml(b.label)}（${counts[b.id]}）</li>`)
    .join("");

  document.getElementById("summary").classList.remove("hidden");
  document.getElementById("summary").innerHTML = `
    <div class="stat"><span>查詢人數</span><b>${results.length}</b></div>
    <div class="stat"><span>乒總上榜</span><b>${found.length}</b></div>
    <div class="stat"><span>男女比例</span><b>${genderText}</b></div>
    <div class="stat"><span>資料期數</span><b>${snapshot.period}</b></div>
  `;

  const breakdown = document.getElementById("breakdown");
  breakdown.classList.remove("hidden");
  breakdown.innerHTML = `<h2>名單組別</h2><ul class="bucket-list">${bucketHtml}</ul>
    <p class="hint">甲至戊組按今期乒總全港排名，對照<a href="https://www.hktta.org.hk/gameinfo/local/local_hkopen_ranking/2026/EntryForm/2026RankingProspectus.pdf" target="_blank" rel="noreferrer">2026 全港公開排名錦標賽章程</a>。女子冇戊組，第 301 名或以後算丁組。冇人嘅組別唔會顯示。</p>`;

  document.getElementById("results").innerHTML = results
    .map((item) => renderCard(item, totals, rankMap.get(item.query)))
    .join("");
}

function openHkttaSearch(name) {
  document.getElementById("hktta-chi-name").value = name;
  document.getElementById("hktta-search").submit();
}

function runSearch() {
  const names = parseNames(document.getElementById("names").value);
  if (!names.length) {
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
    return;
  }
  const results = names.map((query) => ({
    query,
    matches: findMatches(query, snapshot.players),
    lcsd: findLcsd(query),
  }));
  render(results, snapshot.totals);
}

async function boot() {
  const meta = document.getElementById("data-meta");
  try {
    const [rankRes, lcsdRes] = await Promise.all([
      fetch("data/rankings.json"),
      fetch("data/lcsd.json"),
    ]);
    if (!rankRes.ok) throw new Error(rankRes.statusText);
    snapshot = await rankRes.json();
    if (lcsdRes.ok) lcsdIndex = await lcsdRes.json();
    const lcsdCount = Object.keys(lcsdIndex.players || {}).length;
    meta.textContent = `目前資料：乒總 ${snapshot.period} 期（列印 ${snapshot.printed || "—"}，${snapshot.players.length} 人）· 康文署 PDF ${lcsdCount} 個姓名`;
  } catch (err) {
    meta.textContent = "排名資料載入失敗。請先執行 python scripts/fetch_rankings.py";
    console.error(err);
    return;
  }

  document.getElementById("search-btn").addEventListener("click", runSearch);
  runSearch();

  document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("names").value = "";
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("breakdown").classList.add("hidden");
    document.getElementById("results").innerHTML = "";
  });

  document.getElementById("results").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hktta]");
    if (!btn) return;
    openHkttaSearch(btn.getAttribute("data-hktta"));
  });
}

boot();
