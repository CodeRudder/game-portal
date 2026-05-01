# Bond R2 — 测试分支树（精简）

> Builder Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts)

## R1→R2 变更摘要

R1 发现 8 个 P0，全部已修复并穿透验证通过：

| R1 P0 | FIX | 状态 | R2 验证节点 |
|-------|-----|------|------------|
| P0-001 addFavorability NaN/Infinity | FIX-B01 | ✅ 已修 | R2-V01 |
| P0-002 addFavorability 无上限 | FIX-B02 | ✅ 已修 | R2-V02 |
| P0-003 loadSaveData null崩溃 | FIX-B03 | ✅ 已修 | R2-V03 |
| P0-004 存档系统未接入 | FIX-B04 | ✅ 已修 | R2-V04 |
| P0-005 triggerStoryEvent 无前置条件 | FIX-B05 | ✅ 已修 | R2-V05 |
| P0-006 triggerStoryEvent deps未初始化 | FIX-B06 | ✅ 已修 | R2-V06 |
| P0-007 getAvailableStoryEvents null崩溃 | FIX-B07 | ✅ 已修 | R2-V07 |
| P0-008 getFactionDistribution faction无效 | FIX-B08 | ✅ 已修 | R2-V08 |

## R2 精简树

R2 聚焦：① R1 FIX 回归验证 ② R1 P1 升级评估 ③ 新边界探索

### V: R1 FIX 回归验证

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| R2-V01 | addFavorability(NaN) → 静默忽略，fav.value不变 | F-Error | P0 |
| R2-V02 | addFavorability('hero', 999999) → fav.value=99999（MAX_FAVORABILITY） | F-Boundary | P0 |
| R2-V03 | loadSaveData(null) → 静默return，不崩溃 | F-Error | P0 |
| R2-V04 | 完整保存→加载循环，bond字段完整保留 | F-Cross | P0 |
| R2-V05 | triggerStoryEvent 好感度不足 → success=false | F-Error | P0 |
| R2-V06 | triggerStoryEvent 未init → success=false, reason='系统未初始化' | F-Error | P0 |
| R2-V07 | getAvailableStoryEvents(null) → [] | F-Error | P0 |
| R2-V08 | getFactionDistribution([{faction:undefined}]) → 全零分布 | F-Error | P0 |

### E: R1 P1 升级评估

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| R2-E01 | getBondEffect('invalid_type') → 返回什么？静默返回空对象？ | F-Error | P1 |
| R2-E02 | addFavorability('', 100) → 静默忽略（空heroId） | F-Error | P1 |
| R2-E03 | 双BondSystem name='bond' → 注册冲突？ | F-Cross | P1 |
| R2-E04 | STORY_EVENTS 无前置事件链 → 可直接触发第一个事件 | F-Normal | P1 |
| R2-E05 | loadSaveData 版本不匹配 → 无校验，静默接受 | F-Error | P1 |

### N: R2 新边界探索

| Node ID | 分支 | 类型 | 优先级 |
|---------|------|------|--------|
| R2-N01 | addFavorability 极大正数 (1e15) → MAX_FAVORABILITY截断 | F-Boundary | P2 |
| R2-N02 | loadSaveData favorabilities含NaN值 → 跳过该条目 | F-Error | P1 |
| R2-N03 | serialize() 空状态 → {version, favorabilities:{}, completedStoryEvents:[]} | F-Normal | P2 |
| R2-N04 | triggerStoryEvent 重复触发 repeatable=true → success=true | F-Normal | P2 |
| R2-N05 | getFormationPreview 空编队 → 无羁绊 | F-Normal | P2 |
| R2-N06 | detectActiveBonds 5同阵营 → faction_3（不触发faction_6） | F-Normal | P2 |
| R2-N07 | calculateTotalBondBonuses 空羁绊 → {} | F-Normal | P2 |
| R2-N08 | loadSaveData completedStoryEvents含空字符串 → 跳过 | F-Boundary | P2 |
| R2-N09 | addFavorability 连续调用100次 → 累加不超过MAX_FAVORABILITY | F-Stress | P2 |

## 统计

| 指标 | R1 | R2 | 变化 |
|------|-----|-----|------|
| 总节点 | 46 | 22 | -52% |
| P0 | 18 | 8 | -56%（全部回归验证） |
| P1 | 7 | 7 | 持平（5个P1升级评估+2个新发现） |
| P2 | 21 | 7 | -67% |
| F-Normal | 22 | 5 | 大幅精简 |
| F-Error | 14 | 10 | 聚焦回归 |
| F-Cross | 9 | 2 | 存档链路验证 |
| F-Boundary | 1 | 3 | 新边界 |
| F-Stress | 0 | 1 | 新增压力测试 |

## R2 穿透验证清单

| FIX | 穿透路径 | 验证方式 |
|-----|---------|---------|
| FIX-B01 | addFavorability → triggerStoryEvent(rewards) | rewards来自配置常量，安全 |
| FIX-B02 | addFavorability → serialize → JSON.stringify | MAX_FAVORABILITY=99999，序列化安全 |
| FIX-B03 | loadSaveData ← applySaveData(data.bond) | applySaveData有if(data.bond)保护 |
| FIX-B04 | buildSaveCtx → buildSaveData → applySaveData → loadSaveData | 六处同步已验证 |
| FIX-B05 | triggerStoryEvent ← getAvailableStoryEvents | 两者条件检查一致 |
| FIX-B06 | triggerStoryEvent deps检查 → eventBus.emit | 先检查deps再使用 |
| FIX-B07 | getAvailableStoryEvents → heroes.has() | 先检查heroes非null |
| FIX-B08 | getFactionDistribution → dist[hero.faction]++ | 先检查faction有效性 |
