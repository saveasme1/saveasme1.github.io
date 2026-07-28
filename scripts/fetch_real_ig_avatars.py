import re
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
OUT = Path(r"F:/공방171포폴프로젝트/_pwa_push/wear-media/avatars/ig-real")
AV = Path(r"F:/공방171포폴프로젝트/_pwa_push/wear-media/avatars")
OUT.mkdir(parents=True, exist_ok=True)

HANDLES = [
    "chanel", "chanelofficial", "cartier", "vancleefarpels", "tiffanyandco",
    "bvlgari", "bulgari", "chaumetofficial", "chromeheartsofficial", "gucci",
    "hermes", "prada", "fredjewelry", "louisvuitton", "damianiofficial",
    "boucheron", "highsnobiety", "esquiresg", "diamondsindubaii",
    "lofficielmalaysia", "joopiter", "legitgrails", "archivethreads",
    "designerarchives", "drbengee", "imsaintkatherine", "amandagorman",
    "hermesselebriti", "saveasme1",
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
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read()
    except Exception as e:
        code = getattr(getattr(e, "code", None), "real", None) or getattr(e, "code", 0) or 0
        return int(code or 0), b""


def pick_avatar_url(html: str) -> str:
    # Prefer explicit avatar img (imginn proxies official IG profile media).
    patterns = [
        r'<img[^>]+src="(https://s\d+\.imginn\.com/[^"]+t51\.[^"]+-19/[^"]+)"',
        r'<img[^>]+src="(https://[^"]+)"[^>]*alt="[^"]*profile avatar"',
        r'profile avatar"[^>]*>\s*</a>.*?src="(https://[^"]+)"',
        r'<img[^>]+src="(https://s\d+\.imginn\.com/[^"]+)"[^>]*alt="[^"]*avatar"',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I | re.S)
        if m:
            return m.group(1).replace("&#38;", "&").replace("&amp;", "&")
    # first img on profile pages is usually DP
    imgs = re.findall(r'<img[^>]+src="(https://s\d+\.imginn\.com/[^"]+)"', html, re.I)
    for u in imgs:
        if "t51." in u and "-19/" in u:
            return u.replace("&#38;", "&").replace("&amp;", "&")
    if imgs:
        return imgs[0].replace("&#38;", "&").replace("&amp;", "&")
    return ""


def upgrade_size(url: str) -> str:
    # try larger crop if s150 present
    return re.sub(r"stp=dst-jpg_s150x150", "stp=dst-jpg_s640x640", url)


def main():
    ok = 0
    for h in HANDLES:
        print(f"== @{h}", flush=True)
        code, body = fetch(f"https://imginn.com/{h}/")
        if code != 200:
            print(f"  page {code}", flush=True)
            continue
        html = body.decode("utf-8", "replace")
        url = pick_avatar_url(html)
        if not url:
            print("  no avatar url", flush=True)
            continue
        for candidate in (upgrade_size(url), url):
            c, img = fetch(candidate)
            if c == 200 and len(img) > 800 and (img[:3] == b"\xff\xd8\xff" or img[:8] == b"\x89PNG\r\n\x1a\n" or b"JFIF" in img[:32] or True):
                # accept jpeg/webp/png proxies
                if len(img) < 800:
                    continue
                (OUT / f"{h}.jpg").write_bytes(img)
                (AV / f"{h}.jpg").write_bytes(img)
                print(f"  OK {len(img)}B {candidate[:90]}", flush=True)
                ok += 1
                break
        else:
            print(f"  FAIL download {url[:90]}", flush=True)
    print(f"DONE {ok}/{len(HANDLES)}", flush=True)


if __name__ == "__main__":
    main()
