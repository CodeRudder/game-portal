# Building 模块 — Round 1 Arbiter 仲裁裁决书

> **Arbiter 视角** | 裁决对象: `round-1-tree.md` + `round-1-challenges.md`  
> 裁决时间: 2025-05-02 | 封版线: **9.0/10**

---

## 1. 评分总览

| 评估维度 | 权重 | Builder得分 | Challenger调整 | 最终得分 |
|----------|------|------------|---------------|---------|
| API枚举完整性 | 10% | 28/28 (100%) | 无异议 | **100%** |
| F1-Normal 覆盖 | 20% | 88% | 75% | **75%** |
| F2-Boundary 覆盖 | 20% | 81% | 68% | **68%** |
| F3-Error 覆盖 | 20% | 71% | 52% | **52%** |
| F4-Cross 覆盖 | 15% | 67% | 50% | **50%** |
| F5-Lifecycle 覆盖 | 15% | 67% | 55% | **55%** |
| **加权总分** | **100%** | — | — | **65.4/100** |

**换算10分制**: **6.5/10**

---

## 2. 裁决分析

### 2.1 Builder 优势
- ✅ API枚举完整，28个公开方法全部识别
- ✅ 5维度分类清晰，流程树结构合理
- ✅ 已有测试覆盖情况统计准确
- ✅ 高优先级测试用例(BT-P0)识别合理

### 2.2 Challenger 优势
- ✅ 发现1个P0级真实缺陷(BUG-CANCEL-01)
- ✅ 识别出deserialize一致性校验缺失
- ✅ 补充了3个新分支维度(F3-07/F2-07/F5-06)
- ✅ 对engine-building-ops原子性问题的分析到位

### 2.3 争议裁决

#### 争议1: BUG-CANCEL-01 严重度
- **Challenger声称**: P0 — 可被利用刷退款
- **Arbiter裁决**: **P1** — 需要存档篡改才能触发
- **理由**: 正常游戏流程中 `startUpgrade` 不会增加 level，只有通过恶意构造存档才能制造矛盾状态。虽然应修复，但不阻塞正常游戏流程。
- **修复建议**: `cancelUpgrade` 应在 `startUpgrade` 时缓存实际费用，或记录"升级前等级"。

#### 争议2: BUG-OPS-01 非原子性
- **Challenger声称**: P1 — consumeBatch与startUpgrade非原子
- **Arbiter裁决**: **P1 确认** — 确实存在资源已扣但startUpgrade失败的风险
- **修复建议**: 将资源扣减移入startUpgrade内部，或使用try-catch回滚。

#### 争议3: F3-Error 覆盖率
- **Builder声称**: 71%
- **Challenger声称**: 52%
- **Arbiter裁决**: **52%** — Challenger补充的输入验证攻击(F3-07)和矛盾状态组合确实未被Builder覆盖

---

## 3. 缺陷裁决清单

### 确认缺陷（需修复）

| ID | 严重度 | 描述 | 裁决 | 修复优先级 |
|----|--------|------|------|-----------|
| BUG-CANCEL-01 | **P1** | cancelUpgrade在篡改存档下退款金额错误 | ✅ 确认 | Round 2前修复 |
| BUG-DESER-01 | **P1** | deserialize不校验level/status一致性 | ✅ 确认 | Round 2前修复 |
| BUG-OPS-01 | **P1** | executeBuildingUpgrade资源扣减非原子 | ✅ 确认 | Round 2前修复 |
| BUG-DEF-01 | P2 | getBuildingDef返回可变引用 | ✅ 确认 | 可选修复 |
| BUG-COST-01 | P2 | getUpgradeProgress total=0返回1未测试 | ✅ 确认 | 补充测试 |
| BUG-PROD-01 | P2 | calculateTotalProduction跳过无production建筑 | ⚠️ 设计意图 | 需确认 |

### 驳回缺陷

| ID | 描述 | 驳回理由 |
|----|------|---------|
| P0-02 tick防重入 | tick()使用remaining数组模式，无竞态风险 | 代码逻辑正确，队列替换是原子的 |

---

## 4. 封版条件

### 当前状态: ❌ **未达封版线** (6.5/10 < 9.0)

### 封版要求（达到 9.0 分需完成）

#### 必须完成（阻塞封版）

1. **补充 F3-Error 测试用例** (预计提升 +15 分)
   - [ ] F3-07: 输入验证攻击（无效BuildingType、undefined、null）
   - [ ] F3-04 补充: 矛盾状态组合（level>0+locked, level=0+idle, upgrading+null endTime）
   - [ ] F3-05 补充: batchUpgrade异常（空列表、重复类型、非Error异常）

2. **补充 F4-Cross 测试用例** (预计提升 +12 分)
   - [ ] F4-01: engine-building-ops资源扣减原子性验证
   - [ ] F4-05: academy techPoint产出是否被calculateTotalProduction正确计入
   - [ ] F4-06: 事件总线集成验证

3. **修复 P1 缺陷** (预计提升 +5 分)
   - [ ] BUG-CANCEL-01: cancelUpgrade缓存升级费用或记录升级前等级
   - [ ] BUG-DESER-01: deserialize增加level/status一致性校验
   - [ ] BUG-OPS-01: executeBuildingUpgrade原子性保证

4. **补充 F2-Boundary 测试用例** (预计提升 +8 分)
   - [ ] F2-06: getProduction level超出levelTable范围
   - [ ] F2-07: 配置一致性验证（MAX_LEVELS vs levelTable.length）
   - [ ] F2-05: timeSeconds边界（0、NaN、极大值）

#### 建议完成（提升质量）

5. **补充 F5-Lifecycle 测试用例**
   - [ ] F5-06: 并发/时序攻击场景
   - [ ] F5-04: 长时间运行状态一致性

6. **补充 F1-Normal 测试用例**
   - [ ] F1-07: 推荐系统完整覆盖
   - [ ] F1-06: 序列化/反序列化往返一致性

---

## 5. Round 2 测试重点建议

基于 Round 1 发现的缺陷和覆盖缺口，Round 2 应重点关注：

### 优先级排序

| 优先级 | 测试重点 | 预计用例数 | 目标覆盖率提升 |
|--------|---------|-----------|--------------|
| 🔴 P0 | deserialize矛盾状态校验 | 8 | F3 +8% |
| 🔴 P0 | cancelUpgrade退款精确性（含篡改场景） | 5 | F3 +5% |
| 🟡 P1 | 输入验证攻击 | 6 | F3 +6% |
| 🟡 P1 | engine-building-ops原子性 | 4 | F4 +4% |
| 🟢 P2 | 配置一致性 | 4 | F2 +4% |
| 🟢 P2 | 并发/时序场景 | 5 | F5 +5% |

### 预计 Round 2 结果
- 新增测试用例: ~32
- 覆盖率提升: 60% → **92%**
- 预计得分: **9.2/10** ✅ 达到封版线

---

## 6. 最终裁决

```
╔══════════════════════════════════════════════╗
║  Round 1 裁决: ❌ 未封版                      ║
║  得分: 6.5/10 (封版线 9.0)                    ║
║  状态: 需进入 Round 2                         ║
║                                              ║
║  P0缺陷: 0个 (1个降级为P1)                    ║
║  P1缺陷: 3个 (需Round 2前修复)                ║
║  P2缺陷: 3个                                 ║
║  P3缺陷: 4个                                 ║
║                                              ║
║  封版条件: 补充28个测试用例 + 修复3个P1缺陷     ║
║  预计Round 2可达: 9.2/10 ✅                   ║
╚══════════════════════════════════════════════╝
```

---

## 附录: 源码质量评价

### 优点
- FIX-401/402/403/405 等防御性编程标记清晰
- 模块拆分合理（System/Config/Types/Helpers/BatchOps/Recommender）
- 纯函数设计（Recommender、StateHelpers）便于测试
- 注释充分，代码可读性高

### 改进建议
- `cancelUpgrade` 应缓存升级费用而非重新查表
- `deserialize` 应增加数据完整性校验（白名单校验）
- `getBuildingDef` 应返回 Readonly 类型
- `executeBuildingUpgrade` 应使用事务模式保证原子性
- 考虑使用状态机库（如 XState）管理建筑状态转换
