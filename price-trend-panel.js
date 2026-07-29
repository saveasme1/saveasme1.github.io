(() => {
  "use strict";

  const API_BASE = (
    window.JEWELRY_PRICE_API || "https://app.0-1.co.kr/api/jewelry-price/v1"
  ).replace(/\/$/, "");

  const COUNTRY_META = {
    KR: { overseas: false, flag: "🇰🇷", country: "KR", label: "한국", siteCurrency: "KRW", flagCode: "kr" },
    US: { overseas: true, flag: "🇺🇸", country: "US", label: "미국", siteCurrency: "USD", flagCode: "us" },
    JP: { overseas: true, flag: "🇯🇵", country: "JP", label: "일본", siteCurrency: "JPY", flagCode: "jp" },
    FR: { overseas: true, flag: "🇫🇷", country: "FR", label: "프랑스", siteCurrency: "EUR", flagCode: "fr" },
    IT: { overseas: true, flag: "🇮🇹", country: "IT", label: "이탈리아", siteCurrency: "EUR", flagCode: "it" },
    DE: { overseas: true, flag: "🇩🇪", country: "DE", label: "독일", siteCurrency: "EUR", flagCode: "de" },
    UK: { overseas: true, flag: "🇬🇧", country: "UK", label: "영국", siteCurrency: "GBP", flagCode: "gb" },
    GB: { overseas: true, flag: "🇬🇧", country: "UK", label: "영국", siteCurrency: "GBP", flagCode: "gb" },
  };

  const CURRENCY_COUNTRY = {
    KRW: "KR",
    USD: "US",
    JPY: "JP",
    EUR: "FR",
    GBP: "UK",
  };

  function won(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `${Math.round(Number(n)).toLocaleString("ko-KR")}원`;
  }

  function formatUpdated(iso) {
    if (!iso) return "업데이트 정보 없음";
    try {
      const d = new Date(iso);
      return `마지막 업데이트 ${d.toLocaleString("ko-KR")}`;
    } catch {
      return `마지막 업데이트 ${iso}`;
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return String(url || "").toLowerCase();
    }
  }

  function pathOf(url) {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  }

  /**
   * Flag/country from SELLER SITE (not brand HQ).
   * Prefer API region + original_currency, then URL locale / host.
   */
  function originMeta(row) {
    const url = String(row.product_url || row.listing_url || row.domain || "");
    const host = hostOf(row.domain || url);
    const path = pathOf(url);
    const regionRaw = String(row.region || "").trim().toLowerCase();
    const cur = String(row.original_currency || "").toUpperCase();

    if (regionRaw && COUNTRY_META[regionRaw.toUpperCase()]) {
      return { ...COUNTRY_META[regionRaw.toUpperCase()] };
    }
    if (regionRaw === "gb") return { ...COUNTRY_META.UK };

    // USD/JPY/EUR/GBP from API → country flag + that currency
    if (cur && cur !== "KRW" && CURRENCY_COUNTRY[cur]) {
      return { ...COUNTRY_META[CURRENCY_COUNTRY[cur]] };
    }

    if (regionRaw === "kr") return { ...COUNTRY_META.KR };

    if (/\/(fr-fr|fr_fr|\/fr\/)/i.test(path) || host.endsWith(".fr")) return { ...COUNTRY_META.FR };
    if (/\/(en-gb|uk\/)/i.test(path) || host.endsWith(".co.uk") || host.endsWith(".uk")) return { ...COUNTRY_META.UK };
    if (/\/(ja-jp|\/jp\/)/i.test(path) || host.endsWith(".co.jp") || host.endsWith(".jp")) return { ...COUNTRY_META.JP };
    if (/\/(it-it|\/it\/)/i.test(path) || host.endsWith(".it")) return { ...COUNTRY_META.IT };
    if (/\/(de-de|\/de\/)/i.test(path) || host.endsWith(".de")) return { ...COUNTRY_META.DE };
    if (/\/(en-us|us\/)/i.test(path)) return { ...COUNTRY_META.US };

    const rules = [
      { test: /(naver\.|coupang\.|ssg\.|lotteon\.|gmarket\.|11st\.|thehyundai\.|auction\.co\.kr|danawa\.|akmall\.|galleria\.|cafe24\.|gsshop\.|\.co\.kr$|\.kr$)/, code: "KR" },
      { test: /(amazon\.co\.jp|yahoo\.co\.jp|rakuten\.co\.jp)/, code: "JP" },
      { test: /(amazon\.com|saksfifthavenue|net-a-porter\.com|tiffany\.com|google\.|bing\.com)/, code: "US" },
      { test: /farfetch\.com/, code: "UK" },
      { test: /cartier\.com|bulgari\.com|bvlgari\.com|vancleefarpels\.com|chanel\.com|hermes\.com/, code: "US" },
      { test: /\.com$/, code: "US" },
    ];
    for (const r of rules) {
      if (r.test.test(host)) return { ...COUNTRY_META[r.code] };
    }

    if (regionRaw === "overseas") return { ...COUNTRY_META.US };
    if (cur === "KRW") return { ...COUNTRY_META.KR };
    return { ...COUNTRY_META.KR };
  }

  function appendFlag(target, meta) {
    const wrap = document.createElement("span");
    wrap.className = "price-trend-panel__flag";
    wrap.title = `${meta.label || meta.country} (${meta.country})`;
    wrap.setAttribute(
      "aria-label",
      meta.overseas ? `해외 출처 ${meta.label || meta.country}` : "국내 출처"
    );

    if (meta.flagCode) {
      const img = document.createElement("img");
      img.className = "price-trend-panel__flag-img";
      img.src = `https://flagcdn.com/24x18/${meta.flagCode}.png`;
      img.srcset = `https://flagcdn.com/48x36/${meta.flagCode}.png 2x`;
      img.width = 24;
      img.height = 18;
      img.alt = meta.country;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.remove();
        const emoji = document.createElement("span");
        emoji.className = "price-trend-panel__flag-emoji";
        emoji.textContent = meta.flag || "🌐";
        wrap.prepend(emoji);
      };
      wrap.append(img);
    } else {
      const emoji = document.createElement("span");
      emoji.className = "price-trend-panel__flag-emoji";
      emoji.textContent = meta.flag || "🌐";
      wrap.append(emoji);
    }

    const code = document.createElement("span");
    code.className = "price-trend-panel__flag-code";
    code.textContent = meta.country;
    wrap.append(code);
    target.append(wrap);
  }

  function resolveLocalAmount(row, meta) {
    const cur = String(row.original_currency || meta.siteCurrency || "KRW").toUpperCase();
    if (row.original_amount != null && !Number.isNaN(Number(row.original_amount))) {
      return { currency: cur, amount: Number(row.original_amount) };
    }
    const krw = Number(row.price);
    const fx = Number(row.fx_rate);
    if (cur !== "KRW" && Number.isFinite(krw) && Number.isFinite(fx) && fx > 0) {
      return { currency: cur, amount: krw / fx };
    }
    return { currency: cur, amount: null };
  }

  function shortSellerName(row) {
    const raw = String(row.seller_name || row.domain || "판매처");
    return raw
      .replace(/\(해외신품\)/g, "")
      .replace(/\(카탈로그\)/g, "")
      .replace(/공식신품/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 28);
  }

  function formatFx(amount, currency) {
    if (amount == null || Number.isNaN(Number(amount))) return null;
    const cur = String(currency || "USD").toUpperCase();
    const n = Number(amount);
    const symbols = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", KRW: "₩" };
    const sym = symbols[cur] || `${cur} `;
    if (cur === "JPY") return `${sym}${Math.round(n).toLocaleString("en-US")}`;
    if (cur === "KRW") return `${sym}${Math.round(n).toLocaleString("ko-KR")}`;
    return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  class PriceTrendPanel {
    constructor(mountEl, opts = {}) {
      this.mountEl = mountEl;
      this.getProduct = opts.getProduct || (() => null);
      this.open = false;
      this.chart = null;
      this._activeProductId = null;
      this._loadSeq = 0;
      this._build();
    }

    _build() {
      this.root = document.createElement("section");
      this.root.className = "price-trend-panel";
      this.root.setAttribute("aria-hidden", "true");
      this.root.innerHTML = `
        <div class="price-trend-panel__inner">
          <div class="price-trend-panel__card">
            <div class="price-trend-panel__head">
              <h3>가격추세</h3>
              <span class="price-trend-panel__updated" data-pt-updated></span>
            </div>
            <p class="price-trend-panel__status" data-pt-status>불러오는 중…</p>
            <div class="price-trend-panel__stats">
              <div class="price-trend-panel__stat"><span>현재 최저가</span><strong data-pt-low>—</strong></div>
              <div class="price-trend-panel__stat"><span>현재 최고가</span><strong data-pt-high>—</strong></div>
              <div class="price-trend-panel__stat"><span>평균가</span><strong data-pt-avg>—</strong></div>
            </div>
            <div class="price-trend-panel__body">
              <div class="price-trend-panel__chart-wrap">
                <canvas data-pt-canvas aria-label="최고가·평균가·최저가 가격 추세 차트"></canvas>
                <p class="price-trend-panel__chart-empty" hidden>수집된 실측 가격 포인트가 없어 그래프를 표시하지 않습니다.</p>
              </div>
              <div class="price-trend-panel__sellers">
                <h4>판매처</h4>
                <ul data-pt-sellers></ul>
              </div>
            </div>
          </div>
        </div>`;
      this.mountEl.append(this.root);
      this.els = {
        status: this.root.querySelector("[data-pt-status]"),
        updated: this.root.querySelector("[data-pt-updated]"),
        low: this.root.querySelector("[data-pt-low]"),
        high: this.root.querySelector("[data-pt-high]"),
        avg: this.root.querySelector("[data-pt-avg]"),
        canvas: this.root.querySelector("[data-pt-canvas]"),
        sellers: this.root.querySelector("[data-pt-sellers]"),
      };
    }

    /** Clear previous product UI so it cannot linger when switching items. */
    resetForProduct(productId) {
      this._activeProductId = productId || null;
      this._loadSeq += 1;
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      this.els.low.textContent = "—";
      this.els.high.textContent = "—";
      this.els.avg.textContent = "—";
      this.els.updated.textContent = "";
      this.els.status.textContent = productId ? "불러오는 중…" : "";
      this.els.status.classList.remove("is-error");
      this.els.sellers.replaceChildren();
      this.els.canvas.style.display = "block";
      const empty = this.root.querySelector(".price-trend-panel__chart-empty");
      if (empty) empty.hidden = true;
    }

    setExpanded(next) {
      this.open = !!next;
      this.root.classList.toggle("is-open", this.open);
      this.root.setAttribute("aria-hidden", this.open ? "false" : "true");
      if (this.open) {
        const product = this.getProduct();
        this.resetForProduct(product?.id || null);
        this.load();
        requestAnimationFrame(() => {
          setTimeout(() => {
            this.root.scrollIntoView({ behavior: "smooth", block: "nearest" });
            const sheet =
              this.root.closest(".board-detail") ||
              this.root.closest(".board-dialog__sheet") ||
              this.root.closest(".board-dialog");
            if (sheet && typeof sheet.scrollTo === "function") {
              const top = this.root.offsetTop - 24;
              sheet.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }
            if (this.chart) this.chart.resize();
          }, 80);
        });
      }
    }

    toggle() {
      this.setExpanded(!this.open);
      return this.open;
    }

    async load() {
      const product = this.getProduct();
      if (!product?.id) {
        this.els.status.textContent = "상품 정보를 찾을 수 없습니다.";
        this.els.status.classList.add("is-error");
        return;
      }
      const seq = ++this._loadSeq;
      this._activeProductId = product.id;
      this.els.status.classList.remove("is-error");
      this.els.status.textContent = "저장된 신품 시세를 불러오는 중…";
      const params = new URLSearchParams({
        title: product.title || "",
        brand: product.brand || "",
        image_url: product.imageUrl || "",
        category: product.category || "",
      });
      try {
        const res = await fetch(`${API_BASE}/trend/${encodeURIComponent(product.id)}?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (seq !== this._loadSeq || this._activeProductId !== product.id) return;
        if (!res.ok || !data.ok) throw new Error(data.detail || "불러오기 실패");
        this.render(data);
        setTimeout(() => {
          if (seq !== this._loadSeq) return;
          this.root.scrollIntoView({ behavior: "smooth", block: "nearest" });
          if (this.chart) this.chart.resize();
        }, 120);
      } catch (err) {
        if (seq !== this._loadSeq) return;
        this.els.status.textContent = err.message || "가격 정보를 불러오지 못했습니다.";
        this.els.status.classList.add("is-error");
      }
    }

    render(data) {
      const s = data.summary || {};
      this.els.low.textContent = won(s.lowest);
      this.els.high.textContent = won(s.highest);
      this.els.avg.textContent = won(s.average);
      this.els.updated.textContent = formatUpdated(s.last_updated);
      this.els.status.textContent = `판매처 ${s.seller_count || (data.sellers || []).length}곳 기준`;
      if (s.includes_estimates) {
        this.els.status.textContent += " · 일부 참고가 포함";
      }

      const sellers = data.sellers || [];
      this.els.sellers.replaceChildren();
      sellers.forEach((row) => {
        const meta = originMeta(row);
        const href = row.product_url || row.listing_url || "#";

        const li = document.createElement("li");
        li.className = "price-trend-panel__seller";

        const main = document.createElement("div");
        main.className = "price-trend-panel__seller-main";

        const top = document.createElement("div");
        top.className = "price-trend-panel__seller-top";

        const name = document.createElement("span");
        name.className = "price-trend-panel__seller-name";
        name.textContent = shortSellerName(row);
        name.title = row.seller_name || row.domain || "";

        appendFlag(top, meta);
        top.append(name);

        const metaRow = document.createElement("div");
        metaRow.className = "price-trend-panel__meta";

        const badge = document.createElement("span");
        badge.className = `price-trend-panel__badge ${meta.overseas ? "is-overseas" : "is-kr"}`;
        badge.textContent = meta.overseas ? `해외·${meta.country}` : "국내";

        const link = document.createElement("a");
        link.className = "price-trend-panel__link";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "출처링크";
        link.title = href;

        metaRow.append(badge, link);
        main.append(top, metaRow);

        const priceBox = document.createElement("div");
        priceBox.className = "price-trend-panel__prices";

        const local = resolveLocalAmount(row, meta);
        const showLocal =
          meta.overseas &&
          local.currency !== "KRW" &&
          local.amount != null &&
          !Number.isNaN(Number(local.amount));

        if (showLocal) {
          const fxLine = document.createElement("strong");
          fxLine.className = "price-trend-panel__price-fx";
          fxLine.textContent = formatFx(local.amount, local.currency);
          fxLine.title = `${meta.label || meta.country} 판매처 통화 (${local.currency})`;

          const fxNote = document.createElement("small");
          fxNote.className = "price-trend-panel__price-note";
          fxNote.textContent = `${meta.country} 통화(${local.currency})`;

          const krwLine = document.createElement("span");
          krwLine.className = "price-trend-panel__price-krw";
          krwLine.textContent = won(row.price);

          const krwNote = document.createElement("small");
          krwNote.className = "price-trend-panel__price-note";
          krwNote.textContent = "단순원화환산(실 구매가격 X)";
          if (row.fx_rate) {
            krwNote.title = `환율 1 ${local.currency} ≈ ${Number(row.fx_rate).toLocaleString("ko-KR")}원`;
          }

          priceBox.append(fxLine, fxNote, krwLine, krwNote);
        } else {
          const krwLine = document.createElement("strong");
          krwLine.className = "price-trend-panel__price-krw";
          krwLine.textContent = won(row.price);

          const krwNote = document.createElement("small");
          krwNote.className = "price-trend-panel__price-note";
          krwNote.textContent = meta.overseas ? `${meta.country} · 원화환산` : "국내가(KRW)";

          priceBox.append(krwLine, krwNote);
        }
        if (row.price_is_estimate) priceBox.title = "참고 추정가 포함";

        li.append(main, priceBox);
        this.els.sellers.append(li);
      });
      if (!sellers.length) {
        const li = document.createElement("li");
        li.textContent = "아직 발견된 판매처가 없습니다.";
        this.els.sellers.append(li);
      }

      this.renderChart(data.history || [], data.sellers || []);
    }

    renderChart(history, sellers = []) {
      const wrap = this.root.querySelector(".price-trend-panel__chart-wrap");
      const points = (history || []).filter((h) => {
        const p = Number(h?.price);
        return Number.isFinite(p) && p > 0 && h?.observed_at && String(h.source || "") !== "backfill";
      });

      if (typeof window.Chart === "undefined") {
        this.els.status.textContent += " · 차트 라이브러리 로딩 필요";
        return;
      }
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      // Day buckets → 최고가 / 평균가 / 최저가 (stock-style multi-line).
      const byDay = new Map();
      const pushPoint = (iso, price, meta = {}) => {
        const p = Number(price);
        if (!Number.isFinite(p) || p <= 0 || !iso) return;
        const day = String(iso).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        const row = byDay.get(day) || { day, low: p, high: p, sum: 0, count: 0, samples: [] };
        row.low = Math.min(row.low, p);
        row.high = Math.max(row.high, p);
        row.sum += p;
        row.count += 1;
        row.samples.push({ ...meta, price: p, observed_at: iso });
        byDay.set(day, row);
      };
      points.forEach((h) => pushPoint(h.observed_at, h.price, h));
      // Fold current seller quotes into latest day so high/low reflect live spread.
      (sellers || []).forEach((row) => {
        const iso =
          row.last_seen_at ||
          row.observed_at ||
          row.updated_at ||
          points[points.length - 1]?.observed_at ||
          new Date().toISOString();
        pushPoint(iso, row.price, row);
      });

      const series = [...byDay.values()]
        .map((row) => ({
          ...row,
          avg: row.count ? row.sum / row.count : row.low,
        }))
        .sort((a, b) => a.day.localeCompare(b.day));

      let empty = wrap.querySelector(".price-trend-panel__chart-empty");
      if (!series.length) {
        this.els.canvas.style.display = "none";
        if (!empty) {
          empty = document.createElement("p");
          empty.className = "price-trend-panel__chart-empty";
          wrap.append(empty);
        }
        empty.hidden = false;
        empty.textContent = "수집된 실측 가격 포인트가 없어 그래프를 표시하지 않습니다.";
        return;
      }

      this.els.canvas.style.display = "block";
      if (empty) empty.hidden = true;

      const labels = series.map((row) => {
        try {
          return new Date(`${row.day}T12:00:00`).toLocaleDateString("ko-KR", {
            month: "numeric",
            day: "numeric",
          });
        } catch {
          return row.day.slice(5);
        }
      });
      const highs = series.map((row) => row.high);
      const avgs = series.map((row) => row.avg);
      const lows = series.map((row) => row.low);
      const multiDay = series.length > 1;
      const hasSpread = series.some((row) => row.high !== row.low);

      this.chart = new window.Chart(this.els.canvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "최고가",
              data: highs,
              borderColor: "#c62828",
              backgroundColor: "rgba(198, 40, 40, 0.08)",
              borderWidth: 2,
              // Fill down to 최저가 (index +2) — band like a range chart.
              fill: hasSpread ? "+2" : false,
              tension: multiDay ? 0.25 : 0,
              pointRadius: series.length === 1 ? 5 : 2.5,
              pointHoverRadius: 6,
              pointBackgroundColor: "#c62828",
              showLine: true,
            },
            {
              label: "평균가",
              data: avgs,
              borderColor: "#6b6762",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 4],
              fill: false,
              tension: multiDay ? 0.25 : 0,
              pointRadius: series.length === 1 ? 4 : 0,
              pointHoverRadius: 5,
              pointBackgroundColor: "#6b6762",
              showLine: true,
            },
            {
              label: "최저가",
              data: lows,
              borderColor: "#1565c0",
              backgroundColor: "rgba(21, 101, 192, 0.08)",
              borderWidth: 2,
              fill: false,
              tension: multiDay ? 0.25 : 0,
              pointRadius: series.length === 1 ? 5 : 2.5,
              pointHoverRadius: 6,
              pointBackgroundColor: "#1565c0",
              showLine: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 50,
          interaction: { mode: "index", intersect: false },
          layout: { padding: { top: 4, right: 6, bottom: 2, left: 2 } },
          plugins: {
            legend: {
              display: true,
              position: "top",
              align: "end",
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true,
                pointStyle: "line",
                color: "#4a4641",
                font: { size: 11, weight: "600" },
                padding: 12,
              },
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const i = items?.[0]?.dataIndex ?? 0;
                  const row = series[i];
                  return row?.day || "";
                },
                label: (ctx) => `${ctx.dataset.label}: ${won(ctx.parsed.y)}`,
                afterBody: (items) => {
                  const i = items?.[0]?.dataIndex ?? 0;
                  const row = series[i];
                  if (!row) return [];
                  const spread = row.high - row.low;
                  if (!(spread > 0)) return ["당일 최고·최저·평균가 동일"];
                  return [`차이(최고−최저) ${won(spread)}`];
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: Math.min(6, Math.max(1, series.length)),
                color: "#6b6762",
                font: { size: 10 },
              },
              grid: { display: false },
            },
            y: {
              ticks: {
                color: "#6b6762",
                font: { size: 10 },
                maxTicksLimit: 5,
                callback: (v) => `${Math.round(v / 10000)}만`,
              },
              grid: { color: "rgba(22,21,19,0.08)" },
            },
          },
        },
      });
      requestAnimationFrame(() => {
        if (this.chart) this.chart.resize();
      });
    }

    destroy() {
      if (this.chart) this.chart.destroy();
      this.root.remove();
    }
  }

  window.HeritagePriceTrendPanel = PriceTrendPanel;
})();
