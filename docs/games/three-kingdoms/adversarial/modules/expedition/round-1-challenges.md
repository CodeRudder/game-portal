# Expedition R1 挑战书

> Challenger Agent | 基于 challenger-rules v1.4 | 2026-05-01

## 挑战总览

| 指标 | 值 |
|------|------|
| 挑战总数 | 12 |
| P0 确认 | 3 |
| P1 确认 | 4 |
| 驳回 | 5 |
| 虚报率 | 0% (仅确认有源码证据的P0) |

---

## P0-1: 保存/加载流程断裂 — 远征数据存档丢失

### 源码证据

**SaveContext 缺少 expedition 字段**（engine-save.ts:55-131）：
- SaveContext 接口有 resource, building, hero, campaign 等30+子系统引用
- **无 expedition 字段**

**GameSaveData 缺少 expedition 字段**（shared/types.ts:216-295）：
- GameSaveData 接口有 resource, building, campaign, heroStar, awakening 等20+子系统字段
- **无 expedition 字段**

**buildSaveData() 未调用 ExpeditionSystem.serialize()**（engine-save.ts:135-200）：
- 调用了 ctx.techTree.serialize(), ctx.hero.serialize(), ctx.campaign.serialize() 等
- **未调用任何 expedition.serialize()**

**applySaveData() 未调用 ExpeditionSystem.deserialize()**（engine-save.ts:425-640）：
- 调用了 ctx.hero.deserialize(), ctx.campaign.deserialize() 等
- **未调用任何 expedition.deserialize()**

**但 ExpeditionSystem 已实现 serialize()/deserialize()**（ExpeditionSystem.ts:415-480）：
- 完整的序列化/反序列化逻辑已存在
- 包括 teams, sweepCounts, routeNodeStatuses, lastDispatchConfig 等

### 复现场景

```typescript
// 1. 玩家完成远征，获得通关记录
const sys = new ExpeditionSystem();
sys.dispatchTeam('team1', 'route_hulao_easy');
sys.completeRoute('team1', 3);
// state.clearedRouteIds = Set(['route_hulao_easy'])

// 2. 保存游戏
const saveData = buildSaveData(ctx);
// saveData 中无 expedition 字段！

// 3. 加载游戏
applySaveData(ctx, saveData);
// ExpeditionSystem.deserialize() 从未被调用

// 4. 结果：远征进度全部丢失
sys.getState().clearedRouteIds; // 空 Set（默认值）
```

### 影响范围

- 所有远征进度（通关路线、星级、扫荡次数、队伍编成）
- 路线解锁状态（已解锁路线回退到锁定）
- 里程碑成就（全部重置）
- 自动远征配置和连续失败计数

### 规则引用

- BR-014: 保存/加载覆盖扫描
- BR-015: deserialize覆盖验证（六处同步）
- BR-024: 新增子系统时必须同步更新六处

### 六处同步检查

| 检查点 | 状态 | 位置 |
|--------|------|------|
| GameSaveData | ❌ 缺失 | shared/types.ts:216 |
| SaveContext | ❌ 缺失 | engine-save.ts:55 |
| buildSaveData() | ❌ 未调用 | engine-save.ts:135 |
| toIGameState() | ❌ 未包含 | engine-save.ts:204 |
| fromIGameState() | ❌ 未包含 | engine-save.ts:256 |
| applySaveData() | ❌ 未调用 | engine-save.ts:425 |

**严重度：P0-CRITICAL** — 用户保存后远征进度100%丢失

---

## P0-2: completeRoute(stars) NaN/负值未防护

### 源码证据

**ExpeditionSystem.ts:320-333**：
```typescript
completeRoute(teamId: string, stars: number): boolean {
    // ... 无 stars 参数校验
    const prevStars = this.state.routeStars[routeId] ?? 0;
    if (stars > prevStars) this.state.routeStars[routeId] = stars;
    // ...
}
```

- 无 `!Number.isFinite(stars) || stars < 0` 校验
- `NaN > prevStars` → false（不更新，看似安全）
- 但如果 `stars = -1`，`-1 > 0` → false（安全）
- 如果 `stars = Infinity`，`Infinity > 0` → true → **写入Infinity到routeStars**
- Infinity序列化后变为null，反序列化后变为null → 后续 `routeStars[routeId] ?? 0` → 0 → 星级丢失
- `stars = NaN` 写入时 `NaN > prevStars` → false → 不写入（看似安全）

### 复现场景

```typescript
const sys = new ExpeditionSystem();
sys.createTeam('t1', ['h1'], 'FISH_SCALE', heroMap);
sys.dispatchTeam('team1', 'route_hulao_easy');
sys.completeRoute('team1', Infinity);
// routeStars['route_hulao_easy'] = Infinity
const data = sys.serialize();
JSON.stringify(data); // Infinity → null
sys.deserialize(data);
// routeStars['route_hulao_easy'] = null → ?? 0 → 星级丢失
```

### 规则引用

- BR-01: 所有数值API入口必须检查NaN
- BR-17: 战斗数值安全
- BR-19: Infinity序列化风险

**严重度：P0** — Infinity写入导致序列化后数据损坏

---

## P0-3: recoverTroops(elapsedSeconds) NaN传播

### 源码证据

**ExpeditionSystem.ts:407-411**：
```typescript
recoverTroops(elapsedSeconds: number): void {
    const recoveryCycles = Math.floor(elapsedSeconds / TROOP_COST.recoveryIntervalSeconds);
    const recoveryAmount = recoveryCycles * TROOP_COST.recoveryAmount;
    for (const team of Object.values(this.state.teams)) {
      team.troopCount = Math.min(team.maxTroops, team.troopCount + recoveryAmount);
    }
}
```

- 无 `!Number.isFinite(elapsedSeconds)` 校验
- `NaN / 300` → NaN → `Math.floor(NaN)` → NaN
- `NaN * 1` → NaN
- `team.troopCount + NaN` → NaN
- `Math.min(maxTroops, NaN)` → NaN
- **所有队伍兵力变为NaN**

### 复现场景

```typescript
const sys = new ExpeditionSystem();
sys.createTeam('t1', ['h1'], 'FISH_SCALE', heroMap);
// team.troopCount = 100
sys.recoverTroops(NaN);
// team.troopCount = NaN
sys.dispatchTeam('team1', 'route_hulao_easy');
// NaN < requiredTroops → false → 派遣成功！
// NaN -= requiredTroops → NaN
```

### 规则引用

- BR-01: NaN绕过 `<= 0` 检查
- BR-21: 资源比较NaN防护（NaN < cost → false 绕过检查）

**严重度：P0** — NaN传播导致兵力系统崩溃，NaN绕过兵力检查

---

## P1-1: updateSlots(castleLevel) NaN防护缺失

### 源码证据

**ExpeditionSystem.ts:83-96**：
```typescript
updateSlots(castleLevel: number): number {
    const slots = this.getSlotCount(castleLevel);
    this.state.unlockedSlots = slots;
    return slots;
}

getSlotCount(castleLevel: number): number {
    const levels = Object.keys(CASTLE_LEVEL_SLOTS).map(Number).sort((a, b) => b - a);
    for (const lvl of levels) {
      if (castleLevel >= lvl) return CASTLE_LEVEL_SLOTS[lvl];
    }
    return 0;
}
```

- `NaN >= 20` → false, `NaN >= 15` → false, ... → return 0
- `unlockedSlots = 0` → 所有队伍无法派遣
- 虽然不会崩溃，但会导致功能异常

**严重度：P1** — NaN输入导致功能降级但不崩溃

---

## P1-2: processNodeEffect() healPercent NaN风险

### 源码证据

**ExpeditionSystem.ts:312-316**：
```typescript
const healPercent = node.healPercent ?? 0.20;
const healAmount = Math.round(team.maxTroops * healPercent);
team.troopCount = Math.min(team.maxTroops, team.troopCount + healAmount);
```

- healPercent 由配置创建，正常情况为 0.20
- 但如果 deserialize 恢复的节点数据中 healPercent 被设为 NaN
- `NaN ?? 0.20` → NaN（??不拦截NaN，只拦截null/undefined）
- `Math.round(maxTroops * NaN)` → NaN
- `troopCount + NaN` → NaN

**严重度：P1** — 需要外部数据注入（deserialize），正常流程不会触发

---

## P1-3: AutoExpeditionSystem.remainingRepeats 未持久化

### 源码证据

**AutoExpeditionSystem.ts:135-136**：
```typescript
private remainingRepeats: number | null = null;
```

- remainingRepeats 是 AutoExpeditionSystem 的内部状态
- AutoExpeditionSystem 无 serialize()/deserialize()
- ExpeditionSystem.serialize() 不包含 remainingRepeats
- 保存/加载后 remainingRepeats 重置为 null（=无限）
- 如果玩家设定了有限次数（如 repeatCount=5），加载后会变为无限循环

**严重度：P1** — 仅在自动远征有限次数模式+保存/加载时触发

---

## P1-4: quickBattle() NaN输入风险

### 源码证据

**ExpeditionBattleSystem.ts:140-188**：
```typescript
quickBattle(allyPower, allyFormation, enemyPower, enemyFormation) {
    const counterBonus = this.getCounterBonus(allyFormation, enemyFormation);
    const effectiveAlly = allyPower * (1 + counterBonus);
    const powerRatio = effectiveAlly / Math.max(enemyPower, 1);
    // NaN * 1 = NaN, NaN / 1 = NaN
    if (powerRatio >= 2.0) { ... } // NaN >= 2.0 → false
    // ... 落入 else 分支
    allyHpPercent = Math.random() * 10; // 正常
    allyDeaths = Math.floor(Math.random() * 5); // 正常
    // totalTurns: Math.ceil(10 / Math.max(NaN, 0.1)) → Math.ceil(10 / NaN) → NaN
```

- NaN输入不会崩溃，但 totalTurns 变为 NaN
- allyHpPercent 和 allyDeaths 正常（随机值）

**严重度：P1** — 输出含NaN但不崩溃

---

## 驳回的挑战（5个）

| # | 挑战描述 | 驳回原因 |
|---|---------|---------|
| D-1 | executeBattle() NaN防护 | 内部调用，数据来自 ExpeditionSystem 已校验的队伍数据 |
| D-2 | calculateNodeReward() gradeMultiplier NaN | grade 枚举值，switch 有 default 分支 |
| D-3 | validateTeam() heroIds 为空数组 | 已有 `heroIds.length === 0` 检查 |
| D-4 | scaleReward() multiplier=NaN | 内部调用方均使用有限值 |
| D-5 | autoComposeTeam() candidates为空 | 已有 `candidates.length === 0` 返回空数组 |

## 总结

| 级别 | 数量 | 修复优先级 |
|------|------|-----------|
| P0 | 3 | 立即修复 |
| P1 | 4 | 下轮修复 |
| 驳回 | 5 | - |
| **虚报率** | **0%** | 所有P0均有源码行号+复现场景 |
