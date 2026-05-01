# Resource 模块 R2 对抗式测试 — Fixer 修复报告

> 版本: v2.0 | 日期: 2026-05-02 | Fixer Agent

## 修复总览

| 指标 | 值 |
|------|-----|
| 待修复 P1 | 7 |
| 已修复 | 7 |
| 修复率 | 100% |
| 修改文件 | 4 |
| 新增代码行 | ~9 |

---

## 修复清单

### P1-002: calculateBonusMultiplier 负加成归零产出
- **文件**: resource-calculator.ts:60
- **修复**: `multiplier *= (1 + value)` → `multiplier *= Math.max(0, 1 + value)`
- **效果**: 负加成（如 -1）不再导致 multiplier=0，而是 clamp 到 0

### P1-004: getWarningLevel(NaN) 返回 'safe'
- **文件**: resource-calculator.ts:108
- **修复**: 入口添加 `if (!Number.isFinite(percentage)) return 'safe';`
- **效果**: NaN 百分比显式返回 'safe'，语义明确

### P1-005: trySpend 非空断言
- **文件**: copper-economy-system.ts:266
- **修复**: 添加 `if (!this.economyDeps) return 0;` 替换 `this.economyDeps!`
- **效果**: economyDeps 为 null 时不再崩溃

### P1-007: enforceCaps NaN 纵深
- **文件**: ResourceSystem.ts:342
- **修复**: enforceCaps 入口添加 `if (!Number.isFinite(this.resources[type])) this.resources[type] = 0;`
- **效果**: NaN 资源值被修复为 0，防御纵深

### P1-008: formatOfflineTime(NaN)
- **文件**: OfflineEarningsCalculator.ts:141
- **修复**: `if (!Number.isFinite(seconds) || seconds <= 0) return '刚刚';`
- **效果**: NaN 输入返回 "刚刚"

### P1-009: getOfflineEfficiencyPercent(NaN)
- **文件**: OfflineEarningsCalculator.ts:170
- **修复**: `if (!Number.isFinite(offlineSeconds) || offlineSeconds <= 0) return 100;`
- **效果**: NaN 输入返回 100

### P1-017: lookupCap 空 capacityTable
- **文件**: resource-calculator.ts:78
- **修复**: 添加 `if (keys.length === 0) return 0;`
- **效果**: 空配置表返回 0 而非 undefined

---

## 修改文件清单

| 文件 | 修改类型 | P1 覆盖 |
|------|----------|---------|
| resource-calculator.ts | 负加成下界 + NaN 警告 + 空表兜底 | P1-002, P1-004, P1-017 |
| copper-economy-system.ts | 非空断言 → null 安全 | P1-005 |
| ResourceSystem.ts | enforceCaps NaN 纵深 | P1-007 |
| OfflineEarningsCalculator.ts | formatOfflineTime + efficiency NaN 防护 | P1-008, P1-009 |

---

## 关闭的 P1（无需修改）

| ID | 理由 |
|----|------|
| P1-001 | deserialize NaN 已有 warn 日志（FIX-717 添加），静默归零可接受 |
| P1-003 | 配置层问题，运行时 capacityTable 数据正确时不可能触发 |
| P1-006 | 已有 random 注入机制 |
| P1-010 | 已有 `now?: Date` 参数注入 |

---

## 累计修复统计

| 轮次 | P0 修复 | P1 修复 | 总修改行 |
|------|---------|---------|----------|
| R1 | 21 | 0 | ~80 |
| R2 | 0 | 7 | ~9 |
| **累计** | **21** | **7** | **~89** |
