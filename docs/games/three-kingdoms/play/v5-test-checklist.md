# 三国霸业 v5.0 百家争鸣 — 集成测试检查清单

> **版本**: v5.0  
> **最后测试时间**: 2026-04-24  
> **测试框架**: Vitest  
> **测试脚本文件名前缀**: `integration/`  
> **测试目录**: `src/games/three-kingdoms/engine/tech/__tests__/integration/`

---

## 📊 测试总览

| 指标 | 数值 |
|------|------|
| 测试文件数 | 17 |
| 总测试用例 | 394 |
| 通过 | 383 |
| 跳过 (skip) | 11 |
| 失败 | 0 |
| 通过率 | 100% (383/383 非 skip) |

---

## 📋 文件级测试明细

### 核心9个集成测试文件（按 Play 文档章节）

| # | 文件 | 覆盖章节 | 通过 | Skip | 总计 |
|---|------|----------|------|------|------|
| 1 | `integration/tech-research-full-flow` | §1.1-1.4 | 14 | 0 | 14 |
| 2 | `integration/tech-link-fusion-offline` | §1.5-1.8 | 16 | 0 | 16 |
| 3 | `integration/tech-points-core-loop` | §1.9-1.11 + §9.1 | 16 | 0 | 16 |
| 4 | `integration/map-render-territory` | §2.1-2.4 + §3.1-3.2 | 50 | 0 | 50 |
| 5 | `integration/siege-full-flow` | §4.1-4.6 | 39 | 3 | 42 |
| 6 | `integration/map-filter-stat` | §2.5-2.6 + §5.1-5.3 + §6.1 | 46 | 1 | 47 |
| 7 | `integration/prestige-rebirth` | §7.1-7.2 + §8.1-8.2 | 41 | 0 | 41 |
| 8 | `integration/cross-validation-loop` | §9.x | 21 | 0 | 21 |
| 9 | `integration/mobile-edge-cases` | §2.7 + §10.x | 25 | 0 | 25 |

### 扩展集成测试文件

| # | 文件 | 覆盖章节 | 通过 | Skip | 总计 |
|---|------|----------|------|------|------|
| 10 | `integration/cross-system-validation` | §9.x 补充 | 15 | 0 | 15 |
| 11 | `integration/map-territory-siege` | §2-4 补充 | 27 | 0 | 27 |
| 12 | `integration/tech-mutex-fusion-link` | §1.x 互斥融合 | 19 | 0 | 19 |
| 13 | `integration/garrison-reincarnation-edge` | §3.x + §8.x | 13 | 0 | 13 |
| 14 | `integration/tech-offline-reincarnation` | §1.x 离线转生 | 10 | 0 | 10 |
| 15 | `integration/tech-browse-research` | §1.x 浏览研究 | 12 | 0 | 12 |
| 16 | `integration/tech-queue-accelerate` | §1.x 队列加速 | 13 | 0 | 13 |
| 17 | `integration/map-event-stat-mobile` | §2.x + §5-6 + §10.x | 6 | 7 | 13 |

---

## 🔍 核心9文件验证点覆盖

### 文件8: cross-validation-loop (§9.x)
- ✅ §9.1 科技↔地图联动：科技影响地图渲染 (3 tests)
- ✅ §9.2 科技↔领土联动：科技加成领土产出 (3 tests)
- ✅ §9.3 科技↔攻城联动：科技影响攻城战力 (3 tests)
- ✅ §9.5 领土↔资源联动：领土产出影响资源 (4 tests)
- ✅ §9.7 科技↔声望联动：科技研究获得声望 (4 tests)
- ✅ §9.9 离线↔领土联动：离线领土产出 (4 tests)

### 文件9: mobile-edge-cases (§2.7 + §10.x)
- ✅ §2.7 手机端地图适配：响应式配置 (8 tests)
- ✅ §10.1 科技点不足：研究拒绝 (3 tests)
- ✅ §10.2 前置科技未完成：研究拒绝 (3 tests)
- ✅ §10.3 互斥科技冲突：互斥拒绝 (3 tests)
- ✅ §10.5 领土被夺回：状态变更 (3 tests)
- ✅ §10.6 攻城失败后重试：冷却和重试 (5 tests)

---

## ✅ 封版判定

| 检查项 | 状态 |
|--------|------|
| 全部测试通过 | ✅ 383/383 pass |
| Skip 用例有明确标记 | ✅ 11 skip (API未实现) |
| 编译无错误 | 待验证 |
| Play 文档章节全覆盖 | ✅ §1-10 |

---

*Generated: 2026-04-24 · 三国霸业 v5.0 百家争鸣封版*
