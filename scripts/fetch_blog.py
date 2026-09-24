"""네이버 블로그 RSS → data/blog.json

GitHub Actions에서 주기적으로 실행되어, 블로그 최신 글 목록을
앱 홈 화면의 '최신 작업 일지'에 표시할 수 있게 저장합니다.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

BLOG_ID = "athomecarcare"
RSS_URL = f"https://rss.blog.naver.com/{BLOG_ID}.xml"
OUT = Path(__file__).resolve().parent.parent / "data" / "blog.json"
MAX_ITEMS = 12


def text_of(el, tag):
    node = el.find(tag)
    return (node.text or "").strip() if node is not None and node.text else ""


def clean_summary(html):
    body = re.sub(r"<[^>]+>", " ", html or "")
    body = unescape(re.sub(r"\s+", " ", body)).strip()
    return body[:110] + ("…" if len(body) > 110 else "")


def first_image(html):
    m = re.search(r'<img[^>]+src="([^"]+)"', html or "")
    return unescape(m.group(1)) if m else ""


def main():
    req = urllib.request.Request(RSS_URL, headers={"User-Agent": "Mozilla/5.0 (athome-carcare blog sync)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        raw = res.read()

    root = ET.fromstring(raw)
    items = []
    for it in root.iter("item"):
        desc = text_of(it, "description")
        pub = text_of(it, "pubDate")
        try:
            date = parsedate_to_datetime(pub).strftime("%Y-%m-%d")
        except Exception:
            date = ""
        link = text_of(it, "link").split("?")[0]
        items.append({
            "title": text_of(it, "title"),
            "link": link,
            "date": date,
            "category": text_of(it, "category"),
            "summary": clean_summary(desc),
            "thumb": first_image(desc),
        })
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        print("RSS에 글이 없습니다. 기존 파일을 유지합니다.")
        return 0

    data = {"blog": f"https://blog.naver.com/{BLOG_ID}", "posts": items}
    new = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    if new == old:
        print("변경 없음")
        return 0
    OUT.write_text(new, encoding="utf-8")
    print(f"{len(items)}개 글 저장")
    return 0


if __name__ == "__main__":
    sys.exit(main())
