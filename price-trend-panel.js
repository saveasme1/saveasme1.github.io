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

  class PriceTrendPanel {
    /**
     * @param {HTMLElement} mountEl - container inserted below detail section
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
                <canvas data-pt-canvas width="640" height="240" aria-label="가격 히스토리 차트"></canvas>
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
        // Wait for slide-open then scroll panel into view (detail dialog / page)
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
      // Do not force-refresh every open — overnight batch fills DB; only fetch if stale server-side.
      try {
        const res = await fetch(`${API_BASE}/trend/${encodeURIComponent(product.id)}?${params}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.detail || "불러오기 실패");
        this.render(data);
        // After content paints, ensure panel is visible
        setTimeout(() => {
          this.root.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        this.els.status.textContent += " · 일부 추정가 포함(출처 표기 참고)";
      }

      const sellers = data.sellers || [];
      this.els.sellers.replaceChildren();
      sellers.forEach((row) => {
        const li = document.createElement("li");
        li.className = "price-trend-panel__seller";

        const main = document.createElement("div");
        main.className = "price-trend-panel__seller-main";

        const a = document.createElement("a");
        a.href = row.product_url || row.listing_url || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = row.seller_name || row.domain || "판매처";

        const source = document.createElement("small");
        source.className = "price-trend-panel__source";
        const kind =
          row.source_kind === "product_page"
            ? row.region === "overseas"
              ? "해외 신품 상세"
              : "신품 상품상세"
            : row.region === "overseas"
              ? "해외 신품 검색"
              : "신품 검색목록";
        const est = row.price_is_estimate ? "참고추정가" : "신품수집가";
        const region = row.region === "overseas" ? "해외사이트" : "국내";
        let fx = "";
        if (row.original_currency && row.original_currency !== "KRW" && row.original_amount != null) {
          fx = ` · ${row.original_currency} ${Number(row.original_amount).toLocaleString()}→KRW`;
        }
        source.textContent = `${region} · ${row.domain || "—"} · ${kind} · ${est}${fx}`;

        const urlHint = document.createElement("small");
        urlHint.className = "price-trend-panel__url";
        try {
          const u = new URL(a.href);
          urlHint.textContent = `${u.hostname}${u.pathname.slice(0, 48)}`;
        } catch {
          urlHint.textContent = a.href;
        }

        main.append(a, source, urlHint);

        const em = document.createElement("em");
        em.textContent = won(row.price);
        if (row.price_is_estimate) em.title = "크롤 차단 등으로 추정된 가격";

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
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => won(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: { ticks: { maxTicksLimit: 6, color: "#6b6762" }, grid: { display: false } },
            y: {
              ticks: {
                color: "#6b6762",
                callback: (v) => `${Math.round(v / 10000)}만`,
              },
              grid: { color: "rgba(22,21,19,0.08)" },
            },
          },
        },
      });
    }

    destroy() {
      if (this.chart) this.chart.destroy();
      this.root.remove();
    }
  }

  window.HeritagePriceTrendPanel = PriceTrendPanel;
})();
