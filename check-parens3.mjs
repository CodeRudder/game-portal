import fs from "fs";
const c = fs.readFileSync("src/games/three-kingdoms/tests/acc/FLOW-08-商店Tab集成.test.tsx", "utf8");
const lines = c.split("\n");
let p = 0, s = false, sc = "";
for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (!s) {
      if (ch === "'" || ch === '"' || ch === '`') { s = true; sc = ch; }
      else if (ch === '(') { p++; }
      else if (ch === ')') p--;
    } else {
      if (ch === '\\') i++;
      else if (ch === sc) s = false;
    }
  }
  if (li < 80 && p !== 0) {
    console.log(`Line ${li+1}: parens=${p}`);
  }
}
console.log("Final parens:", p);
