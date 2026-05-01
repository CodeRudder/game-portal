# R1: Formation 编队模块 — 挑战报告 (Challenger)

> Challenger: 对 Builder 分支树进行五维度质疑

## 总体评估
- 覆盖率评分: **7.2/10**
- 发现遗漏数: **23**
- P0遗漏: 3, P1遗漏: 12, P2遗漏: 8

---

## 维度分析

### F-Normal: 主线流程完整性

**遗漏1 [P0] setFormation不检查武将互斥 — 跨编队重复武将注入**
- Builder的T6.2.3仅标注了"setFormation不检查互斥"，但未给出具体测试用例
- `setFormation(id, ['hero1'])` 可直接设置武将列表，**绕过 addToFormation 的互斥检查**
- 场景：编队A有hero1，`setFormation('B', ['hero1'])` 成功 → hero1同时出现在两个编队
- 建议：`it('should detect hero in multiple formations after setFormation bypass')`

**遗漏2 [P1] autoFormation空候选列表时的编队副作用**
- T5.2.4标注"空候选列表→null"，但 autoFormationByIds 内部先调用 `createFormation`
- 如果编队不存在，会先创建编队再返回null → **创建了空编队但返回失败**
- 建议：`it('should not create formation when autoFormationByIds returns null due to empty candidates')`

**遗漏3 [P1] deleteFormation后武将互斥状态释放**
- 删除编队后，该编队中的武将应可加入其他编队
- Builder的T2.3.2提到了"移除后添加到其他编队"，但那是removeFromFormation
- 删除整个编队是不同路径：`deleteFormation` 内部直接 `delete this.state.formations[id]`
- 建议：`it('should allow hero to join another formation after its formation is deleted')`

**遗漏4 [P1] renameFormation空字符串/特殊字符处理**
- T1.5.2只测了10字符截断，未测空字符串名称
- `renameFormation('1', '')` → name='' 是否合法？
- 建议：`it('should handle empty string rename')`

### F-Boundary: 边界条件覆盖

**遗漏5 [P0] setFormation传入超过6个武将时的精确行为**
- T1.3.2说"截断"，但 FIX-302 的过滤逻辑是先filter再slice
- 输入 `[null, 'a', undefined, '', 'b', 'c', 'd', 'e', 'f', 'g']` → filter后7个 → slice(0,6) → 6个
- 输入 `['a', null, 'b']` → filter后2个 → 正确
- 需验证混合null/undefined/有效值的边界
- 建议：`it('should handle mixed null/undefined/valid IDs in setFormation')`

**遗漏6 [P1] maxFormations边界：setMaxFormations(3)不变、setMaxFormations(0)**
- T6.3.3说"不能低于3"，但代码是 `Math.min(Math.max(max, MAX_FORMATIONS), 5)`
- `setMaxFormations(0)` → Math.max(0,3)=3 → Math.min(3,5)=3 → 无变化
- `setMaxFormations(2)` → Math.max(2,3)=3 → 同上
- `setMaxFormations(6)` → Math.max(6,3)=6 → Math.min(6,5)=5 → 被限制到5
- 需测试这些边界
- 建议：`it('should clamp maxFormations between 3 and 5')`

**遗漏7 [P1] FormationRecommendSystem中0个武将的评分**
- T7.2.4标注空列表→空方案，但calculateScore中 `selected.length === 0 → return 0`
- 如果只有1个武将但recommendedPower极大 → powerScore可能极低
- 建议：`it('should handle single hero recommendation against high difficulty stage')`

**遗漏8 [P2] DefenseFormationSystem中slots长度不为5**
- T8.2.1验证了正确阵位数，但setFormation的参数类型是 `[string, string, string, string, string]`（元组）
- 如果传入长度不为5的数组会怎样？TypeScript编译期会拦截，但运行时呢？
- 建议：`it('should validate formation slots length at runtime')`

**遗漏9 [P2] autoFormation(battle)中全部单位isAlive=false**
- T5.1.2说空列表→空结果，但如果units不为空但全部dead呢？
- `valid = units.filter(u => u.isAlive).slice(0,6)` → 空数组
- 建议：`it('should return empty result when all units are dead')`

### F-Error: 异常路径覆盖

**遗漏10 [P0] deserialize恶意数据注入**
- T4.2.2测了null/undefined state，但未测恶意数据
- 如果 `data.state.formations` 包含 `__proto__` 或 `constructor`？
- `Object.entries()` 能遍历原型链属性吗？→ 不能，`Object.entries` 只返回自身可枚举属性
- 但如果formations是一个数组呢？`Object.entries(['a','b'])` → [['0','a'],['1','b']]
- 如果activeFormationId指向不存在的编队呢？
- 建议：`it('should handle deserialize with activeFormationId pointing to non-existent formation')`

**遗漏11 [P1] prerequisites.spendCopper竞态条件**
- T1.1.8测了扣费失败，但getCopperBalance和spendCopper之间有时间窗口
- 虽然JS单线程，但如果prerequisites实现中getCopperBalance检查后、spendCopper前有异步操作？
- 建议：`it('should handle spendCopper failure after balance check passes')`

**遗漏12 [P1] calculateFormationPower中calcPower返回NaN/Infinity**
- T3.1.1测了正常计算，但未测calcPower返回异常值
- `NaN + 100 = NaN` → `Math.floor(NaN) = NaN` → 编队战力为NaN
- 建议：`it('should handle NaN from calcPower gracefully')`

**遗漏13 [P1] FormationRecommendSystem.recommend中calculatePower返回负数**
- T7.3.1测了正常评分，但如果calculatePower返回负数？
- `sorted` 按降序排列，负数排后面 → 影响方案选择
- 建议：`it('should handle negative power values in recommendation')`

**遗漏14 [P2] DefenseFormationSystem.setFormation抛出异常**
- T8.1.2说"至少1名武将"，代码是 `throw new Error('防守阵容至少需要1名武将')`
- 需验证异常消息内容和类型
- 建议：`it('should throw error with correct message when no heroes in defense formation')`

### F-Cross: 跨系统交互覆盖

**遗漏15 [P1] 编队→远征系统链路**
- 远征系统有独立的FormationType（expedition-formation.types.ts）
- 编队数据如何映射到远征阵型？FormationType.STANDARD/OFFENSIVE等
- 建议：`it('should map hero formation to expedition formation type')`

**遗漏16 [P1] 编队→PvP竞技场链路**
- DefenseFormationSystem使用不同的FormationType枚举（pvp.types.ts的FISH_SCALE等）
- 与HeroFormation的编队数据如何关联？
- 建议：`it('should convert hero formation to PvP defense formation')`

**遗漏17 [P1] 编队→战役系统链路**
- campaign章节配置中引用了编队
- 编队武将变化后，正在进行的战役是否受影响？
- 建议：`it('should reflect formation changes in active campaign battle')`

**遗漏18 [P2] 编队→引导系统**
- guide-config.ts引用了编队
- 引导流程中的编队操作是否有特殊处理？
- 建议：`it('should handle formation operations during tutorial guide')`

**遗漏19 [P2] 编队→地图驻防**
- GarrisonSystem使用编队数据
- 驻防编队与普通编队的关系
- 建议：`it('should handle garrison formation assignment')`

### F-Lifecycle: 数据生命周期覆盖

**遗漏20 [P1] 序列化→修改→反序列化一致性**
- T4.2.3测了恢复后操作一致性，但未测"序列化→修改原对象→反序列化→验证"
- 关键：序列化返回的深拷贝是否真的独立？
- 建议：`it('should ensure serialized data is independent from source state')`

**遗漏21 [P1] 存档迁移中编队数据兼容性**
- engine-save-migration.ts处理编队版本迁移
- 旧版本存档（无formation字段）→ 新版本的迁移路径
- 建议：`it('should migrate save data without formation field to default state')`

**遗漏22 [P2] DefenseFormationSystem日志老化**
- T8.3.2测了最多50条，但未测"已有50条→添加新日志→最老的被丢弃"
- 建议：`it('should discard oldest log when exceeding MAX_DEFENSE_LOGS')`

**遗漏23 [P2] FormationRecommendSystem阵营为空字符串**
- T7.4.1测了同阵营优先，但武将faction为空字符串时的分组行为
- 建议：`it('should handle heroes with empty faction string')`

---

## 建议新增的测试用例 (按优先级排序)

### P0 (阻塞级)
1. `setFormation`绕过互斥检查导致同一武将在多编队
2. `setFormation`混合null/undefined/有效ID的过滤边界
3. `deserialize`中activeFormationId指向不存在编队

### P1 (严重)
4. `autoFormationByIds`空候选时创建编队副作用
5. `deleteFormation`后武将互斥状态释放
6. `renameFormation`空字符串处理
7. `setMaxFormations`边界值测试
8. `calculateFormationPower`中calcPower返回NaN
9. `FormationRecommendSystem`负数战力处理
10. 编队→远征系统映射
11. 编队→PvP防守转换
12. 编队→战役系统联动
13. 序列化数据独立性验证
14. 存档迁移兼容性
15. `spendCopper`竞态条件

### P2 (一般)
16. DefenseFormation slots运行时长度校验
17. autoFormation(battle)全部dead单位
18. DefenseFormation异常消息验证
19. 编队→引导系统交互
20. 编队→地图驻防
21. DefenseFormationSystem日志老化
22. FormationRecommendSystem空阵营处理
23. 单武将对高难度关卡推荐

---

## 维度覆盖均衡度

| 维度 | 遗漏数 | 覆盖评估 |
|------|--------|---------|
| F-Normal | 4 | ⚠️ 主线互斥绕过是P0 |
| F-Boundary | 5 | ⚠️ 混合值过滤是P0 |
| F-Error | 5 | ⚠️ 恶意反序列化是P0 |
| F-Cross | 5 | 跨系统链路缺失较多 |
| F-Lifecycle | 4 | 存档迁移未覆盖 |

**均衡度**: 0.72（F-Cross和F-Lifecycle偏弱）
