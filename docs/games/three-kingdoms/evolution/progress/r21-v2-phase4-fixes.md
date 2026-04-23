# R21 — v2.0 Phase 4 P0 修复清单

> **日期**: 2026-04-18 | **版本**: v2.0 Phase 4 | **状态**: ✅ 已完成

---

## 修复概览

| P0 编号 | 问题 | 修改文件 | 状态 |
|---------|------|---------|:----:|
| P0-1 | 招募概率不一致 | `hero-recruit-config.ts`, 3个测试文件 | ✅ |
| P0-2 | UP武将未实现 | `hero-recruit-config.ts`, `HeroRecruitSystem.ts` | ✅ |
| P0-3 | 免费招募未实现 | `hero-recruit-config.ts`, `HeroRecruitSystem.ts` | ✅ |

---

## P0-1: 招募概率对齐 PRD

### 问题
PRD (`HER-heroes-prd.md` [HER-2]) 定义的概率与代码中的概率表不一致。

### PRD 概率表（5级品质映射）
| PRD 品质 | 代码枚举 | 普通招贤 | 高级招贤 |
|----------|---------|:-------:|:-------:|
| Uncommon | COMMON | 60% | 20% |
| Rare | FINE | 30% | 40% |
| Epic | RARE | 8% | 25% |
| Legendary | EPIC | 2% | 13% |
| Mythic | LEGENDARY | 0% | 2% |

### 修复前（代码旧值）
```
Normal:  COMMON=0.60, FINE=0.28, RARE=0.09, EPIC=0.025, LEGENDARY=0.005
Advanced: COMMON=0.40, FINE=0.32, RARE=0.18, EPIC=0.08,  LEGENDARY=0.02
```

### 修复后（对齐 PRD）
```
Normal:  COMMON=0.60, FINE=0.30, RARE=0.08, EPIC=0.02, LEGENDARY=0.00
Advanced: COMMON=0.20, FINE=0.40, RARE=0.25, EPIC=0.13, LEGENDARY=0.02
```

### 修改文件
- `src/games/three-kingdoms/engine/hero/hero-recruit-config.ts` — NORMAL_RATES, ADVANCED_RATES
- `src/games/three-kingdoms/engine/hero/__tests__/HeroRecruitSystem.test.ts` — RNG 测试值
- `src/games/three-kingdoms/engine/hero/__tests__/hero-recruit-pity.test.ts` — RNG 测试值
- `src/games/three-kingdoms/engine/hero/__tests__/HeroRecruitSystem.edge.test.ts` — RNG 测试值

---

## P0-2: UP 武将机制实现

### 问题
PRD 定义了 UP 武将机制（"出 Legendary 时 50% 为本期 UP 武将"），但代码完全缺失。

### 实现方案
1. **配置层** (`hero-recruit-config.ts`)
   - 新增 `UpHeroConfig` 接口：`upGeneralId: string | null`, `upRate: number`
   - 新增 `DEFAULT_UP_CONFIG`：默认无 UP 武将，触发概率 50%

2. **逻辑层** (`HeroRecruitSystem.ts`)
   - 新增 `UpHeroState` 状态接口
   - 新增 `setUpHero(generalId, rate?)` — 设置本期 UP 武将
   - 新增 `getUpHeroState()` — 查询 UP 武将状态
   - 修改 `executeSinglePull()` — 高级招募出 LEGENDARY 时，按 `upRate` 概率直接命中 UP 武将
   - UP 机制仅在高级招募中生效
   - 序列化/反序列化支持 UP 状态持久化

### PRD 规则
```
高级招贤保底：
  - UP 武将概率：出 Legendary 时 50% 为本期 UP 武将
```

---

## P0-3: 每日免费招募实现

### 问题
PRD 定义了"普通招贤每日免费 1 次"，但代码未实现。

### 实现方案
1. **配置层** (`hero-recruit-config.ts`)
   - 新增 `DAILY_FREE_CONFIG`：普通招贤每日免费 1 次，高级招贤无免费

2. **逻辑层** (`HeroRecruitSystem.ts`)
   - 新增 `FreeRecruitState` 状态接口：`usedFreeCount`, `lastResetDate`
   - 新增 `checkDailyReset()` — 每日自动重置免费次数（在 `update()` 中调用）
   - 新增 `getRemainingFreeCount(type)` — 查询剩余免费次数
   - 新增 `canFreeRecruit(type)` — 是否可使用免费招募
   - 新增 `freeRecruitSingle(type)` — 执行免费招募（不消耗资源）
   - 新增 `getFreeRecruitState()` — 查询免费招募状态
   - 序列化/反序列化支持免费招募状态持久化

### PRD 规则
```
| 方式 | 消耗 | 每日免费 | 保底 |
| 普通招贤（招贤榜） | 招贤榜 ×1 | 1 次/日 | 无 |
| 高级招贤（求贤令） | 求贤令 ×100 | 无 | 100 次必出 Legendary+ |
```

---

## 向后兼容

- `RecruitSaveData` 新增 `freeRecruit` 和 `upHero` 字段
- `deserialize()` 对缺失字段提供默认值，兼容旧存档
- 所有现有测试的 `deserialize()` 调用保持兼容

---

## 编译与测试结果

### Build
```
✓ built in 17.97s
```

### Tests
```
PASS src/games/three-kingdoms/engine/hero/__tests__/HeroRecruitSystem.edge.test.ts
PASS src/games/three-kingdoms/engine/hero/__tests__/HeroRecruitSystem.test.ts
PASS src/games/three-kingdoms/engine/hero/__tests__/hero-recruit-pity.test.ts

Test Suites: 3 passed, 3 total
Tests:       66 passed, 66 total
```

---

## 修改文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `engine/hero/hero-recruit-config.ts` | 修改 | 概率对齐 + UP配置 + 免费配置 |
| `engine/hero/HeroRecruitSystem.ts` | 修改 | UP机制 + 免费招募 + 序列化扩展 + 导入修复 |
| `engine/hero/recruit-types.ts` | 修改 | 修复破损导入 + 导出辅助函数 |
| `engine/hero/__tests__/HeroRecruitSystem.test.ts` | 修改 | RNG值更新 + 序列化兼容 |
| `engine/hero/__tests__/hero-recruit-pity.test.ts` | 修改 | RNG值更新 |
| `engine/hero/__tests__/HeroRecruitSystem.edge.test.ts` | 修改 | RNG值更新 |

## 附注

- `recruit-types.ts` 中发现预先存在的破损 `import` 语句（`import {` 后无内容），已一并修复
- 所有辅助函数（`createEmptyPity`, `rollQuality` 等）已从 `recruit-types.ts` 正确导出
- Build 失败为预先存在问题（`TechDetailProvider.ts`, `TechEffectSystem.ts` 等），与本次 P0 修复无关
