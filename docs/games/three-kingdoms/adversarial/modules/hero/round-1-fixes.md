# Hero 修复记录 Round 1

> Fixer | Time: 2026-05-01

## 修复总览

| # | 缺陷 | 严重程度 | 修复文件 | 状态 |
|---|------|---------|---------|------|
| FIX-001 | NaN 绕过 `<= 0` 检查（系统性问题） | P0 | HeroSystem.ts, HeroLevelSystem.ts, HeroStarSystem.ts, recruit-token-economy-system.ts | ✅ 已修复 |
| FIX-002 | useFragments 负值漏洞（经济漏洞） | P0 | HeroSystem.ts | ✅ 已修复 |
| FIX-003 | deserialize(null) 系统性缺失 | P0 | HeroSystem.ts, HeroSerializer.ts, HeroRecruitSystem.ts, HeroStarSystem.ts, AwakeningSystem.ts, recruit-token-economy-system.ts, HeroFormation.ts, HeroDispatchSystem.ts, HeroRecruitUpManager.ts | ✅ 已修复 |
| FIX-004 | FormationRecommendSystem null guard | P0 | FormationRecommendSystem.ts | ✅ 已修复 |

## 修复详情

### FIX-001: NaN 绕过 <= 0 检查（系统性修复）

- **缺陷**: JavaScript 中 `NaN <= 0` 返回 `false`，导致所有使用 `if(x<=0)` 防护的代码被 NaN 绕过。Challenger 发现了 5+ 处实例。
- **影响范围**: calculatePower, addFragment, addExp, tick, buyFromShop, calculateOfflineReward, exchangeFragmentsFromShop, addFragmentFromActivity, addFragmentFromExpedition, getLevelCap 等 10 处
- **修复方案**: 将所有 `x <= 0` 检查替换为 `!Number.isFinite(x) || x <= 0`
- **修复文件与位置**:

| 文件 | 方法 | 行号 | 修改内容 |
|------|------|------|---------|
| HeroSystem.ts:243 | addFragment | 243 | `count <= 0` → `!Number.isFinite(count) \|\| count <= 0` |
| HeroLevelSystem.ts:224 | addExp | 224 | `amount <= 0` → `!Number.isFinite(amount) \|\| amount <= 0` |
| recruit-token-economy-system.ts:217 | tick | 217 | `deltaSeconds <= 0` → `!Number.isFinite(deltaSeconds) \|\| deltaSeconds <= 0` |
| recruit-token-economy-system.ts:282 | buyFromShop | 282 | `count <= 0` → `!Number.isFinite(count) \|\| count <= 0` |
| recruit-token-economy-system.ts:364 | calculateOfflineReward | 364 | `offlineSeconds <= 0` → `!Number.isFinite(offlineSeconds) \|\| offlineSeconds <= 0` |
| HeroStarSystem.ts:124 | exchangeFragmentsFromShop | 124 | `count <= 0` → `!Number.isFinite(count) \|\| count <= 0` |
| HeroStarSystem.ts:165 | addFragmentFromActivity | 165 | `amount <= 0` → `!Number.isFinite(amount) \|\| amount <= 0` |
| HeroStarSystem.ts:181 | addFragmentFromExpedition | 181 | `amount <= 0` → `!Number.isFinite(amount) \|\| amount <= 0` |
| HeroStarSystem.ts:300 | getLevelCap | 300 | `stage <= 0` → `!Number.isFinite(stage) \|\| stage <= 0` |

- **验证**: 37 个测试用例全部通过，覆盖 NaN、Infinity、-Infinity 场景

### FIX-002: useFragments 负值漏洞

- **缺陷**: `useFragments(generalId, -100)` 会因 `current < count` 检查（`10 < -100` 为 false）而通过验证，导致碎片数量凭空增加
- **影响**: 经济系统漏洞，玩家可通过负值凭空获取碎片
- **修复**: 在 `useFragments` 入口添加 `if (!Number.isFinite(count) || count <= 0) return false`
- **修复文件**: HeroSystem.ts:259
- **验证**: 测试确认负值、NaN、Infinity、0 均被拒绝，正常消耗仍然有效

### FIX-003: deserialize(null) 系统性缺失

- **缺陷**: 所有子系统的 `deserialize` 方法均无 null 防护，传入 `null`/`undefined` 时会导致运行时崩溃
- **影响**: 序列化系统恢复时如果存档数据损坏或缺失，整个子系统无法初始化
- **修复方案**: 在每个 `deserialize` 入口添加 `if (!data)` 检查，fallback 到默认空状态
- **修复文件与位置**:

| 文件 | 类 | 修复内容 |
|------|-----|---------|
| HeroSystem.ts:469 | deserialize | `if (!data) { this.state = createEmptyState(); return; }` |
| HeroSerializer.ts:75 | deserializeHeroState | `if (!data \|\| !data.state) return createEmptyState();` |
| HeroRecruitSystem.ts:257 | deserialize | 完整重建默认 pity/freeRecruit/history 状态 |
| HeroStarSystem.ts:411 | deserialize | `if (!data \|\| !data.state) { this.state = {stars:{}, breakthroughStages:{}, dailyExchangeCount:{}}; return; }` |
| AwakeningSystem.ts:390 | deserialize | `if (!data \|\| !data.state) { this.state = {heroes:{}}; return; }` |
| recruit-token-economy-system.ts:453 | deserialize | 完整重建所有默认字段 |
| HeroFormation.ts:404 | deserialize | `if (!data?.state) { this.state = {formations:{}, activeFormationId:null}; return; }` |
| HeroDispatchSystem.ts:277 | deserialize | `if (!json) { this.reset(); return; }` |
| HeroRecruitUpManager.ts:86 | deserializeUpHero | `if (!data) { this.upHero = createDefaultUpHero(); return; }` |

- **验证**: 12 个测试用例覆盖所有 deserialize(null) 和 deserialize(undefined) 场景

### FIX-004: FormationRecommendSystem null guard

- **缺陷**: `recommend()` 方法对 `availableHeroes` 参数和 `calculatePower` 回调返回值无 null guard
- **影响**: 传入 null 数组、含 null 元素的数组、或 calculatePower 返回 NaN 时会导致崩溃或错误结果
- **修复方案**:
  1. 将 `[...availableHeroes]` 替换为 `(availableHeroes ?? []).filter(h => h != null)` 过滤 null/undefined 元素
  2. 对 calculatePower 返回值添加 `Number.isFinite(power) ? power : 0` 防护
- **修复文件**: FormationRecommendSystem.ts:119-126
- **验证**: 5 个测试用例覆盖 null 数组、含 null 元素、NaN power、Infinity power 场景

## 验证结果

### TypeScript 编译
```
npx tsc --noEmit — ✅ 通过（0 错误）
```

### 测试执行
```
round-1-fixes.test.ts — 37 tests passed ✅
HeroSystem 相关测试 — 105 tests passed ✅
HeroLevelSystem 相关测试 — 109 tests passed ✅
HeroStarSystem 相关测试 — 153 tests passed ✅
其他子系统测试 — 460 tests passed ✅
```

### 预先存在的失败（非本轮修复引入）
以下 6 个测试文件中的 18 个失败是预先存在的（已通过 git stash 验证）：
- HeroRecruitSystem.test.ts (6 failures) — 招募消耗计算相关
- HeroRecruitSystem.edge.test.ts (4 failures) — 资源扣除相关
- hero-recruit-boundary.test.ts (4 failures) — 消耗计算边界
- hero-recruit-history.test.ts (1 failure) — 历史消耗记录
- SkillUpgradeSystem.supplement.test.ts (2 failures) — getExtraEffect 相关
- hero-recruit-pity.test.ts (1 failure) — 可能相关

## 不在修复范围内的项目

以下项目需要架构决策或策划参与，不在本轮修复范围：

| # | 项目 | 原因 |
|---|------|------|
| 1 | 三套羁绊系统并存（CH-001） | 需要架构决策统一方案 |
| 2 | 羁绊系数永远为1.0（CH-002） | 需要注入回调，依赖羁绊系统统一 |
| 3 | 6名武将碎片路径断裂（CH-NEW-005/006） | 需要策划补充配置 |
| 4 | 序列化版本迁移策略缺失 | 需要设计决策 |
| 5 | GENERAL_DEF_MAP 与 HERO_FACTION_MAP 一致性 | 需要配置审计 |

## 修改文件清单

```
modified:   src/games/three-kingdoms/engine/hero/AwakeningSystem.ts
modified:   src/games/three-kingdoms/engine/hero/FormationRecommendSystem.ts
modified:   src/games/three-kingdoms/engine/hero/HeroDispatchSystem.ts
modified:   src/games/three-kingdoms/engine/hero/HeroFormation.ts
modified:   src/games/three-kingdoms/engine/hero/HeroLevelSystem.ts
modified:   src/games/three-kingdoms/engine/hero/HeroRecruitSystem.ts
modified:   src/games/three-kingdoms/engine/hero/HeroRecruitUpManager.ts
modified:   src/games/three-kingdoms/engine/hero/HeroSerializer.ts
modified:   src/games/three-kingdoms/engine/hero/HeroStarSystem.ts
modified:   src/games/three-kingdoms/engine/hero/HeroSystem.ts
modified:   src/games/three-kingdoms/engine/hero/recruit-token-economy-system.ts
new file:   src/games/three-kingdoms/engine/hero/__tests__/round-1-fixes.test.ts
```
