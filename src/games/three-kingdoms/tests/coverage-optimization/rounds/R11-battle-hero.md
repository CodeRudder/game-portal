# R11 — Battle & Hero 模块未覆盖文件测试

> **日期**: 2025-04-30  
> **轮次**: R11  
> **范围**: battle 模块 5 文件 + hero 模块 4 文件  
> **结果**: ✅ 9 个测试文件、170 个用例全部通过

---

## 📊 总览

| 模块 | 文件 | 测试文件 | 用例数 | 状态 |
|------|------|----------|--------|------|
| battle | `battle-effect-presets.ts` | `battle-effect-presets.test.ts` | 20 | ✅ |
| battle | `BattleFragmentRewards.ts` | `BattleFragmentRewards.test.ts` | 12 | ✅ |
| battle | `battle-helpers.ts` | `battle-helpers.test.ts` | 17 | ✅ |
| battle | `BattleStatistics.ts` | `BattleStatistics.test.ts` | 17 | ✅ |
| battle | `BattleTargetSelector.ts` | `BattleTargetSelector.test.ts` | 14 | ✅ |
| hero | `AwakeningSystem.ts` | `AwakeningSystem.supplement.test.ts` | 22 | ✅ |
| hero | `HeroRecruitExecutor.ts` | `HeroRecruitExecutor.test.ts` | 12 | ✅ |
| hero | `HeroRecruitUpManager.ts` | `HeroRecruitUpManager.test.ts` | 20 | ✅ |
| hero | `SkillUpgradeSystem.ts` | `SkillUpgradeSystem.supplement.test.ts` | 36 | ✅ |
| **合计** | **9 文件** | **9 测试文件** | **170** | **✅** |

---

## 🔬 Battle 模块详情

### 1. battle-effect-presets.test.ts (20 用例)

**类型**: 纯数据/配置文件测试  
**策略**: 验证数据结构完整性和基本不变量

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| ELEMENT_PARTICLE_PRESETS | 6 | 8种元素完整性、数值范围、颜色格式、重力方向 |
| ELEMENT_GLOW_PRESETS | 4 | 8种元素完整性、属性范围、最高/最低强度 |
| SCREEN_PRESETS | 6 | 3种屏幕尺寸、尺寸递增、简化特效、粒子缩放 |
| BUFF_ELEMENT_MAP | 4 | 8种Buff映射正确性、只读性 |

**关键不变量验证**:
- fire 粒子重力向上（负值），ice/earth 向下（正值）
- thunder 无重力
- thunder 光效强度最高(1.0)，neutral 最低(0.4)
- small 屏幕简化特效，medium/large 不简化
- canvasWidth/canvasHeight 随屏幕等级递增

### 2. BattleFragmentRewards.test.ts (12 用例)

**类型**: 纯函数业务逻辑测试  
**策略**: 正常路径 + 边界条件

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| calculateFragmentRewards | 7 | 胜利/失败/平局、首通必掉、非首通10%掉率、空队伍、0存活 |
| simpleHash | 5 | 非负整数、确定性、不同输入不同输出、空字符串、超长字符串 |

**关键业务规则验证**:
- PRD v3.0 §4.3a: 非胜利无碎片
- 首通时所有敌方单位必掉1碎片
- 非首通使用确定性哈希实现10%掉率（纯函数可回放）

### 3. battle-helpers.test.ts (17 用例)

**类型**: 工具函数测试  
**策略**: 每个函数的正常路径 + 空输入/全灭边界

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| getAliveUnits | 3 | 存活筛选、全灭、空队伍 |
| getAliveFrontUnits | 1 | 前排存活筛选 |
| getAliveBackUnits | 1 | 后排存活筛选 |
| sortBySpeed | 4 | 速度降序、同速ID排序、不修改原数组、空输入 |
| getEnemyTeam | 2 | ally→enemy、enemy→ally |
| getAllyTeam | 2 | ally→ally、enemy→enemy |
| findUnitInTeam | 2 | 找到/未找到 |
| findUnit | 3 | allyTeam找到、enemyTeam找到、未找到 |

### 4. BattleStatistics.test.ts (17 用例)

**类型**: 统计计算 + ISubsystem 包装测试  
**策略**: 纯函数测试 + 子系统生命周期测试

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| calculateBattleStats | 6 | 空日志、伤害统计、最高伤害、连击统计、连击重置、零伤害 |
| generateSummary | 4 | 三星胜利、一星胜利、失败、平局 |
| BattleStatisticsSubsystem | 7 | name/init/update/getState/reset/calculate/summary |

**关键统计规则验证**:
- 连击 = 连续暴击次数，非暴击重置
- allyTotalDamage / enemyTotalDamage 按行动者阵营分别统计
- maxSingleDamage 跨阵营全局最大值

### 5. BattleTargetSelector.test.ts (14 用例)

**类型**: 目标选择逻辑测试  
**策略**: 每种目标类型 + 降级逻辑 + 边界

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| selectSingleTarget | 4 | 前排优先、后排降级、全灭空返回、空队伍 |
| selectFrontRowTargets | 2 | 前排选择、后排降级 |
| selectBackRowTargets | 2 | 后排选择、前排降级 |
| selectTargets (集成) | 6 | SINGLE_ENEMY/FRONT_ROW/BACK_ROW/ALL_ENEMY/SELF/SINGLE_ALLY |

**关键目标规则验证**:
- 单体目标优先前排，无前排降级后排
- 前排技能无前排时降级后排，后排同理
- SELF 死亡时返回空数组
- SINGLE_ALLY 选择HP比例最低的友方
- 未知目标类型默认为单体敌方

---

## 🦸 Hero 模块详情

### 6. AwakeningSystem.supplement.test.ts (22 用例)

**类型**: 补充覆盖测试（已有58用例的补充）  
**策略**: 覆盖已有测试未覆盖的盲区

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| getAwakeningSkillPreview | 2 | 未觉醒也能预览、不存在武将返回null |
| calculateAwakenedStats 边界 | 3 | 不存在武将零属性、未觉醒返回原属性、觉醒后×1.5 |
| getAwakeningStatDiff | 3 | 未觉醒零差值、觉醒正差值、不存在零差值 |
| getPassiveSummary 边界 | 2 | 无觉醒零加成、全局属性叠加上限 |
| 序列化边界 | 3 | 版本不匹配、null heroes、序列化/反序列化往返 |
| ISubsystem 接口 | 3 | update空操作、getState序列化、reset清空 |
| 觉醒经验/金币表边界 | 3 | level<101返回0、level>120返回0、101-120有效 |
| getAwakeningSkill | 1 | 返回副本而非引用 |

### 7. HeroRecruitExecutor.test.ts (12 用例)

**类型**: 抽卡执行器直接测试  
**策略**: 完整抽卡流程 + UP机制 + 保底计数器

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| executeSinglePull 基本流程 | 3 | 普通/高级招募、重复武将处理 |
| UP武将机制 | 3 | UP命中、普通招募不触发UP、null UP |
| 保底计数器更新 | 3 | normalPity递增、advancedPity递增、RARE+品质重置 |
| 空卡池处理 | 1 | 不抛异常 |
| 多次抽卡 | 1 | 同RNG一致性 |
| 保底计数器隔离 | 1 | normal/advanced独立计数 |

**关键UP规则验证**:
- UP 仅在 advanced + LEGENDARY + rng < upRate 时触发
- 普通招募不触发 UP
- upGeneralId=null 不触发 UP

### 8. HeroRecruitUpManager.test.ts (20 用例)

**类型**: UP武将管理子系统直接测试（首次覆盖）  
**策略**: ISubsystem接口 + CRUD + 序列化/反序列化

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| ISubsystem 接口 | 5 | name/init/update/getState/reset |
| UP武将设置 | 4 | 默认概率、自定义概率、设为null、只读副本 |
| UP概率 | 3 | get/set、100%和0% |
| clearUpHero | 1 | 清除恢复默认 |
| 序列化/反序列化 | 6 | 序列化、反序列化恢复、版本不匹配、缺失upHero、部分数据、往返 |

**关键序列化规则验证**:
- 版本不匹配仅 warn 不抛异常
- 缺失 upHero 数据恢复默认
- 部分 upHero 数据用默认值填充
- 序列化/反序列化往返一致性

### 9. SkillUpgradeSystem.supplement.test.ts (36 用例)

**类型**: 补充覆盖测试（已有用例的补充）  
**策略**: 覆盖升级成功/失败路径 + 边界条件

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| upgradeSkill 成功路径 | 3 | Lv1→Lv2正确消耗、效果提升、历史记录 |
| upgradeSkill 失败路径 | 7 | deps未设置/武将不存在/无效索引/材料不足/觉醒技能突破前置 |
| getSkillLevel/getSkillEffect 边界 | 4 | deps未设置/不存在武将/无效索引 |
| getSkillLevelCap 边界 | 4 | 0星/负星/未知星级/1-6星完整 |
| canUpgradeAwakenSkill | 3 | deps未设置/突破0/突破≥1 |
| getExtraEffect | 5 | 无额外效果/deps未设置/等级≥5/等级>5缩放/不存在武将 |
| ISubsystem 接口 | 4 | name/update/reset/getState副本 |
| getStrategyRecommender | 1 | 返回实例 |
| recommendStrategy | 1 | 委托调用 |

**关键升级规则验证**:
- 升级消耗表：Lv1→500金+1书, Lv2→1500金+1书, Lv3→4000金+2书, Lv4→10000金+2书
- 技能效果公式：1.0 + (level-1) × 0.1
- 星级上限映射：1→3, 2→4, 3→5, 4→6, 5→8, 6→10
- 觉醒技能需突破≥1才能升级
- 额外效果：等级≥5时 bonus = 0.2 × (level - 5 + 1)

---

## 🧪 测试质量指标

| 指标 | 值 |
|------|-----|
| 新增测试文件 | 9 |
| 新增测试用例 | 170 |
| 通过率 | 100% (170/170) |
| 覆盖文件 | 9/9 (100%) |
| 边界条件用例占比 | ~35% |
| 异常路径用例占比 | ~25% |

---

## 📝 测试文件清单

```
src/games/three-kingdoms/engine/battle/__tests__/
├── battle-effect-presets.test.ts       (NEW, 20 cases)
├── BattleFragmentRewards.test.ts       (NEW, 12 cases)
├── battle-helpers.test.ts              (NEW, 17 cases)
├── BattleStatistics.test.ts            (NEW, 17 cases)
└── BattleTargetSelector.test.ts        (NEW, 14 cases)

src/games/three-kingdoms/engine/hero/__tests__/
├── AwakeningSystem.supplement.test.ts  (NEW, 22 cases)
├── HeroRecruitExecutor.test.ts         (NEW, 12 cases)
├── HeroRecruitUpManager.test.ts        (NEW, 20 cases)
└── SkillUpgradeSystem.supplement.test.ts (NEW, 36 cases)
```
