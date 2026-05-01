# Bond R1 — Challenger 审查报告

> Challenger Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts + engine/hero/BondSystem.ts)

## 审查范围

源文件：
- `src/games/three-kingdoms/engine/bond/BondSystem.ts` (267行)
- `src/games/three-kingdoms/engine/bond/bond-config.ts` (94行)
- `src/games/three-kingdoms/core/bond/bond.types.ts` (154行)

交叉验证：
- `src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts` (buildSaveCtx, finalizeLoad, reset)
- `src/games/three-kingdoms/engine/engine-save.ts` (SaveContext, buildSaveData, applySaveData, toIGameState, fromIGameState)
- `src/games/three-kingdoms/shared/types.ts` (GameSaveData)
- `src/games/three-kingdoms/engine/hero/BondSystem.ts` (同名系统冲突)

## P0 缺陷（必须修复）

### P0-001: addFavorability 无NaN/Infinity/负数防护
- **位置**: BondSystem.ts L159-162 `addFavorability(heroId, amount)`
- **代码**: `fav.value += amount;`
- **攻击向量**: `addFavorability('liubei', NaN)` -> `fav.value = 0 + NaN = NaN`
- **爆炸半径**:
  - `getFavorability()` 返回 `value: NaN`
  - `getAvailableStoryEvents()` 中 `fav.value < condition.minFavorability` -> `NaN < 50` = false -> **绕过好感度检查，提前触发故事事件**
  - `serialize()` -> `JSON.stringify({value: NaN})` = `{"value":null}` -> **数据永久损坏**
- **规则**: BR-001(数值NaN检查), BR-017(战斗数值安全), BR-019(Infinity序列化)
- **严重性**: Critical — NaN注入可绕过游戏逻辑+破坏存档

### P0-002: addFavorability 无上限保护
- **位置**: BondSystem.ts L159-162
- **代码**: `fav.value += amount;` 无上限检查
- **攻击向量**: 循环调用 `addFavorability('liubei', 1e15)` -> `fav.value = Infinity`
- **爆炸半径**: `serialize()` -> `JSON.stringify({value: Infinity})` = `{"value":null}` -> **数据丢失**
- **规则**: BR-022(资源上限验证)
- **严重性**: Critical — Infinity序列化为null

### P0-003: loadSaveData 无null/undefined输入防护
- **位置**: BondSystem.ts L237-243 `loadSaveData(data: BondSaveData)`
- **代码**: `for (const [key, value] of Object.entries(data.favorabilities ?? {}))`
- **攻击向量1**: `loadSaveData(null as any)` -> `data.favorabilities` -> TypeError: Cannot read properties of null
- **攻击向量2**: `loadSaveData({version:1} as any)` -> `data.completedStoryEvents` = undefined -> `[...undefined]` -> **TypeError: undefined is not iterable**
- **规则**: BR-010(deserialize覆盖验证)
- **严重性**: Critical — 加载崩溃导致存档不可用

### P0-004: BondSystem未接入引擎存档系统（六处遗漏）
- **位置**: 六处缺失
  1. `SaveContext` 接口无 `bond` 字段 (engine-save.ts L55)
  2. `GameSaveData` 接口无 `bond` 字段 (types.ts L216)
  3. `buildSaveCtx()` 不含 `this.bondSystem` (ThreeKingdomsEngine.ts L842)
  4. `buildSaveData()` 不调用 `bondSystem.serialize()` (engine-save.ts L172)
  5. `applySaveData()` 不调用 `bondSystem.loadSaveData()` (engine-save.ts L525)
  6. `toIGameState()` / `fromIGameState()` 不含 bond (engine-save.ts L268/L340)
- **攻击向量**: 用户完成故事事件、积累好感度后保存 -> 加载后好感度归零、故事事件重置
- **规则**: BR-014(保存/加载覆盖扫描), BR-015(deserialize覆盖验证六处)
- **验证**: `grep "bond" engine-save.ts` = 0 results; `grep "bondSystem" buildSaveCtx` = not found
- **严重性**: Critical — 所有好感度和故事事件进度在保存/加载后丢失

### P0-005: triggerStoryEvent 未校验前置条件
- **位置**: BondSystem.ts L199-218 `triggerStoryEvent(eventId)`
- **代码**: 仅检查事件是否存在、是否已完成，**不检查武将是否存在/好感度/等级/前置事件**
- **攻击向量**: 直接调用 `triggerStoryEvent('story_001')` 即可获得奖励，无需满足任何条件
- **爆炸半径**:
  - 绕过好感度要求直接获得碎片和声望
  - 绕过等级要求
  - 绕过前置事件要求
- **规则**: BR-020(关卡系统状态锁验证)
- **严重性**: Critical — 可直接调用触发任意事件获取奖励

### P0-006: triggerStoryEvent deps未初始化时崩溃
- **位置**: BondSystem.ts L213 `this.deps.eventBus.emit(...)`
- **代码**: `this.deps` 用 `!` 断言，未检查是否已init
- **攻击向量**: `new BondSystem().triggerStoryEvent('story_001')` -> `this.deps` is undefined -> TypeError
- **规则**: BR-006(注入点验证)
- **严重性**: Critical — 运行时崩溃

### P0-007: getAvailableStoryEvents heroes参数无null防护
- **位置**: BondSystem.ts L171 `for (const heroId of condition.heroIds) { if (!heroes.has(heroId))`
- **代码**: 直接调用 `heroes.has()`，未检查 heroes 是否为 null/undefined
- **攻击向量**: `getAvailableStoryEvents(null as any)` -> TypeError: Cannot read properties of null
- **严重性**: Critical — 运行时崩溃

### P0-008: getFactionDistribution hero.faction可能为undefined
- **位置**: BondSystem.ts L80 `dist[hero.faction]++`
- **代码**: 未验证 hero.faction 是否为有效 Faction 值
- **攻击向量**: `getFactionDistribution([{faction: undefined as any}])` -> `dist[undefined]++` -> 返回的对象含undefined key
- **严重性**: High — 静默数据损坏

## P1 缺陷（建议修复）

### P1-001: getBondEffect 无效BondType无防护
- **位置**: BondSystem.ts L112 `return { ...BOND_EFFECTS[type] }`
- **代码**: 如果 type 不在 BOND_EFFECTS 中，返回 `{ ...undefined }` = `{}`
- **建议**: 返回空对象或抛出错误

### P1-002: heroId空字符串未校验
- **位置**: BondSystem.ts L155 `addFavorability(heroId, amount)`
- **代码**: `heroId=""` 会创建 Map 中的空字符串键
- **建议**: 校验 heroId 非空

### P1-003: 双BondSystem name冲突
- **位置**:
  - `engine/bond/BondSystem.ts` -> `name = 'bond'`
  - `engine/hero/BondSystem.ts` -> `name = 'bond' as const`
- **代码**: 两个系统都用 `name = 'bond'`，但引擎只注册了 `engine/bond/BondSystem`
- **验证**: `ThreeKingdomsEngine.ts:234` -> `r.register('bond', this.bondSystem)` — 注册的是 bond/ 版本
- **风险**: hero/ 版本的 BondSystem 永远不被注册，但 engine-getters 的 `getBondSystem()` 返回的是 bond/ 版本，而 HeroSystem 依赖的 `getBondMultiplier` 方法只在 hero/ 版本存在
- **严重性**: High — API不匹配，getBondMultiplier不存在于bond/BondSystem

### P1-004: STORY_EVENTS无前置事件链
- **位置**: bond-config.ts
- **代码**: 5个故事事件的 condition.prerequisiteEventId 全部为 undefined
- **风险**: 前置事件检查代码存在但配置为空

### P1-005: loadSaveData无版本兼容处理
- **位置**: BondSystem.ts L237-243
- **代码**: 读取 `data.version` 但不校验，直接加载
- **风险**: 未来版本升级时无法做数据迁移

## Builder覆盖评估

| Builder节点 | Challenger验证 | 评级 |
|-------------|---------------|------|
| T4-N03 (addFavorability NaN) | confirmed P0-001 | covered |
| T4-N05 (addFavorability Infinity) | confirmed P0-002 | covered |
| T4-N07 (无上限保护) | confirmed P0-002 | covered |
| T7-N03 (serialize Infinity) | confirmed P0-002 side-effect | covered |
| T7-N04 (loadSaveData null) | confirmed P0-003 | covered |
| T7-N05 (loadSaveData undefined) | confirmed P0-003 | covered |
| T9-N01~N06 (save coverage) | confirmed P0-004 | covered |
| T5-N05 (前置条件绕过) | confirmed P0-005 | covered |
| T5-N06 (deps not init) | confirmed P0-006 | covered |
| T5-N07 (rewards NaN) | confirmed P0-001 side-effect | covered |
| T6-N07 (heroes null) | confirmed P0-007 | covered |
| T1-N04 (faction undefined) | confirmed P0-008 | covered |

**Builder遗漏发现**: 无 — Builder R1 tree v2 已完整覆盖所有P0

## 优先修复建议

| Priority | FIX ID | Description | Affected API |
|----------|--------|-------------|--------------|
| P0 | FIX-B01 | addFavorability NaN/Infinity/negative guard + upper bound | addFavorability |
| P0 | FIX-B02 | loadSaveData null/undefined guard | loadSaveData |
| P0 | FIX-B03 | BondSystem save/load integration (六处) | SaveContext, GameSaveData, buildSaveCtx, buildSaveData, applySaveData, toIGameState, fromIGameState |
| P0 | FIX-B04 | triggerStoryEvent precondition validation | triggerStoryEvent |
| P0 | FIX-B05 | triggerStoryEvent deps init check | triggerStoryEvent |
| P0 | FIX-B06 | getAvailableStoryEvents null guard | getAvailableStoryEvents |
| P0 | FIX-B07 | getFactionDistribution faction validity check | getFactionDistribution |
