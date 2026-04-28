/**
 * ACC 验收测试工具函数
 *
 * 提供统一的测试描述生成、严格断言和可见性检查工具。
 * 包含扩展断言：范围断言、浮点近似、异步断言、测试快照。
 */

// ── 基础工具 ──

export function accTest(id: string, description: string): string {
  return `[${id}] ${description}`;
}

export function assertStrict(condition: boolean, accId: string, message: string): void {
  if (!condition) throw new Error(`FAIL [${accId}]: ${message}`);
}

export function assertVisible(element: HTMLElement | null, accId: string, elementName: string): void {
  if (!element) throw new Error(`FAIL [${accId}]: ${elementName} 元素未找到`);
  if (element.style.display === 'none' || element.style.visibility === 'hidden')
    throw new Error(`FAIL [${accId}]: ${elementName} 元素存在但不可见`);
}

export function assertContainsText(element: HTMLElement | null, accId: string, expectedText: string): void {
  if (!element) throw new Error(`FAIL [${accId}]: 元素未找到，无法检查文本「${expectedText}」`);
  const actual = element.textContent || '';
  if (!actual.includes(expectedText))
    throw new Error(`FAIL [${accId}]: 期望包含文本「${expectedText}」，实际为「${actual}」`);
}

// ── 扩展断言工具 ──

/**
 * 断言值在指定范围内 [min, max]（闭区间）
 *
 * @param value   待检查的数值
 * @param min     最小值（含）
 * @param max     最大值（含）
 * @param id      ACC/FLOW 用例编号
 * @param msg     失败时的描述信息
 * @throws 当 value < min 或 value > max 时抛出
 *
 * @example
 * assertRange(playerLevel, 1, 100, 'FLOW-03-39', '武将等级应在1~100之间');
 */
export function assertRange(
  value: number,
  min: number,
  max: number,
  id: string,
  msg: string,
): void {
  if (value < min || value > max) {
    throw new Error(
      `FAIL [${id}]: ${msg} — 值 ${value} 不在范围 [${min}, ${max}] 内`,
    );
  }
}

/**
 * 断言两个浮点数近似相等（误差在 epsilon 以内）
 *
 * @param a       第一个浮点数
 * @param b       第二个浮点数
 * @param epsilon 允许的最大绝对误差（默认 1e-6）
 * @param id      ACC/FLOW 用例编号
 * @param msg     失败时的描述信息
 * @throws 当 |a - b| > epsilon 时抛出
 *
 * @example
 * assertFloatEqual(critRate, 0.25, 1e-4, 'FLOW-07-22', '暴击率应为25%');
 */
export function assertFloatEqual(
  a: number,
  b: number,
  epsilon: number,
  id: string,
  msg: string,
): void {
  const diff = Math.abs(a - b);
  if (diff > epsilon) {
    throw new Error(
      `FAIL [${id}]: ${msg} — |${a} - ${b}| = ${diff} > epsilon(${epsilon})`,
    );
  }
}

/**
 * 异步断言 — 在指定超时内等待断言函数成功
 *
 * 适合测试异步状态更新、定时器回调、Promise resolve 等场景。
 * 内部以 50ms 间隔轮询，直到 fn() 不抛异常或超时。
 *
 * @param fn      返回 void 的断言函数，内部可使用 assertStrict 等
 * @param timeout 最大等待时间（毫秒，默认 2000）
 * @param id      ACC/FLOW 用例编号
 * @param msg     超时时的描述信息
 * @throws 超时或 fn 持续抛异常时，抛出最后一次错误
 *
 * @example
 * await assertAsync(
 *   () => assertStrict(store.getState().loaded, 'ACC-01', '应已加载'),
 *   3000,
 *   'ACC-01-async',
 *   '数据加载超时',
 * );
 */
export async function assertAsync(
  fn: () => void,
  timeout: number,
  id: string,
  msg: string,
): Promise<void> {
  const interval = 50;
  const maxAttempts = Math.ceil(timeout / interval);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fn();
      return; // 断言通过
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `FAIL [${id}]: ${msg} — 超时 ${timeout}ms（最后错误: ${lastError?.message ?? '无'}）`,
  );
}

/**
 * 测试快照接口 — 用于前后对比
 */
export interface TestSnapshot {
  /** 快照时间戳 */
  timestamp: number;
  /** 快照标签（如 "before-upgrade"、"after-battle"） */
  label: string;
  /** 序列化的游戏状态数据 */
  data: Record<string, unknown>;
}

/**
 * 创建测试快照，用于前后对比
 *
 * 从模拟器/引擎实例中提取关键状态字段，生成可序列化的快照对象。
 * 配合 compareSnapshots() 可快速验证状态变化是否符合预期。
 *
 * @param sim  任意包含状态的对象（通常为 ThreeKingdomsEngine 或测试模拟器）
 * @param label 快照标签
 * @returns TestSnapshot 对象
 *
 * @example
 * const before = createTestSnapshot(engine, 'before-upgrade');
 * engine.upgradeBuilding('barracks');
 * const after = createTestSnapshot(engine, 'after-upgrade');
 * assertStrict(after.data.gold < before.data.gold, 'FLOW-02', '升级应消耗金币');
 */
export function createTestSnapshot(
  sim: Record<string, any>,
  label: string,
): TestSnapshot {
  const data: Record<string, unknown> = {};

  // 尝试提取常见状态字段（兼容不同引擎接口）
  const stateKeys = [
    'gold', 'food', 'wood', 'iron', 'gems',
    'playerLevel', 'playerExp', 'vipLevel',
    'buildings', 'generals', 'formations',
    'prestige', 'reputation', 'arenaRank',
    'currentStage', 'maxStage',
    'resources', 'inventory',
  ];

  for (const key of stateKeys) {
    if (sim[key] !== undefined) {
      // 对数组/对象做深拷贝，避免引用共享
      const val = sim[key];
      if (Array.isArray(val)) {
        data[key] = JSON.parse(JSON.stringify(val));
      } else if (typeof val === 'object' && val !== null) {
        data[key] = JSON.parse(JSON.stringify(val));
      } else {
        data[key] = val;
      }
    }
  }

  // 如果 sim 有 getState() 方法，也提取
  if (typeof sim.getState === 'function') {
    try {
      const state = sim.getState();
      if (state && typeof state === 'object') {
        data._rawState = JSON.parse(JSON.stringify(state));
      }
    } catch {
      // getState() 可能不可用，忽略
    }
  }

  return {
    timestamp: Date.now(),
    label,
    data,
  };
}

/**
 * 比较两个快照，返回差异字段列表
 *
 * @param before  操作前快照
 * @param after   操作后快照
 * @returns 变化的字段名数组
 *
 * @example
 * const diff = compareSnapshots(before, after);
 * assertStrict(diff.includes('gold'), 'FLOW-02', '升级应改变金币');
 * assertStrict(!diff.includes('playerLevel'), 'FLOW-02', '升级建筑不应改变玩家等级');
 */
export function compareSnapshots(
  before: TestSnapshot,
  after: TestSnapshot,
): string[] {
  const changed: string[] = [];
  const allKeys = Array.from(new Set([
    ...Object.keys(before.data),
    ...Object.keys(after.data),
  ]));

  for (const key of allKeys) {
    const bv = before.data[key];
    const av = after.data[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changed.push(key);
    }
  }

  return changed;
}
