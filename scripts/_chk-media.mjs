import https from "https";
import fs from "fs";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(Buffer.from(data, "utf8")));
      })
      .on("error", reject);
  });
}

const buf = await get("https://hand-made.kr/portfolio-board.css?v=20260722-mp11");
const text = buf.toString("utf8");
console.log("CRLF count", (text.match(/\r\n/g) || []).length);
console.log("double CR count", (text.match(/\r\r\n/g) || []).length);
console.log("lonely CR", (text.match(/\r(?!\n)/g) || []).length);

// Find media query blocks containing 196px
const idx = text.indexOf("grid-template-columns: 196px");
console.log("context around 196px:");
console.log(JSON.stringify(text.slice(idx - 200, idx + 100)));

// Check if @media properly wraps by naive brace walk from each @media
let i = 0;
while (true) {
  const at = text.indexOf("@media", i);
  if (at < 0) break;
  const open = text.indexOf("{", at);
  let depth = 0;
  let end = open;
  for (; end < text.length; end++) {
    if (text[end] === "{") depth++;
    else if (text[end] === "}") {
      depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }
  }
  const block = text.slice(at, end);
  const has196 = block.includes("196px");
  const hasCatsCol = /flex-direction:\s*column/.test(block);
  console.log(
    "media",
    block.slice(0, 40).replace(/\s+/g, " "),
    "len",
    block.length,
    "196",
    has196,
    "catsCol",
    hasCatsCol
  );
  i = end;
}

// Also check local file line endings
const local = fs.readFileSync("portfolio-board.css", "utf8");
console.log("local double CR", (local.match(/\r\r\n/g) || []).length);
console.log("local CRLF", (local.match(/\r\n/g) || []).length);
