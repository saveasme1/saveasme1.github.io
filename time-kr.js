(() => {
  "use strict";

  const TZ = "Asia/Seoul";

  function parseDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    // MySQL DATETIME without zone → treat as KST wall-clock
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      const normalized = raw.replace(" ", "T");
      const withSeconds = /T\d{2}:\d{2}:\d{2}/.test(normalized) ? normalized : `${normalized}:00`;
      const date = new Date(`${withSeconds}+09:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isRecent(value, days = 30) {
    const date = parseDate(value);
    const limit = Number(days) * 24 * 60 * 60 * 1000;
    if (!date || !Number.isFinite(limit) || limit <= 0) return false;
    const age = Date.now() - date.getTime();
    return age >= 0 && age < limit;
  }

  function renderPostTitle(element, title, publishedAt) {
    if (!element) return;
    element.replaceChildren();
    if (isRecent(publishedAt, 30)) {
      const badge = document.createElement("span");
      badge.className = "post-new-badge";
      badge.textContent = "NEW";
      badge.setAttribute("aria-label", "새 게시물");
      badge.title = "30일 이내 게시물";
      element.append(badge);
    }
    element.append(document.createTextNode(String(title || "")));
  }

  function pickParts(date, options) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour12: false, ...options }).formatToParts(date);
    const map = {};
    parts.forEach((part) => {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    return map;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatDateShort(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: TZ,
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatYmd(value = new Date()) {
    const date = parseDate(value) || new Date();
    const p = pickParts(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return `${p.year}-${p.month}-${p.day}`;
  }

  function formatYmdCompact(value = new Date()) {
    return formatYmd(value).replace(/-/g, "");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function toDateTimeLocal(value) {
    const date = parseDate(value) || new Date();
    const p = pickParts(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const hour = String(p.hour).padStart(2, "0");
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
  }

  function fromDateTimeLocal(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return nowIso();
    const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || "00"}+09:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
  }

  window.GongbangTime = {
    TZ,
    parseDate,
    isRecent,
    renderPostTitle,
    formatDate,
    formatDateShort,
    formatDateTime,
    formatYmd,
    formatYmdCompact,
    nowIso,
    toDateTimeLocal,
    fromDateTimeLocal,
  };
})();
