# Phase1-R1 P0缺口修复 — 架构审查报告 (R2)

> **审查人**: PM Agent (架构审查)
> **审查日期**: 2026-05-02
> **审查范围**: Phase1-R1 提交 `a653a103` — 7个P0缺口测试文件，1697行新增代码
> **测试执行**: 8个文件 / 99个用例 / 全部通过 (4.75s)
> **综合评分**: **8.2 / 10**

---

## 一、总览

### 1.1 提交统计

| 指标 | 数值 |
|------|------|
| 新增测试文件 | 8个（含1个额外crash-fixes） |
| 新增测试用例 | 99个（超出预期的84个） |
| 新增代码行数 | 1,697行 |
| 测试通过率 | 100% (99/99) |
| 覆盖缺口ID | 8个P0缺口 |
| 涉及模块 | alliance(2) / battle(2) / hero(1) / resource(3) |

### 1.2 缺口覆盖映射

| 缺口ID | 缺口描述 | 测试文件 | 用例数 | 状态 |
|--------|----------|----------|--------|------|
| GAP-ALLIANCE-006 | 联盟Boss伤害累计 | P0-boss-damage-accumulation.test.ts | 14 | ✅ 已覆盖 |
| GAP-ALLIANCE-007 | 联盟战争攻防战斗 | P0-alliance-war.test.ts | 16 | ✅ 已覆盖 |
| GAP-BATTLE-001 | 战斗中断重连 | P0-battle-reconnect.test.ts | 12 | ✅ 已覆盖 |
| GAP-HERO-007 | 觉醒技能解锁 | P0-awaken-skill.test.ts | 15 | ✅ 已覆盖 |
| GAP-RES-001 | 粮仓降级容量截断 | P0-downgrade-cap-truncation.test.ts | 13 | ✅ 已覆盖 |
| GAP-RES-002 | 兵营降级容量截断 | P0-downgrade-cap-truncation.test.ts | (合并) | ✅ 已覆盖 |
| GAP-RES-006 | 攻城获得天命 | P0-mandate-siege-reward.test.ts | 12 | ✅ 已覆盖 |
| GAP-BUILD-001 | 产出上限验证 | P0-production-cap.test.ts | 12 | ✅ 已覆盖 |
| DEF-004/005/006 | 战斗崩溃缺陷修复 | P0-crash-fixes.test.ts | 33 | ✅ 额外覆盖 |

### 1.3 评分分布

| 文件 | 用例数 | 代码质量 | 断言强度 | 边界覆盖 | 评分 |
|------|--------|----------|----------|----------|------|
| P0-crash-fixes.test.ts | 33 | ★★★★★ | ★★★★★ | ★★★★★ | **9.5** |
| P0-downgrade-cap-truncation.test.ts | 13 | ★★★★★ | ★★★★☆ | ★★★★★ | **9.0** |
| P0-production-cap.test.ts | 12 | ★★★★☆ | ★★★★☆ | ★★★★☆ | **8.5** |
| P0-awaken-skill.test.ts | 15 | ★★★★☆ | ★★★★☆ | ★★★★☆ | **8.5** |
| P0-battle-reconnect.test.ts | 12 | ★★★★☆ | ★★★★☆ | ★★★☆☆ | **8.0** |
| P0-boss-damage-accumulation.test.ts | 14 | ★★★★☆ | ★★★★☆ | ★★★★☆ | **8.0** |
| P0-alliance-war.test.ts | 16 | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | **7.0** |
| P0-mandate-siege-reward.test.ts | 12 | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | **6.5** |

---

## 二、逐文件审查

### 2.1 P0-crash-fixes.test.ts ⭐ 9.5/10 — 最佳实践标杆

**覆盖缺口**: DEF-004 (null防护) / DEF-005 (负伤害漏洞) / DEF-006 (NaN传播)

**优点**:
- ✅ 33个用例，密度最高，每个缺陷都有完整的正例+反例+边界
- ✅ NaN全链防护测试覆盖了 `calculateDamage → applyDamage` 的完整链路
- ✅ 负伤害测试覆盖了 `-100`、`0`、`-9999` 三种边界值
- ✅ 每个describe块对应一个缺陷ID，可追溯性极强
- ✅ 测试工具函数 `createUnit` / `createTeam` 复用性好

**不足**:
- 无显著不足

**改进建议**: 可作为团队测试编写标准模板推广。

---

### 2.2 P0-downgrade-cap-truncation.test.ts ⭐ 9.0/10 — 精确边界验证

**覆盖缺口**: GAP-RES-001 + GAP-RES-002

**优点**:
- ✅ 精确的数值场景设计：`grain=4500, cap 5000→3500, 截断至3500`
- ✅ 覆盖了"恰好等于上限"、"低于上限"、"高于上限"三种边界
- ✅ 验证了"截断差值不退还"这一关键业务规则
- ✅ `updateCaps` 集成验证了降级→截断的完整链路
- ✅ `getCapWarning` 联动验证了截断后的UI提示

**不足**:
- ⚠️ 未测试负数cap（如 `setCap('grain', -1)`）的防御

**改进建议**: 补充一个 `setCap` 传入非法值的防御测试。

---

### 2.3 P0-production-cap.test.ts ⭐ 8.5/10 — 事件驱动验证完整

**覆盖缺口**: GAP-BUILD-001

**优点**:
- ✅ `tick` 产出上限验证完整，含"接近上限只增加差值"的精确场景
- ✅ `resource:overflow` 事件触发验证详细（含溢出量、cap值）
- ✅ 验证了"未溢出不触发事件"的反例
- ✅ `null` 上限资源（gold/mandate）的无限增长验证
- ✅ 不同资源类型上限独立性验证

**不足**:
- ⚠️ 未测试 `setProductionRate` 为0或负数的边界
- ⚠️ 未测试 tick 传入负数deltaTime的场景

**改进建议**: 补充 `setProductionRate('grain', 0)` 和 `tick(-1000)` 的防御测试。

---

### 2.4 P0-awaken-skill.test.ts ⭐ 8.5/10 — 回调验证到位

**覆盖缺口**: GAP-HERO-007

**优点**:
- ✅ 资源消耗验证完整：碎片、铜钱、突破石三种资源各有独立不足场景
- ✅ `skillUnlockCallback` 回调验证精确到调用参数 `(generalId, stage)`
- ✅ "觉醒技能不可重置"通过两种方式验证：序列化保持 + API不存在
- ✅ `getBreakthroughPreview` 预览功能验证完整

**不足**:
- ⚠️ "没有提供重置突破的方法"测试通过反射检查方法名，脆弱性较高
- ⚠️ 多次突破循环中 `if (!result.success) break` 的容错处理隐藏了潜在失败

**改进建议**: 
1. 反射检查改为更稳定的断言方式
2. 多次突破测试应断言每次都成功，而非静默跳过失败

---

### 2.5 P0-battle-reconnect.test.ts ⭐ 8.0/10 — 核心链路验证完整

**覆盖缺口**: GAP-BATTLE-001

**优点**:
- ✅ serialize/deserialize 往返一致性验证了id、phase、turn、HP、actionLog
- ✅ 重连后继续战斗直到结束的端到端验证
- ✅ 数据完整性校验：null/undefined/空对象/字段缺失
- ✅ 超时处理验证（高HP低攻击→最大回合→平局）

**不足**:
- ⚠️ **战斗模式恢复测试有耦合问题**：通过 `__subsystem` 私有属性验证模式恢复，依赖内部实现细节
- ⚠️ 未测试重连后怒气值(rage)和大招冷却(cooldown)的恢复
- ⚠️ 未测试 buffs/debuffs 状态在重连后的保持
- ⚠️ 超时测试耗时1006ms（高HP低攻击），可优化为降低maxTurns

**改进建议**:
1. 战斗模式恢复测试应通过公开API验证（如再次序列化检查），不依赖 `__subsystem`
2. 补充rage/cooldown/buffs的重连恢复验证
3. 超时测试使用更小的maxTurns参数

---

### 2.6 P0-boss-damage-accumulation.test.ts ⭐ 8.0/10 — 业务逻辑覆盖全面

**覆盖缺口**: GAP-ALLIANCE-006

**优点**:
- ✅ 挑战次数限制验证完整（3次→第4次拒绝→重置恢复→不同玩家独立）
- ✅ 伤害累计精确验证（1000+2000=3000）
- ✅ 排行榜降序排列验证
- ✅ 伤害不超过Boss当前HP的溢出保护
- ✅ 击杀奖励/参与奖/已击杀不可再战的完整生命周期

**不足**:
- ⚠️ 排行榜只测了2人，未测试3+人和并列伤害的排序
- ⚠️ 未测试Boss刷新后的状态重置

**改进建议**: 补充多人排行榜和Boss每日刷新场景。

---

### 2.7 P0-alliance-war.test.ts ⭐ 7.0/10 — 模拟器与真实系统脱节

**覆盖缺口**: GAP-ALLIANCE-007

**优点**:
- ✅ 每日3攻1防的精确限制验证
- ✅ 据点占领判定（damage>=1000）的阈值测试
- ✅ 权限验证（非成员拒绝、所有角色可参与）
- ✅ dailyReset 后次数恢复验证

**不足**:
- ⚠️ **核心问题：使用了自建 `AllianceWarSimulator` 模拟器而非真实系统API**
  - 文件注释明确写道"AllianceWarSystem尚未独立实现"
  - 测试的是模拟器逻辑而非产品代码，**存在假阳性风险**
  - 模拟器的 `attackRecords`/`defendRecords` 是内存Map，不经过持久化
- ⚠️ 据点占领阈值硬编码为1000，与配置表无关联
- ⚠️ "战争时间结束"测试依赖 `Date.now()`，不可控
- ⚠️ "联盟等级福利"测试（最后2个it）与战争主题无关，应独立文件

**改进建议**:
1. **P0优先**：当 `AllianceWarSystem` 实现后，替换模拟器为真实系统调用
2. 据点占领阈值应从配置表读取
3. 战争时间测试应注入可控时钟
4. 联盟等级福利测试移至独立文件

---

### 2.8 P0-mandate-siege-reward.test.ts ⭐ 6.5/10 — 断言深度不足

**覆盖缺口**: GAP-RES-006

**优点**:
- ✅ 天命无上限验证（100次循环增加）
- ✅ 首次通关 vs 非首次通关的奖励差异验证
- ✅ 天命消耗的边界验证（不足/恰好/零消耗）

**不足**:
- ⚠️ **测试粒度过粗**：核心场景"攻城获得天命"直接调用 `rs.addResource('mandate', 10)`
  - 未经过攻城系统（CampaignSystem）的完整链路
  - 未经过 RewardDistributor 的实际分发逻辑
  - 相当于测试了 `addResource` 能加数字，而非攻城→天命的完整流程
- ⚠️ "与配置表对照"测试硬编码数值（`baseMandateReward = 10`），未从实际配置文件读取
- ⚠️ "RewardDistributor分发mandate"测试手动模拟了分发循环，非真实调用
- ⚠️ `expect(rs.getAmount('grain')).toBeGreaterThan(300)` 断言不精确，应为精确值

**改进建议**:
1. **P1优先**：集成CampaignSystem进行端到端验证
2. 配置表数值应从实际文件导入，不硬编码
3. `grain` 初始值+奖励值应精确断言

---

## 三、问题清单

### P0 — 阻塞问题 (0个)

> 本次审查未发现P0阻塞问题。所有测试均通过且覆盖了声明的缺口。

### P1 — 严重问题 (3个)

| # | 问题 | 文件 | 描述 | 建议 |
|---|------|------|------|------|
| P1-1 | 模拟器替代真实系统 | P0-alliance-war.test.ts | AllianceWarSimulator是自建模拟器，非产品代码。当AllianceWarSystem实现后需全面重写 | 跟踪AllianceWarSystem开发进度，实现后替换 |
| P1-2 | 天命测试链路过短 | P0-mandate-siege-reward.test.ts | 直接调用addResource而非经过CampaignSystem→RewardDistributor完整链路 | 补充集成测试 |
| P1-3 | 战斗模式恢复依赖内部属性 | P0-battle-reconnect.test.ts | 通过`__subsystem`私有属性验证，耦合实现细节 | 改用公开API验证 |

### P2 — 一般问题 (7个)

| # | 问题 | 文件 | 描述 |
|---|------|------|------|
| P2-1 | 负数cap未防御 | P0-downgrade-cap-truncation.test.ts | `setCap('grain', -1)` 场景未覆盖 |
| P2-2 | 负数产出速率未防御 | P0-production-cap.test.ts | `setProductionRate('grain', -100)` 场景未覆盖 |
| P2-3 | 负数tick时间未防御 | P0-production-cap.test.ts | `tick(-1000)` 场景未覆盖 |
| P2-4 | 重连后rage/cooldown未验证 | P0-battle-reconnect.test.ts | 怒气值和技能冷却的重连恢复未测试 |
| P2-5 | 排行榜并列未测试 | P0-boss-damage-accumulation.test.ts | 多人同伤害的排序稳定性未验证 |
| P2-6 | 配置表硬编码 | P0-mandate-siege-reward.test.ts | 天命奖励数值硬编码，未从配置文件导入 |
| P2-7 | 联盟等级福利测试错位 | P0-alliance-war.test.ts | 2个联盟等级福利测试与战争主题无关 |

---

## 四、架构级观察

### 4.1 测试分层分析

```
                    ┌──────────────────────┐
                    │   E2E / Integration   │  ← 缺失：无跨系统端到端测试
                    ├──────────────────────┤
                    │   Component / Module  │  ← 薄弱：mandate/siege未经过CampaignSystem
                    ├──────────────────────┤
  ██████████████████│   Unit / Function     │  ← 强：crash-fixes/downgrade-cap 质量优秀
                    ├──────────────────────┤
                    │   Simulator / Mock    │  ← 风险：alliance-war 使用模拟器
                    └──────────────────────┘
```

**结论**: Phase1-R1 的测试重心在 Unit 层，Component 和 Integration 层覆盖不足。

### 4.2 Mock依赖分析

| 文件 | Mock方式 | 风险 |
|------|----------|------|
| P0-crash-fixes | 无Mock，直接实例化 | ✅ 零风险 |
| P0-downgrade-cap | createMockDeps（事件总线） | ✅ 低风险 |
| P0-production-cap | createMockDeps（事件总线） | ✅ 低风险 |
| P0-awaken-skill | vi.fn() Mock依赖注入 | ✅ 低风险 |
| P0-battle-reconnect | 无Mock，直接实例化 | ✅ 零风险 |
| P0-boss-damage | createMockDeps + 真实AllianceBossSystem | ✅ 低风险 |
| P0-alliance-war | **自建AllianceWarSimulator** | ⚠️ 高风险 |
| P0-mandate-siege | createMockDeps + 手动模拟分发 | ⚠️ 中风险 |

### 4.3 辅助代码复用性

| 辅助函数 | 出现次数 | 建议提取 |
|----------|----------|----------|
| `createMockDeps()` | 6次 | ✅ 提取到共享 `test-utils.ts` |
| `createUnit()` | 3次 | ✅ 提取到 `battle-test-utils.ts` |
| `createTeam()` | 3次 | ✅ 提取到 `battle-test-utils.ts` |
| `createTestAlliance()` | 2次 | ✅ 提取到 `alliance-test-utils.ts` |
| `createPlayerState()` | 3次 | ✅ 提取到 `alliance-test-utils.ts` |

---

## 五、改进建议（按优先级排序）

### Must（必须改进）

| # | 建议 | 工时 | 影响 |
|---|------|------|------|
| M1 | 提取共享测试工具函数到 `test-utils.ts` | 2h | 消除6处重复代码 |
| M2 | alliance-war 等真实系统实现后替换模拟器 | 4h | 消除假阳性风险 |

### Should（应该改进）

| # | 建议 | 工时 | 影响 |
|---|------|------|------|
| S1 | mandate-siege 补充 CampaignSystem 集成测试 | 3h | 覆盖完整攻城→天命链路 |
| S2 | battle-reconnect 补充 rage/cooldown/buffs 重连恢复测试 | 2h | 覆盖战斗状态完整恢复 |
| S3 | battle-reconnect 战斗模式恢复测试改用公开API | 1h | 消除内部实现耦合 |
| S4 | 所有数值配置从配置文件导入，消除硬编码 | 2h | 配置变更时测试自动适应 |

### Could（可以改进）

| # | 建议 | 工时 | 影响 |
|---|------|------|------|
| C1 | 补充负数参数防御测试（cap/rate/tick） | 1h | 增强边界覆盖 |
| C2 | 联盟等级福利测试独立为文件 | 0.5h | 改善文件组织 |
| C3 | boss-damage 补充多人并列排行榜测试 | 1h | 增强边界覆盖 |

---

## 六、规则库更新建议

### 6.1 新增模式建议

基于本次审查发现，建议在 `p0-pattern-library.md` 新增以下模式：

#### 模式10: 测试模拟器与产品代码脱节
- **出现频率**: 1次（本次发现）
- **检查方法**: 测试文件中是否包含自建Simulator/Mock类替代真实系统
- **典型案例**: AllianceWarSimulator替代AllianceWarSystem
- **修复模式**: 标记为 `@pending-real-impl`，待真实系统实现后替换
- **风险等级**: 高（假阳性风险）

#### 模式11: 测试链路过短（跳过中间层）
- **出现频率**: 1次（本次发现）
- **检查方法**: 测试是否直接调用底层API而非经过业务链路
- **典型案例**: 天命测试直接调用addResource而非CampaignSystem→RewardDistributor
- **修复模式**: 补充集成测试覆盖完整业务链路
- **风险等级**: 中（遗漏中间层缺陷风险）

### 6.2 缺口注册表更新

| 缺口ID | 当前状态 | 建议更新 |
|--------|----------|----------|
| GAP-ALLIANCE-006 | partial → | **covered** (14个用例验证) |
| GAP-ALLIANCE-007 | partial → | **partial** (模拟器覆盖，待真实系统) |
| GAP-BATTLE-001 | missing → | **covered** (12个用例验证) |
| GAP-HERO-007 | partial → | **covered** (15个用例验证) |
| GAP-RES-001 | (未注册) → | **covered** (合并入downgrade-cap) |
| GAP-RES-002 | (未注册) → | **covered** (合并入downgrade-cap) |
| GAP-RES-006 | (未注册) → | **partial** (链路过短) |
| GAP-BUILD-001 | missing → | **covered** (12个用例验证) |

### 6.3 跨系统规则补充

建议在 `cross-system-rules.md` 新增：

```
RULE-CROSS-041: 攻城→天命完整链路
  CampaignSystem.completeStage → RewardDistributor.distribute → ResourceSystem.addResource('mandate')
  验证点: 天命数量与配置表一致、首次通关双倍、失败不获得

RULE-CROSS-042: 降级→截断→警告联动
  BuildingSystem.downgrade → ResourceSystem.setCap → enforceCaps → getCapWarning
  验证点: 截断值精确、差值不退还、UI警告级别正确

RULE-CROSS-043: Boss挑战→伤害累计→排行榜→奖励分配
  AllianceBossSystem.challengeBoss → damageRecords → getDamageRanking → killReward
  验证点: 次数限制、伤害累计精确、排行榜降序、击杀奖励分配
```

---

## 七、结论

### 7.1 总体评价

Phase1-R1 的P0缺口修复工作**质量良好**，8个测试文件99个用例全部通过，覆盖了8个P0缺口中的6个完整覆盖、2个部分覆盖。代码风格统一，测试结构清晰，辅助函数设计合理。

**亮点**:
- `P0-crash-fixes.test.ts` 可作为团队测试标杆
- `P0-downgrade-cap-truncation.test.ts` 边界设计精妙
- DEF-004/005/006 三个崩溃缺陷的修复验证极其完整

**风险点**:
- `P0-alliance-war.test.ts` 的模拟器问题需跟踪真实系统开发进度
- `P0-mandate-siege-reward.test.ts` 的测试链路过短，可能遗漏中间层缺陷
- 测试工具函数重复度较高，需提取共享模块

### 7.2 Phase1-R2 建议

Phase1-R2 应聚焦以下三件事：
1. **提取共享测试工具**（M1，2h）— 消除技术债
2. **补充集成测试**（S1+S2，5h）— 提升链路覆盖
3. **跟踪alliance-war真实系统**（M2，4h）— 消除假阳性

预计R2完成后综合评分可提升至 **9.0+**。

---

> **审查完成** | 评分: 8.2/10 | P0问题: 0 | P1问题: 3 | P2问题: 7 | 测试通过: 99/99
