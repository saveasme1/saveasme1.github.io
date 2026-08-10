import re
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
req = urllib.request.Request("https://imginn.com/chanel/", headers={"User-Agent": UA})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
print("len", len(html))
print("cdninstagram", html.count("cdninstagram"))
print("fbcdn", html.count("fbcdn"))
print("avatar", html.lower().count("avatar"))
print("profile_pic", html.count("profile_pic"))
# print nearby avatar
idx = html.lower().find("avatar")
print("around avatar:", html[max(0, idx - 100) : idx + 300] if idx >= 0 else "none")
# all img src
srcs = re.findall(r'<img[^>]+src="([^"]+)"', html, re.I)
print("img count", len(srcs))
for s in srcs[:20]:
    print("IMG", s[:160])
# any scontent
for m in re.finditer(r'https?://[^"\s<>]+scontent[^"\s<>]+', html):
    print("SCONTENT", m.group(0)[:180])
    break
