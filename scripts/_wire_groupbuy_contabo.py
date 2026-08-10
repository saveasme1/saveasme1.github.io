#!/usr/bin/env python3
from pathlib import Path
import re

gb = Path(r"F:/공방171포폴프로젝트/_pwa_push/groupbuy-calendar.js")
g = gb.read_text(encoding="utf-8")

if "boards/groupbuy/live" not in g:
    needle = 'const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\\/$/, "");'
    if needle not in g:
        raise SystemExit("API const not found")
    g = g.replace(
        needle,
        needle + '\n  const LIVE_API = `${API}/boards/groupbuy/live`;',
        1,
    )

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
if old_fetch not in g:
    raise SystemExit("fetchPublicItems block missing")
g = g.replace(old_fetch, new_fetch)

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

if old_gb_submit not in g:
    raise SystemExit("groupbuy submit block missing")
g = g.replace(old_gb_submit, new_gb_submit)

# deleteGroupbuyItem
m = re.search(r"async function deleteGroupbuyItem\(id\) \{[\s\S]*?\n  \}", g)
if not m:
    raise SystemExit("deleteGroupbuyItem missing")
new_del = '''async function deleteGroupbuyItem(id) {
    if (!id) return;
    await api(`/admin/boards/groupbuy/${encodeURIComponent(id)}`, { method: "DELETE" });
    return fetchPublicItems().then((items) => items.map(normalizeItem));
  }'''
g = g[: m.start()] + new_del + g[m.end() :]

gb.write_text(g, encoding="utf-8", newline="\n")
print("groupbuy ok")
