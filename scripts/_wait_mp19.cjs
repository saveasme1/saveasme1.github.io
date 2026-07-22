const https=require("https"); const {execSync}=require("child_process");
function get(u){return new Promise((res,rej)=>https.get(u,{headers:{"Cache-Control":"no-cache"}},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(d));}).on("error",rej));}
(async()=>{
 for(let i=0;i<10;i++){
  let st=""; try{st=execSync("gh api repos/saveasme1/gongbang171_temp/pages --jq .status",{encoding:"utf8"}).trim();}catch{}
  const h=await get("https://hand-made.kr/landing.html?t="+Date.now());
  const ver=(h.match(/landing\.css\?v=([^"]+)/)||[])[1];
  const c=await get("https://hand-made.kr/landing.css?v="+ver+"&t="+Date.now());
  const ok=c.includes("min-height: 52vh") && c.includes("MO/TB detail");
  console.log({i,st,ver,ok});
  if(ok && st==="built") break;
  await new Promise(r=>setTimeout(r,7000));
 }
})();
