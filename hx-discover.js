(() => {
  "use strict";

  const KNOWLEDGE = [
    {
      id: "k14-18",
      title: "14K vs 18K",
      body: "18K는 순금 비율이 높아 색이 깊고, 14K는 상대적으로 단단해 데일리 착용에 유리합니다.",
    },
    {
      id: "natural-lab",
      title: "천연 vs 랩그로운",
      body: "외관은 비슷할 수 있지만 생성 과정·가격·감정서 표기가 다릅니다. 예산과 가치관을 함께 보세요.",
    },
    {
      id: "shape",
      title: "다이아 쉐입",
      body: "같은 캐럿도 쉐입에 따라 보이는 크기가 달라집니다. 라운드는 표준, 오벌·페어는 세로로 길어 보입니다.",
    },
    {
      id: "ring-size",
      title: "반지 호수",
      body: "계절·시간대에 따라 손가락 굵기가 달라집니다. 오후·따뜻한 환경에서 재는 편이 안전합니다.",
    },
    {
      id: "neck-length",
      title: "목걸이 길이",
      body: "40cm는 초커에 가깝고, 45cm는 데일리, 50cm+는 레이어드에 자주 쓰입니다.",
    },
    {
      id: "care",
      title: "관리 기본",
      body: "화학제품·격한 충격 후엔 프롱·체인을 점검하세요. 초음파 세척은 세팅에 따라 주의가 필요합니다.",
    },
  ];

  const BIRTHSTONES = [
    { m: 1, name: "가넷", tip: "정열·시작", q: /가넷|하트|레드|루비/i },
    { m: 2, name: "자수정", tip: "평온", q: /퍼플|자수정|아메시/i },
    { m: 3, name: "아쿠아마린", tip: "맑음", q: /블루|아쿠아|사파이어/i },
    { m: 4, name: "다이아몬드", tip: "견고함", q: /다이아|브릴/i },
    { m: 5, name: "에메랄드", tip: "성장", q: /그린|에메랄드/i },
    { m: 6, name: "진주·문스톤", tip: "유연함", q: /진주|펄|문스톤/i },
    { m: 7, name: "루비", tip: "열정", q: /루비|레드|하트/i },
    { m: 8, name: "페리도트", tip: "활력", q: /그린|올리브/i },
    { m: 9, name: "사파이어", tip: "성실", q: /사파이어|블루/i },
    { m: 10, name: "오팔·투어말린", tip: "변화", q: /컬러|멀티|레인보/i },
    { m: 11, name: "토파즈·시트린", tip: "풍요", q: /옐로우|골드|시트리/i },
    { m: 12, name: "터콰이즈·지르콘", tip: "지혜", q: /블루|터콰|지르콘/i },
  ];

  const QUIZ = [
    {
      key: "brands",
      multi: true,
      q: "관심 브랜드를 골라 주세요",
      opts: [
        { v: "C", t: "Cartier" },
        { v: "VCA", t: "VCA" },
        { v: "B", t: "Bulgari" },
        { v: "BO", t: "Boucheron" },
        { v: "H", t: "Hermès" },
        { v: "CL", t: "Chanel" },
      ],
    },
    {
      key: "metals",
      multi: true,
      q: "선호하는 골드 컬러는?",
      opts: [
        { v: "yellow", t: "옐로우" },
        { v: "rose", t: "로즈" },
        { v: "white", t: "화이트" },
      ],
    },
    {
      key: "moods",
      multi: true,
      q: "끌리는 무드는?",
      opts: [
        { v: "minimal", t: "미니멀" },
        { v: "classic", t: "클래식" },
        { v: "romantic", t: "로맨틱" },
        { v: "bold", t: "볼드" },
        { v: "geometric", t: "지오메트릭" },
        { v: "vintage", t: "빈티지" },
      ],
    },
    {
      key: "types",
      multi: true,
      q: "관심 주얼리 타입은?",
      opts: [
        { v: "ring", t: "반지" },
        { v: "bracelet", t: "팔찌" },
        { v: "necklace", t: "목걸이" },
        { v: "earring", t: "귀걸이" },
      ],
    },
    {
      key: "occasions",
      multi: true,
      q: "주로 어떤 순간에 찾나요?",
      opts: [
        { v: "daily", t: "데일리" },
        { v: "wedding", t: "웨딩·약혼" },
        { v: "gift", t: "선물" },
        { v: "special", t: "특별한 날" },
      ],
    },
  ];

  let catalog = null;
  let diamondRules = null;
  let sheetEl = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function goProduct(item) {
    if (!item) return;
    window.HxStore?.pushRecent?.(item);
    const q = new URLSearchParams();
    if (/[?&]app=1(?:&|$)/.test(location.search)) q.set("app", "1");
    q.set("id", item.id);
    if (item.category) q.set("cat", item.category);
    location.href = `./portfolio.html?${q.toString()}`;
  }

  function cardButton(item) {
    const btn = el("button", "hx-card");
    btn.type = "button";
    btn.innerHTML =
      `<span class="hx-card__thumb"><img alt="" loading="lazy" src="${item.coverUrl || ""}"></span>` +
      `<span class="hx-card__brand">${item.brandEn || item.category || ""}</span>` +
      `<span class="hx-card__name">${item.displayTitle || item.title || ""}</span>`;
    btn.addEventListener("click", () => goProduct(item));
    if (window.GongbangProtectImage) window.GongbangProtectImage(btn.querySelector("img"));
    return btn;
  }

  function openSheet(title, build) {
    if (!sheetEl) {
      sheetEl = el("div", "hx-sheet");
      sheetEl.hidden = true;
      sheetEl.innerHTML = `<div class="hx-sheet__panel" role="dialog" aria-modal="true"><div class="hx-sheet__bar"><h3></h3><button type="button" aria-label="닫기">×</button></div><div class="hx-sheet__body"></div></div>`;
      document.body.append(sheetEl);
      sheetEl.addEventListener("click", (e) => {
        if (e.target === sheetEl) closeSheet();
      });
      $(".hx-sheet__bar button", sheetEl).addEventListener("click", closeSheet);
    }
    $(".hx-sheet__bar h3", sheetEl).textContent = title;
    const body = $(".hx-sheet__body", sheetEl);
    body.replaceChildren();
    build(body);
    sheetEl.hidden = false;
    window.HxStore?.track?.("feature_opened", { feature: title });
  }

  function closeSheet() {
    if (sheetEl) sheetEl.hidden = true;
  }

  async function ensureData() {
    if (!catalog) catalog = await window.HxCatalog.loadCatalog();
    if (!diamondRules) {
      try {
        const res = await fetch(`./hx-diamond-rules.json?v=${Date.now()}`, { cache: "no-store" });
        diamondRules = await res.json();
      } catch (_) {
        diamondRules = { shapes: {}, roundMmByCarat: {}, budgetBands: [], settingShare: 0.28 };
      }
    }
    return catalog;
  }

  function roundMm(carat) {
    const table = diamondRules?.roundMmByCarat || {};
    const keys = Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b);
    if (!keys.length) return 6.5 * Math.cbrt(carat);
    if (carat <= keys[0]) return table[String(keys[0].toFixed(2))] || table[keys[0]] || 4.2;
    if (carat >= keys[keys.length - 1]) {
      const last = keys[keys.length - 1];
      return (table[String(last.toFixed(2))] || table[last]) * Math.cbrt(carat / last);
    }
    for (let i = 0; i < keys.length - 1; i += 1) {
      const a = keys[i];
      const b = keys[i + 1];
      if (carat >= a && carat <= b) {
        const va = table[a.toFixed(2)] || table[a];
        const vb = table[b.toFixed(2)] || table[b];
        const t = (carat - a) / (b - a);
        return va + (vb - va) * t;
      }
    }
    return 6.5;
  }

  function openQuiz() {
    const answers = {
      brands: [],
      metals: [],
      moods: [],
      types: [],
      occasions: [],
    };
    let step = 0;
    openSheet("취향 퀴즈", (body) => {
      const paint = () => {
        body.replaceChildren();
        if (step >= QUIZ.length) {
          window.HxStore.setPrefs(answers);
          body.append(
            el("p", "hx-quiz__q", "취향이 저장됐어요"),
            el("p", "hx-note", "이 기기 로컬에만 저장됩니다. 로그인 동기화는 아직 연결하지 않았습니다."),
            el("div", "hx-row")
          );
          const row = $(".hx-row", body);
          const a = el("button", "hx-btn", "For You 보기");
          a.addEventListener("click", () => {
            closeSheet();
            renderFeed();
            location.hash = "#foryou";
          });
          row.append(a);
          return;
        }
        const q = QUIZ[step];
        body.append(el("p", "hx-quiz__q", `${step + 1}. ${q.q}`));
        const opts = el("div", "hx-quiz__opts");
        q.opts.forEach((opt) => {
          const b = el("button", "", opt.t);
          b.type = "button";
          if (answers[q.key].includes(opt.v)) b.classList.add("is-on");
          b.addEventListener("click", () => {
            const list = answers[q.key];
            const i = list.indexOf(opt.v);
            if (i >= 0) list.splice(i, 1);
            else list.push(opt.v);
            paint();
          });
          opts.append(b);
        });
        body.append(opts);
        const row = el("div", "hx-row");
        const next = el("button", "hx-btn", step === QUIZ.length - 1 ? "완료" : "다음");
        next.addEventListener("click", () => {
          step += 1;
          paint();
        });
        const skip = el("button", "hx-btn is-ghost", "건너뛰기");
        skip.addEventListener("click", () => {
          step += 1;
          paint();
        });
        row.append(next, skip);
        body.append(row);
      };
      paint();
    });
  }

  function openDiamond() {
    openSheet("다이아 사이즈", (body) => {
      const wrap = el("div", "hx-diamond");
      wrap.innerHTML =
        `<div class="hx-field"><label>쉐입</label><select id="hxShape"></select></div>` +
        `<div class="hx-field"><label>캐럿</label><input id="hxCt" type="number" min="0.2" max="5" step="0.05" value="1.00"></div>` +
        `<div class="hx-field"><label>비교 캐럿</label><input id="hxCt2" type="number" min="0.2" max="5" step="0.05" value="0.50"></div>` +
        `<div class="hx-diamond__stage" id="hxStage"></div>` +
        `<p class="hx-diamond__meta" id="hxDiaMeta"></p>` +
        `<p class="hx-note">컷 비율·세팅에 따라 실측 mm는 달라질 수 있습니다. 참고용 시각화입니다.</p>` +
        `<div class="hx-row"><button type="button" class="hx-btn" id="hxDiaMatch">비슷한 작품 보기</button></div>`;
      body.append(wrap);
      const shapeSel = $("#hxShape", wrap);
      Object.entries(diamondRules.shapes || {}).forEach(([k, v]) => {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = v.label || k;
        shapeSel.append(o);
      });
      const paint = () => {
        const shape = shapeSel.value || "round";
        const ct = Math.max(0.2, Number($("#hxCt", wrap).value) || 1);
        const ct2 = Math.max(0.2, Number($("#hxCt2", wrap).value) || 0.5);
        const meta = diamondRules.shapes[shape] || { aspect: 1, factor: 1 };
        const mm = roundMm(ct) * (meta.factor || 1);
        const mm2 = roundMm(ct2) * (meta.factor || 1);
        const stage = $("#hxStage", wrap);
        const scale = 14;
        const w = mm * scale;
        const h = (mm / (meta.aspect || 1)) * scale;
        const w2 = mm2 * scale;
        const h2 = (mm2 / (meta.aspect || 1)) * scale;
        stage.innerHTML =
          `<svg viewBox="0 0 280 200" width="100%" height="200" aria-hidden="true">` +
          `<rect x="20" y="150" width="240" height="18" rx="4" fill="#2a2a2a"/>` +
          `<text x="140" y="178" text-anchor="middle" fill="#888" font-size="10">대략적인 손가락 폭 참고</text>` +
          `<ellipse cx="100" cy="90" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="#e8d5a8" stroke-width="2"/>` +
          `<ellipse cx="190" cy="90" rx="${w2 / 2}" ry="${h2 / 2}" fill="none" stroke="#888" stroke-width="1.5" stroke-dasharray="4 3"/>` +
          `</svg>`;
        $("#hxDiaMeta", wrap).textContent =
          `${meta.label || shape} · ${ct.toFixed(2)}ct ≈ ${mm.toFixed(1)}mm 장축 참고` +
          ` · 비교 ${ct2.toFixed(2)}ct ≈ ${mm2.toFixed(1)}mm`;
      };
      ["change", "input"].forEach((ev) => {
        shapeSel.addEventListener(ev, paint);
        $("#hxCt", wrap).addEventListener(ev, paint);
        $("#hxCt2", wrap).addEventListener(ev, paint);
      });
      $("#hxDiaMatch", wrap).addEventListener("click", () => {
        closeSheet();
        const rings = catalog.items.filter((x) => x.type === "ring").slice(0, 12);
        openSheet("매칭 링 아카이브", (b) => {
          const rail = el("div", "hx-rail");
          rings.forEach((item) => rail.append(cardButton(item)));
          b.append(rail);
          b.append(el("p", "hx-note", "실제 다이아 스펙과 1:1 매칭이 아닌 아카이브 탐색용입니다."));
        });
      });
      paint();
      window.HxStore?.track?.("diamond_tool_completed", {});
    });
  }

  function openBudget() {
    openSheet("다이아 예산 가이드", (body) => {
      body.innerHTML =
        `<div class="hx-field"><label>예산 (원)</label><input id="hxBudget" type="number" min="500000" step="100000" value="3000000"></div>` +
        `<div class="hx-field"><label>우선</label><select id="hxOrigin"><option value="lab">랩그로운</option><option value="natural">천연</option></select></div>` +
        `<div class="hx-row"><button type="button" class="hx-btn" id="hxBudgetGo">범위 보기</button></div>` +
        `<div id="hxBudgetOut"></div>` +
        `<p class="hx-note">${diamondRules.disclaimer || "참고용 내부 규칙 · 실시간 시세 아님"}</p>`;
      $("#hxBudgetGo", body).addEventListener("click", () => {
        const budget = Math.max(0, Number($("#hxBudget", body).value) || 0);
        const origin = $("#hxOrigin", body).value;
        const band =
          (diamondRules.budgetBands || []).find((b) => budget <= b.max) ||
          (diamondRules.budgetBands || [])[(diamondRules.budgetBands || []).length - 1];
        const share = Number(diamondRules.settingShare) || 0.28;
        const stoneBudget = Math.round(budget * (1 - share));
        const settingBudget = budget - stoneBudget;
        const range = origin === "lab" ? band?.labCt : band?.naturalCt;
        const out = $("#hxBudgetOut", body);
        out.innerHTML =
          `<div class="hx-vault-card"><strong>추천 스펙 범위</strong>` +
          `<p>센터 스톤 참고 예산 약 ${stoneBudget.toLocaleString("ko-KR")}원` +
          `<br>세팅·제작 참고 약 ${settingBudget.toLocaleString("ko-KR")}원` +
          `<br>캐럿 참고 범위 ${(range || [0, 0]).join(" ~ ")} ct` +
          `<br>${band?.note || ""}</p></div>`;
        const matches = catalog.items.filter((x) => x.type === "ring").slice(0, 8);
        const rail = el("div", "hx-rail");
        matches.forEach((item) => rail.append(cardButton(item)));
        out.append(el("p", "hx-note", "연결 작품은 아카이브 탐색용이며 가격 보장가 아닙니다."));
        out.append(rail);
      });
    });
  }

  function openCompare() {
    openSheet("작품 비교", (body) => {
      const ids = window.HxStore.getCompare();
      const wish = window.HxStore.loadWish();
      const pool = [...new Set([...ids, ...wish, ...window.HxStore.loadRecent().map((x) => x.id)])]
        .map((id) => catalog.byId[String(id)])
        .filter(Boolean)
        .slice(0, 12);
      if (pool.length < 2) {
        body.append(el("p", "hx-empty", "비교할 작품이 부족합니다. 위시 또는 최근 본 작품을 2개 이상 모아 주세요."));
        return;
      }
      body.append(el("p", "hx-note", "최대 4개 · 모바일 카드 비교"));
      const pickRow = el("div", "hx-quiz__opts");
      const selected = new Set(ids.slice(0, 4));
      pool.forEach((item) => {
        const b = el("button", selected.has(String(item.id)) ? "is-on" : "", item.displayTitle.slice(0, 14));
        b.type = "button";
        b.addEventListener("click", () => {
          const id = String(item.id);
          if (selected.has(id)) selected.delete(id);
          else if (selected.size < 4) selected.add(id);
          window.HxStore.setCompare([...selected]);
          openCompare();
        });
        pickRow.append(b);
      });
      body.append(pickRow);
      const grid = el("div", "hx-compare");
      [...selected]
        .map((id) => catalog.byId[id])
        .filter(Boolean)
        .forEach((item) => {
          const col = el("div", "hx-compare__col");
          col.innerHTML =
            `<img alt="" src="${item.coverUrl}">` +
            `<dl>` +
            `<dt>브랜드</dt><dd>${item.brandEn}</dd>` +
            `<dt>타입</dt><dd>${item.type}</dd>` +
            `<dt>메탈</dt><dd>${item.metals.join(", ")}</dd>` +
            `<dt>무드</dt><dd>${item.moods.join(", ")}</dd>` +
            `<dt>순도</dt><dd>${item.purity || "—"}</dd>` +
            `<dt>위시</dt><dd>${window.HxStore.isWished(item.id) ? "YES" : "NO"}</dd>` +
            `</dl>`;
          grid.append(col);
        });
      body.append(grid);
      window.HxStore?.track?.("comparison_created", { n: selected.size });
    });
  }

  function openGift() {
    const state = { occasion: "gift", type: "any", metal: "any", mood: "classic", brand: "any" };
    openSheet("선물 찾기", (body) => {
      const paint = () => {
        body.replaceChildren();
        body.innerHTML =
          `<div class="hx-field"><label>상황</label><select id="gOcc"><option value="gift">선물</option><option value="daily">데일리</option><option value="wedding">웨딩</option><option value="special">기념일</option></select></div>` +
          `<div class="hx-field"><label>타입</label><select id="gType"><option value="any">상관없음</option><option value="ring">반지</option><option value="bracelet">팔찌</option><option value="necklace">목걸이</option><option value="earring">귀걸이</option></select></div>` +
          `<div class="hx-field"><label>메탈</label><select id="gMetal"><option value="any">상관없음</option><option value="yellow">옐로우</option><option value="rose">로즈</option><option value="white">화이트</option></select></div>` +
          `<div class="hx-field"><label>무드</label><select id="gMood"><option value="classic">클래식</option><option value="minimal">미니멀</option><option value="romantic">로맨틱</option><option value="bold">볼드</option></select></div>` +
          `<div class="hx-row"><button type="button" class="hx-btn" id="gGo">추천 보기</button></div>` +
          `<div id="gOut"></div>`;
        $("#gOcc", body).value = state.occasion;
        $("#gType", body).value = state.type;
        $("#gMetal", body).value = state.metal;
        $("#gMood", body).value = state.mood;
        $("#gGo", body).addEventListener("click", () => {
          state.occasion = $("#gOcc", body).value;
          state.type = $("#gType", body).value;
          state.metal = $("#gMetal", body).value;
          state.mood = $("#gMood", body).value;
          const items = window.HxCatalog.giftMatch(catalog, state);
          const out = $("#gOut", body);
          out.replaceChildren();
          const rail = el("div", "hx-rail");
          items.forEach((item) => rail.append(cardButton(item)));
          out.append(rail);
          out.append(el("p", "hx-note", "실물 상담으로 이어가시면 사이즈·예산·세팅을 더 정확히 맞출 수 있습니다."));
          const cta = el("a", "hx-btn", "카카오 상담");
          cta.href = "http://qr.kakao.com/talk/rOLSrSFZxCmHy7mWrkgwuNMH49w-";
          cta.target = "_blank";
          cta.rel = "noopener noreferrer";
          cta.style.display = "inline-block";
          cta.style.marginTop = "12px";
          cta.addEventListener("click", () => window.HxStore?.track?.("consultation_clicked", { from: "gift" }));
          out.append(cta);
        });
      };
      paint();
    });
  }

  function openVault() {
    openSheet("My Jewelry Value", (body) => {
      const list = window.HxStore.getVault();
      const gold = (() => {
        try {
          return JSON.parse(localStorage.getItem("hx.gold.last") || "null");
        } catch (_) {
          return null;
        }
      })();
      const purityMap = { "24K": 1, "22K": 0.916, "18K": 0.75, "14K": 0.585 };
      body.append(
        el(
          "p",
          "hx-note",
          "금속 함량 참고값입니다. 공식 감정·매입 보장가가 아닙니다. 브랜드 프리미엄·세공·스톤은 포함하지 않습니다."
        )
      );
      const form = el("div", "");
      form.innerHTML =
        `<div class="hx-field"><label>타입</label><select id="vType"><option>ring</option><option>bracelet</option><option>necklace</option><option>earring</option></select></div>` +
        `<div class="hx-field"><label>순도</label><select id="vPur"><option>18K</option><option>14K</option><option>22K</option><option>24K</option></select></div>` +
        `<div class="hx-field"><label>총중량(g)</label><input id="vWt" type="number" min="0.1" step="0.1" value="5"></div>` +
        `<div class="hx-field"><label>구입가(원, 선택)</label><input id="vPay" type="number" min="0" step="1000" value=""></div>` +
        `<div class="hx-row"><button type="button" class="hx-btn" id="vAdd">등록</button></div>`;
      body.append(form);
      const listHost = el("div", "");
      body.append(listHost);
      const paintList = () => {
        listHost.replaceChildren();
        if (!list.length) {
          listHost.append(el("p", "hx-empty", "등록된 보유 주얼리가 없습니다."));
          return;
        }
        let sum = 0;
        list.forEach((row, idx) => {
          const factor = purityMap[row.purity] || 0.75;
          const pureG = Number(row.weight) * factor;
          const don = gold?.don ? (pureG / 3.75) * gold.don : null;
          if (don) sum += don;
          const card = el("div", "hx-vault-card");
          card.innerHTML =
            `<strong>${row.type} · ${row.purity} · ${row.weight}g</strong>` +
            `<p>순금환산 참고 ${pureG.toFixed(2)}g` +
            (don != null ? ` · 재료 참고가 약 ${Math.round(don).toLocaleString("ko-KR")}원` : " · 금시세 캐시 없음") +
            (row.paid ? `<br>구입가 ${Number(row.paid).toLocaleString("ko-KR")}원` : "") +
            `</p>`;
          const del = el("button", "hx-btn is-ghost", "삭제");
          del.style.marginTop = "8px";
          del.addEventListener("click", () => {
            list.splice(idx, 1);
            window.HxStore.saveVault(list);
            paintList();
          });
          card.append(del);
          listHost.append(card);
        });
        if (sum) {
          listHost.prepend(
            el(
              "div",
              "hx-vault-card",
              `<strong>재료 참고 합계</strong><p>약 ${Math.round(sum).toLocaleString("ko-KR")}원 · ${new Date(
                gold?.at || Date.now()
              ).toLocaleString("ko-KR")} 시세 캐시 기준</p>`
            )
          );
        }
      };
      $("#vAdd", form).addEventListener("click", () => {
        const row = {
          id: `v-${Date.now()}`,
          type: $("#vType", form).value,
          purity: $("#vPur", form).value,
          weight: Math.max(0.1, Number($("#vWt", form).value) || 0),
          paid: Number($("#vPay", form).value) || 0,
          at: Date.now(),
        };
        list.unshift(row);
        window.HxStore.saveVault(list);
        window.HxStore?.track?.("jewelry_registered", { type: row.type });
        paintList();
      });
      paintList();
    });
  }

  function openSizes() {
    openSheet("사이즈 가이드", (body) => {
      const profile = window.HxStore.getSizeProfile() || {};
      body.innerHTML =
        `<div class="hx-field"><label>반지 호수</label><input id="sRing" type="text" placeholder="예: 11호" value="${
          profile.ring || ""
        }"></div>` +
        `<div class="hx-field"><label>팔찌</label><input id="sBr" type="text" placeholder="예: 16cm / 슬림" value="${
          profile.bracelet || ""
        }"></div>` +
        `<div class="hx-field"><label>목걸이</label><input id="sNk" type="text" placeholder="예: 45cm" value="${
          profile.necklace || ""
        }"></div>` +
        `<div class="hx-row"><button type="button" class="hx-btn" id="sSave">내 사이즈 저장</button></div>` +
        `<p class="hx-note">화면·줄자 오차가 있을 수 있습니다. 선물·주문 전 실측을 권장합니다.</p>` +
        `<div class="hx-vault-card"><strong>목걸이 길이 참고</strong><p>40cm 초커 · 45cm 데일리 · 50cm 레이어 · 60cm 롱</p></div>` +
        `<div class="hx-vault-card"><strong>반지 팁</strong><p>끈으로 둘레(mm)를 재고 원주÷π≈직경으로 호수를 가늠할 수 있습니다.</p></div>`;
      $("#sSave", body).addEventListener("click", () => {
        window.HxStore.setSizeProfile({
          ring: $("#sRing", body).value.trim(),
          bracelet: $("#sBr", body).value.trim(),
          necklace: $("#sNk", body).value.trim(),
        });
        alert("이 기기에 사이즈 프로필을 저장했습니다.");
      });
    });
  }

  function openBirthstone(month) {
    const m = month || new Date().getMonth() + 1;
    const stone = BIRTHSTONES.find((x) => x.m === m) || BIRTHSTONES[0];
    openSheet(`${m}월 · ${stone.name}`, (body) => {
      body.append(el("p", "hx-note", `${stone.tip} · 상징 탐색용이며 의학적·투자 조언이 아닙니다.`));
      const rail = el("div", "hx-rail");
      const items = catalog.items.filter((x) => stone.q.test(`${x.title} ${x.content}`)).slice(0, 12);
      (items.length ? items : catalog.items.filter((x) => x.moods.includes("romantic")).slice(0, 12)).forEach((item) =>
        rail.append(cardButton(item))
      );
      body.append(rail);
    });
  }

  function openKnowledge(card) {
    openSheet(card.title, (body) => {
      body.append(el("p", "", card.body));
      body.append(el("p", "hx-note", "교육용 카드입니다. 개별 작품 스펙은 상담으로 확인해 주세요."));
      const rail = el("div", "hx-rail");
      window.HxCatalog.forYou(catalog, 8).forEach((item) => rail.append(cardButton(item)));
      body.append(rail);
    });
  }

  function openCollections() {
    openSheet("스마트 컬렉션", (body) => {
      let cols = window.HxStore.getCollections();
      if (!cols.length) {
        cols = [
          { id: "wedding", name: "Wedding shortlist", ids: [] },
          { id: "daily", name: "Daily jewelry", ids: [] },
          { id: "dream", name: "Dream collection", ids: [] },
          { id: "compare", name: "Compare later", ids: window.HxStore.getCompare() },
        ];
        window.HxStore.saveCollections(cols);
      }
      const wish = window.HxStore.loadWish();
      cols.forEach((col) => {
        const card = el("div", "hx-vault-card");
        const covers = (col.ids.length ? col.ids : wish)
          .map((id) => catalog.byId[String(id)])
          .filter(Boolean)
          .slice(0, 3);
        card.innerHTML = `<strong>${col.name}</strong><p>${(col.ids.length || wish.length) + " pieces"}</p>`;
        if (covers.length) {
          const mosaic = el("div", "hx-edit__mosaic");
          mosaic.style.height = "90px";
          covers.forEach((item) => {
            const img = document.createElement("img");
            img.src = item.coverUrl;
            img.alt = "";
            mosaic.append(img);
          });
          card.append(mosaic);
        }
        const add = el("button", "hx-btn is-ghost", "위시에서 담기");
        add.style.marginTop = "8px";
        add.addEventListener("click", () => {
          col.ids = [...new Set([...(col.ids || []), ...wish])].slice(0, 40);
          window.HxStore.saveCollections(cols);
          openCollections();
        });
        card.append(add);
        body.append(card);
      });
    });
  }

  function renderFeed() {
    const root = document.getElementById("hxDiscover");
    if (!root || !catalog) return;
    root.replaceChildren();

    const hero = el("header", "hx-page__hero");
    hero.innerHTML =
      `<p class="hx-page__eyebrow">DISCOVER</p>` +
      `<h1 class="hx-page__title">발견</h1>` +
      `<p class="hx-page__lead">취향 · 에디토리얼 · 사이즈 · 가치 참고까지. 아카이브를 생활 도구로.</p>`;
    root.append(hero);

    const tools = el("div", "hx-tools");
    const toolDefs = [
      { t: "퀴즈", s: "취향", fn: openQuiz },
      { t: "다이아", s: "사이즈", fn: openDiamond },
      { t: "예산", s: "가이드", fn: openBudget },
      { t: "비교", s: "2–4", fn: openCompare },
      { t: "선물", s: "찾기", fn: openGift },
      { t: "가치", s: "Vault", fn: openVault },
      { t: "사이즈", s: "가이드", fn: openSizes },
      { t: "컬렉션", s: "폴더", fn: openCollections },
    ];
    toolDefs.forEach((def) => {
      const b = el("button", "", `${def.t}<span>${def.s}</span>`);
      b.type = "button";
      b.addEventListener("click", def.fn);
      tools.append(b);
    });
    root.append(tools);

    const daily = window.HxCatalog.dailyPick(catalog);
    if (daily) {
      const d = el("button", "hx-daily");
      d.type = "button";
      d.innerHTML =
        `<img alt="" src="${daily.coverUrl}">` +
        `<span><p class="hx-page__eyebrow">TODAY</p><strong>${daily.displayTitle}</strong>` +
        `<p>${daily.brandEn} · 오늘의 디스커버리 카드</p></span>`;
      d.addEventListener("click", () => goProduct(daily));
      root.append(d);
    }

    if (!window.HxStore.getPrefs()) {
      const quizCta = el("div", "hx-disclaimer");
      quizCta.innerHTML = `아직 취향이 없어요. <button type="button" class="hx-btn" style="margin-left:8px">30초 퀴즈</button>`;
      quizCta.querySelector("button").addEventListener("click", openQuiz);
      root.append(quizCta);
    }

    // For You
    const fy = el("section", "hx-sec");
    fy.id = "foryou";
    fy.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">FOR YOU</p><h2>나를 위한 피드</h2></div><button type="button" data-quiz>취향 수정</button></div>`;
    fy.querySelector("[data-quiz]").addEventListener("click", openQuiz);
    const fyRail = el("div", "hx-rail");
    window.HxCatalog.forYou(catalog, 14).forEach((item) => fyRail.append(cardButton(item)));
    fy.append(el("p", "hx-note", "로컬 취향·최근 열람·위시 기반 점수입니다. AI 추천 모델이 아닙니다."));
    fy.append(fyRail);
    root.append(fy);

    // Edits
    const editsSec = el("section", "hx-sec");
    editsSec.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">EDIT</p><h2>오늘의 주얼리 에디트</h2></div></div>`;
    const editRail = el("div", "hx-rail");
    window.HxCatalog.editorialEdits(catalog).forEach((edit) => {
      const b = el("button", "hx-edit");
      b.type = "button";
      const imgs = edit.items
        .slice(0, 3)
        .map((x) => `<img alt="" src="${x.coverUrl}">`)
        .join("");
      b.innerHTML = `<strong>${edit.title}</strong><p>${edit.sub}</p><div class="hx-edit__mosaic">${imgs}</div>`;
      b.addEventListener("click", () => {
        openSheet(edit.title, (body) => {
          body.append(el("p", "hx-note", edit.sub));
          const rail = el("div", "hx-rail");
          edit.items.forEach((item) => rail.append(cardButton(item)));
          body.append(rail);
        });
      });
      editRail.append(b);
    });
    editsSec.append(editRail);
    root.append(editsSec);

    // Trending local
    const trend = window.HxCatalog.localTrending(catalog, 10);
    const trSec = el("section", "hx-sec");
    trSec.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">RANK</p><h2>${trend.label}</h2></div></div>`;
    trSec.append(el("p", "hx-note", trend.note));
    const trRail = el("div", "hx-rail");
    trend.items.forEach((item) => trRail.append(cardButton(item)));
    trSec.append(trRail);
    root.append(trSec);

    // Recent + similar
    const recent = window.HxStore.loadRecent()
      .map((r) => catalog.byId[String(r.id)])
      .filter(Boolean)
      .slice(0, 12);
    if (recent.length) {
      const rSec = el("section", "hx-sec");
      rSec.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">RECENT</p><h2>최근 본 작품</h2></div></div>`;
      const rRail = el("div", "hx-rail");
      recent.forEach((item) => rRail.append(cardButton(item)));
      rSec.append(rRail);
      const seed = recent[0];
      const sim = window.HxCatalog.similarTo(catalog, seed, 10);
      if (sim.length) {
        rSec.append(el("div", "hx-sec__head", `<div><p class="hx-page__eyebrow">CONTINUE</p><h2>이어서 탐색</h2></div>`));
        const sRail = el("div", "hx-rail");
        sim.forEach((item) => sRail.append(cardButton(item)));
        rSec.append(sRail);
      }
      const look = window.HxCatalog.completeTheLook(catalog, seed);
      if (look.length) {
        rSec.append(el("div", "hx-sec__head", `<div><p class="hx-page__eyebrow">SET</p><h2>Complete the look</h2></div>`));
        const lRail = el("div", "hx-rail");
        look.forEach((item) => lRail.append(cardButton(item)));
        rSec.append(lRail);
      }
      root.append(rSec);
    }

    // Knowledge
    const kSec = el("section", "hx-sec");
    kSec.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">KNOWLEDGE</p><h2>주얼리 카드</h2></div></div>`;
    const kRail = el("div", "hx-rail");
    KNOWLEDGE.forEach((card) => {
      const b = el("button", "hx-know");
      b.type = "button";
      b.innerHTML = `<b>${card.title}</b><p>${card.body}</p>`;
      b.addEventListener("click", () => openKnowledge(card));
      kRail.append(b);
    });
    kSec.append(kRail);
    root.append(kSec);

    // Birthstone
    const bSec = el("section", "hx-sec");
    bSec.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">BIRTHSTONE</p><h2>탄생석 탐색</h2></div></div>`;
    const months = el("div", "pwa-birth");
    BIRTHSTONES.forEach((s) => {
      const b = el("button", "", `${s.m}월`);
      b.type = "button";
      if (s.m === new Date().getMonth() + 1) b.classList.add("is-on");
      b.addEventListener("click", () => openBirthstone(s.m));
      months.append(b);
    });
    bSec.append(months);
    root.append(bSec);

    root.append(
      el(
        "p",
        "hx-disclaimer",
        "재료 가치·다이아 예산·랭킹은 참고용입니다. 공식 감정·매입·실시간 재고/가격을 대체하지 않습니다. 선호 데이터는 기본적으로 이 기기 로컬에 저장됩니다."
      )
    );
  }

  async function bootDiscoverPage() {
    const root = document.getElementById("hxDiscover");
    if (!root) return;
    root.innerHTML = `<p class="hx-empty">Jewelry Today 준비 중…</p>`;
    try {
      if (window.HxToday?.renderToday) {
        await window.HxToday.renderToday(root);
      }
      await ensureData();
      const toolsWrap = document.createElement("div");
      toolsWrap.id = "hxInternalTools";
      root.append(toolsWrap);
      renderInternalTools(toolsWrap);
      const hash = location.hash.replace("#", "");
      if (hash === "quiz") openQuiz();
      if (hash === "diamond") openDiamond();
      if (hash === "gift") openGift();
      if (hash === "vault") openVault();
      if (hash === "compare") openCompare();
    } catch (err) {
      if (!root.querySelector(".hx-jod") && !root.querySelector(".hx-feed-grid")) {
        root.innerHTML = `<p class="hx-empty">디스커버를 불러오지 못했습니다. 네트워크 후 다시 시도해 주세요.</p>`;
      }
    }
  }

  function renderInternalTools(host) {
    if (!host) return;
    const head = document.createElement("div");
    head.className = "hx-sec__head";
    head.innerHTML = `<div><p class="hx-page__eyebrow">HERITAGE TOOLS</p><h2>유틸리티</h2></div>`;
    host.append(head);
    const tools = document.createElement("div");
    tools.className = "hx-tools";
    const toolDefs = [
      { t: "퀴즈", s: "취향", fn: openQuiz },
      { t: "다이아", s: "사이즈", fn: openDiamond },
      { t: "예산", s: "가이드", fn: openBudget },
      { t: "비교", s: "2–4", fn: openCompare },
      { t: "선물", s: "찾기", fn: openGift },
      { t: "가치", s: "Vault", fn: openVault },
      { t: "사이즈", s: "가이드", fn: openSizes },
      { t: "컬렉션", s: "폴더", fn: openCollections },
    ];
    toolDefs.forEach((def) => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `${def.t}<span>${def.s}</span>`;
      b.addEventListener("click", def.fn);
      tools.append(b);
    });
    host.append(tools);
    const note = document.createElement("p");
    note.className = "hx-note";
    note.textContent = "아래는 내부 포트폴리오·로컬 유틸입니다. 위쪽 Jewelry Today가 외부 콘텐츠 중심입니다.";
    host.append(note);
  }

  async function mountHomeTeasers(host) {
    if (!host) return;
    try {
      await ensureData();
    } catch (_) {
      return;
    }

    const strip = el("div", "pwa-hx-strip");
    const mk = (title, sub, href) => {
      const b = el("button", "");
      b.type = "button";
      b.innerHTML = `<strong>${title}</strong><span>${sub}</span>`;
      b.addEventListener("click", () => {
        location.href = href;
      });
      return b;
    };
    const app = /[?&]app=1(?:&|$)/.test(location.search) ? "&app=1" : "";
    strip.append(
      mk("Jewelry Today", "뮤지엄·영상·젬", `./discover.html`),
      mk("취향 퀴즈", "30초 맞춤 피드", `./discover.html#quiz`),
      mk("다이아 사이즈", "캐럿 시각화", `./discover.html#diamond`),
      mk("My Jewelry", "재료 가치 참고", `./discover.html#vault`)
    );
    // Fix discover URL with app param
    strip.children[0].onclick = () => {
      location.href = `./discover.html${app ? `?app=1` : ""}`;
    };
    strip.children[1].onclick = () => {
      location.href = `./discover.html${app ? "?app=1" : ""}#quiz`;
    };
    strip.children[2].onclick = () => {
      location.href = `./discover.html${app ? "?app=1" : ""}#diamond`;
    };
    strip.children[3].onclick = () => {
      location.href = `./discover.html${app ? "?app=1" : ""}#vault`;
    };
    host.append(strip);

    const daily = window.HxCatalog.dailyPick(catalog);
    if (daily) {
      const d = el("button", "hx-daily");
      d.type = "button";
      d.innerHTML =
        `<img alt="" src="${daily.coverUrl}">` +
        `<span><p class="hx-page__eyebrow">TODAY</p><strong>${daily.displayTitle}</strong>` +
        `<p>오늘의 디스커버리 · ${daily.brandEn}</p></span>`;
      d.addEventListener("click", () => goProduct(daily));
      host.append(d);
    }

    const editSec = el("section", "pwa-sec");
    editSec.innerHTML =
      `<div class="pwa-sec__head"><div><p class="pwa-sec__eyebrow">EDIT</p><h2>오늘의 에디트</h2></div>` +
      `<a href="./discover.html${app ? "?app=1" : ""}">더보기</a></div>`;
    const rail = el("div", "hx-rail");
    window.HxCatalog.editorialEdits(catalog)
      .slice(0, 4)
      .forEach((edit) => {
        const b = el("button", "hx-edit");
        b.type = "button";
        b.innerHTML =
          `<strong>${edit.title}</strong><p>${edit.sub}</p>` +
          `<div class="hx-edit__mosaic">${edit.items
            .slice(0, 3)
            .map((x) => `<img alt="" src="${x.coverUrl}">`)
            .join("")}</div>`;
        b.addEventListener("click", () => {
          location.href = `./discover.html${app ? "?app=1" : ""}`;
        });
        rail.append(b);
      });
    editSec.append(rail);
    host.append(editSec);

    // Upgrade FOR YOU if empty prefs note already handled in discover
    const fyHost = document.getElementById("pwaForYouRail");
    if (fyHost) {
      fyHost.replaceChildren();
      window.HxCatalog.forYou(catalog, 10).forEach((item) => {
        // reuse home card style if possible via simple clone of hx card
        fyHost.append(cardButton(item));
      });
    }
  }

  window.HxDiscover = {
    bootDiscoverPage,
    mountHomeTeasers,
    openQuiz,
    openDiamond,
    openGift,
    openVault,
    openCompare,
    ensureData,
  };

  if (document.getElementById("hxDiscover")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootDiscoverPage);
    else bootDiscoverPage();
  }
})();
