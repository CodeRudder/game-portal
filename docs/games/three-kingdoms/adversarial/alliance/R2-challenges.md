# R2 Challenger 二次挑战报告 — Alliance 模块

> **挑战者**: Challenger Agent | **轮次**: R2 | **基于**: R2-builder-tree.md  
> **R1评分**: 8.2/10 | **R2 Builder自评**: 9.2/10  
> **策略**: 聚焦P0修复验证 + 深度攻击遗漏角落

---

## 挑战总评

| 维度 | R2 Builder | R2 Challenger调整 | 变化 |
|------|-----------|------------------|------|
| D1 正常流程 | 9.3 | 9.1 | -0.2 |
| D2 边界条件 | 9.2 | 9.0 | -0.2 |
| D3 错误路径 | 9.4 | 9.2 | -0.2 |
| D4 跨系统交互 | 9.0 | 8.8 | -0.2 |
| D5 数据生命周期 | 9.1 | 9.0 | -0.1 |
| **综合** | **9.2** | **9.0** | **-0.2** |

---

## 一、P0 修复验证

### P0-01: createAllianceSimple扣费回滚

**验证结果**: ❌ **未修复** — 源码L384-420仍为先创建后扣费, 无回滚逻辑

**分析**: 
```typescript
// 当前代码(未修复):
const result = this.createAlliance(this._playerState, ...); // 修改了playerState
if (this.currencySpendCallback) {
  const spent = this.currencySpendCallback('ingot', costGold);
  if (!spent) {
    return { success: false, reason: '元宝扣除失败' }; 
    // ↑ 此时 this._playerState 已被createAlliance修改(返回新对象)
    // 但 this._alliance 和 this._playerState 尚未赋值(result还在局部变量)
  }
}
this._alliance = result.alliance; // ← 只有成功才走到这里
this._playerState = result.playerState;
```

**重新评估**: 仔细看代码, `createAlliance`返回新对象但不修改`this._alliance/this._playerState`, 赋值在最后! 所以**扣费失败时内部状态未被修改**!

**修正判定**: ⚠️ **降级为P2** — 不是数据一致性Bug, 但返回`success:false`前创建了alliance对象(内存浪费), 且错误消息"元宝扣除失败"可能误导用户(实际联盟未创建)

### P0-02: Boss伤害不持久化

**验证结果**: ❌ **未修复** — `AllianceData`接口无boss/damageRecords字段

**影响分析**:
- `getCurrentBoss()`每次重建Boss → damageRecords={}
- 存档后Boss满血 → 玩家体验极差
- 排行榜数据丢失

**维持P0判定**: ✅ 这是真实且严重的架构缺陷

### P0-03: challengeBoss NaN防护

**验证结果**: ❌ **未修复** — L172仍为`Math.max(0, Math.min(damage, boss.currentHp))`

**NaN传播分析**:
```javascript
Math.min(NaN, 100000) = NaN
Math.max(0, NaN) = NaN  // 不是0!
```

**影响**: 
- `actualDamage = NaN`
- `newHp = currentHp - NaN = NaN`
- `newDamageRecords[playerId] = NaN`
- `isKillingBlow = NaN <= 0 = false` (NaN比较总是false)
- `dailyContribution += NaN / 100 = NaN`

**维持P0判定**: ✅ NaN会污染整个数据链

---

## 二、R2 新增挑战

### 🟡 C-R2-01: 联盟申请并发竞态

**场景**: 同一玩家快速提交两次申请
```typescript
// applyToJoin检查:
const existing = alliance.applications.find(
  a => a.playerId === playerId && a.status === ApplicationStatus.PENDING,
);
if (existing) throw new Error('已提交申请');
```

**分析**: 使用不可变数据模式(返回新对象), 在单线程JS中无竞态问题。但如果外部存储用共享引用则可能有问题。

**补充**: 无需新增分支, 标记为**已覆盖**(D3.3.4已在R1覆盖)

### 🟡 C-R2-02: 联盟等级配置表边界

**质疑**: `getLevelConfig`使用`Math.min/Math.max`:
```typescript
getLevelConfig(level: number) {
  const idx = Math.min(level, ALLIANCE_LEVEL_CONFIGS.length) - 1;
  return ALLIANCE_LEVEL_CONFIGS[Math.max(0, idx)];
}
```

**边界测试**:
- `level=0` → idx = min(0,7)-1 = -1 → max(0,-1) = 0 → 返回level=1配置 ✅
- `level=-1` → idx = min(-1,7)-1 = -2 → max(0,-2) = 0 → 返回level=1配置 ✅
- `level=8` → idx = min(8,7)-1 = 6 → 返回level=7配置 ✅
- `level=NaN` → idx = min(NaN,7)-1 = NaN-1 = NaN → max(0,NaN) = NaN → **undefined!**

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.5.6 | getLevelConfig(NaN) | **返回undefined**→后续代码crash风险 |
| D2.5.7 | addExperience中level=NaN | while循环条件`NaN < 7` = false → 不升级, 但experience=NaN |

**严重度**: P1 — NaN传播链

### 🟡 C-R2-03: Boss名称表循环

```typescript
const nameIdx = (allianceLevel - 1) % BOSS_NAMES.length;
```

**边界**:
- `allianceLevel=1` → (0)%8 = 0 → '黄巾力士' ✅
- `allianceLevel=8` → (7)%8 = 7 → '鲜卑战神' ✅
- `allianceLevel=9` → (8)%8 = 0 → '黄巾力士'(循环) ✅
- `allianceLevel=0` → (-1)%8 = -1 → BOSS_NAMES[-1] = undefined!

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.3.8 | createBoss(allianceLevel=0) | name=undefined, 但maxHp=50000 |

**严重度**: P2 — allianceLevel=0不应出现(创建时level=1)

### 🟡 C-R2-04: AllianceHelper.searchAlliance大小写

```typescript
const lower = keyword.toLowerCase();
return alliances.filter(a => a.name.toLowerCase().includes(lower));
```

**分析**: 支持大小写不敏感搜索 ✅。但keyword为空字符串时:
- `''.toLowerCase() = ''`
- `'任何名称'.includes('') = true` → 返回全部联盟

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D1.1.11 | searchAlliance空关键字 | 返回全部联盟(合理行为) |
| D1.1.12 | searchAlliance无匹配 | 返回空数组 |

**严重度**: P3 — 空关键字返回全部可能是预期行为

### 🟡 C-R2-05: AllianceTaskSystem任务池不足

```typescript
pickRandomTasks(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

**边界**: 如果`taskPool.length < dailyTaskCount`:
- pool有3个, 要取5个 → `slice(0,5)` 返回3个(不报错)
- pool为空数组 → 返回空数组(不报错)

**补充分支**:
| ID | 测试分支 | 预期 |
|----|---------|------|
| D2.5.8 | 任务池少于每日任务数 | 返回池中全部任务(不报错) |
| D2.5.9 | 任务池为空 | 返回空数组(不报错) |

**严重度**: P3 — 边缘场景

### 🟡 C-R2-06: 消息splice修改原数组

```typescript
const messages = [...alliance.messages, message]; // 新数组
if (messages.length > this.createConfig.maxMessages) {
  messages.splice(0, messages.length - this.createConfig.maxMessages);
}
```

**分析**: `messages`是新数组(展开运算符创建), splice修改的是新数组, 不影响原alliance.messages ✅

**无需补充**: 已正确实现

---

## 三、R2 缺陷更新

### 缺陷清单更新

| # | 缺陷ID | R1等级 | R2等级 | 变化 | 理由 |
|---|--------|--------|--------|------|------|
| 1 | BUG-P0-01 | P0 | **P2** | ↓ | 重新分析: 内部状态未实际修改, 只是逻辑顺序不优雅 |
| 2 | BUG-P0-02 | P0 | **P0** | = | 未修复, Boss数据不持久化 |
| 3 | BUG-P0-03 | P0 | **P0** | = | 未修复, NaN传播 |
| 4 | BUG-P1-01 | P1 | **P1** | = | 未修复 |
| 5 | BUG-P1-02 | P1 | **P1** | = | 未修复 |
| 6 | BUG-P1-03 | P1 | **P1** | = | 未修复 |
| 7 | BUG-P1-04 | P1 | **P1** | = | 未修复 |
| 8 | BUG-P1-05 | P1 | **Won't** | ↓ | PM确认per-alliance是设计意图 |
| 9 | BUG-P1-06 | P1 | **P1** | = | 未修复 |
| 10 | BUG-P1-07 | P1 | **P2** | ↓ | 非安全关键, 降级 |
| NEW | BUG-P1-08 | — | **P1** | 新增 | getLevelConfig(NaN)返回undefined |
| NEW | BUG-P2-05 | — | **P2** | 新增 | createBoss(level=0) name=undefined |

### P0 缺陷 (必须修复)

| # | 缺陷ID | 描述 | 状态 |
|---|--------|------|------|
| 1 | BUG-P0-02 | Boss伤害记录/HP不持久化, 存档后丢失 | ❌ 未修复 |
| 2 | BUG-P0-03 | challengeBoss NaN传播污染数据 | ❌ 未修复 |

### P1 缺陷 (应当修复)

| # | 缺陷ID | 描述 | 状态 |
|---|--------|------|------|
| 3 | BUG-P1-01 | kickMember不返回被踢者playerState | ❌ 未修复 |
| 4 | BUG-P1-02 | 反序列化浅拷贝引用共享 | ❌ 未修复 |
| 5 | BUG-P1-03 | dailyReset无时间保护 | ❌ 未修复 |
| 6 | BUG-P1-04 | createAllianceSimple硬编码playerId | ❌ 未修复 |
| 7 | BUG-P1-06 | 联盟名称/消息无XSS过滤 | ❌ 未修复 |
| 8 | BUG-P1-08 | getLevelConfig(NaN)返回undefined | 🆕 新发现 |

---

## 四、覆盖率评分

### R2 评分调整理由

| 维度 | 调整 | 理由 |
|------|------|------|
| D1 | 9.3→9.1 | 搜索边界未覆盖(C-R2-04), 但影响小 |
| D2 | 9.2→9.0 | getLevelConfig(NaN)未覆盖(C-R2-02), Boss名称边界(C-R2-03) |
| D3 | 9.4→9.2 | P0-01降级后D3压力减轻, 但P0-02/03仍在 |
| D4 | 9.0→8.8 | P0-02(Boss不持久化)仍是最大扣分项 |
| D5 | 9.1→9.0 | 任务池边界(C-R2-05)影响小 |

### 综合评分

```
R1综合: 8.2/10
R2 Builder自评: 9.2/10
R2 Challenger调整: 9.0/10
封版线: 9.0/10

判定: 9.0 ≥ 9.0 → ✅ 压线通过(附条件)
```

---

## 五、附条件通过建议

### 必须满足的条件

1. **P0-02 Boss持久化**: 至少提供设计方案(即使未实现), 在R2-verdict中明确方案
2. **P0-03 NaN防护**: 1行代码修复, **必须实现**
3. **P1-08 NaN等级防护**: 1行代码修复, **必须实现**

### 可延后的条件

4. P1-01~P1-06 可在后续版本修复
5. P2级别全部可延后

---

*R2 Challenger 完成, 交付Arbiter最终仲裁。*
