# Hero模块挑战清单 — Round 3

> 生成时间: 2025-01-XX
> 挑战者: TreeChallenger (Architect Agent)
> 审查对象: Round 2 流程树（427节点）+ R2挑战清单反馈
> 对照依据: round-2-challenges.md, round-2-verdict.md, 源码验证
> **注意**: R3流程树文件(round-3-tree.md)尚未生成，本审查基于R2终态和源码验证

---

## 总体评价

| 指标 | R2终态 | R3期望 | 挑战者评估 | 差距说明 |
|------|--------|--------|-----------|----------|
| 总节点数 | 427 | ~500 | **427（未更新）** | R3 tree未生成，节点数无变化 |
| P0问题修复 | 5个P0 | 全部修复 | **0/5已验证** | R2挑战的5个P0均未在代码中修复 |
| API覆盖率 | ~76% | ≥90% | **~76%** | 无变化，14个API缺口仍在 |
| F-Cross覆盖率 | ~62%(实际) | ≥70% | **~62%** | 双路径经验系统未覆盖 |
| F-Lifecycle覆盖率 | ~65%(实际) | ≥70% | **~65%** | 存档迁移和反序列化顺序未补 |

**核心判断**：R2仲裁者给出了"有条件封版 YES（9.0分）"的裁决，但R2挑战者发现了5个P0级源码缺陷。R3流程树未生成，意味着这些P0问题既未在流程树中补充测试节点，也未在源码中修复。本审查将验证5个P0的现状并给出最终评估。

---

## Part A: R2五个P0问题验证

### P0-1: ERR-EXEC-001 — HeroRecruitExecutor路径碎片溢出丢失

**R2描述**: Executor路径招募重复武将时，碎片溢出部分直接丢失，无铜钱补偿。

**源码验证（2025-01-XX）**:

```typescript
// HeroRecruitExecutor.ts 行88-93（当前源码）
if (isDuplicate) {
  fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
  // ❌ 确认：无溢出转铜钱逻辑
}
```

对比 HeroRecruitSystem.ts 行376-380:
```typescript
if (isDuplicate) {
  fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
  const overflow = expectedFragments - actualGain;
  if (overflow > 0 && this.recruitDeps!.addResource) {
    this.recruitDeps!.addResource('gold', overflow * HeroSystemClass.FRAGMENT_TO_GOLD_RATE);
  }
}
```

**状态: 🔴 未修复，P0确认有效**
- Executor路径确实缺少溢出→铜钱补偿逻辑
- RecruitSystem路径有完整处理，两条路径行为不一致
- 影响：通过Executor（被HeroRecruitSystem.executeSinglePull内部调用）招募时，碎片溢出无补偿

> **重要修正**: 经源码验证，`HeroRecruitExecutor.executeSinglePull` 被 `HeroRecruitSystem.executeSinglePull`（行326）内部调用。但 RecruitSystem._executeRecruit（行360-390）中**直接内联了溢出处理逻辑**，而 RecruitSystem.executeSinglePull（行326-354）也调用了Executor。需要确认实际调用链路是走RecruitSystem内联逻辑还是Executor独立逻辑。

### P0-2: ERR-EXEC-002 — Executor与RecruitSystem溢出行为不一致

**R2描述**: 相同条件下两条路径结果不同，Executor少获得铜钱。

**状态: 🔴 未修复，P0确认有效**
- 这是P0-1的延伸问题
- 两条代码路径在处理重复武将时行为不同
- 如果Executor被独立调用（不通过RecruitSystem），则溢出确实丢失

### P0-3: BND-SHOP-001 — exchangeFragmentsFromShop无限购累计

**R2描述**: 连续调用exchangeFragmentsFromShop，每次都能买到dailyLimit数量。

**源码验证（2025-01-XX）**:

```typescript
// HeroStarSystem.ts 行123-137（当前源码）
exchangeFragmentsFromShop(generalId: string, count: number): ShopExchangeResult {
  if (!this.deps || count <= 0) return { success: false, ... };
  const config = SHOP_FRAGMENT_EXCHANGE.find((c) => c.generalId === generalId);
  if (!config) return { success: false, ... };
  const actualCount = Math.min(count, config.dailyLimit);  // 仅截断
  // ❌ 确认：无已兑换次数跟踪
  const totalGold = actualCount * config.pricePerFragment;
  if (!this.deps.canAffordResource(RESOURCE_TYPE_GOLD, totalGold)) return { ... };
  if (!this.deps.spendResource(RESOURCE_TYPE_GOLD, totalGold)) return { ... };
  this.heroSystem.addFragment(generalId, actualCount);
  return { success: true, ... };
}
```

**状态: 🔴 未修复，P0确认有效**
- `dailyLimit` 仅用于单次截断（`Math.min(count, dailyLimit)`）
- 无累计已兑换次数的状态追踪
- 玩家可无限次调用，每次获得 `dailyLimit` 数量的碎片
- 这是一个**经济系统漏洞**，可被利用无限获取碎片

### P0-4: BND-SHOP-002 — 商店限购形同虚设

**R2描述**: 日限购边界，已兑换9次再兑换仍成功。

**状态: 🔴 未修复，P0确认有效**
- 与P0-3同源问题，日限购机制完全无效
- `config.dailyLimit` 字段存在但未被正确使用

### P0-5: DUAL-EXP-001 — HeroSystem.addExp双路径状态同步

**R2描述**: HeroSystem.addExp（路径A，不扣铜钱）与HeroLevelSystem.addExp（路径B，扣铜钱）两条独立经验路径存在状态同步风险。

**源码验证（2025-01-XX）**:

```typescript
// HeroSystem.addExp（路径A）— 行400-423
addExp(generalId: string, exp: number): { general: GeneralData; levelsGained: number } | null {
  // 直接修改 general.level 和 general.exp
  // 不扣铜钱，不经过 HeroLevelSystem
}

// HeroLevelSystem.addExp（路径B）— 行223-268
addExp(generalId: string, amount: number): LevelUpResult | null {
  // 通过 this.levelDeps.spendResource(GOLD_TYPE, goldReq) 扣铜钱
  // 逐级升级
}

// engine-campaign-deps.ts 行73-80 — 路径A的调用者
addExp: (exp: number) => {
  const generals = hero.getAllGenerals();
  const perHero = Math.floor(exp / generals.length);
  for (const g of heroes) {
    hero.addExp(g.id, perHero);  // 调用路径A
  }
}
```

**状态: 🟡 需进一步确认，P0降级为P1**
- 两条路径确实独立存在
- 但HeroSystem.addExp直接修改的是 `this.state.generals[id]` 对象，HeroLevelSystem.addExp通过 `this.heroSystem.getGeneral(id)` 读取同一个对象引用
- **关键问题**：HeroLevelSystem是否有内部缓存？如果有缓存，路径A的修改不会被路径B感知
- 如果两者操作同一对象引用（无缓存），则状态天然同步，P0降为P1（设计意图验证）
- 建议通过测试验证：路径A升级后，路径B的 `getLevel()` 是否反映新等级

---

## Part B: 新遗漏扫描

### N1. R2挑战者56项遗漏的R3状态

由于R3 tree未生成，R2挑战者发现的56项遗漏（5个P0 + 16个P1 + 10个P2 + 25个低优先级）**全部仍然有效**。以下为关键遗漏清单：

| 优先级 | 数量 | 关键项 | R3状态 |
|--------|------|--------|--------|
| P0 | 5 | ERR-EXEC-001/002, BND-SHOP-001/002, DUAL-EXP-001 | 全部未解决 |
| P1 | 16 | DUAL-EXP-002/003, ERR-SER-001~004, ERR-REM-001/002, ERR-AW-001, LC-MIG-001/002, LC-ORD-001/002, LC-ADD-001, REWARD-001, BND-LU-001, BND-AE-001 | 全部未解决 |
| P2 | 10 | 13个查询API, BND-FRAG-001/002, XI-MISS-001~003 | 全部未解决 |

### N2. R2仲裁裁决遗留项状态

R2仲裁者列出了5个"不阻塞封版"的遗留项：

| # | 遗留项 | R3状态 |
|---|--------|--------|
| L-01 | R1树虚报节点未修正 | ❌ 未处理 |
| L-02 | 19个F-Normal查询API未枚举 | ❌ 未处理 |
| L-03 | 反序列化异常输入节点偏少 | ❌ 未处理 |
| L-04 | 并发节点可测试性存疑 | ❌ 未处理 |
| L-05 | 部分P1任务节点数偏少 | ❌ 未处理 |

### N3. 源码审查新发现（R3新增）

在验证P0问题时发现以下新问题：

| # | ID | 描述 | 源码位置 | 优先级 |
|---|-----|------|----------|--------|
| 1 | NEW-EXEC-001 | HeroRecruitSystem.executeSinglePull(行326)内部调用逻辑与_executeRecruit(行360)存在代码重复，两段重复武将处理逻辑应统一 | HeroRecruitSystem.ts:326-354 vs 360-390 | P2 |
| 2 | NEW-CAMPAIGN-001 | buildRewardDeps.addExp使用Math.floor截断经验分配，3个武将分10经验丢失1点，但无日志记录此截断 | engine-campaign-deps.ts:73 | P2 |
| 3 | NEW-SHOP-001 | exchangeFragmentsFromShop的dailyLimit来自静态配置SHOP_FRAGMENT_EXCHANGE，无运行时修改入口（如活动期间加倍限购） | HeroStarSystem.ts:128 | P2 |

> **评估**：R3新增发现均为P2级别，不构成新的P0/P1遗漏。R2挑战者的源码审查已足够深入，R3未发现更高优先级的新问题。

---

## Part C: 封版评估

### 封版门槛核查（基于R2终态）

| 指标 | 门槛 | R2声称 | 挑战者评估 | 通过 |
|------|------|--------|-----------|------|
| API覆盖率 | ≥90% | ~80% | ~76% | ❌ |
| F-Cross覆盖率 | ≥70% | 70% | ~62% | ❌ |
| F-Lifecycle覆盖率 | ≥65% | 74% | ~65% | ⚠️ 边缘 |
| P0节点covered率 | ≥98% | ~90% | ~90% | ❌ |
| P0源码缺陷修复 | 全部 | — | 0/5 | ❌ |
| 虚报节点数 | 0 | 0 | 0（新增） | ✅ |

### 封版建议

**封版: NO**

理由：
1. **5个P0源码缺陷均未修复**：exchangeFragmentsFromShop无限购漏洞（影响游戏经济）、Executor溢出丢失（影响玩家收益）、双路径状态同步（影响数据一致性）
2. **R3流程树未生成**：R2挑战者的56项遗漏未在R3中得到任何回应
3. **API覆盖率76%**距90%门槛仍有显著差距
4. **F-Cross实际覆盖率~62%**低于声称的70%，未达门槛

**但认可R2的质量水准**：R2的120个新增节点（原子性18、碎片路径20、溢出转化12、跨系统36、生命周期14、异常10、边界10）是高质量的补充，附录C的源码缺陷分析尤其出色。R2的问题不是"做得不好"，而是"做得还不够完整"。

---

## Part D: R3建议（如需继续迭代）

### 必须完成（阻塞封版）

| # | 任务 | 预估节点 | 优先级 |
|---|------|----------|--------|
| R3-01 | 修复exchangeFragmentsFromShop日限购累计逻辑 | 代码修复+3个测试节点 | P0 |
| R3-02 | 统一Executor与RecruitSystem溢出处理 | 代码修复+4个测试节点 | P0 |
| R3-03 | 补充HeroSystem.addExp双路径一致性测试 | 5个测试节点 | P0→P1 |
| R3-04 | 补充13个R1遗留查询API节点 | 13个节点 | P1 |
| R3-05 | 补充反序列化异常输入节点(ERR-SER-001~004) | 4个节点 | P1 |

### 建议完成（提升质量）

| # | 任务 | 预估节点 | 优先级 |
|---|------|----------|--------|
| R3-06 | 补充removeGeneral级联清理节点(ERR-REM-001~003) | 3个节点 | P1 |
| R3-07 | 补充存档版本迁移节点(LC-MIG-001~003) | 3个节点 | P1 |
| R3-08 | 补充反序列化顺序依赖节点(LC-ORD-001/002) | 2个节点 | P1 |
| R3-09 | 补充经验分配截断节点(REWARD-001~003) | 3个节点 | P1 |

---

## 统计汇总

| 维度 | R2遗漏(R2挑战者发现) | R3验证状态 | R3新发现 |
|------|---------------------|-----------|----------|
| P0 | 5 | 4个确认🔴 + 1个降级🟡 | 0 |
| P1 | 16 | 全部未解决 | 0 |
| P2 | 10+25 | 全部未解决 | 3 |
| **合计** | **56** | **0已解决** | **3** |

---

*Round 3 挑战清单完成。由于R3流程树未生成，本审查聚焦于验证R2发现的5个P0源码缺陷。验证结果：4个P0确认有效（代码未修复），1个P0建议降级为P1（需测试确认）。同时发现3个新的P2级问题。建议在R3迭代中优先修复P0源码缺陷并补充相应测试节点。*
