import fs from "fs";

const files = [
  "portfolio-data.json",
  "portfolio-draft.json",
  "reviews-data.json",
  "shipping-data.json",
  "shipping-draft.json",
  "notices-data.json",
  "notices-draft.json",
];

const rules = [
  [/GONGBANG\s*171/gi, "HERITAGE"],
  [/Gongbang\s*171/gi, "Heritage"],
  [/gongbang\s*171/gi, "Heritage"],
  [/공방\s*171/g, "헤리티지"],
];

let total = 0;
for (const name of files) {
  if (!fs.existsSync(name)) {
    console.log("skip", name);
    continue;
  }
  let text = fs.readFileSync(name, "utf8");
  let hits = 0;
  for (const [re, to] of rules) {
    text = text.replace(re, () => {
      hits += 1;
      return to;
    });
  }
  fs.writeFileSync(name, text);
  total += hits;
  console.log(name, hits);
}
console.log("total", total);
