import json, urllib.request, ssl

ctx = ssl.create_default_context()

def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        body = r.read()
        return r.status, dict(r.headers), body

status, headers, body = get(
    "https://app.0-1.co.kr/api/handmade/v1/boards/notices/live?v=probe",
    {"User-Agent": "Mozilla/5.0", "Origin": "https://saveasme1.github.io"},
)
data = json.loads(body.decode("utf-8"))
print("api", status, "count", len(data.get("items") or []), "title", data["items"][0]["title"])

status, headers, body = get("https://saveasme1.github.io/notices-data.json")
git = json.loads(body.decode("utf-8"))
print("gitjson", status, "count", len(git.get("items") or []))

status, headers, body = get("https://saveasme1.github.io/notices.html?v=63")
html = body.decode("utf-8", "replace")
print("html", status)
print("noticesList", 'id="noticesList"' in html)
print("landing-boards", "landing-boards.js?v=" in html)
for token in ("gbcal63", "forceNuke", "boardWriteDialog", "boardDialog"):
    print(token, token in html)

# check if cover path returns 200 for a few
for item in data["items"][:3]:
    cover = item.get("cover") or ""
    try:
        req = urllib.request.Request(cover, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
            print("cover", item["id"], r.status)
    except Exception as e:
        print("cover_fail", item["id"], cover[:80], e)
