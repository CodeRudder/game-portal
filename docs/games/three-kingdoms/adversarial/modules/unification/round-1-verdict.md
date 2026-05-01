# Unification 模块对抗式测试 — Round 1 仲裁裁决

> **角色**: TreeArbiter
> **模块**: unification（天下一统引擎层）
> **Round**: 1
> **日期**: 2026-05-01

---

## 一、评分概览

| 指标 | 得分 | 满分 | 说明 |
|------|------|------|------|
| API覆盖率 | 28 | 30 | 160/160 API已枚举，但工具模块的隐式API有遗漏 |
| 节点完备性 | 20 | 25 | 197节点，F-Normal充分但F-Cross偏少 |
| 分支覆盖 | 16 | 20 | 核心分支已覆盖，但组合边界场景不足 |
| 维度均衡度 | 10 | 15 | F-Cross仅7节点(3.6%)，F-State仅7节点(3.6%) |
| 挑战合理性 | 9 | 10 | 35项挑战中30项合理，5项可降级 |
| **总分** | **83** | **100** | **标准化: 8.3/10** |

---

## 二、详细评估

### 2.1 API覆盖率评估 ✅ 98%

| 子系统 | 公开API数 | 已枚举 | 覆盖率 |
|--------|-----------|--------|--------|
| EndingSystem | 8 | 8 | 100% |
| GlobalStatisticsSystem | 5 | 5 | 100% |
| BalanceValidator | 16 | 16 | 100% |
| IntegrationValidator | 7 | 7 | 100% |
| PerformanceMonitor | 22 | 22 | 100% |
| GraphicsQualityManager | 20 | 20 | 100% |
| InteractionAuditor | 14 | 14 | 100% |
| VisualConsistencyChecker | 20 | 20 | 100% |
| AnimationAuditor | 9 | 9 | 100% |
| ObjectPool | 5 | 5 | 100% |
| DirtyRectManager | 7 | 7 | 100% |
| BalanceUtils | 7 | 7 | 100% |
| BalanceReport | 5 | 5 | 100% |
| SimulationDataProvider | 11 | 11 | 100% |
| 其他工具 | 4 | 4 | 100% |
| **合计** | **160** | **160** | **100%** |

扣分项：ISimulationDataProvider接口方法在DefaultSimulationDataProvider中全部枚举，但接口本身的约束（如返回值类型）未作为独立节点。

### 2.2 节点完备性评估

**优点**:
- 160个API全部枚举，无遗漏
- 每个子系统的ISubsystem接口方法都有对应节点
- 纯函数模块（BalanceUtils/BalanceReport）也有完整覆盖
- P0/P1/P2优先级分配合理（31.5%/49.2%/19.3%）

**不足**:
- ❌ F-Cross维度仅7节点（3.6%），跨系统链路覆盖不足
  - EndingSystem ↔ GlobalStatisticsSystem 仅有1条链路
  - PerformanceMonitor ↔ ObjectPool/DirtyRectManager 仅有1条链路
  - GraphicsQualityManager ↔ SettingsManager 仅有1条链路
- ❌ F-State维度仅7节点（3.6%），状态矩阵不完整
  - PerformanceMonitor无状态转换节点
  - GraphicsQualityManager无状态转换节点
  - InteractionAuditor无状态转换节点

### 2.3 维度均衡度评估

| 维度 | 节点数 | 占比 | 评价 |
|------|--------|------|------|
| F-Normal | 109 | 55.3% | ✅ 充分 |
| F-Boundary | 48 | 24.4% | ✅ 良好 |
| F-Error | 11 | 5.6% | ⚠️ 偏少 |
| F-Cross | 7 | 3.6% | ❌ 不足 |
| F-State | 7 | 3.6% | ❌ 不足 |

**建议**: R2应补充至少10条跨系统链路和8个状态转换节点。

### 2.4 挑战合理性评估

对Challenger提出的35项挑战逐一裁决：

---

#### P0挑战裁决（9项）

| # | 代号 | Challenger描述 | Arbiter裁决 | 理由 |
|---|------|---------------|-------------|------|
| 1 | B-01 | EndingSystem powerCap=0→NaN | ✅ **确认为P0** | 除零导致NaN传播，影响评分结果。模式匹配DEF-006。 |
| 2 | B-02 | EndingSystem prestigeCap=0→NaN | ✅ **确认为P0** | 与B-01同一问题，对称缺陷。模式匹配DEF-020(对称函数修复)。 |
| 3 | B-03 | GlobalStatisticsSystem deserialize(null)崩溃 | ✅ **确认为P0** | 运行时TypeError崩溃。模式匹配DEF-010。 |
| 4 | N-02 | GlobalStatisticsSystem update(dt)无NaN防护 | ✅ **确认为P0** | NaN传播到accumulatedOnlineSeconds后不可恢复。模式匹配DEF-006。 |
| 5 | N-03 | IntegrationValidator validateCrossSystemFlow无异常保护 | ✅ **确认为P0** | 异常中断整个validateAll，其他维度结果丢失。模式匹配DEF-013。 |
| 6 | E-01 | EndingSystem deps未初始化时崩溃 | ⚠️ **降级为P1** | 代码使用`this.deps?.registry`可选链，deps=undefined时不会崩溃。但`triggerUnification`中`this.deps.eventBus.emit`无可选链，确实会崩溃。降级为P1因为正常使用流程中init总是先于triggerUnification调用。 |
| 7 | E-03 | IntegrationValidator validateCrossSystemFlow异常中断 | ⚠️ **与N-03合并** | 与N-03描述同一缺陷，合并为1个P0。 |
| 8 | S-01 | EndingSystem serialize/deserialize往返 | ⚠️ **降级为P1** | 这是测试覆盖问题而非代码缺陷。deserialize实现简单直接赋值，往返一致性风险低。 |
| 9 | S-02 | GlobalStatisticsSystem serialize/deserialize往返 | ⚠️ **降级为P1** | 同S-01理由。 |

**最终P0确认**: 6个（B-01, B-02, B-03, N-02, N-03/E-03合并, E-01降P1后保留5个核心P0）

**修正后P0清单**:

| # | FIX-ID | 子系统 | 缺陷 | 严重度 |
|---|--------|--------|------|--------|
| 1 | FIX-U01 | EndingSystem | calculateScore除零→NaN (powerCap=0) | P0 |
| 2 | FIX-U02 | EndingSystem | calculateScore除零→NaN (prestigeCap=0) — 对称修复 | P0 |
| 3 | FIX-U03 | GlobalStatisticsSystem | deserialize(null/undefined)崩溃 | P0 |
| 4 | FIX-U04 | GlobalStatisticsSystem | update(dt) NaN/负数/Infinity穿透 | P0 |
| 5 | FIX-U05 | IntegrationValidator | validateCrossSystemFlow无异常保护 | P0 |

---

#### P1挑战裁决（14项）

| # | 代号 | 裁决 | 理由 |
|---|------|------|------|
| 1 | N-05 | ✅ P1确认 | null配置导致后续崩溃，但setter通常由开发者调用，非用户输入 |
| 2 | B-04 | ✅ P1确认 | fps=Infinity影响统计，但PerformanceMonitor是开发工具，非核心玩法 |
| 3 | B-05 | ✅ P1确认 | 违反BR-16深拷贝规则 |
| 4 | B-06 | ✅ P1确认 | 边界场景，正常流程init先调用 |
| 5 | B-08 | ⚠️ 降为P2 | 负数count非正常输入，返回1.0合理 |
| 6 | E-05 | ✅ P1确认 | 状态已变更但事件丢失，UI不同步风险 |
| 7 | E-06 | ✅ P1确认 | 部分结果丢失，但validateAll可重试 |
| 8 | E-07 | ⚠️ 降为P2 | TypeScript类型检查可防止非法category |
| 9 | E-08 | ⚠️ 降为P2 | 未知preset安全退出，不会崩溃 |
| 10 | C-01 | ✅ P1确认 | 跨系统一致性需验证 |
| 11 | C-02 | ⚠️ 降为P2 | 开发工具状态跟踪问题 |
| 12 | C-03 | ✅ P1确认 | 双向同步缺失可能导致设置不一致 |
| 13 | S-03 | ⚠️ 降为P2 | reset是开发调试方法 |
| 14 | S-04 | ✅ P1确认 | reset后detectionResult陈旧 |

**确认P1**: 10个 | **降为P2**: 4个

---

#### P2挑战裁决（8项）

全部确认为P2，无异议。

---

## 三、修复指令

### 3.1 P0修复优先级

| 优先级 | FIX-ID | 修复内容 | 预估工时 |
|--------|--------|----------|----------|
| 1 | FIX-U01+U02 | EndingSystem.calculateScore除零防护 | 0.5h |
| 2 | FIX-U03 | GlobalStatisticsSystem.deserialize null防护 | 0.5h |
| 3 | FIX-U04 | GlobalStatisticsSystem.update dt验证 | 0.5h |
| 4 | FIX-U05 | IntegrationValidator.validateCrossSystemFlow try-catch | 1h |

**总预估工时**: 2.5h

### 3.2 修复规范

1. **FIX-U01/U02**: 在`calculateScore`中添加除零检查：
   ```typescript
   const powerScore = ctx.powerCap > 0
     ? Math.min(100, Math.round((ctx.totalPower / ctx.powerCap) * 100))
     : 0;
   const prestigeScore = ctx.prestigeCap > 0
     ? Math.min(100, Math.round((ctx.prestigeLevel / ctx.prestigeCap) * 100))
     : 0;
   ```

2. **FIX-U03**: 在`deserialize`中添加null防护：
   ```typescript
   deserialize(data: GlobalStatisticsSaveData): void {
     if (!data) return;
     this.accumulatedOnlineSeconds = Number.isFinite(data.accumulatedOnlineSeconds)
       ? Math.max(0, data.accumulatedOnlineSeconds)
       : 0;
   }
   ```

3. **FIX-U04**: 在`update`中添加dt验证：
   ```typescript
   update(dt: number): void {
     if (!Number.isFinite(dt) || dt < 0) return;
     this.accumulatedOnlineSeconds += dt;
   }
   ```

4. **FIX-U05**: 在`validateCrossSystemFlow`中添加try-catch：
   ```typescript
   validateCrossSystemFlow(): CrossSystemFlowResult {
     try {
       const p = this.provider;
       const checks: DataFlowCheckResult[] = [];
       // ... 现有逻辑 ...
       return { checks, allPassed: checks.every(c => c.consistent) };
     } catch (e) {
       return {
         checks: [{
           path: 'error', sourceValue: 0, targetValue: 0,
           consistent: false, deviation: 100,
         }],
         allPassed: false,
       };
     }
   }
   ```

### 3.3 穿透验证

按BR-10规则，修复后需检查穿透：

| FIX-ID | 修复位置 | 穿透检查 | 结果 |
|--------|----------|----------|------|
| FIX-U01 | EndingSystem.calculateScore | GlobalStatisticsSystem.getSnapshot是否也做除法？ | ❌ 不做除法，直接从子系统读取，无穿透 |
| FIX-U02 | 同FIX-U01 | 同上 | ❌ 无穿透 |
| FIX-U03 | GlobalStatisticsSystem.deserialize | EndingSystem.deserialize是否也需要null防护？ | ✅ 需检查：EndingSystem.deserialize也无null防护，但已由FIX-U01的调用方保证 |
| FIX-U04 | GlobalStatisticsSystem.update | PerformanceMonitor.update是否也需要dt验证？ | ✅ 需检查：PerformanceMonitor.update使用dt*1000计算水墨过渡，dt=NaN时timer变NaN→过渡永远不完成。但这是P1，不在本轮修复范围 |
| FIX-U05 | IntegrationValidator.validateCrossSystemFlow | validateRebirthCycle/validateOfflineFull是否也需要try-catch？ | ❌ 这两个方法不调用provider的复杂方法，风险低 |

**穿透率**: 1/5 = 20% > 10%目标。额外发现PerformanceMonitor.update的dt问题，记录为P1跟踪。

---

## 四、R2建议

1. **补充F-Cross节点**: 至少增加10条跨系统链路
2. **补充F-State节点**: 至少增加8个状态转换节点
3. **验证P0修复**: 为5个P0修复编写回归测试
4. **PerformanceMonitor.update dt验证**: 升级为P1修复
5. **EndingSystem.deserialize null防护**: 作为穿透修复一并处理

---

## 五、最终裁决

| 指标 | 结果 |
|------|------|
| Builder评分 | 8.3/10 |
| P0确认数 | 5个 |
| P1确认数 | 10个 |
| P2确认数 | 12个 |
| 修复工时 | 2.5h |
| 穿透验证 | 20%（1/5），需额外关注PerformanceMonitor |
| **总体评价** | **通过 — 修复5个P0后可进入R2** |
