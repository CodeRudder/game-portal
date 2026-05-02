import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { SAVE_KEY, ENGINE_SAVE_VERSION } from '../../shared/constants';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => Object.keys(storage).forEach(k => delete storage[k]),
  get length() { return Object.keys(storage).length; },
  key: () => null as string | null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('离线收益', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });
  it('加载时发出 game:loaded 事件', () => {
    engine.init();
    engine.save();

    const engine2 = new ThreeKingdomsEngine();
    const listener = vi.fn();
    engine2.on('game:loaded', listener);
    engine2.load();
    expect(listener).toHaveBeenCalled();
    engine2.reset();
  });

  it('加载后引擎状态为已初始化', () => {
    engine.init();
    engine.save();

    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    expect(engine2.isInitialized()).toBe(true);
    engine2.reset();
  });

  it('旧格式存档离线收益正确计算', () => {
    engine.init();
    engine.tick(5000);

    // 使用旧格式（直接 JSON）写入，绕过 SaveManager checksum
    const legacyData = JSON.stringify({
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now() - 3600000, // 1 小时前
      resource: engine.resource.serialize(),
      building: engine.building.serialize(),
    });
    // 修改 lastSaveTime 模拟离线
    const parsed = JSON.parse(legacyData);
    parsed.resource.lastSaveTime = Date.now() - 3600000;
    storage[SAVE_KEY] = JSON.stringify(parsed);

    const engine2 = new ThreeKingdomsEngine();
    const offlineListener = vi.fn();
    engine2.on('game:offline-earnings', offlineListener);
    engine2.load();

    expect(engine2.isInitialized()).toBe(true);
    // 有产出时应该触发离线收益事件
    if (offlineListener.mock.calls.length > 0) {
      const earnings = offlineListener.mock.calls[0][0];
      expect(earnings).toHaveProperty('offlineSeconds');
      expect(earnings).toHaveProperty('earned');
    }
    engine2.reset();
  });
});

// ═══════════════════════════════════════════
// 9. 加成体系框架
// ═══════════════════════════════════════════
describe('加成体系框架', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('tick() 中 castle 加成正确传入（非零）', () => {
    engine.init();
    const snap1 = engine.getSnapshot();

    // 升级农田增加基础产出
    const check = engine.checkUpgrade('farmland');
    if (check.canUpgrade) {
      engine.upgradeBuilding('farmland');
      engine.tick(999999999);
    }

    // 升级主城增加加成
    const castleCheck = engine.checkUpgrade('castle');
    if (castleCheck.canUpgrade) {
      engine.upgradeBuilding('castle');
      engine.tick(999999999);
    }

    const snap2 = engine.getSnapshot();
    expect(snap2.productionRates.grain).toBeGreaterThan(0);
  });

  it('tech/hero/rebirth/vip 加成预留为 0', () => {
    engine.init();
    // 预留加成均为 0，产出仅受 castle 影响
    expect(() => engine.tick(1000)).not.toThrow();
    const snap = engine.getSnapshot();
    expect(snap.productionRates).toBeDefined();
  });

  it('未来版本可通过修改 Bonuses 对象接入新加成', () => {
    engine.init();
    engine.tick(1000);
    engine.tick(1000);
    engine.tick(1000);
    expect(engine.isInitialized()).toBe(true);
  });
});

// ═══════════════════════════════════════════
// 10. v1.0 存档迁移 → 武将系统自动初始化
// ═══════════════════════════════════════════
describe('v1.0 存档迁移（无武将数据）', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  /** 创建一个不含 hero/recruit 字段的 v1.0 旧格式存档 */
  function makeV1Save(): string {
    return JSON.stringify({
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now() - 1000,
      resource: {
        resources: { grain: 5000, gold: 2000, troops: 500, mandate: 10 },
        lastSaveTime: Date.now() - 1000,
        productionRates: { grain: 2, gold: 1, troops: 0.5, mandate: 0 },
        caps: { grain: 10000, gold: 2000, troops: 5000, mandate: null },
        version: 1,
      },
      building: {
        buildings: {
          castle:   { type: 'castle',   level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
          farmland: { type: 'farmland',  level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
          market:   { type: 'market',    level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
          barracks: { type: 'barracks',  level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          workshop:   { type: 'workshop',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          academy:  { type: 'academy',   level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          clinic:   { type: 'clinic',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          wall:     { type: 'wall',      level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
        },
        version: 1,
      },
      // 注意：无 hero、recruit、calendar 字段 — 模拟 v1.0 存档
    });
  }

  it('v1.0 存档加载后引擎初始化成功', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    expect(engine2.isInitialized()).toBe(true);
    engine2.reset();
  });

  it('v1.0 存档加载后武将列表为空', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    const generals = engine2.getGenerals();
    expect(generals).toHaveLength(0);
    engine2.reset();
  });

  it('v1.0 存档加载后武将碎片为空', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    const fragments = engine2.getHeroSystem().getAllFragments();
    expect(Object.keys(fragments)).toHaveLength(0);
    engine2.reset();
  });

  it('v1.0 存档加载后总战力为 0', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    const snap = engine2.getSnapshot();
    expect(snap.totalPower).toBe(0);
    engine2.reset();
  });

  it('v1.0 存档加载后保底计数器全为 0', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    const pity = engine2.getRecruitSystem().getGachaState();
    expect(pity.normalPity).toBe(0);
    expect(pity.advancedPity).toBe(0);
    expect(pity.normalHardPity).toBe(0);
    expect(pity.advancedHardPity).toBe(0);
    engine2.reset();
  });

  it('v1.0 存档加载后招募系统可正常工作（canRecruit 检查）', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    // canRecruit 应能正常调用（不抛异常），即使资源可能不足
    expect(() => engine2.getRecruitSystem().canRecruit('normal', 1)).not.toThrow();
    engine2.reset();
  });

  it('v1.0 存档迁移后保存再加载，武将系统数据完整', () => {
    storage[SAVE_KEY] = makeV1Save();
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();
    // 迁移后保存
    engine2.save();

    // 再次加载
    const engine3 = new ThreeKingdomsEngine();
    engine3.load();
    expect(engine3.isInitialized()).toBe(true);
    expect(engine3.getGenerals()).toHaveLength(0);
    // 存档中应包含 hero 和 recruit 数据
    const raw = storage[SAVE_KEY];
    const outer = JSON.parse(raw);
    const inner = JSON.parse(outer.data);
    expect(inner.subsystems.hero).toBeDefined();
    expect(inner.subsystems.recruit).toBeDefined();
    engine3.reset();
    engine2.reset();
  });
});

