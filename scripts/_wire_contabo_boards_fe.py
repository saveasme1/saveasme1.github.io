#!/usr/bin/env python3
"""Wire Contabo board publish/delete into FE writers."""
from pathlib import Path
import re

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")

# ---- landing-boards.js: notices use Contabo like shipping ----
lb = ROOT / "landing-boards.js"
t = lb.read_text(encoding="utf-8")

# Unify delete for shipping+notices (and any Contabo board)
old_del = '''        if (type === "shipping") {
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'shipping delete start',data:{id,title:state.current?.title||''},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const result = await api(`/admin/shipping/${encodeURIComponent(id)}`, { method: "DELETE" });
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'shipping delete ok',data:{id,removed:result?.removed,liveCount:result?.liveCount,serverMs:result?.ms,totalMs:Date.now()-startedAt,via:result?.via},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          state.shipping = (state.shipping || []).filter((item) => item.id !== id);
          window.removeGongbangShippingItem?.(id);
          closeDetail();
          if (typeof window.showGongbangToast === "function") {
            window.showGongbangToast("게시글을 삭제했습니다.", { tone: "success", duration: 1800 });
          }
          return;
        }'''

new_del = '''        if (type === "shipping" || type === "notices") {
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'board delete start',data:{type,id,title:state.current?.title||''},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const result = await api(`/admin/boards/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: "DELETE" });
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'board delete ok',data:{type,id,removed:result?.removed,liveCount:result?.liveCount,serverMs:result?.ms,totalMs:Date.now()-startedAt,via:result?.via},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          state[type] = (state[type] || []).filter((item) => item.id !== id);
          if (type === "shipping") window.removeGongbangShippingItem?.(id);
          else renderList(type);
          closeDetail();
          if (typeof window.showGongbangToast === "function") {
            window.showGongbangToast("게시글을 삭제했습니다.", { tone: "success", duration: 1800 });
          }
          return;
        }'''

if old_del not in t:
    raise SystemExit("landing delete block not found")
t = t.replace(old_del, new_del)

# Replace submitWriter shipping-only Contabo path with shared Contabo for shipping+notices
# Find the big if (type === "shipping") { assets... } else { git path }
# Simpler: change status and make notices also use Contabo publish mirroring shipping block.

# Change else branch for notices to Contabo — replace entire if shipping / else structure after status line.

marker = '      writer.status.textContent = type === "shipping" ? "압축 중…" : "올리는 중…";'
if marker not in t:
    raise SystemExit("status marker missing")

# Extract from if (type === "shipping") { const assets through end of shipping block before } else {
start = t.find("      if (type === \"shipping\") {\n        const assets = [];")
if start < 0:
    raise SystemExit("shipping assets block missing")
# find matching else for submitWriter - the "} else {\n      let cover"
else_idx = t.find("      } else {\n      let cover = writer.cover.path", start)
if else_idx < 0:
    raise SystemExit("else cover block missing")
# find end of else before clearWriterMedia - look for `      }\n      clearWriterMedia`
end_else = t.find("      }\n      clearWriterMedia();", else_idx)
if end_else < 0:
    raise SystemExit("end else missing")
end_else += len("      }")

new_submit = r'''
      writer.status.textContent = "압축 중…";
      const assets = [];
      if (writer.cover.file) {
        const prepared = await compressImageFile(writer.cover.file);
        if (prepared.size > 8 * 1024 * 1024) {
          throw new Error(`${writer.cover.file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
        }
        assets.push({
          role: "cover",
          mime: prepared.type || "image/jpeg",
          content: bytesToBase64(new Uint8Array(await prepared.arrayBuffer())),
        });
      } else if (!writer.cover.path) {
        throw new Error("대표 이미지를 선택해 주세요.");
      }
      for (let index = 0; index < writer.details.length; index += 1) {
        const detail = writer.details[index];
        if (!detail.file) continue;
        const prepared = await compressImageFile(detail.file);
        if (prepared.size > 8 * 1024 * 1024) {
          throw new Error(`${detail.file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
        }
        assets.push({
          role: "detail",
          index: index + 1,
          mime: prepared.type || "image/jpeg",
          content: bytesToBase64(new Uint8Array(await prepared.arrayBuffer())),
        });
      }

      writer.status.textContent = "저장 중…";
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-test',hypothesisId:'S',location:'landing-boards.js:submitWriter',message:'board contabo publish start',data:{type,id,category,publishedAt,assetCount:assets.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const published = await api(`/admin/boards/${encodeURIComponent(type)}/publish`, {
        method: "PUT",
        body: JSON.stringify({
          item: {
            id,
            title,
            content,
            cover: writer.cover.path || "",
            images: (writer.details || []).map((d) => d.path).filter(Boolean),
            publishedAt,
            category,
            origin: "admin",
          },
          assets,
        }),
      });
      const item = published.item;
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-test',hypothesisId:'S',location:'landing-boards.js:submitWriter',message:'board contabo publish ok',data:{type,id:item?.id,cover:item?.cover,liveCount:published?.liveCount,serverMs:published?.ms,totalMs:Date.now()-submitStartedAt,via:published?.via},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      state[type] = [item, ...(state[type] || []).filter((entry) => entry.id !== id)];
      if (boards[type]) boards[type].page = 1;
      if (type === "shipping") {
        window.openGongbangShippingPanel?.();
        window.prependGongbangShippingItem?.(item, { clearFilters: true });
      } else {
        renderList(type);
      }
'''

# Replace from status marker through end_else, but status marker is before if shipping - find from status
status_idx = t.find(marker)
# Also remove the earlier `if (type === "shipping") { const category...` stays
# Replace from marker through end_else
t = t[:status_idx] + new_submit + t[end_else:]
lb.write_text(t, encoding="utf-8", newline="\n")
print("landing-boards ok")
