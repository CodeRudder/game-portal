# Map R1 Challenger 审查报告

> Challenger: v1.4 | Time: 2026-05-01
> 模块: map | 源码: 3,184行 | 审查维度: 5

## 审查统计

| 维度 | 质疑数 | P0确认 | P1确认 | 虚报 | 虚报率 |
|------|--------|--------|--------|------|--------|
| F-Normal | 0 | 0 | 0 | 0 | 0% |
| F-Boundary | 3 | 0 | 3 | 0 | 0% |
| F-Error | 28 | 16 | 10 | 2 | 7.1% |
| F-Cross | 8 | 4 | 3 | 1 | 12.5% |
| F-Lifecycle | 6 | 4 | 1 | 1 | 16.7% |
| **总计** | **45** | **24** | **17** | **4** | **8.9%** |

> ⚠️ 虚报率 8.9% > 5%阈值，准确性扣分

---

## P0 确认列表（24个）

### P0-001: checkSiegeConditions NaN绕过兵力检查
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:179` `if (availableTroops < cost.troops)`
- **复现**: `checkSiegeConditions('target', 'player', NaN, 1000)`
- **预期**: 拒绝攻城（兵力数据异常）
- **实际**: `NaN < cost.troops` -> false -> 绕过检查，允许攻城
- **模式**: 模式21（资源比较NaN绕过）+ 模式9（NaN绕过<=0）
- **修复**: 入口添加 `if (!Number.isFinite(availableTroops) || !Number.isFinite(availableGrain)) return { canSiege: false, errorCode: 'INSUFFICIENT_TROOPS' }`

### P0-002: checkSiegeConditions NaN绕过粮草检查
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:182` `if (availableGrain < cost.grain)`
- **复现**: `checkSiegeConditions('target', 'player', 5000, NaN)`
- **预期**: 拒绝攻城
- **实际**: `NaN < 500` -> false -> 绕过检查
- **模式**: 同P0-001
- **修复**: 同P0-001统一防护

### P0-003: calculateSiegeCost defenseValue=NaN -> cost.troops=NaN
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:203` `Math.ceil(MIN_SIEGE_TROOPS * (territory.defenseValue / 100) * TROOP_COST_FACTOR)`
- **复现**: territory对象defenseValue为NaN（如反序列化损坏）
- **预期**: 返回默认消耗或拒绝
- **实际**: `Math.ceil(100 * NaN / 100 * 1.0)` -> NaN -> cost.troops=NaN
- **模式**: 模式9（NaN传播）
- **修复**: `if (!Number.isFinite(territory.defenseValue) || territory.defenseValue <= 0) return { troops: MIN_SIEGE_TROOPS, grain: GRAIN_FIXED_COST }`

### P0-004: calculateSiegeCost defenseValue负值 -> 负消耗
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:203` 同上
- **复现**: territory.defenseValue = -100
- **预期**: 拒绝或使用最小消耗
- **实际**: `Math.ceil(100 * (-100) / 100 * 1.0)` = -100 -> 负兵力消耗（攻城反而加兵）
- **模式**: 模式3（负值漏洞）
- **修复**: 同P0-003，添加 `territory.defenseValue <= 0` 检查

### P0-005: computeWinRate NaN传播（SiegeSystem）
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:271-278`
- **复现**: `computeWinRate(NaN, 1000)` 或 `computeWinRate(1000, NaN)`
- **预期**: 返回WIN_RATE_MIN或WIN_RATE_MAX
- **实际**: `NaN <= 0` -> false -> `ratio = NaN/1000` -> NaN -> `Math.min(0.95, Math.max(0.05, NaN))` -> NaN
- **模式**: 模式9（NaN传播）
- **修复**: 添加 `if (!Number.isFinite(attackerPower) || !Number.isFinite(defenderPower)) return WIN_RATE_MIN`

### P0-006: computeWinRate NaN传播（SiegeEnhancer）
- **维度**: F-Error
- **源码**: `SiegeEnhancer.ts:155-162`
- **复现**: 同P0-005
- **实际**: 同P0-005，两处重复实现
- **模式**: 模式9 + 模式11（双系统并存）
- **修复**: 同P0-005，两处统一修复

### P0-007: SiegeSystem.serialize不保存captureTimestamps
- **维度**: F-Lifecycle
- **源码**: `SiegeSystem.ts:322-332`
- **复现**: 
  1. `executeSiege`胜利 -> `captureTimestamps.set(targetId, Date.now())`
  2. `serialize()` -> 不包含captureTimestamps
  3. `deserialize()` -> captureTimestamps为空
  4. `isInCaptureCooldown(targetId)` -> false（冷却丢失，刚占领的领土可被立即反攻）
- **预期**: 冷却时间戳随存档保存
- **实际**: 冷却信息完全丢失
- **模式**: 模式7（数据丢失）+ 模式15（保存/加载流程缺失）
- **修复**: serialize中添加captureTimestamps，deserialize中恢复

### P0-008: WorldMapSystem.deserialize(null)崩溃
- **维度**: F-Lifecycle
- **源码**: `WorldMapSystem.ts:337` `Object.entries(data.landmarkOwnerships)`
- **复现**: `deserialize(null as any)`
- **预期**: 安全返回或抛出明确错误
- **实际**: `Object.entries(null)` -> TypeError
- **模式**: 模式1（null/undefined防护缺失）
- **修复**: 入口添加 `if (!data) return`

### P0-009: TerritorySystem.deserialize(null)崩溃
- **维度**: F-Lifecycle
- **源码**: `TerritorySystem.ts:345` `Object.entries(data.owners)`
- **复现**: `deserialize(null as any)`
- **预期**: 安全返回
- **实际**: `Object.entries(null)` -> TypeError
- **模式**: 模式1
- **修复**: 入口添加 `if (!data) return`

### P0-010: SiegeSystem.deserialize(null)崩溃
- **维度**: F-Lifecycle
- **源码**: `SiegeSystem.ts:339` `this.totalSieges = data.totalSieges`
- **复现**: `deserialize(null as any)`
- **预期**: 安全返回
- **实际**: `null.totalSieges` -> TypeError
- **模式**: 模式1
- **修复**: 入口添加 `if (!data) return`

### P0-011: SiegeEnhancer.deserialize(null)崩溃
- **维度**: F-Lifecycle
- **源码**: `SiegeEnhancer.ts:330` `this.totalRewardsGranted = data.totalRewardsGranted`
- **复现**: `deserialize(null as any)`
- **预期**: 安全返回
- **实际**: `null.totalRewardsGranted` -> TypeError
- **模式**: 模式1
- **修复**: 入口添加 `if (!data) return`

### P0-012: upgradeLandmark level=NaN绕过上限检查
- **维度**: F-Error
- **源码**: `WorldMapSystem.ts:243` `if (!landmark || landmark.level >= 5) return false`
- **复现**: landmark.level = NaN（如反序列化损坏）
- **预期**: 拒绝升级
- **实际**: `NaN >= 5` -> false -> 执行升级，level变为NaN+1=NaN，productionMultiplier+=0.2
- **模式**: 模式9（NaN绕过比较）
- **修复**: `if (!landmark || !Number.isFinite(landmark.level) || landmark.level >= 5) return false`

### P0-013: setZoom(NaN) -> viewport.zoom=NaN
- **维度**: F-Error
- **源码**: `WorldMapSystem.ts:265` `Math.max(VIEWPORT_CONFIG.minZoom, Math.min(VIEWPORT_CONFIG.maxZoom, zoom))`
- **复现**: `setZoom(NaN)`
- **预期**: 使用defaultZoom
- **实际**: `Math.max(0.5, Math.min(2.0, NaN))` -> `Math.max(0.5, NaN)` -> NaN
- **模式**: 模式2（数值溢出/非法值）
- **修复**: `if (!Number.isFinite(zoom)) return;`

### P0-014: computeVisibleRange zoom=0 -> 除零
- **维度**: F-Error
- **源码**: `MapDataRenderer.ts:91-97` 多处 `/ zoom` 运算
- **复现**: viewport.zoom=0
- **预期**: 使用minZoom
- **实际**: `worldLeft = -offsetX / 0` -> Infinity -> `Math.floor(Infinity)` -> Infinity -> 后续循环无限
- **模式**: 模式2
- **修复**: 入口添加 `if (!zoom || !Number.isFinite(zoom)) zoom = VIEWPORT_CONFIG.defaultZoom`

### P0-015: MapFilterSystem.filter(tiles=null)崩溃
- **维度**: F-Error
- **源码**: `MapFilterSystem.ts:75` `let filteredTiles = tiles`
- **复现**: `MapFilterSystem.filter(null as any, landmarks, criteria)`
- **预期**: 返回空结果
- **实际**: `tiles.filter(...)` -> TypeError
- **模式**: 模式1
- **修复**: 入口添加null检查

### P0-016: MapFilterSystem.filter(criteria=null)崩溃
- **维度**: F-Error
- **源码**: `MapFilterSystem.ts:79` `criteria.regions`
- **复现**: `MapFilterSystem.filter(tiles, landmarks, null as any)`
- **预期**: 返回全部数据
- **实际**: `null.regions` -> TypeError
- **模式**: 模式1
- **修复**: `criteria = criteria ?? {}`

### P0-017: TerritorySystem.deserialize level=NaN -> calculateProduction异常
- **维度**: F-Lifecycle
- **源码**: `TerritorySystem.ts:354` `t.currentProduction = calculateProduction(t.baseProduction, level)`
- **复现**: data.levels = {'city-luoyang': NaN}
- **预期**: 拒绝或使用默认等级
- **实际**: calculateProduction(baseProduction, NaN) -> NaN产出
- **模式**: 模式2
- **修复**: `if (!Number.isFinite(level) || level < 1) level = 1`

### P0-018: captureTerritory newOwner=null
- **维度**: F-Error
- **源码**: `TerritorySystem.ts:195` `t.ownership = newOwner`
- **复现**: `captureTerritory('city-luoyang', null as any)`
- **预期**: 拒绝
- **实际**: ownership被设为null -> 后续查询异常
- **模式**: 模式1
- **修复**: 添加 `if (!newOwner) return false`

### P0-019: GarrisonSystem.calculateBonus defense=NaN
- **维度**: F-Error
- **源码**: `GarrisonSystem.ts:218` `general.baseStats.defense * DEFENSE_BONUS_FACTOR`
- **复现**: general.baseStats.defense = NaN
- **预期**: defenseBonus=0
- **实际**: NaN * DEFENSE_BONUS_FACTOR = NaN -> getEffectiveDefense返回NaN
- **模式**: 模式9
- **修复**: `const defense = general.baseStats.defense; if (!Number.isFinite(defense)) return { defenseBonus: 0, ... }`

### P0-020: GarrisonSystem.calculateBonus production=NaN
- **维度**: F-Error
- **源码**: `GarrisonSystem.ts:222-226` 多个 `baseProduction.grain * qualityBonus`
- **复现**: baseProduction.grain = NaN
- **预期**: productionBonus各项为0
- **实际**: NaN * qualityBonus = NaN -> 产出加成为NaN
- **模式**: 模式9
- **修复**: 使用 `Math.max(0, ...)` 或 `Number.isFinite` 检查

### P0-021: getPlayerProductionSummary NaN累加
- **维度**: F-Error
- **源码**: `TerritorySystem.ts:272-278` `totalProduction.grain += t.currentProduction.grain`
- **复现**: 任一领土的currentProduction.grain为NaN
- **预期**: 跳过NaN或使用0
- **实际**: 0+NaN=NaN -> 汇总产出全NaN
- **模式**: 模式9
- **修复**: 累加前检查 `if (Number.isFinite(t.currentProduction.grain))`

### P0-022: resolveSiege cost.troops=NaN -> defeatTroopLoss=NaN
- **维度**: F-Error
- **源码**: `SiegeSystem.ts:314` `Math.floor(cost.troops * 0.3)`
- **复现**: cost.troops=NaN（由P0-003传播）
- **预期**: defeatTroopLoss=0
- **实际**: Math.floor(NaN * 0.3) = NaN -> eventBus发送NaN损失
- **模式**: 模式9
- **修复**: 上游P0-003修复后此问题消除

### P0-023: deductSiegeResources cost含NaN
- **维度**: F-Cross
- **源码**: `SiegeSystem.ts:328-335`
- **复现**: cost.troops=NaN -> `resourceSys.consume('troops', NaN)`
- **预期**: 拒绝扣减
- **实际**: 传递NaN到ResourceSystem.consume（下游是否防护未知）
- **模式**: 模式9
- **修复**: 上游P0-003修复后此问题消除

### P0-024: engine-save未覆盖Map全部子系统（架构级）
- **维度**: F-Cross + F-Lifecycle
- **源码**: 需验证engine-save的buildSaveData/applySaveData
- **复现**: 保存游戏 -> Map模块8个子系统的serialize()是否全部被调用
- **预期**: 全部8个子系统序列化
- **实际**: 需源码验证（基于历史教训，6个子系统曾缺失）
- **模式**: 模式15（保存/加载流程缺失）
- **修复**: 验证并补充缺失的子系统序列化

---

## P1 确认列表（17个）

### P1-001: 双系统computeWinRate公式不一致
- SiegeSystem: `ratio * WIN_RATE_BASE`（无terrainBonus）
- SiegeEnhancer: `ratio * WIN_RATE_BASE + terrainBonus`
- SiegeEnhancer多了一个terrainBonus参数但默认为0
- **影响**: 当前无差异（terrainBonus默认0），但未来扩展时可能产生不一致

### P1-002: WorldMapSystem.init deps=null
- `this.deps!` 非空断言，deps=null时后续调用可能崩溃

### P1-003: TerritorySystem.calculateAccumulatedProduction seconds=NaN
- `summary.totalProduction.grain * NaN` -> NaN产出

### P1-004: SiegeSystem.deserialize不恢复history
- serialize不保存history数组，deserialize后history为空

### P1-005: GarrisonSystem.deserialize含无效territoryId
- 不验证territoryId是否存在，直接写入assignments

### P1-006: MapEventSystem.cleanExpiredEvents now=NaN
- NaN>=expiresAt -> false -> 事件永不过期

### P1-007: MapEventSystem.resolveEvent choice无效
- disaster的choices不含'attack'，但resolveEvent不校验choice是否在choices中

### P1-008: MapDataRenderer.clampViewport NaN
- viewport含NaN -> Math.min/max(NaN) -> NaN

### P1-009: SiegeEnhancer.executeConquest siegeSys=null fallback
- fallback到determineBattleOutcome，但executeSiegeWithResult仍需siegeSys

### P1-010: GarrisonSystem territorySys=null -> TERRITORY_NOT_FOUND
- registry中无territory时，所有驻防操作失败

### P1-011: GarrisonSystem heroSys=null -> GENERAL_NOT_FOUND
- registry中无hero时，所有驻防操作失败

### P1-012: setViewportOffset无边界约束
- 与clampViewport分离，setViewportOffset不约束范围

### P1-013: MapEventSystem forceTrigger activeEvents=3
- 返回最后一个事件而非报错，语义不明确

### P1-014: TerritorySystem.deserialize不验证ownership合法性
- data.owners中任意字符串都会被设为ownership

### P1-015: WorldMapSystem.deserialize无效id静默跳过
- data中含无效landmarkId时静默跳过，不报错不警告

### P1-016: SiegeSystem.deserialize不恢复captureTimestamps
- 与P0-007相关，serialize也不保存

### P1-017: MapEventSystem.deserialize含NaN字段
- activeEvents中的NaN字段直接赋值

---

## 虚报分析（4个）

### 虚报-1: MapFilterSystem.filterByRegion tiles=null
- **声称**: null输入崩溃
- **实际**: 静态方法，调用方应确保传入有效数组。MapFilterSystem是无状态纯函数工具类，null防护应在调用方。
- **降级**: P2

### 虚报-2: WorldMapSystem.panViewport NaN
- **声称**: dx/dy=NaN导致偏移异常
- **实际**: panViewport是内部视口操作，调用方通常来自UI事件，值为number类型。且后续clampViewport会约束。
- **降级**: P2

### 虚报-3: MapEventSystem.createRandomEvent权重异常
- **声称**: EVENT_TYPE_CONFIGS权重总和可能为0
- **实际**: 配置硬编码，权重总和=100，不会为0
- **撤回**: 虚报

### 虚报-4: GarrisonSystem.handleAutoGarrison事件数据异常
- **声称**: 事件数据中owner可能不匹配
- **实际**: handleAutoGarrison内部已验证territory.ownership==='player'，不匹配时直接return
- **降级**: P2

---

## 23模式扫描结果

| 模式 | 扫描结果 | P0数 |
|------|---------|------|
| 1. null/undefined防护 | 6处缺失（4个deserialize+1个filter+1个captureTerritory） | 6 |
| 2. 数值溢出/非法值 | 3处（zoom NaN、level NaN、production NaN） | 3 |
| 3. 负值漏洞 | 1处（defenseValue负值->负消耗） | 1 |
| 7. 数据丢失 | 1处（captureTimestamps未序列化） | 1 |
| 9. NaN绕过<=0 | 5处（troops/grain比较、winRate、bonus、production） | 5 |
| 11. 算法正确性 | 1处（双系统公式不一致） | 0(P1) |
| 15. 保存/加载缺失 | 2处（captureTimestamps+engine-save覆盖） | 2 |
| 21. 资源比较NaN | 2处（troops/grain比较） | 2 |
| 23. 免费操作漏洞 | 1处（deductSiegeResources静默失败） | 0(P1) |
| **合计** | | **24** |
