(() => {
  "use strict";

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function openSheet(title, build) {
    if (window.HxDiscover?.openSheet) return; // fallback below
    let sheet = document.getElementById("hxMediaSheet");
    if (!sheet) {
      sheet = el("div", "hx-sheet");
      sheet.id = "hxMediaSheet";
      sheet.hidden = true;
      sheet.innerHTML =
        `<div class="hx-sheet__panel" role="dialog" aria-modal="true">` +
        `<div class="hx-sheet__bar"><h3></h3><button type="button" aria-label="닫기">×</button></div>` +
        `<div class="hx-sheet__body"></div></div>`;
      document.body.append(sheet);
      sheet.addEventListener("click", (e) => {
        if (e.target === sheet) sheet.hidden = true;
      });
      sheet.querySelector(".hx-sheet__bar button").addEventListener("click", () => {
        sheet.hidden = true;
      });
    }
    sheet.querySelector(".hx-sheet__bar h3").textContent = title;
    const body = sheet.querySelector(".hx-sheet__body");
    body.replaceChildren();
    build(body);
    sheet.hidden = false;
    window.HxStore?.track?.("feature_opened", { feature: title });
  }

  function closeSheet() {
    const sheet = document.getElementById("hxMediaSheet");
    if (sheet) sheet.hidden = true;
  }

  function cardMuseum(item) {
    const b = el("button", "hx-media-card");
    b.type = "button";
    b.innerHTML =
      `<span class="hx-media-card__img"><img alt="" loading="lazy" src="${item.thumbnail || item.image}"></span>` +
      `<span class="hx-media-card__src">${item.institution || item.source}</span>` +
      `<strong>${item.titleKo || item.title}</strong>` +
      `<em>${item.summaryKo || item.objectDate || ""}</em>`;
    b.addEventListener("click", () => showDetail(item));
    return b;
  }

  function cardVideo(item) {
    const b = el("button", "hx-video-card");
    b.type = "button";
    b.innerHTML =
      `<span class="hx-video-card__thumb"><img alt="" loading="lazy" src="${item.thumbnail}"><i>▶</i></span>` +
      `<strong>${item.titleKo || item.title}</strong>` +
      `<em>${item.creator}</em>`;
    b.addEventListener("click", () => {
      openSheet(item.titleKo || item.title, (body) => {
        body.innerHTML =
          `<div class="hx-embed"><iframe title="${item.title}" src="https://www.youtube.com/embed/${item.videoId}?rel=0" ` +
          `allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` +
          `<p class="hx-note">${item.attribution} · 자동재생 소리 없음 · 파일 재호스팅 없음</p>` +
          `<a class="hx-btn" href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">원본에서 보기</a>`;
      });
      window.HxStore?.track?.("video_opened", { id: item.id });
    });
    return b;
  }

  function showDetail(item) {
    openSheet(item.titleKo || item.title, (body) => {
      body.replaceChildren();
      if (item.image || item.thumbnail) {
        const img = document.createElement("img");
        img.className = "hx-detail-img";
        img.alt = "";
        img.src = item.image || item.thumbnail;
        body.append(img);
      }
      body.append(el("p", "hx-note", item.summaryKo || ""));
      body.append(
        el(
          "p",
          "hx-attr",
          `${item.attribution || item.institution || ""} · ${item.rights || ""} · ${item.objectDate || ""}`
        )
      );
      if (item.creator) body.append(el("p", "hx-note", `Creator: ${item.creator}`));
      const row = el("div", "hx-row");
      const a = document.createElement("a");
      a.className = "hx-btn";
      a.href = item.sourceUrl || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "원본 출처";
      row.append(a);
      const save = el("button", "hx-btn is-ghost", "영감 저장");
      save.type = "button";
      save.addEventListener("click", () => {
        const key = "hx.life.inspire";
        try {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          list.unshift({ id: item.id, title: item.title, thumb: item.thumbnail, url: item.sourceUrl, at: Date.now() });
          localStorage.setItem(key, JSON.stringify(list.slice(0, 60)));
          save.textContent = "저장됨";
        } catch (_) {}
      });
      row.append(save);
      body.append(row);
      if (window.HxCatalog?.loadCatalog) {
        window.HxCatalog.loadCatalog().then((cat) => {
          const related = window.HxCatalog.forYou(cat, 6);
          if (!related.length) return;
          body.append(el("p", "hx-page__eyebrow", "HERITAGE CONTEXT"));
          const rail = el("div", "hx-rail");
          related.forEach((p) => {
            const b = el("button", "hx-card");
            b.type = "button";
            b.innerHTML =
              `<span class="hx-card__thumb"><img alt="" src="${p.coverUrl}"></span>` +
              `<span class="hx-card__name">${p.displayTitle}</span>`;
            b.addEventListener("click", () => {
              location.href = `./portfolio.html?id=${encodeURIComponent(p.id)}`;
            });
            rail.append(b);
          });
          body.append(el("p", "hx-note", "관련 내부 아카이브 · 광고가 아닌 맥락 추천"));
          body.append(rail);
        });
      }
    });
  }

  function sec(eyebrow, title, note) {
    const s = el("section", "hx-sec");
    s.innerHTML = `<div class="hx-sec__head"><div><p class="hx-page__eyebrow">${eyebrow}</p><h2>${title}</h2></div></div>`;
    if (note) s.append(el("p", "hx-note", note));
    return s;
  }

  async function renderToday(root) {
    if (!root || !window.HxContent) return false;
    root.replaceChildren();
    root.append(el("p", "hx-empty", "글로벌 주얼리 피드를 불러오는 중…"));

    let feed;
    let jod;
    let gem;
    let trends;
    let videos;
    try {
      [feed, jod, gem, trends, videos] = await Promise.all([
        window.HxContent.buildGlobalFeed(),
        window.HxContent.jewelOfTheDay(),
        window.HxContent.gemstoneDaily(),
        window.HxContent.trendSignals().catch(() => null),
        window.HxContent.fetchVideos().catch(() => []),
      ]);
    } catch (err) {
      root.innerHTML = `<p class="hx-empty">외부 피드를 불러오지 못했습니다. 캐시·네트워크를 확인해 주세요.</p>`;
      return false;
    }

    root.replaceChildren();

    const hero = el("header", "hx-page__hero");
    hero.innerHTML =
      `<p class="hx-page__eyebrow">JEWELRY TODAY</p>` +
      `<h1 class="hx-page__title">오늘의 주얼리</h1>` +
      `<p class="hx-page__lead">뮤지엄 · 젬올로지 · 영상 · 트렌드 시그널. 쇼핑하지 않아도 다시 열게 되는 발견 앱.</p>`;
    root.append(hero);

    if (feed?.offline) {
      root.append(el("p", "hx-disclaimer", "오프라인/캐시 피드입니다. 마지막 동기화 콘텐츠를 표시합니다."));
    } else {
      root.append(
        el(
          "p",
          "hx-note",
          `소스 혼합 · ${feed?.from || "live"} · 동기화 ${new Date(feed?.syncedAt || Date.now()).toLocaleTimeString("ko-KR")}`
        )
      );
    }

    // Filters
    const topics = [
      ["all", "전체"],
      ["watch", "Watch"],
      ["learn", "Learn"],
      ["history", "History"],
      ["gems", "Gems"],
      ["craft", "Craft"],
      ["saved", "팔로우"],
    ];
    const chips = el("div", "hx-chips");
    let active = "all";
    const feedHost = el("div", "hx-feed-host");

    function paintFeed() {
      feedHost.replaceChildren();
      const items = window.HxContent.filterByTopic(feed.items || [], active);
      if (!items.length) {
        feedHost.append(el("p", "hx-empty", "이 필터에 표시할 외부 콘텐츠가 없습니다."));
        return;
      }
      const grid = el("div", "hx-feed-grid");
      items.slice(0, 24).forEach((item, idx) => {
        if (item.type === "video") {
          grid.append(cardVideo(item));
          return;
        }
        const card = cardMuseum(item);
        if (idx === 0) card.classList.add("is-hero");
        grid.append(card);
      });
      feedHost.append(grid);
    }

    topics.forEach(([id, label]) => {
      const b = el("button", id === "all" ? "is-on" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        active = id;
        chips.querySelectorAll("button").forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on");
        paintFeed();
      });
      chips.append(b);
    });
    root.append(chips);

    // Jewel of the Day
    if (jod) {
      const jsec = sec("JEWEL OF THE DAY", "오늘의 주얼", "뮤지엄 Open Access에서 날짜 고정 선정");
      const heroCard = el("button", "hx-jod");
      heroCard.type = "button";
      heroCard.innerHTML =
        `<img alt="" src="${jod.image || jod.thumbnail}">` +
        `<span><b>${jod.title}</b><p>${jod.summaryKo || ""}</p>` +
        `<i>${jod.institution} · ${jod.rights}</i></span>`;
      heroCard.addEventListener("click", () => showDetail(jod));
      jsec.append(heroCard);
      root.append(jsec);
    }

    // Watch rail
    if (videos?.length) {
      const vsec = sec("WATCH", "주얼리 영상", "공식 YouTube embed · 소리 자동재생 없음");
      const rail = el("div", "hx-rail");
      videos.forEach((v) => rail.append(cardVideo(v)));
      vsec.append(rail);
      root.append(vsec);
    }

    // Gemstone daily
    if (gem?.gem) {
      const g = gem.gem;
      const gsec = sec("GEMSTONE DAILY", `오늘의 젬 · ${g.nameKo}`, "백과·관리 참고 · 감정/감별 아님");
      const box = el("div", "hx-gemday");
      box.innerHTML =
        `<div><strong>${g.name} / ${g.nameKo}</strong>` +
        `<p>화학식 ${g.formula} · 경도 ${g.hardness}<br>색: ${g.color}<br>${g.care}</p>` +
        `<p class="hx-note">초음파 ${gem.careUltrasonic} · 스팀 ${gem.careSteam} · 물 ${gem.careWater}</p></div>`;
      if (gem.wiki?.thumbnail) {
        const img = document.createElement("img");
        img.src = gem.wiki.thumbnail;
        img.alt = g.name;
        box.prepend(img);
      }
      const myth = el("button", "hx-know", `<b>Myth · ${g.myth}</b><p>${g.mythVerdict} — ${g.mythWhy}</p>`);
      myth.type = "button";
      gsec.append(box, myth);
      if (gem.wiki?.sourceUrl) {
        const a = document.createElement("a");
        a.className = "hx-btn is-ghost";
        a.href = gem.wiki.sourceUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Wikipedia 원문";
        a.style.margin = "0 16px";
        gsec.append(a);
      }
      root.append(gsec);
    }

    // Trends
    if (trends?.rows?.length) {
      const tsec = sec("TREND SIGNAL", trends.label, trends.note);
      const list = el("div", "hx-trend");
      trends.rows.forEach((r, i) => {
        list.append(
          el(
            "div",
            "hx-trend__row",
            `<span>${i + 1}</span><b>${r.article.replace(/_/g, " ")}</b><em>${r.total.toLocaleString("ko-KR")} views</em>`
          )
        );
      });
      tsec.append(list);
      root.append(tsec);
    }

    // Topic follow
    const followSec = sec("FOLLOW", "관심 토픽", "게스트 선호는 이 기기 로컬에 저장");
    const followRow = el("div", "hx-chips");
    ["diamonds", "antique", "craft", "museum", "gems", "gold"].forEach((t) => {
      const on = window.HxContent.getFollowedTopics().includes(t);
      const b = el("button", on ? "is-on" : "", t);
      b.type = "button";
      b.addEventListener("click", () => {
        window.HxContent.toggleTopic(t);
        b.classList.toggle("is-on");
      });
      followRow.append(b);
    });
    followSec.append(followRow);
    root.append(followSec);

    // Global feed
    const fsec = sec("GLOBAL FEED", "글로벌 주얼리 피드", "Met · Cleveland · AIC · YouTube · Wikipedia 혼합");
    fsec.append(feedHost);
    root.append(fsec);
    paintFeed();

    // Quiz
    const qsec = sec("QUIZ", "주얼리 퀴즈", "스트릭은 로컬 저장");
    const start = el("button", "hx-btn", "퀴즈 시작");
    start.type = "button";
    start.style.margin = "0 16px";
    start.addEventListener("click", () => {
      const bank = window.HxContent.quizBank();
      let i = 0;
      let score = 0;
      const play = () => {
        if (i >= bank.length) {
          openSheet("결과", (body) => {
            body.append(el("p", "", `${score}/${bank.length} 정답`));
            const streakKey = "hx.life.quizStreak";
            const streak = (Number(localStorage.getItem(streakKey)) || 0) + 1;
            localStorage.setItem(streakKey, String(streak));
            body.append(el("p", "hx-note", `로컬 스트릭 ${streak}`));
          });
          return;
        }
        const q = bank[i];
        openSheet(`Q${i + 1}`, (body) => {
          body.append(el("p", "hx-quiz__q", q.q));
          const opts = el("div", "hx-quiz__opts");
          q.opts.forEach((t, idx) => {
            const b = el("button", "", t);
            b.type = "button";
            b.addEventListener("click", () => {
              if (idx === q.a) score += 1;
              openSheet(idx === q.a ? "정답" : "오답", (b2) => {
                b2.append(el("p", "", q.explain));
                const n = el("button", "hx-btn", "다음");
                n.type = "button";
                n.addEventListener("click", () => {
                  i += 1;
                  play();
                });
                b2.append(n);
              });
            });
            opts.append(b);
          });
          body.append(opts);
        });
      };
      play();
    });
    qsec.append(start);
    root.append(qsec);

    // Care checker
    const csec = sec("CARE", "관리 체크", "보수적 규칙 · 전문가 상담 대체 아님");
    const careBox = el("div", "hx-care");
    careBox.style.padding = "0 16px";
    careBox.innerHTML =
      `<div class="hx-field"><label>보석</label><select id="hxCareGem"></select></div>` +
      `<div id="hxCareOut" class="hx-vault-card"></div>`;
    const sel = careBox.querySelector("#hxCareGem");
    window.HxContent.GEMS.forEach((g) => {
      const o = document.createElement("option");
      o.value = g.id;
      o.textContent = g.nameKo;
      sel.append(o);
    });
    const paintCare = () => {
      const g = window.HxContent.GEMS.find((x) => x.id === sel.value);
      const out = careBox.querySelector("#hxCareOut");
      out.innerHTML =
        `<strong>${g.nameKo}</strong><p>초음파: ${window.HxContent.CARE_RULES.ultrasonic[g.id]}` +
        `<br>스팀: ${window.HxContent.CARE_RULES.steam[g.id]}` +
        `<br>물: ${window.HxContent.CARE_RULES.water[g.id]}` +
        `<br>${g.care}</p>`;
    };
    sel.addEventListener("change", paintCare);
    paintCare();
    csec.append(careBox);
    root.append(csec);

    // Heritage strip (secondary)
    const hsec = sec("HERITAGE", "본 헤리티지 아카이브", "외부 콘텐츠의 맥락 추천 · 피드의 주인공 아님");
    const hbtn = el("button", "hx-btn is-ghost", "내부 도구 · 취향·비교·Vault");
    hbtn.type = "button";
    hbtn.style.margin = "0 16px 12px";
    hbtn.addEventListener("click", () => {
      document.getElementById("hxInternalTools")?.scrollIntoView({ behavior: "smooth" });
    });
    hsec.append(hbtn);
    root.append(hsec);

    root.append(
      el(
        "p",
        "hx-disclaimer",
        "외부 이미지는 Open Access/공개 도메인·공식 embed 위주입니다. 출처·라이선스를 카드에 표기합니다. 저작권 이슈는 운영자가 재검토할 수 있습니다. 감정·투자 조언이 아닙니다."
      )
    );

    window.HxStore?.track?.("feature_opened", { feature: "jewelry_today" });
    return true;
  }

  window.HxToday = { renderToday, showDetail, openSheet, closeSheet };
})();
