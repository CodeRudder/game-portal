# 装备模块对抗式测试 — R1 Builder 测试分支树

> 生成时间: R1 | 模块: equipment | 维度: 5 | 总分支: 68

---

## 维度一: F-Normal 正向流程 (18 branches)

### 1.1 装备生成
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| N-01 | generateEquipment(slot, rarity) 按部位+品质生成 | 返回合法EquipmentInstance | P0 |
| N-02 | generateEquipment(templateId, rarity) 按模板生成 | 返回对应模板装备 | P0 |
| N-03 | generateCampaignDrop('normal') 关卡掉落 | 返回合法装备, source='campaign_drop' | P1 |
| N-04 | generateFromSource('shop') 按来源生成 | 返回合法装备, source='shop' | P1 |

### 1.2 穿戴/卸下
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| N-05 | equipItem(heroId, uid) 穿戴到空槽位 | success=true, 装备isEquipped=true | P0 |
| N-06 | equipItem 同一武将同部位替换 | success=true, replacedUid有值 | P0 |
| N-07 | unequipItem(heroId, slot) 卸下装备 | success=true, isEquipped=false | P0 |
| N-08 | getHeroEquips 获取武将装备栏 | 返回4个slot的map | P1 |

### 1.3 强化系统
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| N-09 | enhance(uid) 低等级强化(0→1) | outcome='success', 100%成功率 | P0 |
| N-10 | enhance(uid, true) 使用保护符强化 | protectionUsed记录正确 | P1 |
| N-11 | autoEnhance 自动强化到目标等级 | 循环强化直到达标 | P0 |
| N-12 | transferEnhance 强化转移 | 源归零, 目标=源等级-TRANSFER_LEVEL_LOSS | P0 |

### 1.4 锻造系统
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| N-13 | basicForge 3白→绿/蓝/紫 | 消耗3件, 生成1件更高品质 | P0 |
| N-14 | advancedForge 5件高级炼制 | 消耗5件, 高概率出紫/金 | P1 |
| N-15 | targetedForge 定向炼制(指定slot) | 产出指定部位装备 | P1 |

### 1.5 套装/分解/推荐
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| N-16 | getActiveSetBonuses 2件套激活 | 返回2件套bonus | P0 |
| N-17 | getActiveSetBonuses 4件套激活 | 返回2+4件套bonus | P0 |
| N-18 | decompose 分解装备 | 返回copper+enhanceStone | P0 |

---

## 维度二: F-Boundary 边界条件 (16 branches)

### 2.1 背包边界
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| B-01 | 背包满时add装备 | success=false, reason='背包已满' | P0 |
| B-02 | 背包容量=0(非法) | setCapacity回退DEFAULT_BAG_CAPACITY | P1 |
| B-03 | 背包容量=Infinity | setCapacity回退DEFAULT_BAG_CAPACITY | P1 |
| B-04 | expandBag到MAX_BAG_CAPACITY后继续扩容 | success=false | P1 |

### 2.2 强化边界
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| B-05 | enhanceLevel=maxLevel(15)时强化 | 返回failResult | P0 |
| B-06 | enhanceLevel=rarityCap时强化 | 返回failResult(品质上限) | P0 |
| B-07 | enhanceLevel=NaN时计算属性 | 安全降级为0 | P1 |
| B-08 | enhanceLevel=-1时计算属性 | 安全降级为0 | P1 |

### 2.3 穿戴边界
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| B-09 | 穿戴已被其他武将穿戴的装备 | success=false | P0 |
| B-10 | 卸下空槽位 | success=false, reason='该部位无装备' | P1 |
| B-11 | 重复穿戴同一装备到同一武将 | 幂等成功 | P1 |
| B-12 | getHeroEquips 不存在的武将 | 返回4个null的默认槽位 | P1 |

### 2.4 锻造边界
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| B-13 | basicForge 金色装备不可炼制 | valid=false | P0 |
| B-14 | basicForge 投入装备品质不一致 | valid=false | P0 |
| B-15 | basicForge 投入数量不正确(2件而非3件) | valid=false | P1 |
| B-16 | basicForge 投入已穿戴装备 | valid=false | P1 |

---

## 维度三: F-Error 异常路径 (14 branches)

### 3.1 null/undefined防护
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| E-01 | getEquipment(不存在的uid) | 返回undefined | P0 |
| E-02 | equipItem(heroId, 不存在的uid) | success=false | P0 |
| E-03 | enhance(不存在的uid) | 返回failResult | P0 |
| E-04 | bag.add(null) | success=false, reason='无效装备' | P0 |
| E-05 | bag.add(undefined) | success=false, reason='无效装备' | P0 |

### 3.2 反序列化防护
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| E-06 | deserialize(null) | 安全重置, 不崩溃 | P0 |
| E-07 | deserialize(undefined) | 安全重置, 不崩溃 | P0 |
| E-08 | deserialize({}) 空对象 | 安全重置 | P1 |
| E-09 | deserialize 装备equippedHeroId指向不存在武将 | 安全恢复heroEquips | P1 |

### 3.3 资源扣除
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| E-10 | enhance 未注入deductResources | 返回failResult(防止免费强化) | P0 |
| E-11 | enhance deductResources返回false(资源不足) | 返回failResult | P0 |
| E-12 | transferEnhance deductResources返回false | success=false | P1 |
| E-13 | expandBag expandValidator返回false | success=false, reason='资源不足' | P1 |
| E-14 | forge equipmentSystem未初始化 | valid=false | P1 |

---

## 维度四: F-CrossSystem 跨系统交互 (12 branches)

### 4.1 装备→战斗属性传递
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| X-01 | calculateMainStatValue 白装+0级 | baseValue × 1.0 × (1 + 0 × factor) | P0 |
| X-02 | calculateMainStatValue 金装+10级 | baseValue × 2.5 × (1 + 10 × factor) | P0 |
| X-03 | calculateSubStatValue 各品质×强化等级 | 正确应用品质倍率+强化系数 | P0 |
| X-04 | calculatePower 综合战力计算 | 主属性+副属性+特效×5+品质分 | P0 |

### 4.2 套装→属性传递
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| X-05 | getTotalSetBonuses 多套装叠加 | 正确合并所有套装加成 | P0 |
| X-06 | getSetCounts 跨slot统计同setId | 正确统计各套装件数 | P1 |
| X-07 | 穿戴→套装件数变化→效果重新计算 | 卸下1件后4件→3件, 4件套失效 | P0 |

### 4.3 强化→锻造→分解链路
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| X-08 | 强化后分解奖励增加 | enhanceBonus正确计算 | P0 |
| X-09 | 穿戴装备不可分解 | success=false | P0 |
| X-10 | 穿戴装备不可炼制 | valid=false | P0 |
| X-11 | 锻造产出装备自动进背包 | bag中存在新装备 | P1 |
| X-12 | 序列化→反序列化→属性重算 | 属性值完全恢复 | P0 |

---

## 维度五: F-DataLifecycle 数据生命周期 (8 branches)

### 5.1 序列化完整性
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| D-01 | serialize→deserialize 装备数据完整恢复 | 所有装备uid/rarity/slot一致 | P0 |
| D-02 | serialize→deserialize 背包容量恢复 | bagCapacity一致 | P1 |
| D-03 | serialize→deserialize 图鉴数据恢复 | codex entries一致 | P1 |

### 5.2 保底持久化
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| D-04 | ForgePityManager serialize→restore | 保底计数器恢复 | P0 |
| D-05 | ForgeForge serialize→deserialize | totalForgeCount恢复 | P1 |

### 5.3 状态一致性
| ID | 分支 | 预期 | 优先级 |
|----|------|------|--------|
| D-06 | reset()后所有状态清空 | bag/heroEquips/codex全清 | P0 |
| D-07 | 穿戴→序列化→反序列化→卸下 | 操作链完整 | P0 |
| D-08 | 分解→图鉴更新→序列化→恢复 | 图鉴保留分解记录 | P1 |

---

## 统计

| 维度 | 分支数 | P0 | P1 | P2 | P3 |
|------|--------|----|----|----|----|
| F-Normal | 18 | 10 | 8 | 0 | 0 |
| F-Boundary | 16 | 5 | 11 | 0 | 0 |
| F-Error | 14 | 7 | 7 | 0 | 0 |
| F-CrossSystem | 12 | 7 | 5 | 0 | 0 |
| F-DataLifecycle | 8 | 4 | 4 | 0 | 0 |
| **合计** | **68** | **33** | **35** | **0** | **0** |
