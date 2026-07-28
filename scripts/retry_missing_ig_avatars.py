"""Retry failed IG profile avatars with longer delays (copy as-is from imginn)."""
import re
import time
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
OUT = Path(r"F:/공방171포폴프로젝트/_pwa_push/wear-media/avatars/ig-real")
AV = Path(r"F:/공방171포폴프로젝트/_pwa_push/wear-media/avatars")
OUT.mkdir(parents=True, exist_ok=True)

HANDLES = [
    "bulgari",
    "lofficielmalaysia",
    "joopiter",
    "legitgrails",
    "archivethreads",
    "drbengee",
    "imsaintkatherine",
    "amandagorman",
    "hermesselebriti",
    "saveasme1",
]


def fetch(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,image/*,*/*",
            "Referer": "https://imginn.com/",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return res.status, res.read()
    except Exception as e:
        code = getattr(e, "code", 0) or 0
        return int(code), b""


def pick_avatar_url(html: str) -> str:
    patterns = [
        r'<img[^>]+src="(https://s\d+\.imginn\.com/[^"]+t51\.[^"]+-19/[^"]+)"',
        r'alt="[^"]*profile avatar"[^>]*src="(https://[^"]+)"',
        r'src="(https://[^"]+)"[^>]*alt="[^"]*profile avatar"',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I)
        if m:
            return m.group(1).replace("&#38;", "&").replace("&amp;", "&")
    imgs = re.findall(r'<img[^>]+src="(https://s\d+\.imginn\.com/[^"]+)"', html, re.I)
    for u in imgs:
        if "t51." in u and "-19/" in u:
            return u.replace("&#38;", "&").replace("&amp;", "&")
    if imgs:
        return imgs[0].replace("&#38;", "&").replace("&amp;", "&")
    return ""


def main():
    ok = 0
    for i, h in enumerate(HANDLES):
        if i:
            time.sleep(8)
        print(f"== @{h}", flush=True)
        code, body = fetch(f"https://imginn.com/{h}/")
        if code != 200:
            print(f"  page {code}", flush=True)
            continue
        url = pick_avatar_url(body.decode("utf-8", "replace"))
        if not url:
            print("  no avatar url", flush=True)
            continue
        big = re.sub(r"stp=dst-jpg_s150x150", "stp=dst-jpg_s640x640", url)
        for candidate in (big, url):
            c, img = fetch(candidate)
            if c == 200 and len(img) > 800:
                (OUT / f"{h}.jpg").write_bytes(img)
                (AV / f"{h}.jpg").write_bytes(img)
                print(f"  OK {len(img)}B", flush=True)
                ok += 1
                break
        else:
            print("  FAIL download", flush=True)
    print(f"DONE {ok}/{len(HANDLES)}", flush=True)


if __name__ == "__main__":
    main()
