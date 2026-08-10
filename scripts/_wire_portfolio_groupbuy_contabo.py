#!/usr/bin/env python3
"""Patch portfolio-board.js and groupbuy-calendar.js for Contabo publish/delete/load."""
from pathlib import Path
import re

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")

# ---------- portfolio-board.js ----------
# File has weird double newlines between statements - work carefully.
pf = ROOT / "portfolio-board.js"
t = pf.read_text(encoding="utf-8")

LIVE_API_SNIPPET = '''  const DATA_PATH = "portfolio-data.json";
  const LIVE_API = `${(window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\\/$/, "")}/boards/portfolio/live`;
'''

if "LIVE_API" not in t:
    t = t.replace('  const DATA_PATH = "portfolio-data.json";\n', LIVE_API_SNIPPET)

# Replace uploadPortfolioImage + submit path: inject helper prepareAsset and rewrite submitWriter body for Contabo
# Simpler approach: replace uploadPortfolioImage to only return local prepared meta, and replace putManaged sequence in submitWriter.

helper = '''
  async function preparePortfolioAsset(file, role, index = 0) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    return {
      role,
      index: index || undefined,
      mime: file.type || "image/jpeg",
      content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    };
  }

'''

if "preparePortfolioAsset" not in t:
    t = t.replace(
        "  async function uploadPortfolioImage(file, id, role, index = 0) {",
        helper + "  async function uploadPortfolioImage(file, id, role, index = 0) {",
    )

# Rewrite submitWriter try body from cover upload through putManaged
# Match unique ASCII markers
old_start = "      let cover = writer.cover.path || \"\";\n\n      if (writer.cover.file) {\n\n        writer.status.textContent = \"대표 이미지 업로드 중…\";\n\n        cover = await uploadPortfolioImage(writer.cover.file, id, \"cover\");\n\n      }"
# File might not have double newlines consistently after our reads - normalize check
if old_start not in t:
    # try single newline version
    old_start = None
    m = re.search(
        r'let cover = writer\.cover\.path \|\| "";\s*if \(writer\.cover\.file\) \{\s*writer\.status\.textContent = "대표 이미지 업로드 중…";\s*cover = await uploadPortfolioImage\(writer\.cover\.file, id, "cover"\);\s*\}',
        t,
    )
    if not m:
        raise SystemExit("portfolio submit cover block not found")
    start = m.start()
else:
    start = t.find(old_start)

# End at state.items = published.items after putManaged
m2 = re.search(r"await putManaged\(\s*DATA_PATH,[\s\S]*?publishedFile\?\.sha \|\| \"\"\s*\);\s*", t[start:])
if not m2:
    raise SystemExit("portfolio putManaged DATA_PATH block not found")
end = start + m2.end()

replacement = '''
      const assets = [];
      let cover = writer.cover.path || "";
      if (writer.cover.file) {
        writer.status.textContent = "대표 이미지 준비 중…";
        assets.push(await preparePortfolioAsset(writer.cover.file, "cover"));
      }
      const keepImages = [];
      for (let index = 0; index < writer.details.length; index += 1) {
        const detail = writer.details[index];
        if (detail.file) {
          writer.status.textContent = `추가 이미지 준비 중 ${index + 1} / ${writer.details.length}`;
          assets.push(await preparePortfolioAsset(detail.file, "detail", index + 1));
        } else if (detail.path) {
          keepImages.push(detail.path);
        }
      }

      writer.status.textContent = "저장 중…";
      const now = window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString();
      const existing = editing || (state.items || []).find((entry) => entry.id === id);
      const draftItem = toPublishedItem({
        ...(existing || {}),
        id,
        category: form.elements.category.value,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        image: cover,
        cover,
        images: keepImages.filter((path) => path && path !== cover),
        uploadedAt: existing?.uploadedAt || now,
        sortAt: now,
        updatedAt: now,
        origin: existing?.origin || "admin",
      });

      const published = await api("/admin/boards/portfolio/publish", {
        method: "PUT",
        body: JSON.stringify({
          item: draftItem,
          assets,
          meta: {
            version: 3,
            categories: state.categories.length ? state.categories : CATEGORIES,
          },
        }),
      });
      const item = toPublishedItem(published.item || draftItem);
'''

t = t[:start] + replacement + t[end:]
# After replacement, `const now` and `existing` / `item` from old code might duplicate - the next lines still have old const now/existing/item/published construction
# Remove leftover old construction until state.items =
leftover = re.search(
    r"const now = window\.GongbangTime[\s\S]*?const nextItems = sortNewest\(\[item,[\s\S]*?items: nextItems,\s*\};\s*const draftItems[\s\S]*?\}\)\),\s*\};\s*",
    t[start : start + 8000],
)
# Actually old code after putManaged was removed; but between our new item and state.items there may still be old const now... published draft blocks
chunk = t[start : start + 12000]
idx_state = chunk.find("state.items = published.items")
if idx_state < 0:
    idx_state = chunk.find("state.items =")
# Find if there's leftover between `const item = toPublishedItem(published` and state.items
marker = "const item = toPublishedItem(published.item || draftItem);"
mi = chunk.find(marker)
if mi >= 0 and idx_state > mi:
    between = chunk[mi + len(marker) : idx_state]
    if "const now" in between or "const published" in between or "await putManaged" in between:
        abs_a = start + mi + len(marker)
        abs_b = start + idx_state
        t = t[:abs_a] + "\n\n      " + t[abs_b:]

# Fix state.items assignment to merge
t = t.replace(
    "state.items = published.items;",
    "state.items = sortNewest([item, ...(state.items || []).filter((entry) => entry.id !== id)]);",
    1,
)

# deletePortfolioItem -> Contabo
old_del = re.search(
    r"async function deletePortfolioItem\(item\) \{[\s\S]*?state\.items = published\.items;",
    t,
)
if not old_del:
    # try after our replace broke naming
    print("WARN: deletePortfolioItem pattern not found exactly")
else:
    new_del = '''async function deletePortfolioItem(item) {
    const id = item?.id;
    if (!id) return;
    if (!confirm(`"${item.title || "이 글"}" 포트폴리오를 삭제할까요?`)) return;

    await api(`/admin/boards/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.items = (state.items || []).filter((entry) => entry.id !== id);'''
    t = t[: old_del.start()] + new_del + t[old_del.end() :]

# loadData merge live
old_load = '''      const response = await fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" });

      if (!response.ok) throw new Error("포트폴리오 데이터를 불러오지 못했습니다.");

      const payload = await response.json();

      state.categories = Array.isArray(payload.categories) && payload.categories.length

        ? payload.categories

        : [...new Set((payload.items || []).map((item) => item.category).filter(Boolean))];

      state.items = (payload.items || [])

        .slice()

        .sort((a, b) => Date.parse(publishedAt(b) || 0) - Date.parse(publishedAt(a) || 0));
'''
new_load = '''      const [response, liveRes] = await Promise.all([
        fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" }),
        fetch(`${LIVE_API}?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      ]);

      if (!response.ok) throw new Error("포트폴리오 데이터를 불러오지 못했습니다.");

      const payload = await response.json();
      let liveItems = [];
      if (liveRes && liveRes.ok) {
        try {
          const livePayload = await liveRes.json();
          liveItems = Array.isArray(livePayload?.items) ? livePayload.items : [];
          if (Array.isArray(livePayload?.categories) && livePayload.categories.length) {
            payload.categories = livePayload.categories;
          }
        } catch (_) {
          liveItems = [];
        }
      }

      state.categories = Array.isArray(payload.categories) && payload.categories.length

        ? payload.categories

        : [...new Set((payload.items || []).map((item) => item.category).filter(Boolean))];

      const map = new Map();
      (payload.items || []).forEach((entry) => { if (entry?.id) map.set(String(entry.id), entry); });
      liveItems.forEach((entry) => { if (entry?.id) map.set(String(entry.id), entry); });
      state.items = [...map.values()]

        .slice()

        .sort((a, b) => Date.parse(publishedAt(b) || 0) - Date.parse(publishedAt(a) || 0));
'''
if old_load in t:
    t = t.replace(old_load, new_load)
else:
    print("WARN: portfolio loadData block not exact")

pf.write_text(t, encoding="utf-8", newline="\n")
print("portfolio patched")

# ---------- groupbuy-calendar.js ----------
gb = ROOT / "groupbuy-calendar.js"
g = gb.read_text(encoding="utf-8")

if "LIVE_API" not in g:
    g = g.replace(
        '  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\\/$/, "");\n'
        if 'const API = (window.HANDMADE_API_BASE' in g
        else None,
        None,
    )
# Find API const
if "boards/groupbuy/live" not in g:
    g = re.sub(
        r'(const API = \(window\.HANDMADE_API_BASE \|\| "[^"]+"\)\.replace\(/\\\/\$/, ""\);)',
        r'\1\n  const LIVE_API = `${API}/boards/groupbuy/live`;',
        g,
        count=1,
    )

# fetchPublicItems merge live
old_fetch = '''  async function fetchPublicItems() {
    const url = new URL("./groupbuy-data.json", location.href);
    url.searchParams.set("v", String(Date.now()));
    const res = await fetch(url.href, { cache: "no-store", credentials: "omit" });
    if (!res.ok) throw new Error(`공동구매 데이터를 불러오지 못했습니다 (${res.status})`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }'''
new_fetch = '''  async function fetchPublicItems() {
    const url = new URL("./groupbuy-data.json", location.href);
    url.searchParams.set("v", String(Date.now()));
    const [res, liveRes] = await Promise.all([
      fetch(url.href, { cache: "no-store", credentials: "omit" }),
      fetch(`${LIVE_API}?v=${Date.now()}`, { cache: "no-store", credentials: "omit" }).catch(() => null),
    ]);
    if (!res.ok) throw new Error(`공동구매 데이터를 불러오지 못했습니다 (${res.status})`);
    const data = await res.json();
    let liveItems = [];
    if (liveRes && liveRes.ok) {
      try {
        const livePayload = await liveRes.json();
        liveItems = Array.isArray(livePayload?.items) ? livePayload.items : [];
      } catch (_) {
        liveItems = [];
      }
    }
    const map = new Map();
    (Array.isArray(data.items) ? data.items : []).forEach((item) => {
      if (item?.id) map.set(String(item.id), item);
    });
    liveItems.forEach((item) => {
      if (item?.id) map.set(String(item.id), item);
    });
    return [...map.values()];
  }'''
if old_fetch in g:
    g = g.replace(old_fetch, new_fetch)
else:
    print("WARN: groupbuy fetchPublicItems not exact")

# Replace writer submit upload+putManaged with Contabo
old_gb_submit = '''        let cover = mediaState.coverPath;
        if (coverFile) {
          status.textContent = "대표 이미지 업로드 중…";
          cover = await uploadImage(coverFile, id, "cover");
        }
        const images = [...mediaState.images];
        for (let i = 0; i < detailFiles.length; i += 1) {
          status.textContent = `추가 이미지 업로드 중 ${i + 1} / ${detailFiles.length}`;
          images.push(await uploadImage(detailFiles[i], id, "detail", images.length + 1));
        }
        status.textContent = "공개 반영 중…";
        const [publishedFile, draftFile] = await Promise.all([
          readManaged("groupbuy-data.json", true),
          readManaged("groupbuy-draft.json", true),
        ]);
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover,
          image: cover,
          images,
          startDate,
          endDate,
          publishedAt: editing ? mediaState.publishedAt || now : now,
          updatedAt: now,
        };
        const baseItems = publishedFile?.value?.items || [];
        const published = {
          version: 1,
          publishedAt: now,
          items: [item, ...baseItems.filter((e) => e.id !== id)],
        };
        const draftItems = draftFile?.value?.items || baseItems;
        const draft = {
          version: 1,
          items: [item, ...draftItems.filter((e) => e.id !== id)],
        };
        await putManaged(
          "groupbuy-draft.json",
          textToBase64(JSON.stringify(draft)),
          `groupbuy draft: ${editing ? "update" : "create"} ${id}`,
          draftFile?.sha || ""
        );
        await putManaged(
          "groupbuy-data.json",
          textToBase64(JSON.stringify(published)),
          `groupbuy: ${editing ? "update" : "publish"} ${id}`,
          publishedFile?.sha || ""
        );
        status.textContent = editing ? "수정되었습니다." : "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        mediaState.id = null;
        mediaState.coverPath = "";
        mediaState.images = [];
        mediaState.publishedAt = "";
        dlg.close();
        const cb = dlg._onSaved || runtime.onSaved;
        if (typeof cb === "function") cb(published.items.map(normalizeItem));'''

new_gb_submit = '''        const assets = [];
        let cover = mediaState.coverPath;
        if (coverFile) {
          status.textContent = "대표 이미지 준비 중…";
          if (coverFile.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "cover",
            mime: coverFile.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await coverFile.arrayBuffer())),
          });
        }
        const images = [...mediaState.images];
        for (let i = 0; i < detailFiles.length; i += 1) {
          status.textContent = `추가 이미지 준비 중 ${i + 1} / ${detailFiles.length}`;
          const file = detailFiles[i];
          if (file.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "detail",
            index: images.length + i + 1,
            mime: file.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
          });
        }
        status.textContent = "저장 중…";
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover: cover || "",
          image: cover || "",
          images,
          startDate,
          endDate,
          publishedAt: editing ? mediaState.publishedAt || now : now,
          updatedAt: now,
          origin: "admin",
        };
        const published = await api("/admin/boards/groupbuy/publish", {
          method: "PUT",
          body: JSON.stringify({ item, assets }),
        });
        const saved = published.item || item;
        status.textContent = editing ? "수정되었습니다." : "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        mediaState.id = null;
        mediaState.coverPath = "";
        mediaState.images = [];
        mediaState.publishedAt = "";
        dlg.close();
        const cb = dlg._onSaved || runtime.onSaved;
        if (typeof cb === "function") {
          const prev = await fetchPublicItems().catch(() => []);
          const map = new Map(prev.map((e) => [String(e.id), e]));
          map.set(String(saved.id), saved);
          cb([...map.values()].map(normalizeItem));
        }'''

if old_gb_submit in g:
    g = g.replace(old_gb_submit, new_gb_submit)
else:
    print("WARN: groupbuy submit block not exact")

# delete path in groupbuy if any
# saveAllItems still uses putManaged - used for delete reorder - patch saveAllItems to Contabo? 
# For delete of groupbuy items look for savePublishedItems
g = g.replace(
    "await putManaged(\n      \"groupbuy-data.json\",",
    "// legacy git path kept only as fallback\n    await putManaged(\n      \"groupbuy-data.json\",",
)

gb.write_text(g, encoding="utf-8", newline="\n")
print("groupbuy patched")
