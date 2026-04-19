import { BuildingSystem } from "./src/games/three-kingdoms/engine/building/BuildingSystem.ts";
import { BUILDING_DEFS, BUILDING_MAX_LEVELS } from "./src/games/three-kingdoms/engine/building/building-config.ts";
import { BUILDING_TYPES, BUILDING_LABELS } from "./src/games/three-kingdoms/engine/building/building.types.ts";

const sys = new BuildingSystem();
console.log("主城等级:", sys.getCastleLevel());
console.log("农田等级:", sys.getLevel("farmland"));
console.log("市集解锁:", sys.isUnlocked("market"));
console.log("城墙解锁:", sys.isUnlocked("wall"));

const data = sys.serialize();
console.log("序列化版本:", data.version);

for (const t of BUILDING_TYPES) {
  const def = BUILDING_DEFS[t];
  const max = BUILDING_MAX_LEVELS[t];
  console.log(BUILDING_LABELS[t] + ": 上限=" + max + " 表长=" + def.levelTable.length + " 匹配=" + (def.levelTable.length === max));
}
console.log("农田Lv1产出:", sys.getProduction("farmland"));
console.log("主城加成%:", sys.getCastleBonusPercent());
console.log("总产出:", JSON.stringify(sys.calculateTotalProduction()));
console.log("Done");
