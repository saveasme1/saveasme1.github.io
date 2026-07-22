import fs from "fs";

function validateCss(name) {
  const t = fs.readFileSync(name, "utf8");
  let braces = 0;
  let inStr = null;
  let inComment = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const n = t[i + 1];
    if (inComment) {
      if (c === "*" && n === "/") {
        inComment = false;
        i++;
      }
      continue;
    }
    if (!inStr && c === "/" && n === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === "{") braces++;
    if (c === "}") braces--;
    if (braces < 0) {
      console.log(name, "extra } near", i);
      return;
    }
  }
  console.log(name, "braces", braces, "inStr", inStr, "inComment", inComment);
}

validateCss("landing.css");
validateCss("handmade-reviews.css");
validateCss("site-nav.css");
validateCss("mypage.css");

// Check if landing :root vars exist
const land = fs.readFileSync("landing.css", "utf8");
console.log("vars", ["--ink", "--line", "--muted", "--brand", "--night"].map((v) => v + ":" + land.includes(v)));
