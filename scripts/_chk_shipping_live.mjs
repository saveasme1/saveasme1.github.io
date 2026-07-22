const html = await fetch(
  "https://hand-made.kr/landing.html?_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log("bust", [...new Set(html.match(/20260722-mp\d+/g) || [])]);
console.log("shipping-board", html.includes("shipping-board.js"));
console.log("shipCats", html.includes("shipCats"));
console.log("shipCal", html.includes('id="shipCal"'));
console.log("shipping-inline", html.includes("shipping-inline"));

const js = await fetch(
  "https://hand-made.kr/shipping-board.js?v=20260722-mp20&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
try {
  new Function(js);
  console.log("live shipping-board SYNTAX OK", js.length);
} catch (e) {
  console.log("live shipping-board FAIL", e.message, "len", js.length);
}
