# Bond R1 — 测试分支树

> Builder Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts + engine/hero/BondSystem.ts)

## 模块概述

BondSystem 管理武将羁绊系统，包含两个并存的同名系统：

| 系统 | 文件 | 职责 |
|------|------|------|
| `engine/bond/BondSystem` | bond/BondSystem.ts | 好感度、故事事件、编队羁绊预览（旧规则） |
| `engine/hero/BondSystem` | hero/BondSystem.ts | 阵营羁绊计算（新规则）、搭档羁绊、羁绊系数 |

### 公开API清单 — engine/bond/BondSystem

| # | API | 签名 | 类别 |
|---|-----|------|------|
| 1 | `init` | `(deps: ISystemDeps) => void` | 生命周期 |
| 2 | `update` | `(dt: number) => void` | 生命周期 |
| 3 | `getState` | `() => BondSaveData` | 生命周期 |
| 4 | `reset` | `() => void` | 生命周期 |
| 5 | `setCallbacks` | `(callbacks) => void` | 配置 |
| 6 | `getFactionDistribution` | `(heroes: GeneralData[]) => Record<Faction, number>` | 羁绊计算 |
| 7 | `detectActiveBonds` | `(heroes: GeneralData[]) => ActiveBond[]` | 羁绊计算 |
| 8 | `calculateTotalBondBonuses` | `(bonds: ActiveBond[]) => Partial<GeneralStats>` | 羁绊计算 |
| 9 | `getBondEffect` | `(type: BondType) => BondEffect` | 配置查询 |
| 10 | `getAllBondEffects` | `() => BondEffect[]` | 配置查询 |
| 11 | `getFormationPreview` | `(formationId, heroes) => FormationBondPreview` | 可视化 |
| 12 | `getAllStoryEvents` | `() => StoryEventDef[]` | 故事事件 |
| 13 | `getFavorability` | `(heroId: string) => HeroFavorability` | 好感度 |
| 14 | `addFavorability` | `(heroId: string, amount: number) => void` | 好感度 |
| 15 | `getAvailableStoryEvents` | `(heroes: Map<string, GeneralData>) => StoryEventDef[]` | 故事事件 |
| 16 | `triggerStoryEvent` | `(eventId: string) => TriggerResult` | 故事事件 |
| 17 | `serialize` | `() => BondSaveData` | 序列化 |
| 18 | `loadSaveData` | `(data: BondSaveData) => void` | 序列化 |

## 测试分支树

### T1: getFactionDistribution

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T1-N01 | 空数组 → 全零分布 | F-Normal | P2 |
| T1-N02 | 单武将 → 对应阵营+1 | F-Normal | P2 |
| T1-N03 | 6同阵营 → 该阵营=6 | F-Normal | P2 |
| T1-N04 | **hero.faction为undefined → dist[undefined]++，遗漏计数** | F-Error | **P0** |
| T1-N05 | **hero为null → 运行时崩溃** | F-Error | **P0** |

### T2: detectActiveBonds

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T2-N01 | 2同 → faction_2 | F-Normal | P2 |
| T2-N02 | 3同 → faction_3（不触发faction_2） | F-Normal | P2 |
| T2-N03 | 6同 → faction_6 | F-Normal | P2 |
| T2-N04 | 3蜀+3魏 → mixed_3_3 | F-Normal | P2 |
| T2-N05 | 6同+3其他 → faction_6优先，不触发mixed_3_3 | F-Normal | P2 |
| T2-N06 | 2蜀+2魏+2吴 → 3个faction_2 | F-Normal | P2 |

### T3: calculateTotalBondBonuses

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T3-N01 | 空数组 → {} | F-Normal | P2 |
| T3-N02 | 单羁绊 → 对应加成 | F-Normal | P2 |
| T3-N03 | 多羁绊同属性 → 叠加 | F-Normal | P2 |
| T3-N04 | **bonuses含NaN → total[k] = NaN + value = NaN** | F-Error | **P0** |

### T4: addFavorability

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T4-N01 | 新武将+正数 → 创建并累加 | F-Normal | P2 |
| T4-N02 | 已有武将+正数 → 累加 | F-Normal | P2 |
| T4-N03 | **amount=NaN → fav.value=NaN，后续所有比较失效** | F-Error | **P0** |
| T4-N04 | **amount=负数 → 好感度可被恶意扣减** | F-Error | P1 |
| T4-N05 | **amount=Infinity → fav.value=Infinity，序列化崩溃** | F-Error | **P0** |
| T4-N06 | **heroId=""空字符串 → 创建无效条目** | F-Error | P1 |
| T4-N07 | **无上限保护 → 可无限累加** | F-Error | **P0** |

### T5: triggerStoryEvent

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T5-N01 | 正常触发 → success=true | F-Normal | P2 |
| T5-N02 | 事件不存在 → success=false | F-Normal | P2 |
| T5-N03 | 已完成+不可重复 → success=false | F-Normal | P2 |
| T5-N04 | 已完成+可重复 → success=true | F-Normal | P2 |
| T5-N05 | **不校验武将存在/好感度/等级/前置事件 → 可直接触发** | F-Error | **P0** |
| T5-N06 | **deps未初始化 → this.deps.eventBus.emit崩溃** | F-Error | **P0** |
| T5-N07 | **rewards.favorability=NaN → addFavorability注入NaN** | F-Error | **P0** |

### T6: getAvailableStoryEvents

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T6-N01 | 所有条件满足 → 返回事件 | F-Normal | P2 |
| T6-N02 | 武将不存在 → 过滤 | F-Normal | P2 |
| T6-N03 | 好感度不足 → 过滤 | F-Normal | P2 |
| T6-N04 | 等级不足 → 过滤 | F-Normal | P2 |
| T6-N05 | 前置事件未完成 → 过滤 | F-Normal | P2 |
| T6-N06 | 已完成+不可重复 → 过滤 | F-Normal | P2 |
| T6-N07 | **heroes为null → has()调用崩溃** | F-Error | **P0** |

### T7: serialize / loadSaveData

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T7-N01 | 正常序列化+反序列化 → 数据一致 | F-Normal | P2 |
| T7-N02 | 空状态序列化 → 空对象+空数组 | F-Normal | P2 |
| T7-N03 | **favorabilities含Infinity值 → JSON.stringify(Infinity)=null** | F-Error | **P0** |
| T7-N04 | **loadSaveData(null) → Object.entries(null)崩溃** | F-Error | **P0** |
| T7-N05 | **loadSaveData({favorabilities:undefined}) → ?? 运算符返回undefined** | F-Error | **P0** |
| T7-N06 | **loadSaveData缺少version字段 → 无版本校验** | F-Error | P1 |

### T8: getFormationPreview

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T8-N01 | 正常编队 → 完整预览 | F-Normal | P2 |
| T8-N02 | 空编队 → 无羁绊+无提示 | F-Normal | P2 |

### T9: 跨系统链路（保存/加载）

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T9-N01 | **BondSystem.serialize()未被buildSaveData调用 → 好感度/故事事件不存档** | F-Cross | **P0** |
| T9-N02 | **BondSystem.loadSaveData()未被applySaveData调用 → 加载不恢复** | F-Cross | **P0** |
| T9-N03 | **SaveContext缺少bond字段 → 引擎不感知BondSystem状态** | F-Cross | **P0** |
| T9-N04 | **GameSaveData缺少bond字段 → 类型层面不支持** | F-Cross | **P0** |
| T9-N05 | **toIGameState缺少bond → IGameState不含bond** | F-Cross | **P0** |
| T9-N06 | **fromIGameState缺少bond → 反序列化丢bond** | F-Cross | **P0** |
| T9-N07 | triggerStoryEvent → eventBus.emit → 下游系统是否处理 | F-Cross | P1 |

### T10: 双系统冲突

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T10-N01 | **engine/bond/BondSystem.name='bond' vs engine/hero/BondSystem.name='bond'** | F-Cross | P1 |
| T10-N02 | **engine注册bond→bond/BondSystem，但HeroSystem需hero/BondSystem.getBondMultiplier** | F-Cross | P1 |

### T11: 配置一致性

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| T11-N01 | BOND_EFFECTS的4个key与BondType枚举完全对应 | F-Normal | P2 |
| T11-N02 | STORY_EVENTS的condition.eventId与event.id一致 | F-Normal | P2 |

## 统计

| 指标 | 数值 |
|------|------|
| 总节点数 | 46 |
| P0 | 18 |
| P1 | 7 |
| P2 | 21 |
| F-Normal | 22 |
| F-Error | 14 |
| F-Cross | 9 |
| F-Boundary | 1 |
