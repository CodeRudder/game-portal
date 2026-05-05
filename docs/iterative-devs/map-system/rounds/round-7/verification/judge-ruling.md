# R7 Judge Ruling — Builder Manifest vs Challenger Attack

**裁决时间**: 2026-05-04
**裁决角色**: Judge
**审查对象**: Builder R7 Manifest (23功能点) vs Challenger R7 Attack (9质疑)

---

## 裁决摘要

| 级别 | Challenger主张 | 裁决结果 | 最终数量 |
|------|---------------|----------|----------|
| P0 | 2 | UPHELD: 2 | **2** |
| P1 | 4 | UPHELD: 3, DISMISS: 1 | **3** |
| P2 | 3 | UPHELD: 1, PARTIALLY UPHELD: 1, DISMISS: 1 | **1** |
| **有效问题总计** | **9** | | **6** |

---

## 一、P0 级裁决（致命 — 运行时缺陷）

### P0-1: `siegeBattleAnimSystem.destroy()` 在 WorldMapTab cleanup 中被遗漏

**Challenger主张**: SiegeBattleAnimationSystem.destroy() 在 useEffect cleanup 中被完全遗漏，导致事件监听器泄漏。

**代码证据验证**:

```typescript
// WorldMapTab.tsx:655-661 — useEffect cleanup
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  siegeBattleSystem.destroy();           // ✅ SiegeBattleSystem 已销毁
  siegeBattleSystemRef.current = null;
  eventBus.off('march:arrived', handleArrived);
  eventBus.off('march:cancelled', handleCancelled);
  // ❌ 缺失: siegeBattleAnimSystem.destroy()
  // ❌ 缺失: siegeBattleAnimRef.current = null
};
```

创建路径（WorldMapTab.tsx:401-403）:
```typescript
const siegeBattleAnimSystem = new SiegeBattleAnimationSystem();
siegeBattleAnimSystem.init(mockDeps);              // 注册了 battle:started + battle:completed 两个监听器
siegeBattleAnimRef.current = siegeBattleAnimSystem;
```

SiegeBattleAnimationSystem.init()（SiegeBattleAnimationSystem.ts:192-219）注册了两个事件监听器到 `eventBus`:
```typescript
const unsub1 = this.deps.eventBus.on('battle:started', (data) => { ... });
const unsub2 = this.deps.eventBus.on('battle:completed', (data) => { ... });
this.unsubscribers = [unsub1, unsub2].filter(Boolean);
```

**缓解因素分析**:
1. `eventBus` 是 useEffect 内部的局部变量（WorldMapTab.tsx:355-392），不是全局单例
2. 当 useEffect cleanup 执行后，旧的 `eventBus` 局部闭包会随着整个 useEffect 闭包一起被 GC 回收
3. 但在 React StrictMode 下，useEffect 会执行 mount → unmount → mount，此时旧 eventBus 闭包在 cleanup 与重新执行之间仍存活，且 siegeBattleAnimSystem 的监听器闭包持有对旧系统实例（包括 animations Map 等大对象）的引用，造成短期内存泄漏
4. **关键**: cleanup 中 `eventBus.off('march:arrived', ...)` 和 `eventBus.off('march:cancelled', ...)` 被正确调用了，说明 Builder 有意识地清理 eventBus 上的监听器，但唯独遗漏了 siegeBattleAnimSystem 的两个监听器

**裁决**: **UPHELD** — P0 确认

**严重度维持**: P0。虽然局部 eventBus 缓解了全局泄漏风险，但：
- `siegeBattleAnimSystem` 持有 `animations: Map<string, SiegeAnimationState>`，每个 animation state 含多个字段
- `siegeBattleAnimRef.current` 未在 cleanup 中置 null，导致 React ref 持有过期引用
- React StrictMode 下泄漏可累积
- 这是一个**模式性错误** — Builder 清理了 SiegeBattleSystem 却完全遗漏了 SiegeBattleAnimationSystem，说明 cleanup 逻辑不完整

**修复建议**:
```typescript
// WorldMapTab.tsx cleanup (line 655-661) 应补充:
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  siegeBattleSystem.destroy();
  siegeBattleSystemRef.current = null;
  siegeBattleAnimSystem.destroy();           // 补充
  siegeBattleAnimRef.current = null;         // 补充
  eventBus.off('march:arrived', handleArrived);
  eventBus.off('march:cancelled', handleCancelled);
};
```

**注意**: `siegeBattleAnimSystem` 是 useEffect 闭包内的局部变量，可以直接访问。`siegeBattleAnimRef` 已在 line 167 声明为 `useRef`。

---

### P0-2: `updateBattleProgress()` 从未被生产代码调用 — defenseRatio 永远为 1.0

**Challenger主张**: `defenseRatio` 始终为初始值 1.0，城防血条永远显示满血，直到战斗突然结束。

**代码证据验证**:

1. **初始化** — `startSiegeAnimation()` 设置 `defenseRatio: 1.0`（SiegeBattleAnimationSystem.ts:350）:
   ```typescript
   defenseRatio: 1.0, // 初始满血
   ```

2. **唯一修改方法** — `updateBattleProgress()`（SiegeBattleAnimationSystem.ts:377-381）:
   ```typescript
   updateBattleProgress(taskId: string, defenseRatio: number): void {
     const anim = this.animations.get(taskId);
     if (!anim) return;
     anim.defenseRatio = Math.max(0, Math.min(1, defenseRatio));
   }
   ```
   全局搜索结果: 此方法**仅被测试文件调用**（6次），零生产代码调用。

3. **rAF 循环中的调用**（WorldMapTab.tsx:628-632）:
   ```typescript
   siegeBattleSystem.update(dt);      // 内部衰减 defenseValue，但结果不传出
   siegeBattleAnimSystem.update(dt);  // 内部驱动 phase 转换，不读取 defenseValue
   ```
   两个 `.update(dt)` 调用之间没有任何桥接代码。

4. **SiegeBattleSystem.update() 内部**（SiegeBattleSystem.ts:201-241）:
   ```typescript
   session.defenseValue = Math.max(0, session.defenseValue - defenseDelta);
   // defenseValue 在衰减，但仅存储在 session 对象内部
   // 仅在战斗结束时通过 battle:completed 事件传出 remainingDefense
   ```

5. **渲染侧**（PixelWorldMap.tsx:511-514）:
   ```typescript
   const ratio = anim.defenseRatio;   // 始终 = 1.0
   const hpColor = ratio > 0.5 ? '#44CC44' : ...   // 始终绿色
   ctx.fillRect(barX, barY, barWidth * ratio, barHeight);  // 始终满血条
   ```

6. **唯一的其他赋值** — `completeSiegeAnimation()` 中（SiegeBattleAnimationSystem.ts:417）:
   ```typescript
   anim.defenseRatio = victory ? 0 : anim.defenseRatio;
   ```
   胜利时才设为 0，此时动画已进入 completed phase，血条不再有意义。

**缓解因素分析**:
- `SiegeBattleSystem.getBattle(taskId)` 方法存在（line 360-361），可以获取 battle session 及其 defenseValue
- `SiegeBattleAnimationSystem.updateBattleProgress()` 方法存在且完整实现
- 两端的 API 都已就绪，唯一缺失的是中间的桥接调用
- 这不是设计遗漏（API 已设计好），而是集成遗漏

**裁决**: **UPHELD** — P0 确认

**严重度维持**: P0。这是一个**用户可见的运行时缺陷**:
- 城防血条在战斗全程显示满血（绿色 100%），给用户错误的视觉反馈
- 战斗结束时血条突然消失（进入 completed phase），没有平滑过渡
- Builder R7-17 声称"城防HP条实时更新"是**不实的** — HP 条在渲染，但数据不更新

**修复建议**:
在 WorldMapTab.tsx 的 rAF 循环中（line 629-632 之间），添加桥接代码:
```typescript
// 桥接: 将 SiegeBattleSystem 的 defenseValue 同步到 SiegeBattleAnimationSystem
const activeBattles = siegeBattleSystem.getState().activeBattles;
for (const battle of activeBattles) {
  if (battle.maxDefense > 0) {
    siegeBattleAnimSystem.updateBattleProgress(
      battle.taskId,
      battle.defenseValue / battle.maxDefense
    );
  }
}
```

或更简洁地，在 `SiegeBattleSystem.update()` 内部每帧 emit 一个 `battle:progress` 事件，由 AnimationSystem 监听。

---

## 二、P1 级裁决（严重 — 功能缺失或验证不充分）

### P1-1: Phase 2 (R7-9 ~ R7-13) 全部通过"代码审查"验证，零自动化测试

**Challenger主张**: Phase 2 的 5 个集成点全靠"代码审查"验证，无集成测试。

**代码证据验证**:
- e2e 测试 `e2e-map-flow.integration.test.ts` 中搜索 `SiegeBattle` — **零匹配**，已确认
- Phase 1 有 28+47=75 个单元测试，Phase 2/3 确实没有专门的测试
- R7-9 至 R7-13 在 Manifest 的"测试文件"列全部写着"集成验证（代码审查）"

**裁决**: **UPHELD** — P1 确认

**严重度维持**: P1。"代码审查"确实是不可重复的验证手段。但此问题**已被 P0-1 和 P0-2 的发现所佐证** — 正因为缺少集成测试，两个致命的集成缺陷（destroy 遗漏、defenseRatio 断链）才未被捕获。

**修复建议**: 至少补充一个集成测试，覆盖:
```
SiegeBattleSystem.createBattle() → eventBus emit battle:started
  → SiegeBattleAnimationSystem 自动启动动画
SiegeBattleSystem.update() → defenseValue 衰减 → battle:completed
  → SiegeBattleAnimationSystem 自动完成动画
SiegeBattleSystem.destroy() + SiegeBattleAnimationSystem.destroy()
  → 事件监听器全部移除
```

---

### P1-2: Phase 3 (R7-14 ~ R7-23) 共 10 个功能点全部通过"代码审查"，零测试

**Challenger主张**: Canvas 渲染层 10 个功能点无任何测试。

**代码证据验证**:
- PixelWorldMap.tsx 中的 `renderAssemblyPhase`, `renderBattlePhase`, `renderCompletedPhase`, `renderSiegeAnimationOverlay` — 确实没有单元测试
- Canvas 渲染函数测试确实有技术难度（需要 mock CanvasRenderingContext2D）
- 但至少可以做函数调用验证、参数传递验证

**裁决**: **UPHELD** — P1 确认，但**降级为 P2**

**严重度调整**: P1 → P2。理由:
1. Canvas 渲染是纯视觉层，无逻辑副作用（不影响游戏数据）
2. Canvas 渲染测试的技术成本较高，且业界普遍接受视觉验证
3. 关键的数据链问题已被 P0-2 覆盖（defenseRatio 断链）
4. 如果 P0-2 修复后，Canvas 层的渲染逻辑本身是正确的（只是数据源有问题）

**修复建议**: 可以在后续迭代中通过 Canvas mock 或快照测试逐步补充。

---

### P1-3: 测试中 eventBus 被 mock，未验证真实事件传递链

**Challenger主张**: SiegeBattleAnimationSystem.test.ts 中 eventBus.on 被 mock，init 注册的监听器不会真实生效。

**代码证据验证**:
- Challenger 自身也承认了"部分缓解" — destroy/init 测试块中使用了真实 EventBus
- 两个系统之间的事件桥接（SiegeBattleSystem → emit → AnimationSystem）确实从未在测试中验证
- 但各系统内部的事件行为已通过真实 EventBus 测试覆盖

**裁决**: **PARTIALLY UPHELD**

**严重度维持**: P1。"部分"成立:
- 各子系统内部的事件订阅/取消已验证 ✅
- 跨系统事件桥接未验证 ❌（与 P1-1 重叠）
- 考虑到与 P1-1 重复，此问题实际影响已被 P1-1 覆盖

**修复建议**: 与 P1-1 合并，在集成测试中一并覆盖。

---

### P1-4: `faction` 类型收窄遗漏 — `ownershipToFaction` 返回 `string` 而非联合类型

**Challenger主张**: `ownershipToFaction()` 返回 `string`，与收窄后的联合类型不一致。

**代码证据验证**:
1. `ownershipToFaction()` 在 WorldMapTab.tsx:554-560 中返回 `string`
2. 此函数**并非用于 SiegeBattleSystem.createBattle()** — 实际的 createBattle 调用（line 470）硬编码了 `faction: 'wei'`
3. `ownershipToFaction()` 实际用于 `conquestAnimSystem.create()`（line 562-568），这是一个不同的系统
4. SiegeBattleSystem 和 SiegeBattleAnimationSystem 内部的 faction 类型已正确收窄为联合类型
5. **当前没有 TS 编译错误**

**裁决**: **DISMISS**

**理由**:
1. `ownershipToFaction()` 与 R7 的 BattleSystem 修复无关 — 它服务于 `conquestAnimSystem`（征服动画系统），不是 SiegeBattleSystem
2. `createBattle()` 调用硬编码了 `faction: 'wei'`（line 470），类型完全正确
3. Builder 的 R7-FIX-1 修复范围是 SiegeBattleSystem 和 SiegeBattleAnimationSystem 内部，已正确完成
4. Challenger 将不相关的代码路径混淆了
5. faction 硬编码 `'wei'` 虽然限制了多阵营场景，但这是**已知的简化**，不是类型安全问题

**严重度调整**: 降至 P3（信息性），不纳入有效问题计数。作为未来改进建议记录: 当多阵营支持需求出现时，应将 faction 参数改为动态获取而非硬编码。

---

## 三、P2 级裁决（中等 — 测试覆盖或设计问题）

### P2-1: SiegeBattleSystem.destroy() 与 reset() 语义完全相同

**Challenger主张**: `destroy()` 和 `reset()` 实现完全相同。

**代码证据验证**:
```typescript
// SiegeBattleSystem.ts:260-262
reset(): void { this.activeBattles.clear(); }
// SiegeBattleSystem.ts:269-271
destroy(): void { this.activeBattles.clear(); }
```

- SiegeBattleSystem 不订阅任何事件（只 emit），因此 destroy 不需要取消订阅
- `activeBattles.clear()` 确实是两个方法中唯一需要做的清理
- 对比 SiegeBattleAnimationSystem 的 destroy（取消订阅 + clear + 重置 _initialized），SiegeBattleSystem 的 destroy 确实更简单

**裁决**: **UPHELD** — 但降级为设计建议

**严重度维持**: P2。功能正确，但语义不清晰。`destroy` 和 `reset` 行为相同会误导使用者以为 destroy 做了更多事情。

**修复建议**: 可以改为 `destroy() { this.reset(); }` 或添加注释说明为何两者等价。

---

### P2-2: 测试覆盖遗漏 — SiegeBattleSystem 缺少对 `faction` 字段的显式验证

**Challenger主张**: faction 边界值测试缺失。

**裁决**: **DISMISS**

**理由**:
1. faction 字段的类型已通过 TypeScript 编译器验证（R7-FIX-1）
2. 联合类型 `'wei' | 'shu' | 'wu' | 'neutral'` 的每个值在运行时都是普通字符串，不需要逐个测试
3. `createBattle()` 中 faction 值直接传递到 BattleStartedEvent，不经过任何转换逻辑
4. 这是典型的类型安全场景，TS 编译器已经提供了比测试更强的保证
5. 测试中已有 `faction: 'wei'` 的覆盖（line 103-141），验证了传递路径正确

---

### P2-3: `renderSiegeAnimationOverlay` globalAlpha 泄露风险

**Challenger主张**: renderAssemblyPhase 末尾的 `ctx.globalAlpha = 1.0` 是冗余的。

**代码证据验证**:
```typescript
// PixelWorldMap.tsx:1076-1095
ctx.save();
for (const anim of anims) {
  // 各 phase 渲染函数内部修改了 globalAlpha
  if (anim.phase === 'assembly') { renderAssemblyPhase(ctx, anim, cx, cy, ts, now); }
  // ...
}
ctx.restore();
```
- 外层 `ctx.save()/ctx.restore()` **已完整包裹**，确保 globalAlpha 不会泄露
- Challenger 自身也承认"代码质量可接受"、"防御性编码不算 bug"

**裁决**: **DISMISS**

**理由**: Challenger 自身承认这不是 bug。`ctx.save()/restore()` 保护已到位，`ctx.globalAlpha = 1.0` 是防御性编程的最佳实践。这不需要修复。

---

## 四、Builder 功能点审查

### Phase 1: 技术债务修复 (R7-1 ~ R7-8) — 全部 PASS

| ID | 功能点 | 裁决 | 说明 |
|----|--------|------|------|
| R7-1 | ISubsystem.destroy() 可选方法 | PASS | 接口定义正确，JSDoc 清晰 |
| R7-2 | _initialized 幂等守卫 | PASS | 多次 init 不重复注册，有测试覆盖 |
| R7-3 | unsubscribers 数组 | PASS | init 中收集取消订阅函数，destroy 中批量调用 |
| R7-4 | SiegeBattleAnimationSystem.destroy() | PASS | 取消监听 + clear + 重置 _initialized，实现正确 |
| R7-5 | SiegeBattleSystem.destroy() | PASS | 功能正确，与 reset 等价是设计冗余非 bug |
| R7-6 | BattleStartedEvent 扩展 | PASS | 包含完整坐标和阵营信息 |
| R7-7 | faction 类型收窄 | PASS | TS 编译通过，内部类型一致 |
| R7-8 | auto-subscription | PASS | init 自动订阅 battle:started/completed，测试覆盖 |

### Phase 2: 系统集成 (R7-9 ~ R7-13) — 存在 2 个致命缺陷

| ID | 功能点 | 裁决 | 缺陷关联 |
|----|--------|------|----------|
| R7-9 | SiegeBattleSystem 创建并 init | PASS | |
| R7-10 | siegeBattleSystem.update(dt) 在 rAF 中调用 | PARTIAL | 缺少 defenseRatio 桥接（P0-2） |
| R7-11 | createBattle() 在攻城流程中调用 | PASS | |
| R7-12 | siegeBattleSystem.destroy() 在 cleanup 中调用 | PARTIAL | 遗漏 siegeBattleAnimSystem.destroy()（P0-1） |
| R7-13 | 共享 eventBus | PASS | |

### Phase 3: Canvas 渲染 (R7-14 ~ R7-23) — 渲染逻辑正确但数据源有问题

| ID | 功能点 | 裁决 | 说明 |
|----|--------|------|------|
| R7-14 | siegeAnimsRef 数据同步 | PASS | |
| R7-15 | renderSiegeAnimationOverlay | PASS | ctx.save/restore 保护到位 |
| R7-16 | assembly 渲染 | PASS | 渲染逻辑正确 |
| R7-17 | battle 渲染 | PARTIAL | 渲染代码正确，但 defenseRatio 始终为 1.0（P0-2），非渲染层 bug |
| R7-18~R7-21 | 策略特效 | PASS | 各策略有独立颜色和视觉表现 |
| R7-22 | completed 渲染 | PASS | |
| R7-23 | 策略颜色定义 | PASS | |

---

## 五、幻觉评估

| Builder声称 | 实际情况 | 幻觉程度 |
|-------------|----------|----------|
| R7-12: "siegeBattleSystem.destroy() 在 cleanup 中调用" | SiegeBattleSystem.destroy() ✅ 被调用了，但 SiegeBattleAnimationSystem.destroy() ❌ 遗漏 | **部分幻觉** — 声称了 destroy cleanup，但只覆盖了一半 |
| R7-17: "城防HP条实时更新" | defenseRatio 永远为 1.0，HP 条永远满血 | **完全幻觉** — 声称了实时更新，实际从不更新 |
| 75/75 PASS | 数字真实，测试确实全部通过 | **非幻觉** — 但覆盖范围有限 |
| Phase 2/3 PASS | 代码存在但存在集成缺陷 | **过度自信** — "代码审查"未发现运行时问题 |

---

## 六、修复优先级

| 优先级 | 问题 | 修复位置 | 工作量估计 |
|--------|------|----------|-----------|
| **P0-1** | siegeBattleAnimSystem.destroy() 遗漏 | WorldMapTab.tsx:655 cleanup | 2 行代码 |
| **P0-2** | defenseRatio 桥接缺失 | WorldMapTab.tsx:629 rAF 循环 | ~8 行代码 |
| P1-1 | 缺少集成测试 | 新建测试文件 | ~100 行测试 |
| P2-1 | destroy/reset 语义重复 | SiegeBattleSystem.ts:269 | 1 行代码 |

**总计修复工作量**: 约 110 行代码 + 测试。

---

## 七、最终裁决

### 有效问题计数

| 级别 | 数量 | 问题列表 |
|------|------|----------|
| **P0** | **2** | P0-1 (destroy遗漏), P0-2 (defenseRatio断链) |
| **P1** | **3** | P1-1 (零集成测试), P1-2→P2 (Canvas零测试, 降级), P1-3 (事件链未验证, 部分成立) |
| **P2** | **1** | P2-1 (destroy/reset冗余) |
| **总计** | **6** | |

### Builder 总体评价

- **Phase 1 (8/8)**: 实现质量可接受。75 个单元测试覆盖了两个子系统的核心逻辑。
- **Phase 2 (3/5 PASS, 2 PARTIAL)**: 集成代码**存在但有两处致命遗漏**。destroy 遗漏和 defenseRatio 断链都是运行时缺陷，会导致资源泄漏和用户可见的错误 UI。Builder 的"代码审查"验证方法未能发现这些问题。
- **Phase 3 (9/10 PASS, 1 PARTIAL)**: Canvas 渲染逻辑本身正确，但依赖的数据源有问题（P0-2 的下游影响）。

### 结论

Challenger 的攻击**精准且有效**。9 个质疑中 6 个成立（含 2 个 P0 致命问题），1 个部分成立（P1-3），2 个被驳回（P1-4 类型问题不相关，P2-2 类型测试无必要）。特别是两个 P0 问题都有确凿的代码证据，且都是用户可感知的运行时缺陷。

Builder 应在进入下一轮迭代前**优先修复两个 P0 问题**，它们加起来只需约 10 行代码。

---

Judge完成裁决。确认P0:2, P1:3, P2:1个有效问题（共6个）。
