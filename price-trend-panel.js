(() => {
  "use strict";

  const API_BASE = (
    window.JEWELRY_PRICE_API || "https://app.0-1.co.kr/api/jewelry-price/v1"
  ).replace(/\/$/, "");

  const SITE_CURRENCY = {
    KR: "KRW",
    US: "USD",
    JP: "JPY",
    FR: "EUR",
    IT: "EUR",
    DE: "EUR",
    UK: "GBP",
    GB: "GBP",
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
   * @returns {{ overseas: boolean, flag: string, country: string, siteCurrency: string }}
   */
  function originMeta(row) {
    const url = String(row.product_url || row.listing_url || row.domain || "");
    const host = hostOf(row.domain || url);
    const path = pathOf(url);

    // Locale path overrides (e.g. /fr-fr/, /en-us/)
    if (/\/(fr-fr|fr_fr|\/fr\/)/i.test(path) || host.endsWith(".fr")) {
      return { overseas: true, flag: "🇫🇷", country: "FR", siteCurrency: "EUR" };
    }
    if (/\/(en-gb|uk\/)/i.test(path) || host.endsWith(".co.uk") || host.endsWith(".uk")) {
      return { overseas: true, flag: "🇬🇧", country: "UK", siteCurrency: "GBP" };
    }
    if (/\/(ja-jp|\/jp\/)/i.test(path) || host.endsWith(".co.jp") || host.endsWith(".jp")) {
      return { overseas: true, flag: "🇯🇵", country: "JP", siteCurrency: "JPY" };
    }
    if (/\/(it-it|\/it\/)/i.test(path) || host.endsWith(".it")) {
      return { overseas: true, flag: "🇮🇹", country: "IT", siteCurrency: "EUR" };
    }
    if (/\/(de-de|\/de\/)/i.test(path) || host.endsWith(".de")) {
      return { overseas: true, flag: "🇩🇪", country: "DE", siteCurrency: "EUR" };
    }
    if (/\/(en-us|us\/)/i.test(path)) {
      return { overseas: true, flag: "🇺🇸", country: "US", siteCurrency: "USD" };
    }

    const rules = [
      { test: /(naver\.|coupang\.|ssg\.|lotteon\.|gmarket\.|11st\.|thehyundai\.|auction\.co\.kr|danawa\.|akmall\.|galleria\.|\.co\.kr$|\.kr$)/, flag: "🇰🇷", country: "KR", overseas: false, siteCurrency: "KRW" },
      { test: /(amazon\.co\.jp|yahoo\.co\.jp|rakuten\.co\.jp)/, flag: "🇯🇵", country: "JP", overseas: true, siteCurrency: "JPY" },
      { test: /(amazon\.com|saksfifthavenue|net-a-porter\.com|tiffany\.com|google\.)/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /farfetch\.com/, flag: "🇬🇧", country: "UK", overseas: true, siteCurrency: "GBP" },
      // Brand boutique domains: use site TLD/.com US storefront currency, NOT brand nationality
      { test: /cartier\.com/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /bulgari\.com|bvlgari\.com/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /vancleefarpels\.com/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /chanel\.com/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /hermes\.com/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
      { test: /\.com$/, flag: "🇺🇸", country: "US", overseas: true, siteCurrency: "USD" },
    ];

    for (const r of rules) {
      if (r.test.test(host)) {
        return { overseas: r.overseas, flag: r.flag, country: r.country, siteCurrency: r.siteCurrency };
      }
    }

    const overseas = String(row.region || "") === "overseas" || (!/\.kr$/.test(host) && !!host);
    return {
      overseas,
      flag: overseas ? "🌐" : "🇰🇷",
      country: overseas ? "OVERSEAS" : "KR",
      siteCurrency: overseas ? "USD" : "KRW",
    };
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
                <canvas data-pt-canvas aria-label="가격 히스토리 차트"></canvas>
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

        const flag = document.createElement("span");
        flag.className = "price-trend-panel__flag";
        flag.textContent = meta.flag;
        flag.title = `출처사이트 ${meta.country}`;
        flag.setAttribute("aria-label", meta.overseas ? `해외 출처 ${meta.country}` : "국내 출처");

        const name = document.createElement("span");
        name.className = "price-trend-panel__seller-name";
        name.textContent = shortSellerName(row);
        name.title = row.seller_name || row.domain || "";

        top.append(flag, name);

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

        const cur = String(row.original_currency || meta.siteCurrency || "KRW").toUpperCase();
        const hasFx =
          meta.overseas &&
          cur !== "KRW" &&
          row.original_amount != null &&
          !Number.isNaN(Number(row.original_amount));

        if (hasFx) {
          const fxLine = document.createElement("span");
          fxLine.className = "price-trend-panel__price-fx";
          fxLine.textContent = formatFx(row.original_amount, cur);
          fxLine.title = `출처사이트 통화 (${cur})`;

          const fxNote = document.createElement("small");
          fxNote.className = "price-trend-panel__price-note";
          fxNote.textContent = `출처통화(${cur})`;

          const krwLine = document.createElement("strong");
          krwLine.className = "price-trend-panel__price-krw";
          krwLine.textContent = won(row.price);

          const krwNote = document.createElement("small");
          krwNote.className = "price-trend-panel__price-note";
          krwNote.textContent = "단순원화환산(실 구매가격 X)";
          if (row.fx_rate) {
            krwNote.title = `환율 1 ${cur} ≈ ${Number(row.fx_rate).toLocaleString("ko-KR")}원`;
          }

          priceBox.append(fxLine, fxNote, krwLine, krwNote);
        } else {
          const krwLine = document.createElement("strong");
          krwLine.className = "price-trend-panel__price-krw";
          krwLine.textContent = won(row.price);

          const krwNote = document.createElement("small");
          krwNote.className = "price-trend-panel__price-note";
          krwNote.textContent = meta.overseas ? "단순원화환산(실 구매가격 X)" : "국내가";

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

    renderChart(history) {
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

      let empty = wrap.querySelector(".price-trend-panel__chart-empty");
      if (!points.length) {
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

      const labels = points.map((h) => {
        try {
          return new Date(h.observed_at).toLocaleDateString("ko-KR", {
            month: "numeric",
            day: "numeric",
          });
        } catch {
          return String(h.observed_at).slice(0, 10);
        }
      });
      const values = points.map((h) => Number(h.price));

      this.chart = new window.Chart(this.els.canvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "실측가(원화)",
              data: values,
              borderColor: "#1a1714",
              backgroundColor: "rgba(26,23,20,0.08)",
              fill: points.length > 1,
              tension: points.length > 2 ? 0.25 : 0,
              pointRadius: points.length === 1 ? 5 : 3,
              pointHoverRadius: 6,
              showLine: points.length > 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 50,
          layout: { padding: { top: 4, right: 6, bottom: 2, left: 2 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const i = items?.[0]?.dataIndex ?? 0;
                  const h = points[i];
                  try {
                    return new Date(h.observed_at).toLocaleString("ko-KR");
                  } catch {
                    return String(h?.observed_at || "");
                  }
                },
                label: (ctx) => {
                  const h = points[ctx.dataIndex] || {};
                  const site = originMeta(h);
                  const cur = String(h.original_currency || site.siteCurrency || "KRW").toUpperCase();
                  const lines = [];
                  if (site.overseas && cur !== "KRW" && h.original_amount != null) {
                    lines.push(`출처통화 ${formatFx(h.original_amount, cur)}`);
                    lines.push(`단순원화환산(실 구매가격 X) ${won(h.price)}`);
                    if (h.fx_rate) {
                      lines.push(`환율 1 ${cur} ≈ ${Number(h.fx_rate).toLocaleString("ko-KR")}원`);
                    }
                  } else {
                    lines.push(`원화 ${won(h.price)}`);
                  }
                  if (h.domain || h.seller_name) {
                    lines.push(`출처 ${h.seller_name || h.domain}`);
                  }
                  return lines;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: Math.min(6, Math.max(1, points.length)),
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
