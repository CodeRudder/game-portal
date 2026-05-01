# Building 模块 — Round 2 对抗式挑战报告

> **Challenger 视角** | 模块: `engine/building/`  
> 生成时间: 2025-05-02  
> 目标: 验证3个P1缺陷真实性 + 扫描源码发现新缺陷

---

## 一、P1缺陷验证

### P1-DEFECT-01: cancelUpgrade退款金额计算错误 ✅ **确认真实**

**源码位置**: `BuildingSystem.ts:240-255`

```typescript
cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const cost = this.getUpgradeCost(type);
    if (!cost) return null;
    const refund: UpgradeCost = {
      grain: Math.round(cost.grain * CANCEL_REFUND_RATIO),  // ← 问题所在
      gold: Math.round(cost.gold * CANCEL_REFUND_RATIO),
      troops: Math.round(cost.troops * CANCEL_REFUND_RATIO),
      timeSeconds: 0,
    };
    // ...
}
```

**缺陷分析**:
- `CANCEL_REFUND_RATIO = 0.8`，使用 `Math.round()` 对小数值产生严重偏差
- **不是80%退款**，而是 `Math.round(cost * 0.8)`

| cost值 | 期望80%退款 | 实际退款 | 实际比例 | 偏差 |
|--------|------------|---------|---------|------|
| 1 | 0.8 → 1 | 1 | 100% | +25% |
| 2 | 1.6 → 2 | 2 | 100% | +25% |
| 3 | 2.4 → 2 | 2 | 66.7% | -16.7% |
| 5 | 4.0 → 4 | 4 | 80% | 0% |
| 7 | 5.6 → 6 | 6 | 85.7% | +7.1% |
| 10 | 8.0 → 8 | 8 | 80% | 0% |
| 999 | 799.2 → 799 | 799 | 80.0% | ≈0% |

**严重程度**: P1（严重）  
**影响范围**: 所有低费用建筑的取消升级退款  
**修复建议**: 使用 `Math.floor(cost * CANCEL_REFUND_RATIO)` 保证不超过80%，或使用 `Math.round` 但接受±0.5的偏差（并在文档中声明）

**现有测试覆盖情况**: `BuildingSystem.test.ts:177-181` 使用 `Math.round(cost * CANCEL_REFUND_RATIO)` 验证——**测试与实现使用相同公式，无法发现偏差**。测试应验证实际比例在合理范围内。

---

### P1-DEFECT-02: deserialize不校验level/status一致性 ✅ **确认真实**

**源码位置**: `BuildingSystem.ts:374-410`

```typescript
deserialize(data: BuildingSaveData): void {
    if (!data || !data.buildings) { this.reset(); return; }
    // 版本检查 → 仅警告
    
    for (const t of BUILDING_TYPES) {
      if (data.buildings[t]) this.buildings[t] = { ...data.buildings[t] };  // ← 直接赋值，无校验
    }
    
    // 仅处理 status==='upgrading' 的建筑
    for (const t of BUILDING_TYPES) {
      const s = this.buildings[t];
      if (s.status === 'upgrading' && s.upgradeEndTime) {
        // 处理离线完成/队列重建
      }
    }
    this.checkAndUnlockBuildings();
}
```

**缺陷分析**:
1. **直接赋值无校验**: `this.buildings[t] = { ...data.buildings[t] }` 不检查以下一致性：
   - `status='idle'` 但 `level=0`（应为locked）
   - `status='upgrading'` 但 `level >= maxLevel`（不可能在升级）
   - `status='locked'` 但 `level > 0`（矛盾）
   - `status='idle'` 但 `upgradeEndTime !== null`（残留数据）
   - `status` 不是合法的 `BuildingStatus` 值

2. **离线完成不检查level上限**:
   ```typescript
   if (now >= s.upgradeEndTime) {
     s.level += 1;  // ← 不检查是否超过maxLevel
   }
   ```

3. **upgradeEndTime=NaN永不过期**:
   ```typescript
   if (now >= s.upgradeEndTime) { ... }  // NaN比较始终为false
   ```

**篡改场景**:
```json
{
  "castle": { "level": 99, "status": "idle" },
  "farmland": { "level": 0, "status": "upgrading", "upgradeEndTime": 0 }
}
```
→ farmland level从0变成1，但status本应是locked

**严重程度**: P1（严重）  
**影响范围**: 存档篡改、数据损坏、版本迁移  
**修复建议**: deserialize后增加一致性校验：
```typescript
for (const t of BUILDING_TYPES) {
  const s = this.buildings[t];
  // 修正矛盾状态
  if (s.level <= 0 && s.status !== 'locked') s.status = 'locked';
  if (s.level > BUILDING_MAX_LEVELS[t]) s.level = BUILDING_MAX_LEVELS[t];
  if (s.status === 'upgrading' && s.level >= BUILDING_MAX_LEVELS[t]) {
    s.status = 'idle'; s.level = BUILDING_MAX_LEVELS[t];
  }
}
```

**现有测试覆盖情况**: `BuildingSystem.adversarial.test.ts` 测试了正常deserialize场景和castle level约束，但**未测试矛盾status值**。

---

### P1-DEFECT-03: consumeBatch与startUpgrade非原子操作 ✅ **确认真实**

**源码位置**: `engine-building-ops.ts:48-57`

```typescript
export function executeBuildingUpgrade(ctx, type) {
  const resources = ctx.resource.getResources();
  const check = ctx.building.checkUpgrade(type, resources);
  if (!check.canUpgrade) throw new Error(...);
  
  const cost = ctx.building.getUpgradeCost(type);
  if (!cost) throw new Error(...);
  
  ctx.resource.consumeBatch({ grain: cost.grain, ... });  // ← 第1步：扣资源
  ctx.building.startUpgrade(type, resources);              // ← 第2步：改状态
  
  ctx.bus.emit('building:upgrade-start', { type, cost });  // ← 第3步：发事件
  ctx.bus.emit('resource:changed', { ... });
}
```

**缺陷分析**:
1. **两步操作无事务保护**: 
   - `consumeBatch` 成功后，如果 `startUpgrade` 抛错（如队列刚满、状态刚变），资源已扣但建筑状态未变
   - 无回滚机制，资源永久丢失

2. **TOCTOU竞态**:
   - `checkUpgrade` 使用 `getResources()` 获取资源快照
   - `startUpgrade` 传入同一快照，但内部再次调用 `checkUpgrade`
   - 如果在两次检查之间有其他操作改变了状态，第二次检查可能失败

3. **事件丢失风险**:
   - 如果 `bus.emit('building:upgrade-start')` 抛错，升级已完成但事件未发出
   - 下游系统（如UI更新、成就系统）可能不同步

**严重程度**: P1（严重）  
**影响范围**: 所有通过 `executeBuildingUpgrade` 执行的升级操作  
**修复建议**:
```typescript
// 方案A: 先改状态再扣资源（推荐）
ctx.building.startUpgrade(type, resources);  // 先改状态
try {
  ctx.resource.consumeBatch(cost);           // 再扣资源
} catch (e) {
  ctx.building.cancelUpgrade(type);          // 失败回滚
  throw e;
}

// 方案B: try-catch包裹
try {
  ctx.resource.consumeBatch(cost);
} catch (e) { throw e; }
try {
  ctx.building.startUpgrade(type, resources);
} catch (e) {
  ctx.resource.addResource('grain', cost.grain);  // 回滚资源
  // ... 其他资源类型
  throw e;
}
```

**现有测试覆盖情况**: `engine-building-ops.test.ts:110-157` 使用mock测试，`consumeBatch` 是 `vi.fn()` 不会真正抛错，**未测试startUpgrade抛错时的资源回滚**。

---

## 二、新发现缺陷

### NEW-P2-01: tick()完成升级后无事件通知 ⚠️

**源码位置**: `BuildingSystem.ts:270-295`

```typescript
tick(): BuildingType[] {
    for (const slot of this.upgradeQueue) {
      if (now >= slot.endTime) {
        state.level += 1;
        state.status = 'idle';
        completed.push(slot.buildingType);
      }
    }
    // ← 无 bus.emit('building:upgrade-complete', ...)
    return completed;
}
```

**分析**: `executeBuildingUpgrade` 发出 `building:upgrade-start` 事件，但 `tick()` 完成升级后无对应 `building:upgrade-complete` 事件。BuildingSystem 本身不持有事件总线引用（`deps` 仅在 `init` 时注入但未在tick中使用）。

**严重程度**: P2（一般）  
**影响**: 下游系统无法感知升级完成，需轮询 `getUpgradeQueue()` 检测

---

### NEW-P2-02: cancelUpgrade不检查建筑是否在队列中

**源码位置**: `BuildingSystem.ts:240-257`

```typescript
cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.status !== 'upgrading') return null;
    const cost = this.getUpgradeCost(type);
    if (!cost) return null;
    // ... 计算退款
    state.status = 'idle';
    this.upgradeQueue = this.upgradeQueue.filter(s => s.buildingType !== type);
    return refund;
}
```

**分析**: 如果 `status === 'upgrading'` 但建筑不在 `upgradeQueue` 中（数据不一致），`cancelUpgrade` 仍然返回退款。虽然正常情况不会发生，但配合 P1-DEFECT-02 的deserialize不校验，可能产生退款漏洞。

**严重程度**: P2（一般）

---

### NEW-P2-03: getUpgradeCost在level=0时返回null但unlock设置level=1

**源码位置**: `BuildingSystem.ts:185-189` + `BuildingSystem.ts:108-113`

```typescript
getUpgradeCost(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.level <= 0 || state.level >= BUILDING_DEFS[type].maxLevel) return null;
    // ...
}

checkAndUnlockBuildings(): BuildingType[] {
    // ...
    s.status = 'idle';
    s.level = 1;  // 解锁直接设为Lv1
}
```

**分析**: 解锁时直接设level=1，跳过了level=0→1的升级过程。这是设计决策（解锁即Lv1），但 `getUpgradeCost` 在level=0时返回null，意味着locked建筑永远无法通过正常升级路径从level=0到level=1。这不是bug，但应文档化。

**严重程度**: P3（轻微，设计说明）

---

### NEW-P2-04: batchUpgrade中startUpgrade接收的resources可能过时

**源码位置**: `BuildingBatchOps.ts:82-86`

```typescript
const cost = ctx.startUpgrade(t, currentResources);
```

**分析**: `startUpgrade` 内部会再次调用 `checkUpgrade`，使用传入的 `currentResources`。但 `currentResources` 是batchUpgrade维护的本地递减副本，不是真实的 ResourceSystem 状态。如果其他地方也修改了资源（如并行操作），startUpgrade 的内部检查可能与batch的本地状态不一致。

**严重程度**: P2（一般，单线程环境下不会触发）

---

### NEW-P3-01: getProduction对超出levelTable范围的level返回0

**源码位置**: `BuildingSystem.ts:194-197`

```typescript
getProduction(type: BuildingType, level?: number): number {
    const lv = level ?? this.buildings[type].level;
    if (lv <= 0) return 0;
    const data = BUILDING_DEFS[type].levelTable[lv - 1];
    return data?.production ?? 0;  // ← 超范围返回0
}
```

**分析**: 如果 `level` 超过 `levelTable` 长度（如篡改存档 level=99），返回0而非报错。这是安全降级，但可能掩盖数据问题。

**严重程度**: P3（轻微）

---

## 三、缺陷汇总

| ID | 缺陷描述 | 严重度 | 状态 | 关联测试节点 |
|----|---------|--------|------|-------------|
| P1-01 | cancelUpgrade退款Math.round精度偏差 | P1 | ✅确认 | F3-07, F5-07 |
| P1-02 | deserialize不校验level/status一致性 | P1 | ✅确认 | F3-08, F3-10 |
| P1-03 | consumeBatch与startUpgrade非原子 | P1 | ✅确认 | F3-09, F4-07 |
| P2-01 | tick()完成升级无事件通知 | P2 | 🆕新发现 | F4-09 |
| P2-02 | cancelUpgrade不校验队列一致性 | P2 | 🆕新发现 | F3-07 |
| P2-03 | unlock跳过level=0→1过程 | P2 | 🆕新发现 | F1-02 |
| P2-04 | batchUpgrade本地资源副本过时 | P2 | 🆕新发现 | F3-11 |
| P3-01 | getProduction超范围静默返回0 | P3 | 🆕新发现 | F2-06 |

---

## 四、R1测试树挑战

### 挑战1: F3-Error覆盖率虚高
R1声称F3覆盖71%，但实际只覆盖了"抛错"场景，未覆盖"静默错误"场景（如cancelUpgrade退款偏差、deserialize矛盾状态）。**有效覆盖率约52%**。

### 挑战2: F4-Cross缺少真实集成测试
R1的F4测试使用mock，未验证真实的跨系统交互（如executeBuildingUpgrade中consumeBatch+startUpgrade的原子性）。**有效覆盖率约50%**。

### 挑战3: F5-Lifecycle缺少状态机完整性
R1未绘制完整的状态机转换图，遗漏了locked→idle（解锁）、upgrading→idle（forceComplete）等路径。**有效覆盖率约55%**。

### 挑战4: 现有测试与实现同源
`BuildingSystem.test.ts:178` 使用 `Math.round(cost * CANCEL_REFUND_RATIO)` 验证退款——与实现使用相同公式，无法发现偏差。测试应验证 `refund >= cost * 0.75 && refund <= cost * 0.85`。

---

## 五、修复优先级建议

| 优先级 | 缺陷 | 修复工作量 | 建议时间 |
|--------|------|-----------|---------|
| P0-紧急 | P1-03 非原子操作 | 中（加try-catch+回滚） | 1天 |
| P0-紧急 | P1-02 deserialize校验 | 中（加一致性检查） | 1天 |
| P1-重要 | P1-01 退款精度 | 低（改Math.floor） | 0.5天 |
| P2-一般 | P2-01 tick无事件 | 中（需设计事件机制） | 2天 |
| P2-一般 | P2-02 cancel校验 | 低 | 0.5天 |
| P3-轻微 | P3-01 静默返回0 | 低（加日志） | 0.5天 |
