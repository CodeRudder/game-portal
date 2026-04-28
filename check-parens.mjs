import fs from "fs";
const c = fs.readFileSync("src/games/three-kingdoms/tests/acc/FLOW-08-商店Tab集成.test.tsx", "utf8");
let p = 0, s = false, sc = "";
for (let i = 0; i < c.length; i++) {
  const ch = c[i];
  if (!s) {
    if (ch === "'" || ch === '"' || ch === '`') { s = true; sc = ch; }
    else if (ch === '(') p++;
    else if ( ch === ')') p--;
  } else {
    if (ch === '\\') i++;
    else if (ch === sc) s = false;
  }
}
console.log("parens:", p);
