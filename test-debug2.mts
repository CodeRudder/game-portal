import { RebirthSystem } from './src/games/three-kingdoms/engine/prestige/RebirthSystem.ts';
import { REBIRTH_CONDITIONS } from './src/games/three-kingdoms/core/prestige/index.ts';

function createMockDeps() {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: (...args: any[]) => { console.log('emit:', args); },
      off: () => {},
      removeAllListeners: () => {},
    } as any,
    config: { get: () => {}, set: () => {} } as any,
    registry: { register: () => {}, get: () => {}, getAll: () => {}, has: () => {}, unregister: () => {} } as any,
  };
}

const sys = new RebirthSystem();
sys.init(createMockDeps());
sys.setCallbacks({
  castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
  heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
  totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
  prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
});
sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

const check = sys.checkRebirthConditions();
console.log('canRebirth:', check.canRebirth);
for (const [k, v] of Object.entries(check.conditions)) {
  console.log(`  ${k}: met=${(v as any).met}`, JSON.stringify(v));
}
