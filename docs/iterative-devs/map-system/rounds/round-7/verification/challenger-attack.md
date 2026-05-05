# R7 Challenger Attack Report

**攻击时间**: 2026-05-04
**攻击角色**: Challenger
**攻击对象**: R7 Builder Manifest — 技术债务修复与系统集成
**Builder声称**: 75/75 PASS, 23个功能点全部完成, Phase 2/3通过"代码审查"验证

---

## 摘要

经过逐行代码审计、测试执行验证和集成链路追踪，共发现 **9个有效质疑**（其中 **P0: 2**, **P1: 4**, **P2: 3**）。核心问题：Phase 2 系统集成存在资源泄漏（`siegeBattleAnimSystem.destroy()` 遗漏），Phase 3 Canvas 渲染存在致命数据断链（`defenseRatio` 永远为 1.0），整体集成流程缺乏端到端测试覆盖。

---

## P0 级攻击（致命 — 直接导致运行时缺陷）

### P0-1: `siegeBattleAnimSystem.destroy()` 在 WorldMapTab cleanup 中被遗漏

**Builder声称** (R7-12): `siegeBattleSystem.destroy()` 在 cleanup 中调用 (WorldMapTab.tsx:657-658)

**代码证据**:
```typescript
// WorldMapTab.tsx:655-661 — useEffect cleanup
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  siegeBattleSystem.destroy();         // <— SiegeBattleSystem 销毁了
  siegeBattleSystemRef.current = null;
  eventBus.off('march:arrived', handleArrived);
  eventBus.off('march:cancelled', handleCancelled);
  // *** siegeBattleAnimSystem.destroy() 在哪里？ ***
};
```

**实际情况**:
- `siegeBattleAnimSystem` 在 line 401 创建，line 402 init()，line 403 存入 ref
- 但 cleanup 函数中 **完全没有调用** `siegeBattleAnimSystem.destroy()`
- `siegeBattleAnimSystem` 在 init() 中通过 `this.deps.eventBus.on()` 注册了 `battle:started` 和 `battle:completed` 两个事件监听器
- 这些监听器持有 `siegeBattleAnimSystem` 的闭包引用，而 `siegeBattleAnimSystem` 又持有 animations Map 等大对象

**后果**:
1. 组件卸载后，`siegeBattleAnimSystem` 上的两个事件监听器不会被移除
2. 由于 WorldMapTab 使用的是局部 `eventBus`（非全局），这个泄漏会在 useEffect 重新执行时累积
3. React StrictMode 下 useEffect 会执行两次，每次都会创建新的系统实例但只清理 SiegeBattleSystem，AnimationSystem 的监听器会残留
4. `siegeBattleAnimRef.current` 也未在 cleanup 中置 null，导致过期引用

**结论**: Builder R7-12 的验证方法"代码审查"显然没有审查完整。SiegeBattleSystem 的 destroy 被正确调用了，但 SiegeBattleAnimationSystem 的 destroy 被完全遗漏。

---

### P0-2: `updateBattleProgress()` 从未被生产代码调用 — defenseRatio 永远为 1.0

**Builder声称** (R7-17): 城防HP条实时更新 (PixelWorldMap.tsx:375-522)

**代码证据**:

1. `SiegeBattleAnimationSystem.updateBattleProgress()` 是唯一设置 `defenseRatio`（非初始值）的方法:
```typescript
// SiegeBattleAnimationSystem.ts:377-381
updateBattleProgress(taskId: string, defenseRatio: number): void {
  const anim = this.animations.get(taskId);
  if (!anim) return;
  anim.defenseRatio = Math.max(0, Math.min(1, defenseRatio));
}
```

2. 全局搜索 `updateBattleProgress` 的调用方:
```
src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts    — 方法定义
src/games/three-kingdoms/engine/map/__tests__/SiegeBattleAnimationSystem.test.ts  — 测试调用(6次)
```

**没有任何生产代码调用此方法。**

3. WorldMapTab.tsx 中 rAF 循环:
```typescript
// WorldMapTab.tsx:628-632
siegeBattleSystem.update(dt);        // 城防衰减, 但结果不传给 AnimationSystem
siegeBattleAnimSystem.update(dt);    // 驱动 phase 转换, 但 defenseRatio 永远是初始值 1.0
```

4. PixelWorldMap.tsx 中城防血条渲染:
```typescript
// PixelWorldMap.tsx:511-514
const ratio = anim.defenseRatio;   // 始终为 1.0 (初始值)
const hpColor = ratio > 0.5 ? '#44CC44' : ...   // 始终显示绿色满血
ctx.fillRect(barX, barY, barWidth * ratio, barHeight);  // 始终绘制满血条
```

**后果**:
- 用户在屏幕上看到的城防血条永远是满的（绿色 100%），直到战斗突然结束
- 这直接违背了 R7-17 "城防HP条实时更新" 的声明
- SiegeBattleSystem 内部在正确衰减 `defenseValue`，但这个值没有桥接到 AnimationSystem

**根因**: 缺少一个关键的桥接调用，例如:
```typescript
// 缺失的逻辑: 在 rAF 循环中
const battle = siegeBattleSystem.getBattle(taskId);
if (battle) {
  siegeBattleAnimSystem.updateBattleProgress(taskId, battle.defenseValue / battle.maxDefense);
}
```

---

## P1 级攻击（严重 — 功能缺失或验证不充分）

### P1-1: Phase 2 (R7-9 ~ R7-13) 全部通过"代码审查"验证，零自动化测试

**Builder声称**: Phase 2 的 5 个集成点 (R7-9 ~ R7-13) 全部 PASS

**实际情况**:
- 验证方法列写着"集成验证（代码审查）"
- 没有任何集成测试覆盖 WorldMapTab 与 SiegeBattleSystem / SiegeBattleAnimationSystem 的交互
- 现有 e2e 测试 (`e2e-map-flow.integration.test.ts`) 中搜索 `SiegeBattle` 结果为 **零匹配**
- 这意味着以下关键流程从未在自动化测试中执行:
  - useEffect 创建 → init → 共享 eventBus
  - createBattle() → battle:started → AnimationSystem 自动启动动画
  - update(dt) → battle:completed → AnimationSystem 自动完成动画
  - cleanup → destroy → 事件监听移除

**结论**: "代码审查"不是可重复的验证手段。Builder 的 Phase 2 PASS 评级缺乏客观依据。

---

### P1-2: Phase 3 (R7-14 ~ R7-23) 共 10 个功能点全部通过"代码审查"，零测试

**Builder声称**: Canvas 渲染层的 10 个功能点全部 PASS

**实际情况**:
- PixelWorldMap.tsx 的渲染函数 (`renderAssemblyPhase`, `renderBattlePhase`, `renderCompletedPhase`, `renderSiegeAnimationOverlay`) **没有任何测试**
- 没有快照测试、没有 Canvas 渲染验证、甚至没有基本的函数调用验证
- 这 10 个功能点依赖的视觉参数（ASSEMBLY_POINT_COUNT=8, BATTLE_PARTICLE_COUNT=12, 颜色值等）完全是声明性的，无法验证其正确性

**结论**: Phase 3 的 PASS 评级等同于"我写了代码，我看了代码，我认为没问题"。这不是验证。

---

### P1-3: 测试中 eventBus 被 mock，未验证真实事件传递链

**Builder声称** (R7-8): 事件驱动自动启动/完成动画

**代码证据**:
```typescript
// SiegeBattleAnimationSystem.test.ts:32-42 — mock eventBus
const createMockDeps = (): ISystemDeps => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),   // <— 返回空函数，不注册真实监听
    off: vi.fn(),
    ...
  } as any,
});
```

**问题**:
- `on` 被 mock 后，init() 中注册的 battle:started / battle:completed 监听器 **不会生效**
- 因此测试中的 `init 时应注册 battle:started 和 battle:completed 事件监听` 测试 (line 93-96) 只验证了 `on` 被调用了，但 **没有验证监听器被调用时会正确创建/完成动画**
- 只有在 `destroy / idempotent init` describe 块中才使用了真实的 EventBus (`createRealDeps`)，覆盖了部分场景

**部分缓解**: 在 destroy/init 测试中确实使用了真实 EventBus 并验证了事件触发动画创建（line 937-1104）。但这仅覆盖了 init→destroy→reinit 生命周期，没有覆盖完整的事件链路：
- SiegeBattleSystem.createBattle() → emit battle:started → AnimationSystem.startSiegeAnimation()
- SiegeBattleSystem.update() → emit battle:completed → AnimationSystem.completeSiegeAnimation()

**结论**: 虽然没有完全幻觉（有部分真实 EventBus 测试），但两个系统之间的事件桥接从未在测试中被验证。Builder 的 R7-8 声明过度。

---

### P1-4: `faction` 类型收窄遗漏 — `ownershipToFaction` 返回 `string` 而非联合类型

**Builder声称** (R7-7, R7-FIX-1): 将 BattleStartedEvent.faction 和 createBattle() params.faction 类型收窄为 `'wei' | 'shu' | 'wu' | 'neutral'`

**代码证据**:
```typescript
// WorldMapTab.tsx:554-560
const ownershipToFaction = (ownership: string): string => {  // <— 返回 string，不是联合类型
  switch (ownership) {
    case 'player': return 'wei';
    case 'enemy': return 'shu';
    case 'neutral': return 'neutral';
    default: return 'neutral';
  }
};
```

**问题**:
1. `ownershipToFaction` 的返回类型是 `string`，而 `conquestAnimSystem.create()` 接收 `string` 类型的 faction 参数，所以这里没有 TS 错误
2. 但如果在 `createBattle()` 调用链中使用了此函数，返回的 `string` 可能与收窄后的 `'wei' | 'shu' | 'wu' | 'neutral'` 不兼容
3. 实际的 `createBattle()` 调用 (line 462-471) 硬编码了 `faction: 'wei'`，所以当前不会报错

**深层问题**: 收窄后的 faction 类型只在 SiegeBattleSystem 和 SiegeBattleAnimationSystem 内部使用，WorldMapTab 的行军创建 (`createMarch`) 和其他外部接口仍使用 `string`。这意味着 faction 类型系统存在边界不一致——内部是严格联合类型，外部是宽泛 string。

**结论**: R7-FIX-1 的修复是局部的。类型收窄并未贯穿整个调用链，存在边界类型不一致问题。当前不会导致 TS 编译错误，但反映了架构层面的不完整。

---

## P2 级攻击（中等 — 测试覆盖或设计问题）

### P2-1: SiegeBattleSystem.destroy() 与 reset() 语义完全相同

**代码证据**:
```typescript
// SiegeBattleSystem.ts:260-262
reset(): void {
  this.activeBattles.clear();
}

// SiegeBattleSystem.ts:269-271
destroy(): void {
  this.activeBattles.clear();
}
```

**问题**:
- `destroy()` 和 `reset()` 的实现完全相同
- `destroy()` 没有执行任何 `reset()` 没有的清理工作
- 对比 `SiegeBattleAnimationSystem`，其 `destroy()` 正确地移除了事件监听器并重置了 `_initialized`
- SiegeBattleSystem 没有事件监听器需要清理（它只是 emit 事件，不订阅），所以 destroy 可以是空操作或只调用 clear()
- 但 ISubsystem 接口的 JSDoc 说 destroy 是"释放子系统持有的所有资源"，而 SiegeBattleSystem 的 activeBattles map 就是需要释放的资源

**结论**: 功能正确但设计冗余。Builder 可以考虑 `destroy() { this.reset(); }` 或明确 destroy 不需要额外操作。

---

### P2-2: 测试覆盖遗漏 — SiegeBattleSystem 缺少对 `faction` 字段的显式验证

**代码证据**:
SiegeBattleSystem.test.ts 中 28 个测试用例中，只有 `应创建战斗会话` 测试 (line 103-141) 检查了 `battle:started` 事件的 `faction` 字段。其他测试大多使用 `faction: 'wei'`（默认值）。

**遗漏场景**:
- 没有测试 `faction: 'shu'` 或 `faction: 'wu'` 时事件数据是否正确
- 没有测试 `faction: 'neutral'` 时 `SiegeBattleAnimationSystem` 是否正确处理
- 类型收窄后的边界值测试缺失

---

### P2-3: PixelWorldMap 的 `renderSiegeAnimationOverlay` 在无 `ctx.save()/restore()` 包裹时可能泄露 globalAlpha

**代码证据**:
```typescript
// PixelWorldMap.tsx:1061-1096
const renderSiegeAnimationOverlay = useCallback(() => {
  // ...
  ctx.save();   // line 1076
  for (const anim of anims) {
    // 各 phase 渲染函数内部修改了 globalAlpha
    if (anim.phase === 'assembly') {
      renderAssemblyPhase(ctx, anim, cx, cy, ts, now);
    }
    // ...
  }
  ctx.restore();  // line 1095
}, []);
```

**实际情况**: 查看 `renderAssemblyPhase` (line 291-365)，函数末尾有 `ctx.globalAlpha = 1.0;`。但如果在中间发生异常（虽然不太可能），`ctx.save()/restore()` 在外层已经保护了。

**轻微问题**: `renderAssemblyPhase` 末尾的 `ctx.globalAlpha = 1.0` (line 364) 是冗余的——因为外层有 `ctx.restore()`。但这是防御性编码，不算 bug。

**结论**: 代码质量可接受，但存在轻微的防御性编码冗余。

---

## 幻觉攻击汇总

| Builder声称 | 实际情况 | 幻觉程度 |
|-------------|----------|----------|
| R7-12: siegeBattleSystem.destroy() 在 cleanup 中调用 | SiegeBattleSystem.destroy() 正确调用了，但 SiegeBattleAnimationSystem.destroy() 被遗漏 | 部分幻觉 |
| R7-17: 城防HP条实时更新 | defenseRatio 永远为 1.0，updateBattleProgress() 从未被调用 | 完全幻觉 |
| 75/75 PASS | 测试确实 75/75 通过，但测试覆盖了什么？Phase 2/3 全靠"代码审查" | 数字真实，但覆盖度虚高 |
| Phase 2/3 PASS | 5+10=15 个功能点全部标 PASS，但零自动化测试 | "代码审查"≠验证 |

---

## 集成断裂攻击汇总

### 断裂点 1: SiegeBattleSystem → SiegeBattleAnimationSystem (defenseRatio)

```
SiegeBattleSystem.update(dt)
  → defenseValue 衰减 ✅
  → emit battle:completed ✅
  → ??? defenseRatio 传给 AnimationSystem ??? ❌ (未桥接)
```

### 断裂点 2: SiegeBattleAnimationSystem → PixelWorldMap (defenseRatio)

```
PixelWorldMap.renderBattlePhase()
  → anim.defenseRatio 始终 = 1.0 ❌
  → HP 条永远满血 ❌
```

### 断裂点 3: WorldMapTab cleanup → SiegeBattleAnimationSystem

```
useEffect cleanup
  → siegeBattleSystem.destroy() ✅
  → siegeBattleAnimSystem.destroy() ❌ (遗漏)
```

---

## 类型安全攻击汇总

| 攻击点 | 说明 |
|--------|------|
| faction 联合类型边界 | SiegeBattleSystem/AnimationSystem 内部收窄为 `'wei'\|'shu'\|'wu'\|'neutral'`，但 WorldMapTab 的 `ownershipToFaction` 返回 `string` |
| createBattle 硬编码 faction | WorldMapTab.tsx:470 硬编码 `faction: 'wei'`，不考虑玩家阵营变化 |
| STRATEGY_COLORS 类型 | `Record<string, ...>` 而非 `Record<SiegeStrategyType, ...>`，失去了类型收窄的好处 |

---

## 总结

| 级别 | 数量 | 关键问题 |
|------|------|----------|
| P0 | 2 | SiegeBattleAnimationSystem.destroy() 遗漏；defenseRatio 永远为 1.0 导致城防血条无意义 |
| P1 | 4 | Phase 2/3 零测试；事件传递链未在测试中验证；faction 类型边界不一致 |
| P2 | 3 | destroy/reset 语义冗余；faction 边界测试缺失；防御性编码冗余 |
| **总计** | **9** | |

**最终评估**: Builder 的 Phase 1 实现质量可接受（28+47 测试覆盖），但 Phase 2 系统集成存在资源泄漏（P0-1），Phase 3 Canvas 渲染存在致命的数据断链（P0-2）。Phase 2 和 Phase 3 的"代码审查"验证方法不足以发现这些运行时缺陷。建议 Builder 在声称 PASS 之前，至少补充一个 SiegeBattleSystem + SiegeBattleAnimationSystem + 真实 EventBus 的集成测试。

Challenger完成, 9个有效质疑(其中P0:2, P1:4)
