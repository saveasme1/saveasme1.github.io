(() => {
  "use strict";

  const NS = "hx.life";
  const keys = {
    prefs: `${NS}.prefs`,
    recent: "hx.pwa.recent",
    wish: "hx.pwa.wish",
    collections: `${NS}.collections`,
    compare: `${NS}.compare`,
    vault: `${NS}.vault`,
    stats: `${NS}.stats`,
    daily: `${NS}.daily`,
    dates: `${NS}.dates`,
    quizDone: `${NS}.quizDone`,
    sizeProfile: `${NS}.sizeProfile`,
    events: `${NS}.events`,
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function track(name, payload) {
    const row = {
      name: String(name || ""),
      at: Date.now(),
      payload: payload || {},
    };
    const list = read(keys.events, []);
    list.unshift(row);
    write(keys.events, list.slice(0, 200));
    try {
      window.dispatchEvent(new CustomEvent("hx:analytics", { detail: row }));
    } catch (_) {}
  }

  function bumpStat(bucket, id, by) {
    if (!id) return;
    const stats = read(keys.stats, { views: {}, saves: {}, tries: {}, searches: {} });
    if (!stats[bucket]) stats[bucket] = {};
    const sid = String(id);
    stats[bucket][sid] = (Number(stats[bucket][sid]) || 0) + (by || 1);
    write(keys.stats, stats);
  }

  function loadRecent() {
    const list = read(keys.recent, []);
    return Array.isArray(list) ? list : [];
  }

  function pushRecent(item) {
    if (!item || !item.id) return;
    const id = String(item.id);
    const next = [
      {
        id,
        cover: item.cover || item.image || "",
        title: item.title || "",
        category: item.category || "",
      },
    ];
    loadRecent()
      .filter((x) => x && String(x.id) !== id)
      .forEach((x) => next.push(x));
    write(keys.recent, next.slice(0, 40));
    bumpStat("views", id, 1);
    track("product_viewed", { id });
  }

  function loadWish() {
    return (read(keys.wish, []) || []).map(String);
  }

  function toggleWish(id) {
    const sid = String(id);
    let list = loadWish();
    const on = list.includes(sid);
    list = on ? list.filter((x) => x !== sid) : [sid, ...list];
    write(keys.wish, list.slice(0, 80));
    if (!on) bumpStat("saves", sid, 1);
    track(on ? "product_unsaved" : "product_saved", { id: sid });
    return !on;
  }

  function isWished(id) {
    return loadWish().includes(String(id));
  }

  function getPrefs() {
    return read(keys.prefs, null);
  }

  function setPrefs(prefs) {
    write(keys.prefs, prefs || null);
    write(keys.quizDone, true);
    track("prefs_saved", { keys: Object.keys(prefs || {}) });
  }

  function getCollections() {
    const list = read(keys.collections, []);
    return Array.isArray(list) ? list : [];
  }

  function saveCollections(list) {
    write(keys.collections, (list || []).slice(0, 24));
  }

  function getCompare() {
    return (read(keys.compare, []) || []).map(String).slice(0, 4);
  }

  function setCompare(ids) {
    write(keys.compare, (ids || []).map(String).slice(0, 4));
  }

  function getVault() {
    const list = read(keys.vault, []);
    return Array.isArray(list) ? list : [];
  }

  function saveVault(list) {
    write(keys.vault, (list || []).slice(0, 60));
  }

  function getStats() {
    return read(keys.stats, { views: {}, saves: {}, tries: {}, searches: {} });
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function getDailySeed() {
    const cur = read(keys.daily, {});
    if (cur && cur.day === todayKey()) return cur;
    const seed = { day: todayKey(), n: Math.floor(Math.random() * 10000) };
    write(keys.daily, seed);
    return seed;
  }

  function getSizeProfile() {
    return read(keys.sizeProfile, {});
  }

  function setSizeProfile(profile) {
    write(keys.sizeProfile, profile || {});
  }

  window.HxStore = {
    keys,
    read,
    write,
    track,
    bumpStat,
    loadRecent,
    pushRecent,
    loadWish,
    toggleWish,
    isWished,
    getPrefs,
    setPrefs,
    getCollections,
    saveCollections,
    getCompare,
    setCompare,
    getVault,
    saveVault,
    getStats,
    getDailySeed,
    getSizeProfile,
    setSizeProfile,
    todayKey,
  };
})();
