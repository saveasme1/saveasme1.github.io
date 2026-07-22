# -*- coding: utf-8 -*-
"""Wire GongbangTime into front JS + compact toolbar CSS."""
import os
import re

base = r"F:\공방171포폴프로젝트\_gh_fix"

# --- handmade-reviews.js ---
path = os.path.join(base, "handmade-reviews.js")
text = open(path, encoding="utf-8").read()
text = re.sub(
    r"  function formatDate\(value\) \{\n    const date = new Date\(value\);\n    return Number\.isNaN\(date\.getTime\(\)\)\n      \? \"\"\n      : new Intl\.DateTimeFormat\(\"ko-KR\", \{ year: \"numeric\", month: \"2-digit\", day: \"2-digit\" \}\)\.format\(date\);\n  \}",
    '  function formatDate(value) {\n    return window.GongbangTime ? window.GongbangTime.formatDate(value) : "";\n  }',
    text,
    count=1,
)
open(path, "w", encoding="utf-8").write(text)
print("handmade-reviews.js", "GongbangTime.formatDate" in text)

# --- landing-boards.js ---
path = os.path.join(base, "landing-boards.js")
text = open(path, encoding="utf-8").read()
text = re.sub(
    r"  const formatDate = \(value\) => \{\n    const parsed = new Date\(value\);\n    return Number\.isNaN\(parsed\.getTime\(\)\) \? \"\" : parsed\.toLocaleDateString\(\"ko-KR\"\);\n  \};",
    '  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");',
    text,
    count=1,
)
text = text.replace("const now = new Date().toISOString();", "const now = window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString();")
open(path, "w", encoding="utf-8").write(text)
print("landing-boards.js", "GongbangTime.formatDate" in text)

# --- board-page.js ---
path = os.path.join(base, "board-page.js")
text = open(path, encoding="utf-8").read()
text = re.sub(
    r"  const formatDate = \(value\) => \{\n    const parsed = new Date\(value\);\n    return Number\.isNaN\(parsed\.getTime\(\)\) \? \"\" : parsed\.toLocaleDateString\(\"ko-KR\"\);\n  \};",
    '  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");',
    text,
    count=1,
)
open(path, "w", encoding="utf-8").write(text)
print("board-page.js", "GongbangTime.formatDate" in text)

# --- admin/hub.js ---
path = os.path.join(base, "admin", "hub.js")
text = open(path, encoding="utf-8").read()
text = text.replace(
    '          ? `신청 ${new Date(createdAt).toLocaleString("ko-KR")}`',
    '          ? `신청 ${window.GongbangTime ? window.GongbangTime.formatDateTime(createdAt) : createdAt}`',
)
open(path, "w", encoding="utf-8").write(text)
print("hub.js", "formatDateTime" in text)

# --- admin/board-admin.js ---
path = os.path.join(base, "admin", "board-admin.js")
text = open(path, encoding="utf-8").read()
old_date_local = '''  const dateLocal = (value = new Date()) => {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };'''
new_date_local = '''  const dateLocal = (value = new Date()) =>
    window.GongbangTime ? window.GongbangTime.toDateTimeLocal(value) : "";'''
if old_date_local in text:
    text = text.replace(old_date_local, new_date_local)
text = text.replace(
    'date.textContent = `${new Date(item.publishedAt).toLocaleDateString("ko-KR")} · 이미지 ${[item.cover, ...item.images].filter(Boolean).length}장`;',
    'date.textContent = `${window.GongbangTime ? window.GongbangTime.formatDate(item.publishedAt) : ""} · 이미지 ${[item.cover, ...item.images].filter(Boolean).length}장`;',
)
text = text.replace(
    'els.editMode.textContent = item ? `POST · ${new Date(item.publishedAt).toLocaleDateString("ko-KR")}` : "NEW POST";',
    'els.editMode.textContent = item ? `POST · ${window.GongbangTime ? window.GongbangTime.formatDate(item.publishedAt) : ""}` : "NEW POST";',
)
text = text.replace(
    "publishedAt: new Date(els.publishedAtInput.value).toISOString(),",
    "publishedAt: window.GongbangTime ? window.GongbangTime.fromDateTimeLocal(els.publishedAtInput.value) : new Date(els.publishedAtInput.value).toISOString(),",
)
text = text.replace(
    "updatedAt: new Date().toISOString(),",
    "updatedAt: window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString(),",
)
text = text.replace(
    "publishedAt: new Date().toISOString(),",
    "publishedAt: window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString(),",
)
open(path, "w", encoding="utf-8").write(text)
print("board-admin.js updated")

# --- admin/admin.js ---
path = os.path.join(base, "admin", "admin.js")
text = open(path, encoding="utf-8").read()
old_fmt = '''  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function toDateTimeLocal(value) {
    const date = value ? new Date(value) : new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function fromDateTimeLocal(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }'''
new_fmt = '''  function formatDate(value) {
    return window.GongbangTime ? window.GongbangTime.formatDateShort(value) : "";
  }

  function toDateTimeLocal(value) {
    return window.GongbangTime ? window.GongbangTime.toDateTimeLocal(value) : "";
  }

  function fromDateTimeLocal(value) {
    return window.GongbangTime ? window.GongbangTime.fromDateTimeLocal(value) : new Date().toISOString();
  }'''
if old_fmt in text:
    text = text.replace(old_fmt, new_fmt)
    print("admin.js format helpers replaced")
else:
    print("admin.js format helpers NOT found")
# replace remaining new Date().toISOString() for timestamps used as display-ish updatedAt
# Keep most as-is but prefer GongbangTime.nowIso where simple
text = text.replace("new Date().toISOString()", "((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString())")
# careful - fromDateTimeLocal fallback already has it - double wrap ok functionally
open(path, "w", encoding="utf-8").write(text)

# --- portfolio.js ---
path = os.path.join(base, "portfolio.js")
text = open(path, encoding="utf-8").read()
text = text.replace(
    "const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, \"\");",
    'const stamp = window.GongbangTime ? window.GongbangTime.formatYmdCompact() : new Date().toISOString().slice(0, 10).replace(/-/g, "");',
)
text = text.replace(
    "`총 ${items.length}점 · ${new Date().toISOString().slice(0, 10)}`",
    "`총 ${items.length}점 · ${window.GongbangTime ? window.GongbangTime.formatYmd() : new Date().toISOString().slice(0, 10)}`",
)
open(path, "w", encoding="utf-8").write(text)
print("portfolio.js", "formatYmd" in text)

# --- admin/preview.js ---
path = os.path.join(base, "admin", "preview.js")
text = open(path, encoding="utf-8").read()
text = text.replace(
    "total.textContent = `총 ${items.length}점 · ${new Date().toISOString().slice(0, 10)}`;",
    "total.textContent = `총 ${items.length}점 · ${window.GongbangTime ? window.GongbangTime.formatYmd() : new Date().toISOString().slice(0, 10)}`;",
)
open(path, "w", encoding="utf-8").write(text)
print("preview.js done")

# --- CSS toolbar: keep one row with member info ---
css_path = os.path.join(base, "handmade-reviews.css")
css = open(css_path, encoding="utf-8").read()
old_media = '''@media (max-width: 880px) {
  .reviews-toolbar {
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    margin-top: 14px;
  }
  .reviews-toolbar input {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
  }
  .reviews-toolbar-actions {
    flex: 0 0 auto;
    width: auto;
    max-width: 46%;
    flex-wrap: nowrap;
    gap: 5px;
  }
  .reviews-toolbar button,
  .review-session > button {
    min-height: 34px;
    padding: 5px 10px;
    font-size: 11px;
  }
  .review-session-label {
    display: none;
  }
}'''
new_media = '''@media (max-width: 1024px) {
  .reviews-toolbar {
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 5px;
    margin-top: 12px;
  }
  .reviews-toolbar input {
    flex: 1 1 0;
    width: auto;
    min-width: 72px;
    height: 32px;
    padding: 0 8px;
    font-size: 12px;
  }
  .reviews-toolbar-actions {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    width: auto;
    max-width: none;
    flex-wrap: nowrap;
    gap: 4px;
    min-width: 0;
  }
  .reviews-toolbar button,
  .review-session > button {
    min-height: 32px;
    padding: 4px 8px;
    font-size: 10px;
    white-space: nowrap;
  }
  .review-session-label {
    display: inline-block;
    margin-left: 0;
    max-width: 88px;
    font-size: 9px;
    line-height: 1.2;
  }
}

@media (max-width: 480px) {
  .reviews-toolbar {
    gap: 4px;
  }
  .reviews-toolbar input {
    min-width: 56px;
    height: 30px;
    padding: 0 6px;
    font-size: 11px;
  }
  .reviews-toolbar button,
  .review-session > button {
    min-height: 30px;
    padding: 3px 6px;
    font-size: 9px;
  }
  .review-session-label {
    max-width: 64px;
    font-size: 8px;
  }
}'''
if old_media in css:
    css = css.replace(old_media, new_media)
    print("css toolbar replaced")
else:
    print("css toolbar block NOT found exact")
# also tighten base label
css = css.replace(
    """.review-session-label {
  margin-left: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  color: inherit;
  font-size: 11px;
}""",
    """.review-session-label {
  margin-left: 0;
  min-width: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  color: inherit;
  font-size: 11px;
  flex: 0 1 auto;
}""",
)
open(css_path, "w", encoding="utf-8").write(css)
print("done")
