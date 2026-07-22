async function main() {
  const data = await fetch(
    "https://hand-made.kr/shipping-data.json?_=" + Date.now(),
    { cache: "no-store" }
  ).then((r) => r.json());
  console.log("live items", data.items?.length, "has category", data.items?.[0]?.category);

  const js = await fetch(
    "https://hand-made.kr/shipping-board.js?v=20260722-mp20&_=" + Date.now(),
    { cache: "no-store" }
  ).then((r) => r.text());
  console.log("js has filteredItems", js.includes("function filteredItems"));
  console.log("js early return", /if \(!els\.panel \|\| !els\.grid\) return/.test(js));

  // simulate filter
  const items = data.items || [];
  const filtered = items.filter((item) => true);
  console.log("filter all", filtered.length);

  // check if publishedAt missing on many
  const noDate = items.filter((i) => !i.publishedAt).length;
  console.log("no publishedAt", noDate);
}
main();
