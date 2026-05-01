import { RebirthSystem } from './src/games/three-kingdoms/engine/prestige/RebirthSystem.ts';
import { REBIRTH_CONDITIONS, REBIRTH_COOLDOWN_MS } from './src/games/three-kingdoms/core/prestige/index.ts';

function createMockDeps() {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: (...args: any[]) => {},
      off: () => {},
      removeAllListeners: () => {},
    } as any,
    config: { get: () => {}, set: () => {} } as any,
    registry: { register: () => {}, get: () => {}, getAll: () => {}, has: () => {}, unregister: () => {} } as any,
  };
}

let now = 1000000;
const sys = new RebirthSystem();
sys.init(createMockDeps());
sys.setCallbacks({
  castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
  heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
  totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
  prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
  campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
  achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
  nowProvider: () => now,
});
sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

console.log('Cooldown MS:', REBIRTH_COOLDOWN_MS);
const r1 = sys.executeRebirth();
console.log('First rebirth:', r1.success, 'count:', r1.newCount);

now += REBIRTH_COOLDOWN_MS + 1;
const r2 = sys.executeRebirth();
console.log('Second rebirth:', r2.success, 'reason:', r2.reason, 'count:', r2.newCount);
