# Resource 模块 R1 对抗式测试 — Arbiter 裁决

> 版本: v1.0 | 日期: 2026-05-01 | Arbiter Agent

## 裁决总览

| 指标 | 值 |
|------|-----|
| Builder 节点数 | 161 |
| Challenger 质询数 | 28 |
| 确认 P0 | 17 |
| 确认 P1 | 10 |
| 驳回 | 1 |
| 虚报率 | 0% (P0) |

---

## P0 裁决清单

### 确认 P0（17个）

| ID | 质询 | 源码位置 | 模式 | 裁决 | 修复优先级 |
|----|------|----------|------|------|-----------|
| P0-001 | addResource NaN 绕过 `<=0` | ResourceSystem.ts:145 | 模式9/21 | ✅ 确认 | FIX-701 |
| P0-002 | consumeResource NaN amount (grain) | ResourceSystem.ts:163 | 模式9 | ✅ 确认 | FIX-702 |
| P0-003 | consumeResource NaN amount (通用) | ResourceSystem.ts:175 | 模式9/21 | ✅ 确认 | FIX-703 |
| P0-004 | canAfford NaN 资源值绕过 | ResourceSystem.ts:203 | 模式21 | ✅ 确认 | FIX-704 |
| P0-005 | canAfford NaN cost 绕过 | ResourceSystem.ts:199 | 模式9 | ✅ 确认 | FIX-705 |
| P0-006 | consumeBatch NaN 绕过 | ResourceSystem.ts:220 | 模式21 | ✅ 确认 | FIX-706 |
| P0-007 | tick NaN deltaMs | ResourceSystem.ts:107 | 模式2 | ✅ 确认 | FIX-707 |
| P0-008 | tick NaN bonus | resource-calculator.ts:58 | 模式9 | ✅ 确认 | FIX-708 |
| P0-009 | recalculateProduction NaN rate | ResourceSystem.ts:254 | 模式2 | ✅ 确认 | FIX-709 |
| P0-010 | calculateOfflineEarnings NaN sec | OfflineEarningsCalculator.ts:48 | 模式2 | ✅ 确认 | FIX-710 |
| P0-011 | calculateOfflineEarnings NaN rate | OfflineEarningsCalculator.ts:58 | 模式2 | ✅ 确认 | FIX-711 |
| P0-012 | CopperEconomy.tick NaN dt | copper-economy-system.ts:96 | 模式9 | ✅ 确认 | FIX-712 |
| P0-013 | claimStageClearCopper NaN level | copper-economy-system.ts:108 | 模式9 | ✅ 确认 | FIX-713 |
| P0-014 | purchaseItem NaN count | copper-economy-system.ts:116 | 模式9 | ✅ 确认 | FIX-714 |
| P0-015 | spendOnLevelUp NaN level | copper-economy-system.ts:134 | 模式9 | ✅ 确认 | FIX-715 |
| P0-016 | buyBreakthroughStone NaN count | material-economy-system.ts:134 | 模式9 | ✅ 确认 | FIX-716 |
| P0-017 | deserialize(null) 崩溃 x3 | ResourceSystem.ts:328 等 | 模式1 | ✅ 确认 | FIX-717 |

### 额外确认 P0（源码验证后升级）

| ID | 质询 | 源码位置 | 裁决依据 | 修复优先级 |
|----|------|----------|----------|-----------|
| P0-018 | setResource NaN → NaN 传播 | ResourceSystem.ts:186 | Math.max(0, NaN) = NaN → Math.min(NaN, cap) = NaN | FIX-718 |
| P0-019 | NaN → serialize → null → 0 数据丢失 | engine-save.ts | JSON.stringify(NaN) = null → 反序列化变 0 | FIX-719 |
| P0-020 | CopperEconomySystem 未接入 engine-save | engine-save.ts | grep 确认无 copperEconomy 引用 | FIX-720 |
| P0-021 | MaterialEconomySystem 未接入 engine-save | engine-save.ts | grep 确认无 materialEconomy 引用 | FIX-721 |

---

## P1 裁决清单

| ID | 质询 | 裁决 | 理由 |
|----|------|------|------|
| P1-001 | deserialize NaN 静默归零 | ✅ 确认 | 数据修复应记录日志 |
| P1-002 | 负加成归零产出 | ✅ 确认 | 配置错误防护 |
| P1-003 | lookupCap 线性外推负值 | ✅ 确认 | 边界条件 |
| P1-004 | getWarningLevel(NaN) 返回 'safe' | ✅ 确认 | 掩盖数据异常 |
| P1-005 | trySpend 非空断言 | ✅ 确认 | 未初始化时崩溃 |
| P1-006 | 随机数不可控 | ✅ 确认 | 已有注入机制 |
| P1-007 | enforceCaps NaN 不截断 | ✅ 确认 | NaN 传播链一环 |
| P1-008 | formatOfflineTime(NaN) | ✅ 确认 | UI 显示异常 |
| P1-009 | getOfflineEfficiencyPercent(NaN) | ✅ 确认 | UI 显示异常 |
| P1-010 | 日重置依赖系统时间 | ✅ 确认 | 测试性问题 |

---

## 评分

### 5维度评分

| 维度 | 权重 | Builder | Challenger | 说明 |
|------|------|---------|------------|------|
| 完备性 | 25% | 8.5 | 9.0 | Builder 覆盖所有 API，Challenger 发现 4 个 Builder 遗漏的 P0 |
| 准确性 | 25% | 9.0 | 9.5 | Builder covered 标注准确，Challenger 虚报率 0% |
| 优先级 | 15% | 8.0 | 9.0 | Builder 未发现 engine-save 缺失（架构级 P0） |
| 可测试性 | 15% | 9.0 | 9.0 | 所有 P0 均可复现 |
| 挑战应对 | 20% | 7.5 | — | Builder 遗漏 NaN 系统性问题和 engine-save 缺失 |

### 综合评分

| Agent | 加权分 |
|-------|--------|
| Builder | 8.4 / 10 |
| Challenger | 9.1 / 10 |
| **模块总分** | **8.4 / 10** |

### 收敛判断

- **当前评分**: 8.4 < 9.0 封版线
- **新 P0 数**: 21 > 0
- **结论**: **CONTINUE** — 需要 R2 修复轮

---

## 修复策略

### 修复分组（按根因聚合）

#### 组A: NaN 守卫统一加固（影响 15 个 P0）
- **根因**: 所有 `if (x <= 0)` 和 `if (x > 0)` 检查被 NaN 绕过
- **修复方案**: 统一替换为 `if (!Number.isFinite(x) || x <= 0)`
- **影响文件**: ResourceSystem.ts, copper-economy-system.ts, material-economy-system.ts, OfflineEarningsCalculator.ts, resource-calculator.ts

#### 组B: deserialize null 防护（影响 3 个 P0）
- **根因**: deserialize 未检查 null/undefined 输入
- **修复方案**: 入口添加 `if (!data) return;` 或 `if (!data) { this.reset(); return; }`
- **影响文件**: ResourceSystem.ts, copper-economy-system.ts, material-economy-system.ts

#### 组C: engine-save 接入缺失（影响 2 个 P0）
- **根因**: CopperEconomySystem 和 MaterialEconomySystem 的 serialize/deserialize 未被 engine-save 调用
- **修复方案**: 在 engine-save.ts 的 buildSaveData/applySaveData 中添加铜钱/材料经济的序列化
- **影响文件**: engine-save.ts

#### 组D: NaN 传播链防护（影响 1 个 P0）
- **根因**: NaN 资源值通过 serialize → JSON.stringify → null → 反序列化变 0
- **修复方案**: 在 serialize 时添加 NaN 检查，将 NaN 替换为 0 并记录日志
- **影响文件**: ResourceSystem.ts

---

## 规则进化建议

### 新增 Builder 规则
- **BR-024**: 经济子系统序列化完整性 — 所有经济子系统（Copper/Material/etc）必须在 engine-save 中有对应的序列化/反序列化调用，遗漏即 P0

### 新增 P0 模式
- **模式24: 经济子系统存档缺失** — 经济子系统有 serialize/deserialize 但未接入 engine-save，存档后数据丢失

---

## 三Agent复盘

### Builder 表现
- **优点**: API 覆盖率 100%，P0 聚类分析清晰
- **不足**: 遗漏 engine-save 集成验证（Builder 规则 #14/15 已有相关要求但未执行）
- **改进**: 对每个子系统强制执行"六处同步"检查

### Challenger 表现
- **优点**: NaN 系统性分析深入，跨系统链路验证到位
- **不足**: F-Cross-002/003 需源码验证后才确认
- **改进**: 在质询阶段直接 grep 验证，减少"需验证"标注

### Arbiter 独立发现
- 确认 Builder 遗漏的 4 个 P0（P0-018~021）
- 发现 NaN 修复应统一在入口层而非逐个函数修复
