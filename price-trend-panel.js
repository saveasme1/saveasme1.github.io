(() => {
  "use strict";

  const API_BASE = (
    window.JEWELRY_PRICE_API || "https://app.0-1.co.kr/api/jewelry-price/v1"
  ).replace(/\/$/, "");

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

  /** @returns {{ overseas: boolean, flag: string, country: string }} */
  function originMeta(row) {
    const host = hostOf(row.domain || row.product_url || row.listing_url || "");
    const label = String(row.source_label || "");
    const region = String(row.region || "");

    const rules = [
      { test: /(naver\.|coupang\.|ssg\.|lotteon\.|gmarket\.|11st\.|thehyundai\.|auction\.co\.kr)/, flag: "🇰🇷", country: "KR", overseas: false },
      { test: /(amazon\.co\.jp|yahoo\.co\.jp|rakuten\.co\.jp)/, flag: "🇯🇵", country: "JP", overseas: true },
      { test: /(amazon\.com|saksfifthavenue|net-a-porter|farfetch|tiffany\.com|google\.)/, flag: "🇺🇸", country: "US", overseas: true },
      { test: /cartier\.com/, flag: "🇫🇷", country: "FR", overseas: true },
      { test: /(bulgari\.com|bvlgari\.com)/, flag: "🇮🇹", country: "IT", overseas: true },
      { test: /vancleefarpels\.com/, flag: "🇫🇷", country: "FR", overseas: true },
      { test: /chanel\.com/, flag: "🇫🇷", country: "FR", overseas: true },
      { test: /hermes\.com/, flag: "🇫🇷", country: "FR", overseas: true },
      { test: /\.co\.kr$|\.kr$/, flag: "🇰🇷", country: "KR", overseas: false },
      { test: /\.co\.jp$|\.jp$/, flag: "🇯🇵", country: "JP", overseas: true },
      { test: /\.fr$/, flag: "🇫🇷", country: "FR", overseas: true },
      { test: /\.it$/, flag: "🇮🇹", country: "IT", overseas: true },
      { test: /\.uk$|\.co\.uk$/, flag: "🇬🇧", country: "UK", overseas: true },
      { test: /\.de$/, flag: "🇩🇪", country: "DE", overseas: true },
      { test: /\.com$/, flag: "🇺🇸", country: "US", overseas: true },
    ];

    for (const r of rules) {
      if (r.test.test(host)) return { overseas: r.overseas, flag: r.flag, country: r.country };
    }

    const overseas =
      region === "overseas" ||
      /외국|해외/.test(label) ||
      (!/\.kr$/.test(host) && !!host);
    return {
      overseas,
      flag: overseas ? "🌐" : "🇰🇷",
      country: overseas ? "OVERSEAS" : "KR",
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

  class PriceTrendPanel {
    /**
     * @param {HTMLElement} mountEl
     * @param {{ getProduct: () => ({id:string,title?:string,brand?:string,imageUrl?:string}|null) }} opts
     */
    constructor(mountEl, opts = {}) {
      this.mountEl = mountEl;
      this.getProduct = opts.getProduct || (() => null);
      this.open = false;
      this.chart = null;
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

    setExpanded(next) {
      this.open = !!next;
      this.root.classList.toggle("is-open", this.open);
      this.root.setAttribute("aria-hidden", this.open ? "false" : "true");
      if (this.open) {
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
      this.els.status.classList.remove("is-error");
      this.els.status.textContent = "저장된 신품 시세를 불러오는 중…";
      const params = new URLSearchParams({
        title: product.title || "",
        brand: product.brand || "",
        image_url: product.imageUrl || "",
      });
      try {
        const res = await fetch(`${API_BASE}/trend/${encodeURIComponent(product.id)}?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.detail || "불러오기 실패");
        this.render(data);
        setTimeout(() => {
          this.root.scrollIntoView({ behavior: "smooth", block: "nearest" });
          if (this.chart) this.chart.resize();
        }, 120);
      } catch (err) {
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
        flag.title = meta.country;
        flag.setAttribute("aria-label", meta.overseas ? "해외 판매처" : "국내 판매처");

        const name = document.createElement("span");
        name.className = "price-trend-panel__seller-name";
        name.textContent = shortSellerName(row);
        name.title = row.seller_name || row.domain || "";

        top.append(flag, name);

        const metaRow = document.createElement("div");
        metaRow.className = "price-trend-panel__meta";

        const badge = document.createElement("span");
        badge.className = `price-trend-panel__badge ${meta.overseas ? "is-overseas" : "is-kr"}`;
        badge.textContent = meta.overseas ? "해외" : "국내";

        const link = document.createElement("a");
        link.className = "price-trend-panel__link";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "링크";
        link.title = href;

        metaRow.append(badge, link);
        main.append(top, metaRow);

        const em = document.createElement("em");
        em.textContent = won(row.price);
        if (row.price_is_estimate) em.title = "참고 추정가";

        li.append(main, em);
        this.els.sellers.append(li);
      });
      if (!sellers.length) {
        const li = document.createElement("li");
        li.textContent = "아직 발견된 판매처가 없습니다.";
        this.els.sellers.append(li);
      }

      this.renderChart(data.history || []);
    }

    renderChart(history) {
      const labels = history.map((h) => {
        try {
          return new Date(h.observed_at).toLocaleDateString("ko-KR", {
            month: "numeric",
            day: "numeric",
          });
        } catch {
          return h.observed_at;
        }
      });
      const values = history.map((h) => Number(h.price));
      if (typeof window.Chart === "undefined") {
        this.els.status.textContent += " · 차트 라이브러리 로딩 필요";
        return;
      }
      if (this.chart) this.chart.destroy();
      this.chart = new window.Chart(this.els.canvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "가격",
              data: values,
              borderColor: "#1a1714",
              backgroundColor: "rgba(26,23,20,0.08)",
              fill: true,
              tension: 0.35,
              pointRadius: 2,
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
                label: (ctx) => won(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 5, color: "#6b6762", font: { size: 10 } },
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
