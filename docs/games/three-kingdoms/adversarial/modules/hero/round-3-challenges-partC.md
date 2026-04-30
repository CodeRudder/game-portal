# Hero 挑战清单 Round 3 — Part C（辅助系统验证）

> Challenger: TreeChallenger v1.2 | Time: 2026-05-02
> 审查对象: FIX-202 cloneGeneral/deserializeHeroState 穿透验证 + 序列化/事件/配置交叉验证

## 一、FIX-202 穿透验证（序列化路径）

### cloneGeneral null guard — ✅ 完整穿透

| 调用路径 | 位置 | null guard 状态 |
|----------|------|----------------|
| `cloneGeneral(null)` 直接调用 | HeroSerializer.ts:34 | ✅ `if (!g) return null as unknown as GeneralData` |
| `cloneState` → `cloneGeneral` | HeroSerializer.ts:44 | ✅ 间接防护（遍历 Object.entries，值不会为 null） |
| `deserializeHeroState` → `cloneGeneral` | HeroSerializer.ts:91 | ✅ `if (g) generals[id] = cloneGeneral(g)` |
| `HeroSystem.addGeneral` → `cloneGeneral` | HeroSystem.ts:128 | ✅ g 是新创建的对象，不会为 null |
| `HeroSystem.getGeneral` → `cloneGeneral` | HeroSystem.ts:142 | ✅ 有 `if (!g)` 检查 |
| `HeroSystem.removeGeneral` → `cloneGeneral` | HeroSystem.ts:135 | ✅ 有 `if (!general)` 检查 |
| `HeroSystem.getGeneralsSortedByPower` → `cloneGeneral` | HeroSystem.ts:448 | ✅ Object.values 不会产生 null |
| `HeroSystem.setLevelAndExp` → `cloneGeneral` | HeroSystem.ts:382 | ✅ 有 `if (!general)` 检查 |
| `HeroSystem.updateSkillLevel` → `cloneGeneral` | HeroSystem.ts:397 | ✅ 有 `if (!general)` 检查 |
| `HeroSystem.addExp` → `cloneGeneral` | HeroSystem.ts:427 | ✅ 有 `if (!general)` 检查 |

**结论**：cloneGeneral 的 null guard **完整穿透**所有调用路径。

### deserializeHeroState null skip — ✅ 完整穿透

| 检查点 | 位置 | 状态 |
|--------|------|---------|
| 顶层 null/undefined 防护 | HeroSerializer.ts:79 | ✅ `if (!data \|\| !data.state)` return createEmptyState() |
| 武将数据 null skip | HeroSerializer.ts:91 | ✅ `if (g) generals[id] = cloneGeneral(g)` |
| 版本不匹配处理 | HeroSerializer.ts:83 | ⚠️ 仅警告，无迁移逻辑（见 R3-C001） |
| fragments 数据恢复 | HeroSerializer.ts:94 | ✅ `{ ...data.state.fragments }` 浅拷贝 |

**结论**：deserializeHeroState 的 null skip **完整穿透**。

---

## 二、序列化版本迁移

### R3-C001: 版本不匹配时无迁移逻辑 — P1（R2 遗留）

**位置**：所有子系统的 deserialize 方法

**模式**：
```typescript
if (data.version !== SAVE_VERSION) {
  gameLog.warn(`版本不匹配 (期望 ${SAVE_VERSION}，实际 ${data.version})`);
}
// 继续正常反序列化...
```

**R2 标记**：R2-C003（P1），但 R2 未修复。

**R3 补充分析**：当前所有子系统的 `SAVE_VERSION` 都是 1。如果未来版本增加了必填字段，旧存档中缺少这些字段会导致 `undefined`，可能引发运行时崩溃。

**严重程度**：P1（当前版本为1，暂无实际影响，但架构债务）

### R3-C002: BondSystem.emit 无 try-catch 保护 — P1（R2 遗留）

**位置**：`BondSystem.ts:316-341`

**R2 标记**：R2-C011（P1），但 R2 未修复。

**源码**：
```typescript
this.deps.eventBus.emit<BondDeactivatedPayload>('bond:deactivated', { ... });
this.deps.eventBus.emit<BondActivatedPayload>('bond:activated', { ... });
this.deps.eventBus.emit<BondLevelUpPayload>('bond:levelUp', { ... });
```

**影响**：如果监听器回调崩溃，羁绊评估流程中断。

---

## 三、配置交叉验证（v1.2 进化规则）

### R3-C003: 配置冲突仍未修复 — P0（R1/R2/R3 三轮遗留）

| # | 冲突类型 | 位置 | R1标记 | R2标记 | R3验证 |
|---|---------|------|--------|--------|--------|
| 1 | 搭档羁绊ID不一致 | bond-config.ts:342 vs faction-bond-config.ts:443 | ✅ | R2-C005 | ❌ 未修复 |
| 2 | 阵营标识 'qun' vs 'neutral' | hero-config.ts:357/369 vs faction-bond-config.ts:57 | ✅ | R2-C006 | ❌ 未修复 |
| 3 | 搭档羁绊效果值不一致 | bond-config.ts vs faction-bond-config.ts | ✅ | R2-C007 | ❌ 未修复 |
| 4 | BondEffect 接口不兼容 | bond-config.ts vs faction-bond-config.ts | ✅ | R2-C008 | ❌ 未修复 |
| 5 | 6名新增武将碎片获取断裂 | star-up-config.ts | ✅ | R2-C009 | ❌ 未修复 |

**R3 源码验证**：

1. **阵营标识**：
   - `hero-config.ts:357` → `faction: 'qun'`（吕布）
   - `hero-config.ts:369` → `faction: 'qun'`（貂蝉）
   - `faction-bond-config.ts:57` → `FactionId = 'wei' | 'shu' | 'wu' | 'neutral'`
   - `faction-bond-config.ts:511-518` → `lvbu: 'neutral', diaochan: 'neutral'`
   - **冲突仍然存在**：hero-config 使用 'qun'，faction-bond-config 使用 'neutral'

2. **搭档羁绊ID**：
   - `bond-config.ts:342` → `id: 'partner_wei_shuangbi'`
   - `faction-bond-config.ts:443` → `id: 'partner_weizhi_shuangbi'`
   - **冲突仍然存在**

3. **碎片获取路径**：
   - `STAGE_FRAGMENT_DROPS`：13个关卡，仅14个原始武将
   - `SHOP_FRAGMENT_EXCHANGE`：14个配置，仅14个原始武将
   - 新增武将 lushu/huanggai/ganning/xuhuang/zhangliao/weiyan **仍然不在任何碎片获取配置中**
   - **断裂仍然存在**

### R3-C004: hero-config.ts 新增武将的 faction 值与 HERO_FACTION_MAP 不一致 — P0（新发现角度）

**源码交叉验证**：

```typescript
// hero-config.ts — 武将定义中的 faction
{ id: 'lvbu', faction: 'qun', ... }
{ id: 'diaochan', faction: 'qun', ... }

// faction-bond-config.ts — HERO_FACTION_MAP 中的映射
lvbu: 'neutral',
diaochan: 'neutral',
```

**新角度**：如果 UI 层使用 `hero-config.ts` 的 `faction` 值（'qun'）来筛选"群雄"阵营武将，而羁绊系统使用 `HERO_FACTION_MAP` 的 'neutral' 来计算羁绊，两者结果不同。

**具体影响**：
- UI 筛选 "群雄" 武将 → 使用 `faction === 'qun'` → 找到吕布、貂蝉等
- 羁绊计算 → 使用 `HERO_FACTION_MAP[lvbu] = 'neutral'` → 查找 'neutral' 阵营羁绊
- 如果 'qun' 和 'neutral' 分别对应不同的羁绊配置，计算结果不一致

---

## 四、事件发射器异常处理

### R3-C005: BondSystem.evaluateBonds 中 emit 调用无异常保护 — P1（R2 遗留）

**R2 标记**：R2-C011（P1），但 R2 未修复。

**R3 补充分析**：检查了 `evaluateBonds` 方法的完整流程：

```typescript
// BondSystem.ts:313-346
evaluateBonds(generalIds: string[]): void {
  const currentMap = this.calculateBonds(generalIds);
  // 检测失效羁绊
  for (const [bondId, prevBond] of this.previousBonds) {
    if (!currentMap.has(bondId)) {
      this.deps.eventBus.emit('bond:deactivated', { ... }); // ❌ 无 try-catch
    }
  }
  // 检测新激活/升级
  for (const [bondId, currBond] of currentMap) {
    const prevBond = this.previousBonds.get(bondId);
    if (!prevBond) {
      this.deps.eventBus.emit('bond:activated', { ... }); // ❌ 无 try-catch
    } else if (currBond.level > prevBond.level) {
      this.deps.eventBus.emit('bond:levelUp', { ... }); // ❌ 无 try-catch
    }
  }
  this.previousBonds = currentMap;
}
```

**风险场景**：
1. 第一个 `emit('bond:deactivated')` 抛出异常
2. 后续的 `bond:activated` 和 `bond:levelUp` 事件不会被发射
3. `this.previousBonds = currentMap` 不会执行
4. 下次 evaluateBonds 会重新检测所有变化，可能导致重复事件

**严重程度**：P1（事件监听器异常不应中断羁绊评估流程）

---

## 五、Part C 统计

| 类别 | 数量 |
|------|------|
| FIX-202 穿透验证 | 2/2 全部通过 |
| 新发现（P0） | 0 |
| R2 遗留未修复（P0） | 5（配置冲突） |
| 新发现（P1） | 0 |
| R2 遗留未修复（P1） | 2 |

### 与 R2 对比

| 指标 | R2 Part C | R3 Part C | 变化 |
|------|-----------|-----------|------|
| 新 P0 | 2(+5配置) | 0 | ↓2（null guard 已修复） |
| 配置冲突遗留 | 5 | 5 | 不变（三轮未修复） |
| 修复穿透验证 | 8/10 | 2/2 | 全部穿透 |

---

*Part C 审查完成。FIX-202 的序列化修复穿透验证全部通过。配置冲突问题已连续三轮被标记但仍未修复。*
