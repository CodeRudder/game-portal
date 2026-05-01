# Heritage R1 Arbiter Verdict

> Arbiter: v1.8 | 模块: heritage | 时间: 2026-05-01
> 基于文档: round-1-tree.md + round-1-challenges.md + 源码审查

## 一、5维度评分

| 维度 | 权重 | 得分 | 评价 |
|------|------|------|------|
| 完备性 | 25% | 6.5 | 22个API中14个有NaN防护缺口，68个uncovered节点中24个P0 |
| 准确性 | 25% | 8.0 | covered标注经源码验证可靠；Challenger虚报率0%，质疑均有源码支撑 |
| 优先级 | 15% | 8.5 | P0/P1分配合理；NaN系统性问题正确识别为根因；loadSaveData null正确标P0 |
| 可测试性 | 15% | 9.0 | 每个P0均有完整复现场景和修复建议；回调注入模式易于mock |
| 挑战应对 | 20% | 6.0 | Builder Tree覆盖53.1%偏低；R1为Tree+Challenge首轮，Builder尚未参与修复 |
| **加权总分** | | **7.3** | |

### 评分详细说明

**完备性 6.5**:
- 22个公开API全覆盖 ✅
- 14个NaN防护缺口全部识别 ✅
- 跨系统链路15条中7条covered，8条uncovered ⚠️
- 68个uncovered节点中24个P0未覆盖 ❌
- 缺少engine层存档集成验证 ❌

**准确性 8.0**:
- Challenger 22个质疑中16个P0确认，0个虚报 ✅
- 6个P1降级均有充分理由 ✅
- NaN防护全景表准确反映14个入口点状态 ✅
- CH-013(instantUpgrade回调未注入)正确识别为功能性阻断 ✅
- 扣分：CH-020(存档集成缺失)需engine层验证，heritage模块内无法独立确认 ⚠️

**优先级 8.5**:
- NaN系统性问题正确识别为根因，影响3个传承API+模拟器 ✅
- loadSaveData null崩溃正确标P0（可玩性阻断） ✅
- copperCost NaN传播正确标P0（经济一致性） ✅
- CH-010(expRatio负数)正确标P1（有maxExpRatio裁剪但无下限） ✅
- CH-018(免费传承)正确标P1（需外部配置错误触发） ✅

**可测试性 9.0**:
- CH-001 NaN绕过：构造 `source.exp = NaN` 的heroCallback即可复现 ✅
- CH-005 null崩溃：`system.loadSaveData(null as any)` 一行复现 ✅
- CH-006 NaN注入：构造含NaN的saveData即可复现 ✅
- CH-013 回调未注入：不调用setCallbacks直接调用instantUpgrade ✅
- 每个P0均有完整复现场景和修复建议 ✅

**挑战应对 6.0**:
- R1为Tree+Challenge首轮，Builder尚未参与 ⚠️
- Tree本身覆盖53.1%偏低 ❌
- 24个P0 uncovered节点待Builder修复 ❌
- 跨系统链路8条uncovered待处理 ⚠️

---

## 二、封版条件检查

| 条件 | 要求 | 当前 | 状态 |
|------|------|------|------|
| 评分 >= 9.0 | 9.0 | 7.3 | ❌ 不满足 |
| API覆盖率 >= 90% | 90% | 58.5% (96/164) | ❌ 不满足 |
| F-Cross覆盖率 >= 75% | 75% | 46.7% (7/15) | ❌ 不满足 |
| F-Lifecycle覆盖率 >= 70% | 70% | ~40% (估算) | ❌ 不满足 |
| P0节点覆盖 = 100% | 100% | 0% (0/24 covered) | ❌ 不满足 |
| 虚报数 = 0 | 0 | 0 | ✅ 满足 |
| 最终轮新P0 = 0 | 0 | 16 (首轮) | ❌ 不满足 |
| 所有子系统覆盖 = 是 | 是 | 否 (HeritageSystem 53.1%) | ❌ 不满足 |

**封版条件满足数: 1/8 → 判定: CONTINUE**

---

## 三、收敛预测

### R2预期改善

| 改善项 | 预期效果 |
|--------|---------|
| Builder修复NaN入口检查（3个传承API） | P0 covered 从 0% → 50%+ |
| Builder修复loadSaveData null guard | P0 covered +2 |
| Builder修复simulateEarnings NaN防护 | P0 covered +3 |
| Builder修复getSaveData NaN序列化 | P0 covered +1 |
| 新增正常流程测试 | API覆盖率 58.5% → 75%+ |
| 跨系统链路验证 | F-Cross 46.7% → 65%+ |

### 预计R2评分

| 维度 | R1 | R2预期 | 原因 |
|------|-----|--------|------|
| 完备性 | 6.5 | 8.0 | NaN修复覆盖14个入口 |
| 准确性 | 8.0 | 8.5 | 新增测试验证修复 |
| 优先级 | 8.5 | 8.5 | 维持 |
| 可测试性 | 9.0 | 9.0 | 维持 |
| 挑战应对 | 6.0 | 7.5 | Builder参与修复 |
| **加权总分** | **7.3** | **8.2** | |

---

## 四、P0裁决清单

| # | Challenge | 裁决 | 理由 |
|---|-----------|------|------|
| CH-001 | executeHeroHeritage NaN→目标exp | ✅ P0确认 | NaN永久损坏武将数据 |
| CH-002 | executeEquipmentHeritage NaN→目标enhanceLevel | ✅ P0确认 | NaN永久损坏装备数据 |
| CH-003 | executeExperienceHeritage NaN→双武将exp | ✅ P0确认 | NaN同时损坏两个武将 |
| CH-004 | copperCost NaN→资源系统 | ✅ P0确认 | NaN传播到经济系统 |
| CH-005 | loadSaveData null崩溃 | ✅ P0确认 | TypeError阻断加载 |
| CH-006 | loadSaveData NaN注入state | ✅ P0确认 | NaN绕过每日限制 |
| CH-007 | simulateEarnings NaN→收益全NaN | ✅ P0确认 | 模拟器输出完全不可用 |
| CH-008 | simulateEarnings NaN→跨系统传播 | ✅ P0确认 | NaN传播到Prestige系统 |
| CH-009 | getSaveData 序列化NaN | ✅ P0确认 | NaN→null→逻辑错误 |
| CH-010 | executeExperienceHeritage expRatio负数 | 🟡 P1确认 | maxExpRatio有上限裁剪，但缺下限 |
| CH-011 | newSourceExp可能为负 | 🟡 P1确认 | 低风险，maxExpRatio保护 |
| CH-012 | rarityDiff NaN获得最优效率 | 🟡 P1确认 | 逻辑错误但不崩溃 |
| CH-013 | instantUpgrade 回调未注入→永远失败 | ✅ P0确认 | 功能完全不可用 |
| CH-014 | claimInitialGift resources不含gold | 🟡 P1确认 | 配置设计选择 |
| CH-015 | executeRebuild 空数组覆盖 | 🟡 P1确认 | 语义不一致 |
| CH-016 | 回调异常未捕获 | 🟡 P1确认 | 部分状态更新风险 |
| CH-017 | recordHeritage调用顺序 | 🟡 P1确认 | 记录不一致 |
| CH-018 | addResources未注入→免费传承 | 🟡 P1确认 | 需外部配置错误触发 |
| CH-019 | calcRebirthMultiplier Infinity传播 | ✅ P0确认 | Infinity→序列化为null |
| CH-020 | 存档集成可能缺失 | ✅ P0确认 | 需engine层验证（BR-023教训） |
| CH-021 | Calendar时区问题 | 🟡 P1确认 | 取决于Calendar实现 |
| CH-022 | heritageHistory无限增长 | 🟡 P1确认 | 长期内存风险 |

**P0确认: 12 | P1确认: 10 | 虚报: 0 | 虚报率: 0%**

---

## 五、Builder R2指令

### 必须修复（P0，按优先级排序）

1. **FIX-H01**: 三个传承API添加NaN防护 — 检查source/target数值字段（exp/level/enhanceLevel）
2. **FIX-H02**: copperCost计算添加NaN防护 — 传承前验证所有参与计算的数值
3. **FIX-H03**: loadSaveData null guard + NaN字段验证
4. **FIX-H04**: getSaveData NaN序列化防护
5. **FIX-H05**: simulateEarnings 参数NaN防护 + multiplier结果验证
6. **FIX-H06**: instantUpgrade 回调未注入时的明确错误提示
7. **FIX-H07**: 验证engine层存档集成（六处同步检查）

### 建议修复（P1）

8. **FIX-H08**: expRatio添加Math.max(0, ...)下限
9. **FIX-H09**: executeRebuild空数组保护
10. **FIX-H10**: heritageHistory添加上限常量

### 新增规则建议

| 规则ID | 内容 | 原因 |
|--------|------|------|
| BR-026 | 回调注入系统必须在执行前验证必要回调已注入 | CH-013/CH-018教训：可选链静默跳过导致免费传承 |
| BR-027 | 模拟器/预测类API必须对跨系统依赖的返回值做NaN/Infinity检查 | CH-019教训：calcRebirthMultiplier可能返回Infinity |
