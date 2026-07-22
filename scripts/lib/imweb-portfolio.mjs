import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Jimp } from "jimp";

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function cleanHtmlText(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<img\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/<[^>]*$/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractImwebDetail(html) {
  const source = String(html || "");
  const boardStart = Math.max(
    source.lastIndexOf("<div class='board_txt_area fr-view'>"),
    source.lastIndexOf('<div class="board_txt_area fr-view">')
  );
  const boardEnd = boardStart >= 0 ? source.indexOf("comment_section", boardStart) : -1;
  let body =
    boardStart >= 0
      ? source.slice(boardStart, boardEnd > boardStart ? boardEnd : boardStart + 100_000)
      : "";

  // The last image in many posts is a Kakao consultation QR/banner, not a
  // product detail. Remove linked Kakao assets before collecting images.
  body = body.replace(
    /<a\b[^>]*href=["'][^"']*(?:qr\.kakao\.com|pf\.kakao\.com|open\.kakao\.com)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    ""
  );

  const imageUrls = [
    ...new Set(
      [...body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
        .map((match) => decodeEntities(match[1]))
        .filter((url) => /^https:\/\/cdn\.imweb\.me\/upload\//i.test(url))
    ),
  ];
  const og =
    source.match(/property=["']og:image["']\s+content=["']([^"']+)/i) ||
    source.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);

  return {
    coverUrl: og ? decodeEntities(og[1]) : imageUrls[0] || "",
    imageUrls,
    content: cleanHtmlText(body),
  };
}

export async function downloadOptimizedJpeg(url, outputPath, options = {}) {
  const maxSide = options.maxSide || 760;
  const quality = options.quality || 78;
  const response = await fetch(url, {
    headers: { "User-Agent": options.userAgent || "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const input = Buffer.from(await response.arrayBuffer());
  const image = await Jimp.read(input);
  const { width, height } = image.bitmap;
  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height);
    image.resize({
      w: Math.max(1, Math.round(width * scale)),
      h: Math.max(1, Math.round(height * scale)),
    });
  }
  const output = await image.getBuffer("image/jpeg", { quality });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  return {
    width: image.bitmap.width,
    height: image.bitmap.height,
    bytes: output.length,
  };
}
