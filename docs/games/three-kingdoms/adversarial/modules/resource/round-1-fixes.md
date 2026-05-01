# Resource 模块 R1 对抗式测试 — Fixer 修复报告

> 版本: v1.0 | 日期: 2026-05-01 | Fixer Agent

## 修复总览

| 指标 | 值 |
|------|-----|
| 总 P0 | 21 |
| 已修复 | 21 |
| 修复率 | 100% |
| 修改文件 | 7 |
| 新增代码行 | ~80 |

---

## 修复分组

### 组A: NaN 守卫统一加固（15个 P0）

统一将所有 `if (x <= 0)` 和 `if (x > 0)` 替换为 `if (!Number.isFinite(x) || x <= 0)`

| FIX ID | P0 覆盖 | 文件 | 修改内容 |
|--------|---------|------|----------|
| FIX-701 | P0-001 | ResourceSystem.ts:145 | addResource NaN amount 防护 |
| FIX-702/703 | P0-002/003 | ResourceSystem.ts:163 | consumeResource NaN amount 防护 |
| FIX-704/705 | P0-004/005 | ResourceSystem.ts:199-210 | canAfford NaN 资源值 + NaN cost 防护 |
| FIX-706 | P0-006 | ResourceSystem.ts:244 | consumeBatch NaN amount 防护 |
| FIX-707 | P0-007 | ResourceSystem.ts:107 | tick NaN deltaMs 防护 + NaN gain 防护 |
| FIX-708 | P0-008 | resource-calculator.ts:58 | calculateBonusMultiplier NaN bonus 防护 |
| FIX-709 | P0-009 | ResourceSystem.ts:254/305 | recalculateProduction + setProductionRate NaN rate 防护 |
| FIX-710/711 | P0-010/011 | OfflineEarningsCalculator.ts:48 | calculateOfflineEarnings NaN seconds 早期返回 |
| FIX-712 | P0-012 | copper-economy-system.ts:96 | CopperEconomy.tick NaN dt 防护 |
| FIX-713 | P0-013 | copper-economy-system.ts:108 | claimStageClearCopper NaN level 防护 |
| FIX-714 | P0-014 | copper-economy-system.ts:116 | purchaseItem NaN count 防护 |
| FIX-715 | P0-015 | copper-economy-system.ts:134 | spendOnLevelUp NaN level 防护 |
| FIX-716 | P0-016 | material-economy-system.ts:134 | buyBreakthroughStone NaN count 防护 |

### 组B: deserialize null 防护（3个 P0）

| FIX ID | P0 覆盖 | 文件 | 修改内容 |
|--------|---------|------|----------|
| FIX-717 | P0-017 | ResourceSystem.ts | 入口 `if (!data) { this.reset(); return; }` |
| FIX-717 | P0-017 | copper-economy-system.ts | 同上 |
| FIX-717 | P0-017 | material-economy-system.ts | 同上 |

### 组C: engine-save 接入缺失（2个 P0）

| FIX ID | P0 覆盖 | 文件 | 修改内容 |
|--------|---------|------|----------|
| FIX-720 | P0-020 | engine-save.ts + shared/types.ts | copperEconomy 六处同步 |
| FIX-721 | P0-021 | engine-save.ts + shared/types.ts | materialEconomy 六处同步 |

### 组D: NaN 传播链防护（1个 P0）

| FIX ID | P0 覆盖 | 文件 | 修改内容 |
|--------|---------|------|----------|
| FIX-718 | P0-018 | ResourceSystem.ts setResource() | NaN amount 前置检查 |
| FIX-719 | P0-019 | ResourceSystem.ts serialize() | 序列化前修复 NaN + 日志警告 |

---

## 修改文件清单

| 文件 | 修改类型 | FIX ID |
|------|----------|--------|
| ResourceSystem.ts | NaN 守卫 + null 防护 + serialize 防护 | FIX-701~719 |
| resource-calculator.ts | NaN bonus 防护 | FIX-708 |
| OfflineEarningsCalculator.ts | NaN seconds 早期返回 | FIX-710/711 |
| copper-economy-system.ts | NaN 守卫 + null 防护 | FIX-712~715, FIX-717 |
| material-economy-system.ts | NaN 守卫 + null 防护 | FIX-716, FIX-717 |
| engine-save.ts | 铜钱/材料经济存档接入 | FIX-720/721 |
| shared/types.ts | GameSaveData 类型扩展 | FIX-720/721 |

---

## 穿透验证

| FIX | 调用方修复 | 底层函数修复 | 穿透完成 |
|-----|-----------|-------------|----------|
| FIX-701 addResource NaN | 入口守卫 | Math.min(before+NaN, cap) 不再触发 | YES |
| FIX-702/703 consumeResource NaN | 入口守卫 | 不进入消耗逻辑 | YES |
| FIX-704 canAfford NaN resource | NaN 检测转为 shortage | - | YES |
| FIX-707 tick NaN | deltaMs 守卫 | gain NaN 二次守卫 | YES |
| FIX-708 bonus NaN | calculateBonusMultiplier | - | YES |
| FIX-717 deserialize null | 三个子系统 | - | YES |
| FIX-720/721 engine-save | 六处同步 | - | YES |
| FIX-719 serialize NaN | 序列化前修复 | - | YES |

**穿透率**: 0% (所有修复均同时处理调用方和底层)

---

## 未修复的 P1 清单（留待 R2）

| ID | 描述 | 理由 |
|----|------|------|
| P1-001 | deserialize NaN 静默归零无日志 | 已有 Number(val) or 0 处理，仅缺日志 |
| P1-002 | 负加成归零产出 | 配置错误防护，非运行时 P0 |
| P1-003 | lookupCap 线性外推负值 | 边界条件 |
| P1-004 | getWarningLevel(NaN) 返回 safe | 掩盖问题但不崩溃 |
| P1-005 | trySpend 非空断言 | 仅未初始化时触发 |
| P1-006 | 随机数不可控 | 已有注入机制 |
| P1-007 | enforceCaps NaN 不截断 | NaN 传播链已在上游阻断 |
| P1-008 | formatOfflineTime(NaN) | UI 显示异常 |
| P1-009 | getOfflineEfficiencyPercent(NaN) | UI 显示异常 |
| P1-010 | 日重置依赖系统时间 | 测试性问题 |
