# Alliance R1 Challenger 挑战报告

> 模块: engine/alliance | 日期: 2026-05-01
> Challenger: v1.9 | 源码行数: 1562

## 挑战维度

- **D1**: NaN绕过 <=0 检查
- **D2**: deserialize null/undefined
- **D3**: serialize 缺失字段
- **D4**: 负值漏洞
- **D5**: engine-save 接入

---

## P0 缺陷（Critical）

### P0-001: Alliance 4个子系统完全未接入 engine-save ⚠️⚠️⚠️

**维度**: D5 (engine-save接入) | **严重性**: P0-Critical

**源码证据**:
- `engine-save.ts` SaveContext 接口 (L55-140): 无 alliance 相关字段
- `shared/types.ts` GameSaveData 接口 (L216-315): 无 alliance 相关字段
- `buildSaveData()` (L152-236): 未调用 alliance.serialize()
- `applySaveData()` (L479-700): 未调用 alliance.deserialize()
- `toIGameState()` (L238-298): 未处理 alliance 数据
- `fromIGameState()` (L300-360): 未处理 alliance 数据

**影响**:
- 玩家创建联盟、加入联盟后，存档/读档所有联盟数据丢失
- 公会币、Boss挑战次数、任务进度、商店限购状态全部丢失
- AllianceTaskSystem 内部 activeTasks (含 Set<string>) 无法持久化
- AllianceShopSystem 内部 shopItems.purchased 状态无法持久化
- 违反 BR-014 (保存/加载覆盖扫描)、BR-015 (deserialize覆盖验证六处同步)

**复现路径**:
1. 创建联盟 → 加入成员 → 挑战Boss → 购买商品 → 完成任务
2. 保存游戏 (buildSaveData 不序列化 alliance)
3. 加载游戏 (applySaveData 不反序列化 alliance)
4. 结果: 联盟数据全部丢失, 玩家回到无联盟状态

**修复方案**:
1. SaveContext 增加 4 个 alliance 字段
2. GameSaveData 增加 alliance 相关字段
3. buildSaveData() 调用各子系统 serialize
4. applySaveData() 调用各子系统 deserialize
5. toIGameState/fromIGameState 处理 alliance 数据

---

### P0-002: AllianceTaskSystem.activeTasks 含 Set<string> 无法 JSON 序列化

**维度**: D3 (serialize缺失) | **严重性**: P0-Critical

**源码位置**: AllianceTaskSystem.ts L258-265

```typescript
export interface AllianceTaskInstance {
  claimedPlayers: Set<string>;  // ← Set 无法 JSON.stringify
}
```

**问题**: `serializeTasks()` 方法存在但返回 `string[]`，而 `AllianceSaveData` 只序列化 `AlliancePlayerState` + `AllianceData`，**不包含 TaskSystem 的 activeTasks**。即使 P0-001 修复后，TaskSystem 的内部状态（activeTasks + purchased）仍需要额外的序列化路径。

**影响**: 任务进度、领取状态无法持久化

**修复方案**: AllianceTaskSystem 需要独立的 serialize/deserialize 方法，并在 engine-save 中调用

---

### P0-003: AllianceShopSystem 内部 shopItems.purchased 状态无法持久化

**维度**: D3 (serialize缺失) | **严重性**: P0-Critical

**源码位置**: AllianceShopSystem.ts L78-83

```typescript
private shopItems: AllianceShopItem[];
// item.purchased 是可变状态，但无 serialize/deserialize 方法
```

**问题**: AllianceShopSystem 没有实现 `serialize()` 和 `deserialize()` 方法。`getState()` 返回了副本但不是标准的存档接口。`reset()` 方法重置 purchased 但不是存档恢复。

**影响**: 商店限购状态无法持久化，每周重置后如果存档/读档，限购状态丢失

**修复方案**: 添加 serialize/deserialize 方法，返回/恢复 purchased 状态

---

## P1 缺陷（Major）

### P1-001: addExperience NaN 绕过 Math.max(0, NaN) = 0 但静默吞掉

**维度**: D1 (NaN绕过) | **严重性**: P1-Major

**源码位置**: AllianceSystem.ts L229

```typescript
const safeExp = Math.max(0, exp);  // Math.max(0, NaN) = 0 → 静默吞掉
```

**问题**: 传入 `NaN` 时不会报错，而是静默忽略。虽然不会导致数据损坏，但违反 BR-01 (数值API入口必须检查NaN)。

**建议修复**:
```typescript
if (!Number.isFinite(exp) || exp < 0) throw new Error('经验值必须为非负有限数');
```

---

### P1-002: challengeBoss NaN damage 绕过，消耗挑战次数但零伤害

**维度**: D1 (NaN绕过) | **严重性**: P1-Major

**源码位置**: AllianceBossSystem.ts L161

```typescript
const actualDamage = Math.max(0, Math.min(damage, boss.currentHp));
// Math.min(NaN, hp) = NaN → Math.max(0, NaN) = 0
```

**问题**: 传入 `NaN` damage 时，actualDamage=0，但 dailyBossChallenges++ 仍然执行，消耗了挑战次数。

**影响**: 玩家可能因客户端 bug 无意传入 NaN，浪费挑战机会。

**建议修复**:
```typescript
if (!Number.isFinite(damage) || damage < 0) throw new Error('伤害值无效');
```

---

### P1-003: updateProgress NaN 绕过 Math.max(0, NaN) = 0

**维度**: D1 (NaN绕过) | **严重性**: P1-Major

**源码位置**: AllianceTaskSystem.ts L175

```typescript
const safeProgress = Math.max(0, progress);
```

同 P1-001 模式。

---

### P1-004: recordContribution NaN 绕过

**维度**: D1 (NaN绕过) | **严重性**: P1-Major

**源码位置**: AllianceTaskSystem.ts L192

```typescript
const safeContribution = Math.max(0, contribution);
```

同 P1-001 模式。

---

### P1-005: createBoss 负 allianceLevel 导致 maxHp 为负值

**维度**: D4 (负值漏洞) | **严重性**: P1-Major

**源码位置**: AllianceBossSystem.ts L56-58

```typescript
const maxHp = DEFAULT_BOSS_CONFIG.baseHp + (bossLevel - 1) * DEFAULT_BOSS_CONFIG.hpPerLevel;
// allianceLevel=0 → maxHp = 100000 + (-1)*50000 = 50000 (勉强安全)
// allianceLevel=-1 → maxHp = 100000 + (-2)*50000 = 0
// allianceLevel=-2 → maxHp = -50000 (负HP!)
```

**问题**: createBoss 不验证 allianceLevel 下界。虽然正常流程中 alliance.level 始终 >= 1，但作为 exported function 可被外部直接调用。

**建议修复**:
```typescript
const safeLevel = Math.max(1, allianceLevel);
```

---

### P1-006: buyShopItemBatch count=0 或负值行为异常

**维度**: D4 (负值漏洞) | **严重性**: P1-Major

**源码位置**: AllianceShopSystem.ts L147-155

```typescript
const remaining = item.weeklyLimit > 0 ? item.weeklyLimit - item.purchased : count;
const actualCount = Math.min(count, remaining);
if (actualCount <= 0) throw new Error('已达限购上限');
```

**问题**: 当 `count` 为负数且 `weeklyLimit=0` 时，`remaining=count`（负数），`actualCount=Math.min(负数, 负数)` 为负数，`actualCount <= 0` → throw。虽然不会导致数据损坏，但错误信息不准确（不是限购问题而是参数问题）。

**建议修复**: 在函数入口验证 count > 0。

---

## P2 缺陷（Minor）

### P2-001: getLevelConfig 边界处理隐式

**源码位置**: AllianceSystem.ts L239

```typescript
const idx = Math.min(level, ALLIANCE_LEVEL_CONFIGS.length) - 1;
return ALLIANCE_LEVEL_CONFIGS[Math.max(0, idx)];
```

level=0 或负数时返回 levelConfigs[0]，虽然安全但无日志警告。

---

### P2-002: generateId 碰撞风险

**源码位置**: alliance-constants.ts L42

```typescript
return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

高并发时 Date.now() 相同 + Math.random() 短随机串可能碰撞。对游戏场景影响极小。

---

### P2-003: serializeAlliance 浅拷贝风险

**源码位置**: AllianceHelper.ts L72-79

```typescript
allianceData: alliance ? { ...alliance } : null,
```

只做了一层浅拷贝。`alliance.members` 是 Record<string, AllianceMember>，浅拷贝后 members 引用相同对象。虽然当前使用场景（JSON序列化）会深拷贝，但直接操作返回值可能意外修改原始数据。

---

### P2-004: createAllianceSimple 硬编码 playerId='player-1'

**源码位置**: AllianceSystem.ts L329

```typescript
const result = this.createAlliance(
  this._playerState, name, '', 'player-1', playerName, Date.now(),
);
```

硬编码 playerId 不利于多人场景或测试。

---

## 挑战统计

| 严重性 | 数量 | ID列表 |
|--------|------|--------|
| P0 | 3 | P0-001, P0-002, P0-003 |
| P1 | 6 | P1-001~P1-006 |
| P2 | 4 | P2-001~P2-004 |
| **总计** | **13** | |

## 按维度统计

| 维度 | 数量 |
|------|------|
| D1: NaN绕过 | 4 (P1-001~P1-004) |
| D2: deserialize null | 0 |
| D3: serialize缺失 | 2 (P0-002, P0-003) |
| D4: 负值漏洞 | 2 (P1-005, P1-006) |
| D5: engine-save接入 | 1 (P0-001) |
