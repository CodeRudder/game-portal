# Battle 流程分支树 Round 1 — Part C: 辅助层

> Builder: TreeBuilder v1.3 | Time: 2026-05-01
> 文件: DamageNumberSystem.ts (362行) · DamageNumberConfig.ts (193行) · BattleStatistics.ts (151行) · BattleFragmentRewards.ts (82行) · battle-helpers.ts (81行) · battle-config.ts (88行) · index.ts (112行)

---

## 子系统: DamageNumberSystem

### API: createDamageNumber(type, value, targetUnitId, timestamp?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | NORMAL类型 | 创建普通伤害数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 2 | CRITICAL类型 | 创建暴击数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 3 | HEAL类型 | 创建治疗数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 4 | SHIELD类型 | 创建护盾数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 5 | DOT类型 | 创建DOT数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 6 | DODGE类型 | 创建闪避数字(value=0) | covered | P0 | `DamageNumberSystem.test.ts` |
| 7 | IMMUNE类型 | 创建免疫数字(value=0) | covered | P0 | `DamageNumberSystem.test.ts` |
| 8 | value=0 | 正常创建 | covered | P1 | `DamageNumberSystem.test.ts` |
| 9 | value=NaN | text="-NaN" | uncovered | P0 | — |
| 10 | value=负数 | text="--N" | uncovered | P1 | — |
| 11 | value=Infinity | text="-Infinity" | uncovered | P1 | — |
| 12 | targetUnitId="" | 正常创建 | uncovered | P2 | — |
| 13 | timestamp=0 | 正常创建 | covered | P1 | `DamageNumberSystem.test.ts` |
| 14 | 随机偏移 | trajectory含随机offsetX/Y | covered | P1 | `DamageNumberSystem.test.ts` |

### API: tryMerge(newNumber)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 同目标+同类型+时间窗口内 | 合并成功，累加value | covered | P0 | `DamageNumberSystem.test.ts` |
| 2 | 不同目标 | 不合并 | covered | P0 | `DamageNumberSystem.test.ts` |
| 3 | 不同类型 | 不合并 | covered | P0 | `DamageNumberSystem.test.ts` |
| 4 | 超出合并窗口 | 不合并 | covered | P0 | `DamageNumberSystem.test.ts` |
| 5 | 已合并的数字 | 跳过(merged=true) | covered | P1 | `DamageNumberSystem.test.ts` |
| 6 | enableMerge=false | 不合并，直接addNumber | covered | P1 | `DamageNumberSystem.test.ts` |
| 7 | 多次合并到同一数字 | 累加多次 | covered | P1 | `DamageNumberSystem.test.ts` |

### API: createBatchDamageNumbers(type, entries, timestamp?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常多目标 | 返回多个DamageNumber | covered | P0 | `DamageNumberSystem.test.ts` |
| 2 | entries=[] | 返回[] | covered | P1 | `DamageNumberSystem.test.ts` |
| 3 | entries含NaN value | 创建NaN数字 | uncovered | P0 | — |

### API: update(currentTime)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 清理2秒前的数字 | 移除过期数字 | covered | P0 | `DamageNumberSystem.test.ts` |
| 2 | 超过maxActiveNumbers(30) | 移除最旧的 | covered | P0 | `DamageNumberSystem.test.ts` |
| 3 | currentTime=NaN | 所有数字都不过期 | uncovered | P1 | — |

### API: getActiveNumbers() / getActiveCount() / clear()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常获取 | 返回非merged数字 | covered | P1 | `DamageNumberSystem.test.ts` |
| 2 | clear() | 清空所有数字 | covered | P1 | `DamageNumberSystem.test.ts` |

### API: updateConfig(updates) / getConfig() / getTrajectory(type) / getColor(type)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 更新trajectoryOverrides | 重新resolve | covered | P1 | `DamageNumberSystem.test.ts` |
| 2 | 更新colorOverrides | 重新resolve | covered | P1 | `DamageNumberSystem.test.ts` |
| 3 | getConfig() | 返回配置副本 | covered | P1 | `DamageNumberSystem.test.ts` |
| 4 | getTrajectory(type) | 返回解析后的轨迹 | covered | P1 | `DamageNumberSystem.test.ts` |
| 5 | getColor(type) | 返回颜色 | covered | P1 | `DamageNumberSystem.test.ts` |

### API: 便捷方法 (spawnDamage/spawnCritical/spawnHeal/spawnShield/spawnDOT/spawnDodge/spawnImmune)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | spawnDamage | 创建NORMAL | covered | P1 | `DamageNumberSystem.test.ts` |
| 2 | spawnCritical | 创建CRITICAL | covered | P1 | `DamageNumberSystem.test.ts` |
| 3 | spawnHeal | 创建HEAL | covered | P1 | `DamageNumberSystem.test.ts` |
| 4 | spawnShield | 创建SHIELD | covered | P1 | `DamageNumberSystem.test.ts` |
| 5 | spawnDOT | 创建DOT | covered | P1 | `DamageNumberSystem.test.ts` |
| 6 | spawnDodge | 创建DODGE | covered | P1 | `DamageNumberSystem.test.ts` |
| 7 | spawnImmune | 创建IMMUNE | covered | P1 | `DamageNumberSystem.test.ts` |

### API: ISubsystem适配 (init/getState/reset)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | init(deps) | 保存deps | covered | P1 | `DamageNumberSystem.test.ts` |
| 2 | getState() | 返回{activeCount} | covered | P1 | `DamageNumberSystem.test.ts` |
| 3 | reset() | 清空数字+重置idCounter | covered | P1 | `DamageNumberSystem.test.ts` |

---

## 子系统: DamageNumberConfig (纯数据/配置)

### 配置验证
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | DEFAULT_TRAJECTORIES覆盖所有7种类型 | 每种类型有完整配置 | covered | P0 | `battle-effect-presets.test.ts` |
| 2 | DAMAGE_NUMBER_COLORS覆盖所有7种类型 | 每种类型有颜色 | covered | P0 | `battle-effect-presets.test.ts` |
| 3 | DEFAULT_CONFIG值合理 | mergeWindowMs=200, maxActiveNumbers=30 | covered | P1 | `DamageNumberSystem.test.ts` |
| 4 | TrajectoryType枚举完整 | 5种轨迹类型 | covered | P1 | `DamageNumberSystem.test.ts` |
| 5 | DamageNumberType枚举完整 | 7种数字类型 | covered | P1 | `DamageNumberSystem.test.ts` |
| 6 | 配置交叉验证：DamageNumberType与DEFAULT_TRAJECTORIES | 类型一致 | covered | P0 | `DamageNumberSystem.test.ts` |
| 7 | 配置交叉验证：DamageNumberType与DAMAGE_NUMBER_COLORS | 类型一致 | covered | P0 | `DamageNumberSystem.test.ts` |

---

## 子系统: BattleStatistics

### API: calculateBattleStats(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常战斗日志 | 统计双方总伤害+最高伤害+连击 | covered | P0 | `BattleStatistics.test.ts` |
| 2 | actionLog=[] | 全部为0 | covered | P0 | `BattleStatistics.test.ts` |
| 3 | 全部暴击 | maxCombo=actionLog.length | covered | P1 | `BattleStatistics.test.ts` |
| 4 | 无暴击 | maxCombo=0 | covered | P1 | `BattleStatistics.test.ts` |
| 5 | 混合暴击 | maxCombo为最长连续暴击 | covered | P0 | `BattleStatistics.test.ts` |
| 6 | damage=0的行动 | 不增加总伤害 | uncovered | P1 | — |
| 7 | damage=NaN的行动 | 总伤害变NaN | uncovered | P0 | — |
| 8 | actorSide既非ally也非enemy | 不增加任何一方伤害 | uncovered | P1 | — |

### API: generateSummary(outcome, stars, turns, allyAlive)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | VICTORY+3星 | "战斗胜利！★★★，用时N回合，存活N人" | covered | P0 | `BattleStatistics.test.ts` |
| 2 | VICTORY+1星 | "战斗胜利！★☆☆，..." | covered | P0 | `BattleStatistics.test.ts` |
| 3 | DEFEAT | "战斗失败，第N回合全军覆没" | covered | P0 | `BattleStatistics.test.ts` |
| 4 | DRAW | "战斗平局，N回合内未能分出胜负" | covered | P0 | `BattleStatistics.test.ts` |
| 5 | VICTORY+stars=0(NONE) | "战斗胜利！☆☆☆，..." | uncovered | P1 | — |
| 6 | turns=0 | "用时0回合" | uncovered | P2 | — |

### API: BattleStatisticsSubsystem (ISubsystem包装)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | init(deps) | 保存deps | covered | P1 | `BattleStatistics.test.ts` |
| 2 | calculate(state) | 委托给纯函数 | covered | P0 | `BattleStatistics.test.ts` |
| 3 | summary(...) | 委托给纯函数 | covered | P0 | `BattleStatistics.test.ts` |
| 4 | reset() | 清除lastStats | covered | P1 | `BattleStatistics.test.ts` |
| 5 | getState() | 返回{lastStats} | covered | P1 | `BattleStatistics.test.ts` |

---

## 子系统: BattleFragmentRewards

### API: calculateFragmentRewards(outcome, enemyTeam, allySurvivors, isFirstClear?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | VICTORY+非首通 | 10%掉率，确定性hash | covered | P0 | `BattleFragmentRewards.test.ts` |
| 2 | DEFEAT | 返回{} | covered | P0 | `BattleFragmentRewards.test.ts` |
| 3 | DRAW | 返回{} | covered | P0 | `BattleFragmentRewards.test.ts` |
| 4 | VICTORY+首通 | 所有敌方单位必掉1碎片 | covered | P0 | `BattleFragmentRewards.test.ts` |
| 5 | enemyTeam.units=[] | 返回{} | covered | P1 | `BattleFragmentRewards.test.ts` |
| 6 | allySurvivors=0+VICTORY | 正常计算（未使用allySurvivors） | uncovered | P1 | — |
| 7 | isFirstClear=undefined | 非首通逻辑 | covered | P1 | `BattleFragmentRewards.test.ts` |
| 8 | enemyTeam=null | 访问units崩溃 | uncovered | P0 | — |
| 9 | enemyTeam含大量units | 全部计算碎片 | uncovered | P2 | — |

### API: simpleHash(str)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常字符串 | 返回非负整数 | covered | P0 | `BattleFragmentRewards.test.ts` |
| 2 | 空字符串 | 返回0 | covered | P1 | `BattleFragmentRewards.test.ts` |
| 3 | 长字符串 | 正常计算 | covered | P1 | `BattleFragmentRewards.test.ts` |
| 4 | 确定性 | 相同输入相同输出 | covered | P0 | `BattleFragmentRewards.test.ts` |
| 5 | str=null | 崩溃 | uncovered | P0 | — |

---

## 子系统: battle-config (纯配置)

### 配置交叉验证
| # | 检查项 | 预期 | 状态 | 优先级 | 源码/测试位置 |
|---|--------|------|------|--------|--------------|
| 1 | MAX_TURNS(8)与STAR3_MAX_TURNS(6) | STAR3<MAX，合理 | covered | P0 | 源码验证 |
| 2 | STAR2_MIN_SURVIVORS(4)与TEAM_SIZE(6) | 4≤6，合理 | covered | P0 | 源码验证 |
| 3 | MAX_RAGE(100)=ULTIMATE_RAGE_THRESHOLD(100) | 一致 | covered | P0 | 源码验证 |
| 4 | RAGE_GAIN_ATTACK(25)+RAGE_GAIN_HIT(15) | 4回合满怒气(25*4=100) | covered | P1 | 源码验证 |
| 5 | AVAILABLE_SPEEDS=[1,2,3]但BattleSpeed.X4=4存在 | ⚠️ X4不在循环中但枚举存在 | uncovered | P0 | 配置交叉 |
| 6 | BURN_DAMAGE_RATIO(0.05)+POISON_DAMAGE_RATIO(0.03) | BURN>POISON，合理 | covered | P1 | 源码验证 |
| 7 | RANDOM_FACTOR_MIN(0.9)+MAX(1.1) | 波动±10%，合理 | covered | P1 | 源码验证 |
| 8 | BASE_CRITICAL_RATE(0.05) | 5%基础暴击率 | covered | P1 | 源码验证 |
| 9 | DEFAULT_BATTLE_SPEED(1)在AVAILABLE_SPEEDS中 | 一致 | covered | P0 | 源码验证 |
| 10 | CRITICAL_MULTIPLIER(1.5) | 暴击1.5倍，合理 | covered | P1 | 源码验证 |
| 11 | RESTRAINT_ADVANTAGE(1.5)/DISADVANTAGE(0.7) | 克制+50%/被克-30% | covered | P0 | 源码验证 |
| 12 | TIME_STOP_TIMEOUT_MS(30000) | 30秒超时 | covered | P1 | 源码验证 |

---

## 子系统: battle-effect-presets (纯数据)

### 预设验证
| # | 检查项 | 预期 | 状态 | 优先级 | 源码/测试位置 |
|---|--------|------|------|--------|--------------|
| 1 | ELEMENT_PARTICLE_PRESETS覆盖8种元素 | fire/ice/thunder/wind/earth/light/dark/neutral | covered | P0 | `battle-effect-presets.test.ts` |
| 2 | ELEMENT_GLOW_PRESETS覆盖8种元素 | 同上 | covered | P0 | `battle-effect-presets.test.ts` |
| 3 | SCREEN_PRESETS覆盖3种屏幕 | small/medium/large | covered | P0 | `battle-effect-presets.test.ts` |
| 4 | BUFF_ELEMENT_MAP映射合理 | BURN→fire, FREEZE→ice等 | covered | P0 | `battle-effect-presets.test.ts` |
| 5 | BUFF_ELEMENT_MAP未覆盖所有BuffType | ATK_DOWN/DEF_DOWN未映射→neutral | uncovered | P1 | — |
| 6 | 粒子配置值合理(count>0, speedRange有序) | 验证 | covered | P1 | `battle-effect-presets.test.ts` |

---

## 子系统: index.ts (导出)

### 导出完整性
| # | 检查项 | 预期 | 状态 | 优先级 | 源码/测试位置 |
|---|--------|------|------|--------|--------------|
| 1 | 所有公开类已导出 | BattleEngine/DamageCalculator/etc. | covered | P0 | 源码验证 |
| 2 | 所有公开类型已导出 | BattleUnit/BattleTeam/etc. | covered | P0 | 源码验证 |
| 3 | 所有公开函数已导出 | getAliveUnits/sortBySpeed/etc. | covered | P0 | 源码验证 |
| 4 | 所有枚举已导出 | TroopType/BuffType/etc. | covered | P0 | 源码验证 |
| 5 | v4.0新增导出完整 | UltimateSkillSystem/BattleSpeedController/etc. | covered | P0 | 源码验证 |
| 6 | 无循环依赖 | index→各模块单向 | covered | P0 | 源码验证 |

---

## 跨系统链路 (Part C 与 Part A/B 的交叉)

| # | 链路 | 描述 | 状态 | 优先级 |
|---|------|------|------|--------|
| XC-1 | BattleEngine.getBattleResult → calculateBattleStats | 统计链路 | covered | P0 |
| XC-2 | BattleEngine.getBattleResult → calculateFragmentRewards | 碎片链路 | covered | P0 |
| XC-3 | BattleEffectManager → DamageNumberSystem | 飘字生成 | covered | P0 |
| XC-4 | DamageNumberConfig → DamageNumberSystem | 配置注入 | covered | P0 |
| XC-5 | BATTLE_CONFIG → DamageCalculator/BattleEngine/all | 配置消费 | covered | P0 |
| XC-6 | battle-effect-presets → BattleEffectManager | 特效预设 | covered | P0 |
| XC-7 | battle-effect-presets → BattleEffectApplier | 元素/触发类型 | covered | P0 |
| XC-8 | index.ts → 所有子系统 | 统一导出 | covered | P0 |
| XC-9 | BattleStatisticsSubsystem → calculateBattleStats | ISubsystem包装 | covered | P0 |

### 特别关注项（基于Hero模块经验）

| # | 模式 | 检查结果 | 状态 | 优先级 |
|---|------|---------|------|--------|
| S-1 | NaN绕过<=0检查（模式9） | DamageNumberSystem.createDamageNumber未防护NaN value | uncovered | P0 |
| S-2 | 配置交叉不一致（模式10） | AVAILABLE_SPEEDS=[1,2,3]与BattleSpeed.X4=4不一致 ⚠️ | uncovered | P0 |
| S-3 | setter/getter注入未调用（模式12） | DamageNumberSystem构造函数接受config但ISubsystem.init未合并 | uncovered | P1 |
| S-4 | 修复穿透不完整（模式13） | calculateBattleStats未防护NaN damage | uncovered | P0 |
| S-5 | 资源溢出无上限（模式14） | DamageNumberSystem maxActiveNumbers=30有限制 ✅ | covered | P0 |
| S-6 | 保存/加载流程缺失（模式15） | DamageNumberSystem/BattleStatistics无serialize/deserialize | uncovered | P1 |
| S-7 | simpleHash(null)崩溃 | 未防护null输入 | uncovered | P0 |
| S-8 | BUFF_ELEMENT_MAP不完整 | ATK_DOWN/DEF_DOWN未映射 | uncovered | P1 |
