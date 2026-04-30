# Battle 流程分支树 Round 1 — Part B: 效果+大招层

> Builder: TreeBuilder v1.3 | Time: 2026-05-01
> 文件: BattleEffectApplier.ts (370行) · BattleEffectManager.ts (329行) · battle-effect-presets.ts (180行) · UltimateSkillSystem.ts (439行) · BattleSpeedController.ts (329行) · battle-ultimate.types.ts (175行)

---

## 子系统: BattleEffectApplier

### API: getEnhancedStats(unit)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 无TechEffectSystem | 所有加成为0，返回原始属性 | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | 有TechEffectSystem+全军加成 | attackBonus/defenseBonus增加 | covered | P0 | `BattleEffectApplier.test.ts` |
| 3 | 有TechEffectSystem+兵种专属加成 | 额外加成叠加 | covered | P0 | `BattleEffectApplier.test.ts` |
| 4 | 全军+兵种专属同时存在 | 合计加成 | covered | P1 | `BattleEffectApplier.test.ts` |
| 5 | unit.troopType=ARCHER | target='archer' | covered | P1 | `BattleEffectApplier.test.ts` |
| 6 | unit.troopType=STRATEGIST | target='strategist' | covered | P1 | `BattleEffectApplier.test.ts` |
| 7 | unit.baseAttack=0 | enhancedAttack=0 | uncovered | P0 | — |
| 8 | unit.baseAttack=NaN | enhancedAttack=NaN | uncovered | P0 | — |
| 9 | unit.baseDefense=NaN | enhancedDefense=NaN | uncovered | P0 | — |
| 10 | 加成后enhancedAttack为负数 | Math.floor(负数) | uncovered | P1 | — |

### API: applyTechBonusesToUnit(unit)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常unit | 修改unit.attack/defense | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | 无TechEffectSystem | unit不变 | covered | P1 | `BattleEffectApplier.test.ts` |

### API: applyTechBonusesToTeam(units)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常6人队伍 | 所有单位应用加成 | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | 空数组 | 无操作 | covered | P1 | `BattleEffectApplier.test.ts` |
| 3 | 含null元素 | 访问属性崩溃 | uncovered | P0 | — |

### API: enhanceDamageResult(result, attacker)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常result+attacker | 返回EnhancedDamageResult | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | 无TechEffectSystem | techMultiplier=1，enhancedDamage=result.damage | covered | P1 | `BattleEffectApplier.test.ts` |
| 3 | result.damage=0 | enhancedDamage=0 | uncovered | P1 | — |
| 4 | result.damage=NaN | enhancedDamage=NaN | uncovered | P0 | — |
| 5 | result.damage=Infinity | enhancedDamage=Infinity | uncovered | P0 | — |

### API: getSkillEffect(skillId)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 存在的skillId | 返回SkillEffectConfig | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | 不存在的skillId | 返回null | covered | P0 | `BattleEffectApplier.test.ts` |
| 3 | 空字符串 | 返回null | uncovered | P1 | — |

### API: getAllSkillEffects()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常调用 | 返回7个预设配置 | covered | P1 | `BattleEffectApplier.test.ts` |

### API: registerSkillEffect(config)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 新config | 添加到skillEffects | covered | P1 | `BattleEffectApplier.test.ts` |
| 2 | 覆盖已有skillId | 替换配置 | covered | P1 | `BattleEffectApplier.test.ts` |
| 3 | config=null | 可能崩溃 | uncovered | P0 | — |
| 4 | config.skillId=空字符串 | 添加空key | uncovered | P1 | — |

### API: setTechEffectSystem(techEffect)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常TechEffectSystem | 保存引用 | covered | P0 | `BattleEffectApplier.test.ts` |
| 2 | null | 清除引用 | uncovered | P1 | — |

### API: ISubsystem适配 (init/update/getState/reset)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | init(deps) | 保存deps | covered | P1 | `BattleEffectApplier.test.ts` |
| 2 | reset() | 清除techEffect+deps | covered | P1 | `BattleEffectApplier.test.ts` |
| 3 | getState() | 返回{techEffectBound, skillEffectCount} | covered | P1 | `BattleEffectApplier.test.ts` |

---

## 子系统: BattleEffectManager

### API: generateSkillEffect(skill, actor, damageResult?, timestamp?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常技能（火系） | 返回fire元素SkillEffectData | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 2 | 暴击时 | trigger='onCritical' | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 3 | 大招(rageCost>0) | glow.radius*1.5 | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 4 | 4x速度 | 简化特效(count*0.4, scale*0.5) | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 5 | 未知元素skillId | element='neutral' | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 6 | damageResult=undefined | 不崩溃，trigger=inferTrigger | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 7 | skill=null | 访问属性崩溃 | uncovered | P0 | — |
| 8 | 超过maxActiveEffects | trimEffects移除最旧 | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 9 | timestamp=0 | 正常创建 | uncovered | P2 | — |

### API: generateBuffEffect(buffType, target, timestamp?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | BURN buff | element='fire' | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 2 | FREEZE buff | element='ice' | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 3 | 未知buffType | element='neutral' | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 4 | 4x速度 | 简化(count*0.3) | covered | P1 | `BattleEffectManager-p1.test.ts` |

### API: getActiveEffects() / cleanupEffects(currentTime)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常获取 | 返回副本 | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 2 | 清理3秒前的特效 | 过滤掉 | covered | P0 | `BattleEffectManager-p1.test.ts` |
| 3 | 全部过期 | 返回空数组 | covered | P1 | `BattleEffectManager-p1.test.ts` |

### API: generateDamageAnimations(action, timestamp?)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常action含伤害 | 生成DamageAnimationData数组 | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 2 | 暴击伤害 | numType=CRITICAL | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 3 | damage=0 | numType=IMMUNE | covered | P1 | `BattleEffectManager-p2.test.ts` |
| 4 | 多目标伤害 | 每个目标一个动画，delayMs递增 | covered | P1 | `BattleEffectManager-p2.test.ts` |
| 5 | action.damageResults={} | 返回空数组 | uncovered | P1 | — |

### API: generateHealAnimation / generateDotAnimation
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常治疗 | 生成HEAL类型动画 | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 2 | 正常DOT | 生成DOT类型动画 | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 3 | amount=0 | 生成0值动画 | uncovered | P1 | — |
| 4 | amount=NaN | 生成NaN值动画 | uncovered | P0 | — |

### API: getMobileLayout(screenWidth, screenHeight)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | screenWidth<=375 | screenClass='small' | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 2 | 375<screenWidth<=428 | screenClass='medium' | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 3 | screenWidth>428 | screenClass='large' | covered | P0 | `BattleEffectManager-p2.test.ts` |
| 4 | screenWidth=0 | screenClass='small' | uncovered | P1 | — |
| 5 | screenWidth=NaN | screenClass='small'（NaN<=375为false→NaN<=428为false→'large'） | uncovered | P0 | — |
| 6 | screenWidth=负数 | screenClass='small' | uncovered | P1 | — |

### API: getSkillButtonLayout(count)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | count=4 | 返回4个按钮布局 | covered | P1 | `BattleEffectManager-p2.test.ts` |
| 2 | count=0 | 返回空数组 | uncovered | P1 | — |
| 3 | count=NaN | Array.from({length:NaN})返回[] | uncovered | P1 | — |

### API: setBattleSpeed / getBattleSpeed / clear / update
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | setBattleSpeed(X4) | 更新battleSpeed | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 2 | clear() | 清空所有effects+animations | covered | P1 | `BattleEffectManager-p1.test.ts` |
| 3 | update(currentTime) | 清理过期effects+animations | covered | P1 | `BattleEffectManager-p1.test.ts` |

---

## 子系统: UltimateSkillSystem

### API: checkUltimateReady(unit)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | enabled=true, rage≥100, 有可用大招 | {isReady:true, readyUnits:[...]} | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | enabled=false | {isReady:false, readyUnits:[]} | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | rage<100 | {isReady:false} | covered | P0 | `UltimateSkillSystem.test.ts` |
| 4 | rage≥100但无active技能 | {isReady:false} | covered | P1 | `UltimateSkillSystem.test.ts` |
| 5 | rage≥100但技能在冷却 | {isReady:false} | covered | P1 | `UltimateSkillSystem.test.ts` |
| 6 | rage≥100但rageCost=0(被动) | {isReady:false} | covered | P1 | `UltimateSkillSystem.test.ts` |
| 7 | unit.rage=NaN | NaN<100为false→可能异常 | uncovered | P0 | — |
| 8 | unit=null | 访问属性崩溃 | uncovered | P0 | — |

### API: checkTeamUltimateReady(units)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 多人有大招就绪 | 返回所有就绪单位 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | 无人有大招 | {isReady:false} | covered | P1 | `UltimateSkillSystem.test.ts` |
| 3 | 含死亡单位 | 跳过死亡单位 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 4 | units=[] | {isReady:false} | covered | P1 | `UltimateSkillSystem.test.ts` |
| 5 | enabled=false | 直接返回false | covered | P0 | `UltimateSkillSystem.test.ts` |

### API: pauseForUltimate(unit, skill)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | enabled=true | 设置PAUSED，通知handler，启动超时 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | enabled=false | 直接返回，不暂停 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | handler=null | 不通知，但状态仍设置 | covered | P1 | `UltimateSkillSystem.test.ts` |
| 4 | 多次调用（前一次未确认） | 覆盖pendingUnitId/SkillId | uncovered | P1 | — |

### API: confirmUltimate(unitId, skillId)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | PAUSED状态+匹配ID | 返回true，重置状态 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | 非PAUSED状态 | 返回false | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | unitId不匹配 | 返回false | covered | P0 | `UltimateSkillSystem.test.ts` |
| 4 | skillId不匹配 | 返回false | covered | P0 | `UltimateSkillSystem.test.ts` |
| 5 | 通知handler.onUltimateConfirmed | 事件含空unitName/skill | covered | P1 | `UltimateSkillSystem.test.ts` |

### API: confirmUltimateWithInfo(unit, skill)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | PAUSED+匹配 | 返回true，通知含完整信息 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | 非PAUSED | 返回false | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | unit.id不匹配 | 返回false | covered | P0 | `UltimateSkillSystem.test.ts` |

### API: cancelUltimate()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | PAUSED状态 | 重置状态，通知handler | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | 非PAUSED状态 | 直接返回 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | handler=null | 不通知 | covered | P1 | `UltimateSkillSystem.test.ts` |

### API: isPaused() / isConfirmed() / getPendingUnitId() / getPendingSkillId()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | PAUSED状态 | isPaused=true | covered | P1 | `UltimateSkillSystem.test.ts` |
| 2 | INACTIVE状态 | isPaused=false | covered | P1 | `UltimateSkillSystem.test.ts` |
| 3 | 有pending | 返回ID | covered | P1 | `UltimateSkillSystem.test.ts` |
| 4 | 无pending | 返回null | covered | P1 | `UltimateSkillSystem.test.ts` |

### API: reset() / serialize() / deserialize()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | reset() | 清除timeout+重置所有状态 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | serialize() | 返回{state,enabled,pendingUnitId,pendingSkillId} | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | deserialize(data) | 恢复状态 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 4 | serialize→deserialize往返 | 数据一致 | covered | P0 | `UltimateSkillSystem.test.ts` |
| 5 | deserialize(null) | 访问属性崩溃 | uncovered | P0 | — |
| 6 | deserialize含非法state值 | 直接赋值无验证 | uncovered | P0 | — |

### API: registerHandler / removeHandler / setEnabled / isEnabled
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | registerHandler | 保存引用 | covered | P1 | `UltimateSkillSystem.test.ts` |
| 2 | removeHandler | 清除引用 | covered | P1 | `UltimateSkillSystem.test.ts` |
| 3 | setEnabled(false) | 禁用+reset | covered | P0 | `UltimateSkillSystem.test.ts` |
| 4 | setEnabled(true) | 启用 | covered | P0 | `UltimateSkillSystem.test.ts` |

### 超时机制
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 超时30s后自动确认 | confirmUltimateWithInfo | covered | P0 | `UltimateSkillSystem.test.ts` |
| 2 | 手动确认后清除timeout | clearTimeout | covered | P0 | `UltimateSkillSystem.test.ts` |
| 3 | cancel后清除timeout | clearTimeout | covered | P0 | `UltimateSkillSystem.test.ts` |

---

## 子系统: BattleSpeedController

### API: setSpeed(speed)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | X1→X2 | 更新speedState，返回true | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | 相同速度 | 返回false | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | 无效速度(99) | 返回false | covered | P0 | `BattleSpeedController.test.ts` |
| 4 | SKIP(0) | 创建SKIP状态 | covered | P0 | `BattleSpeedController.test.ts` |
| 5 | NaN | isValidSpeed返回false | covered | P0 | `BattleSpeedController.test.ts` |
| 6 | 负数 | 返回false | covered | P1 | `BattleSpeedController.test.ts` |
| 7 | 通知listeners | onSpeedChange调用 | covered | P0 | `BattleSpeedController.test.ts` |
| 8 | 记录changeHistory | push事件 | covered | P1 | `BattleSpeedController.test.ts` |

### API: getSpeedState() / getSpeed()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常获取 | 返回副本/当前速度 | covered | P1 | `BattleSpeedController.test.ts` |

### API: cycleSpeed()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | X1→X2 | 切换到下一档 | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | X2→X3 | 切换到X3 | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | X3→X1 | 循环回X1 | covered | P0 | `BattleSpeedController.test.ts` |
| 4 | SKIP→X1 | 不参与循环，直接回X1 | covered | P0 | `BattleSpeedController.test.ts` |
| 5 | X4(不在AVAILABLE_SPEEDS) | indexOf=-1, nextIndex=0→X1 | uncovered | P0 | — |

### API: getAdjustedTurnInterval()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | X1 | 1000ms | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | X2 | 500ms | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | X4 | 250ms | covered | P0 | `BattleSpeedController.test.ts` |
| 4 | SKIP | 0ms | covered | P0 | `BattleSpeedController.test.ts` |

### API: getAnimationSpeedScale()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | X1 | 1.0 | covered | P1 | `BattleSpeedController.test.ts` |
| 2 | X2 | 2.0 | covered | P1 | `BattleSpeedController.test.ts` |
| 3 | SKIP | Infinity | covered | P0 | `BattleSpeedController.test.ts` |

### API: shouldSimplifyEffects()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | X4 | true | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | X1/X2 | false | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | SKIP | true | covered | P0 | `BattleSpeedController.test.ts` |

### API: addListener / removeListener / getChangeHistory
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | addListener | 添加监听器 | covered | P1 | `BattleSpeedController.test.ts` |
| 2 | addListener重复 | 不重复添加 | covered | P1 | `BattleSpeedController.test.ts` |
| 3 | removeListener | 移除监听器 | covered | P1 | `BattleSpeedController.test.ts` |
| 4 | removeListener不存在 | 无操作 | covered | P1 | `BattleSpeedController.test.ts` |
| 5 | getChangeHistory | 返回副本 | covered | P1 | `BattleSpeedController.test.ts` |

### API: reset() / serialize() / deserialize()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | reset() | 恢复默认速度+清空历史 | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | serialize() | 返回speedState副本 | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | deserialize(state) | 恢复speedState | covered | P0 | `BattleSpeedController.test.ts` |
| 4 | deserialize(null) | 访问属性崩溃 | uncovered | P0 | — |
| 5 | deserialize含非法speed | 直接赋值无验证 | uncovered | P0 | — |

### API: static isValidSpeed / getAvailableSpeeds
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | SKIP(0) | true | covered | P0 | `BattleSpeedController.test.ts` |
| 2 | X1(1)/X2(2)/X3(3) | true | covered | P0 | `BattleSpeedController.test.ts` |
| 3 | X4(4) | false（不在AVAILABLE_SPEEDS=[1,2,3]） | uncovered | P0 | — |
| 4 | getAvailableSpeeds() | [1,2,3] | covered | P1 | `BattleSpeedController.test.ts` |

---

## 跨系统链路 (Part B 内部)

| # | 链路 | 描述 | 状态 | 优先级 |
|---|------|------|------|--------|
| XB-1 | BattleEffectApplier.getEnhancedStats → TechEffectSystem.getAttackBonus | 科技加成查询 | covered | P0 |
| XB-2 | BattleEffectApplier.getEnhancedStats → TechEffectSystem.getEffectValueByTarget | 全军/兵种加成查询 | covered | P0 |
| XB-3 | BattleEffectManager.generateSkillEffect → inferElement | 元素推断 | covered | P0 |
| XB-4 | BattleEffectManager.generateDamageAnimations → DamageNumberSystem.createDamageNumber | 飘字生成 | covered | P0 |
| XB-5 | BattleEffectManager.getMobileLayout → SCREEN_PRESETS | 屏幕适配 | covered | P0 |
| XB-6 | UltimateSkillSystem.pauseForUltimate → handler.onUltimateReady+onBattlePaused | 时停通知链 | covered | P0 |
| XB-7 | UltimateSkillSystem超时 → confirmUltimateWithInfo | 自动确认 | covered | P0 |
| XB-8 | BattleSpeedController.setSpeed → listener.onSpeedChange | 速度变更通知 | covered | P0 |
| XB-9 | BattleSpeedController.createSpeedState(SKIP) → Infinity animationSpeedScale | SKIP状态创建 | covered | P0 |

### 特别关注项（基于Hero模块经验）

| # | 模式 | 检查结果 | 状态 | 优先级 |
|---|------|---------|------|--------|
| S-1 | NaN绕过<=0检查（模式9） | BattleEffectApplier未防护NaN baseAttack/baseDefense | uncovered | P0 |
| S-2 | 配置交叉不一致（模式10） | BATTLE_CONFIG.AvAILABLE_SPEEDS=[1,2,3]但BattleSpeed枚举含X4=4 ⚠️ | uncovered | P0 |
| S-3 | setter/getter注入未调用（模式12） | BattleEffectApplier.setTechEffectSystem需在initBattle前调用 | uncovered | P1 |
| S-4 | 修复穿透不完整（模式13） | enhanceDamageResult未防护NaN result.damage | uncovered | P0 |
| S-5 | 资源溢出无上限（模式14） | getEnhancedStats加成无上限保护 | uncovered | P1 |
| S-6 | 保存/加载流程缺失（模式15） | UltimateSkillSystem有serialize/deserialize但BattleEngine未调用 | uncovered | P0 |
| S-7 | BattleSpeedController.deserialize无验证 | 直接赋值无校验 | uncovered | P0 |
| S-8 | UltimateSkillSystem超时使用setTimeout | 测试环境可能不稳定 | covered | P1 |
