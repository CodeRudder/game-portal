# Hero 挑战清单 Round 2 — Part C（辅助系统验证）

> Challenger: TreeChallenger v1.1 | Time: 2026-05-01
> 审查对象: FIX-003 修复覆盖验证 + 序列化/事件/配置交叉验证

## 一、FIX-003 deserialize(null) 修复覆盖验证

### 全覆盖检查

| 系统 | deserialize(null) | deserialize(undefined) | 损坏数据防护 | 状态 |
|------|-------------------|----------------------|-------------|------|
| HeroSystem | ✅ L469 | ✅ | ⚠️ 见R2-C001 | 部分通过 |
| HeroSerializer | ✅ L75 | ✅ | ⚠️ 见R2-C002 | 部分通过 |
| HeroRecruitSystem | ✅ L257 | ✅ | ✅ 完整默认值 | 通过 |
| HeroStarSystem | ✅ L411 | ✅ | ✅ 默认空状态 | 通过 |
| AwakeningSystem | ✅ L390 | ✅ | ✅ `data.state.heroes ?? {}` | 通过 |
| TokenEconomy | ✅ L453 | ✅ | ✅ 完整默认字段 | 通过 |
| HeroFormation | ✅ L404 | ✅ | ✅ | 通过 |
| HeroDispatchSystem | ✅ L277 | ✅ | ✅ try-catch + reset | 通过 |
| HeroRecruitUpManager | ✅ L86 | ✅ | ✅ createDefaultUpHero | 通过 |
| SkillUpgradeSystem | ❌ 无serialize/deserialize | ❌ | ❌ | **缺失** |
| BondSystem (hero层) | N/A（无状态） | N/A | N/A | 通过 |
| FactionBondSystem | N/A（空操作） | N/A | N/A | 通过 |

### R2-C001: HeroSerializer.deserializeHeroState 含 null 武将数据崩溃 — P0

**位置**：`HeroSerializer.ts:89`

**源码验证**：
```typescript
for (const [id, g] of Object.entries(data.state.generals)) {
    generals[id] = cloneGeneral(g); // g=null → 崩溃
}
```

**复现场景**：
```typescript
deserializeHeroState({
    version: 1,
    state: { generals: { 'guanyu': null }, fragments: {} }
});
// → cloneGeneral(null) → { ...null } = {} → g.skills.map is not a function
```

**修复建议**：添加 `if (!g) continue;` 跳过损坏条目。

### R2-C002: HeroSerializer.cloneGeneral 无 null guard — P0

**位置**：`HeroSerializer.ts:32-36`

```typescript
export function cloneGeneral(g: GeneralData): GeneralData {
  return {
    ...g,
    baseStats: { ...g.baseStats },
    skills: g.skills.map((s) => ({ ...s })),
  };
}
```

**问题**：`cloneGeneral(null)` → `{ ...null }` = `{}`，然后 `{}.baseStats` = undefined，`{}.skills` = undefined → `undefined.map is not a function` 崩溃。

**修复建议**：入口添加 `if (!g) return null;` 或 `if (!g) throw new Error('cloneGeneral: null input');`

---

## 二、序列化版本迁移问题

### R2-C003: 所有子系统版本不匹配时仅打印警告，无迁移逻辑 — P1

**影响范围**：HeroSystem、HeroStarSystem、HeroRecruitSystem、AwakeningSystem

**源码验证**：所有 deserialize 方法中，版本不匹配时统一模式：
```typescript
if (data.version !== SAVE_VERSION) {
    gameLog.warn(`版本不匹配 (期望 ${SAVE_VERSION}，实际 ${data.version})`);
}
// 然后继续正常反序列化...
```

**问题**：如果新版本增加了必填字段，旧存档中没有这些字段，反序列化后该字段为 `undefined`，可能导致后续运行时崩溃。

**影响**：版本升级时缺少数据迁移策略，可能导致存档兼容性问题。

### R2-C004: SkillUpgradeSystem 完全没有 serialize/deserialize — P0（R1遗留）

**位置**：`SkillUpgradeSystem.ts` — 无 serialize/deserialize 方法

**影响**：
- `upgradeHistory`（技能升级历史）不持久化
- `breakthroughSkillUnlocks`（突破技能解锁记录）不持久化
- 游戏重启后所有技能升级历史丢失

---

## 三、配置交叉验证（v1.1 新增规则）

### R2-C005: 羁绊ID不一致 — partner_wei vs partner_weizhi — P0（R1遗留）

**源码验证**：
- `bond-config.ts:342` → `id: 'partner_wei_shuangbi'`（张辽+徐晃）
- `faction-bond-config.ts:443` → `id: 'partner_weizhi_shuangbi'`（张辽+徐晃）

**影响**：同一组搭档羁绊使用不同ID，UI层查询时可能查不到。

### R2-C006: 阵营标识不一致 — 'qun' vs 'neutral' — P0（R1遗留）

**源码验证**：
- `hero-config.ts` → 群雄武将 `faction: 'qun'`（L357, L369）
- `faction-bond-config.ts` → `FactionId = 'wei' | 'shu' | 'wu' | 'neutral'`（L57）
- `faction-bond-config.ts` → `HERO_FACTION_MAP` 中群雄武将映射到 `'neutral'`（L511-518）

**影响**：如果使用 `hero-config.ts` 的 `faction` 值（'qun'）查询 `faction-bond-config.ts` 的羁绊配置，会匹配失败（因为配置使用 'neutral'）。

### R2-C007: 搭档羁绊效果值不一致 — P0（R1遗留）

**源码验证**（以桃园结义为例）：
- `bond-config.ts` → `effects: [{ stat: 'attack', value: 0.15 }]`（仅攻击+15%）
- `faction-bond-config.ts` → `effect: { attackBonus: 0.10, defenseBonus: 0.10, hpBonus: 0.10, critBonus: 0.10, strategyBonus: 0.10 }`（全属性+10%）

**影响**：两套配置计算出的羁绊加成完全不同，使用不同系统得到不同结果。

### R2-C008: BondEffect 接口不兼容 — P1

**源码验证**：
- `bond-config.ts` → `BondEffect { stat: string, value: number }`（单属性效果数组）
- `faction-bond-config.ts` → `BondEffect { attackBonus, defenseBonus, hpBonus, critBonus, strategyBonus }`（全属性效果对象）

**影响**：同名 `BondEffect` 但结构完全不同，TypeScript 命名空间冲突。

### R2-C009: 6名新增武将碎片获取路径断裂 — P0（R1遗留）

**源码验证**：
- `hero-config.ts` → 定义了 lushu/huanggai/ganning/xuhuang/zhangliao/weiyan 6名RARE武将
- `star-up-config.ts` → `STAGE_FRAGMENT_DROPS` 仅14个原始武将，**无新增武将**
- `star-up-config.ts` → `SHOP_FRAGMENT_EXCHANGE` 仅14个原始武将，**无新增武将**

**影响**：这6名武将的碎片只能通过重复招募获得（RARE品质概率低），升星路径几乎不可能完成。

### R2-C010: GENERAL_DEF_MAP vs HERO_FACTION_MAP 覆盖范围差异 — P1

**源码验证**：
- `hero-config.ts` `GENERAL_DEF_MAP` 包含所有20+武将
- `faction-bond-config.ts` `HERO_FACTION_MAP` 需要确认是否包含所有20+武将

**影响**：如果 `HERO_FACTION_MAP` 遗漏了某些武将，羁绊计算中这些武将的阵营会被识别为 undefined。

---

## 四、事件发射器异常处理

### R2-C011: BondSystem.emit 无 try-catch 保护 — P1

**位置**：`BondSystem.ts:316-341`

**源码验证**：
```typescript
this.deps.eventBus.emit<BondDeactivatedPayload>('bond:deactivated', { ... });
this.deps.eventBus.emit<BondActivatedPayload>('bond:activated', { ... });
this.deps.eventBus.emit<BondLevelUpPayload>('bond:levelUp', { ... });
```

**问题**：如果 `eventBus.emit` 抛出异常（如监听器回调崩溃），整个羁绊评估流程会中断。后续的羁绊激活/失效事件不会被发射。

**影响**：羁绊事件监听器异常会导致羁绊系统部分失效。

### R2-C012: HeroDispatchSystem.getState() 浅拷贝风险 — P0（R1遗留）

**位置**：`HeroDispatchSystem.ts:98-103`

**源码验证**：
```typescript
getState(): Record<string, unknown> {
    return {
        buildingDispatch: { ...this.buildingDispatch },
        heroDispatch: { ...this.heroDispatch },
    };
}
```

**问题**：第一层展开是浅拷贝，`DispatchRecord` 对象是引用类型。外部修改 `getState().buildingDispatch["castle"].bonusPercent = 999` 会影响内部状态。

---

## 五、Part C 统计

| 类别 | 数量 |
|------|------|
| FIX-003 覆盖验证通过 | 8/10 |
| FIX-003 遗漏（P0） | 2 |
| 新发现（P0） | 2 |
| 新发现（P1） | 5 |
| R1遗留未修复 | 7 |

---

*Part C 审查完成。*
