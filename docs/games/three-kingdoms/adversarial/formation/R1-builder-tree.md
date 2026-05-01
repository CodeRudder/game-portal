# R1: Formation 编队模块 — 测试分支树 (Builder)

> Builder: 基于 HeroFormation.ts / FormationRecommendSystem.ts / DefenseFormationSystem.ts / autoFormation.ts 源码构建

## 模块范围

| 子模块 | 文件 | 行数 | 职责 |
|--------|------|------|------|
| HeroFormation | engine/hero/HeroFormation.ts | 445 | 核心编队CRUD、武将上下阵、激活切换、战力计算、一键布阵 |
| FormationRecommendSystem | engine/hero/FormationRecommendSystem.ts | 338 | 关卡特性分析、推荐1~3个编队方案 |
| DefenseFormationSystem | engine/pvp/DefenseFormationSystem.ts | 321 | PvP防守阵容管理、AI策略、防守日志 |
| autoFormation (battle) | engine/battle/autoFormation.ts | 76 | 战斗前排/后排自动布阵 |
| formation-types | engine/hero/formation-types.ts | 74 | 类型定义、常量 |

---

## 测试分支树

### T1: 编队创建/编辑/删除 (HeroFormation CRUD)

```
T1-ROOT: 编队生命周期
├── T1.1 创建编队
│   ├── T1.1.1 自动分配ID（'1'→'2'→'3'）
│   ├── T1.1.2 指定ID创建
│   ├── T1.1.3 重复ID创建 → null
│   ├── T1.1.4 达到MAX_FORMATIONS(3)上限 → null
│   ├── T1.1.5 动态上限setMaxFormations(5)扩展
│   ├── T1.1.6 前置条件：主城等级不足 → null
│   ├── T1.1.7 前置条件：铜钱不足 → null
│   ├── T1.1.8 前置条件：扣费失败 → null
│   ├── T1.1.9 无前置条件时跳过检查
│   └── T1.1.10 自动激活第一个编队
├── T1.2 获取编队
│   ├── T1.2.1 按ID获取
│   ├── T1.2.2 不存在ID → null
│   ├── T1.2.3 获取所有编队
│   └── T1.2.4 返回数据不可变性（深拷贝）
├── T1.3 设置编队武将列表
│   ├── T1.3.1 正常设置
│   ├── T1.3.2 超过MAX_SLOTS_PER_FORMATION截断
│   ├── T1.3.3 null/undefined/空字符串过滤 (FIX-302)
│   └── T1.3.4 不存在的编队 → null
├── T1.4 删除编队
│   ├── T1.4.1 正常删除
│   ├── T1.4.2 删除不存在的编队 → false
│   ├── T1.4.3 删除当前激活编队 → 切换到剩余第一个
│   └── T1.4.4 删除最后一个编队 → activeFormationId=null
├── T1.5 重命名
│   ├── T1.5.1 正常重命名
│   ├── T1.5.2 超过10字符截断
│   └── T1.5.3 不存在的编队 → null
└── T1.6 重置
    └── T1.6.1 reset()清空所有状态
```

### T2: 武将上阵/下阵/位置调整

```
T2-ROOT: 武将上下阵
├── T2.1 添加武将 (addToFormation)
│   ├── T2.1.1 添加到第一个空位
│   ├── T2.1.2 连续添加多个武将
│   ├── T2.1.3 重复添加同一武将到同编队 → null
│   ├── T2.1.4 同一武将已在其他编队 → null（互斥）
│   ├── T2.1.5 编队已满(6人) → null
│   ├── T2.1.6 不存在的编队 → null
│   ├── T2.1.7 null/undefined/空字符串武将ID → null (FIX-302)
│   └── T2.1.8 非string类型武将ID → null
├── T2.2 移除武将 (removeFromFormation)
│   ├── T2.2.1 正常移除
│   ├── T2.2.2 移除后留下空位
│   ├── T2.2.3 移除不存在的武将 → null
│   ├── T2.2.4 不存在的编队 → null
│   └── T2.2.5 null/undefined/空字符串武将ID → null
├── T2.3 位置调整
│   ├── T2.3.1 移除后重新添加到同编队
│   ├── T2.3.2 移除后添加到其他编队
│   └── T2.3.3 中间位置移除后空位填充逻辑
└── T2.4 查询
    ├── T2.4.1 isGeneralInAnyFormation
    ├── T2.4.2 getFormationsContainingGeneral
    ├── T2.4.3 getFormationMemberCount
    └── T2.4.4 空编队查询
```

### T3: 羁绊激活/失效

```
T3-ROOT: 羁绊与编队战力
├── T3.1 战力计算 (calculateFormationPower)
│   ├── T3.1.1 正常计算（基础战力求和）
│   ├── T3.1.2 空编队 → 0
│   ├── T3.1.3 武将不存在（getGeneral返回undefined）→ 跳过
│   ├── T3.1.4 羁绊加成：每羁绊+5%
│   ├── T3.1.5 无prerequisites时无羁绊加成
│   └── T3.1.6 Math.floor取整
├── T3.2 羁绊回调
│   ├── T3.2.1 getActiveBondCount正常返回
│   └── T3.2.2 prerequisites为null时bondCount=0
└── T3.3 FORMATION_BOND_BONUS_RATE常量
    └── T3.3.1 验证值为0.05
```

### T4: 编队保存/加载

```
T4-ROOT: 序列化与反序列化
├── T4.1 序列化 (serialize)
│   ├── T4.1.1 正常序列化（含编队数据+activeFormationId）
│   ├── T4.1.2 空状态序列化
│   ├── T4.1.3 深拷贝验证（序列化数据不影响内部状态）
│   └── T4.1.4 version字段为1
├── T4.2 反序列化 (deserialize)
│   ├── T4.2.1 正常恢复
│   ├── T4.2.2 null/undefined state → 空状态
│   ├── T4.2.3 恢复后操作一致性
│   └── T4.2.4 深拷贝验证（反序列化数据不影响原始数据）
└── T4.3 存档链路
    ├── T4.3.1 engine-save.ts中的formation字段序列化
    └── T4.3.2 engine-save-migration.ts中的版本迁移
```

### T5: 编队→战斗链路

```
T5-ROOT: 编队到战斗
├── T5.1 autoFormation (battle)
│   ├── T5.1.1 正常布阵：防御最高3人前排
│   ├── T5.1.2 空单位列表 → 空结果
│   ├── T5.1.3 同防御按HP降序
│   ├── T5.1.4 少于3人时前排数量调整
│   ├── T5.1.5 最多6人限制
│   ├── T5.1.6 isAlive过滤
│   └── T5.1.7 布阵评分计算
├── T5.2 一键布阵 (HeroFormation.autoFormationByIds)
│   ├── T5.2.1 按战力降序选前maxSlots个
│   ├── T5.2.2 allowOverlap=false排除已在编队中的武将
│   ├── T5.2.3 allowOverlap=true允许重叠
│   ├── T5.2.4 空候选列表 → null
│   ├── T5.2.5 自动创建不存在的编队
│   └── T5.2.6 无效武将过滤（getGeneral返回undefined）
└── T5.3 集成链路
    ├── T5.3.1 编队数据→BattleTeam转换
    └── T5.3.2 空编队→战斗启动拒绝
```

### T6: 多编队管理

```
T6-ROOT: 多编队
├── T6.1 编队切换
│   ├── T6.1.1 setActiveFormation正常切换
│   ├── T6.1.2 切换到不存在的编队 → false
│   └── T6.1.3 切换后getActiveFormation返回新编队
├── T6.2 武将互斥
│   ├── T6.2.1 同一武将不可在多个编队
│   ├── T6.2.2 从编队A移除后可加入编队B
│   └── T6.2.3 setFormation不检查互斥（仅addToFormation检查）
├── T6.3 编队上限管理
│   ├── T6.3.1 默认MAX_FORMATIONS=3
│   ├── T6.3.2 setMaxFormations扩展到5
│   ├── T6.3.3 setMaxFormations不能低于MAX_FORMATIONS(3)
│   └── T6.3.4 setMaxFormations不能超过5
└── T6.4 ID分配
    ├── T6.4.1 自动分配'1'→'2'→'3'
    └── T6.4.2 删除后ID重用
```

### T7: 编队推荐系统 (FormationRecommendSystem)

```
T7-ROOT: 编队推荐
├── T7.1 关卡特性分析 (analyzeStage)
│   ├── T7.1.1 normal关卡难度1~5
│   ├── T7.1.2 elite关卡难度4~8
│   ├── T7.1.3 boss关卡难度7~10
│   └── T7.1.4 recommendedPower影响难度
├── T7.2 推荐方案生成
│   ├── T7.2.1 最强战力方案
│   ├── T7.2.2 平衡方案（>2武将时）
│   ├── T7.2.3 羁绊优先方案（>3武将时）
│   ├── T7.2.4 空武将列表 → 空方案
│   └── T7.2.5 null/undefined武将列表防护
├── T7.3 评分计算
│   ├── T7.3.1 四维加权(战力40%+品质25%+覆盖20%+羁绊15%)
│   └── T7.3.2 分数上限100
└── T7.4 阵营分组
    ├── T7.4.1 同阵营优先选择
    └── T7.4.2 不足时用其他阵营补充
```

### T8: 防守阵容系统 (DefenseFormationSystem)

```
T8-ROOT: PvP防守阵容
├── T8.1 阵容管理
│   ├── T8.1.1 创建默认阵容
│   ├── T8.1.2 设置阵容（至少1名武将）
│   ├── T8.1.3 设置阵型
│   ├── T8.1.4 设置AI策略
│   └── T8.1.5 创建快照
├── T8.2 验证
│   ├── T8.2.1 正确的阵位数(5)
│   ├── T8.2.2 至少1名武将
│   ├── T8.2.3 武将不重复
│   ├── T8.2.4 合法阵型
│   └── T8.2.5 合法AI策略
├── T8.3 防守日志
│   ├── T8.3.1 添加日志
│   ├── T8.3.2 最多50条
│   └── T8.3.3 按进攻方查询
├── T8.4 AI策略建议
│   ├── T8.4.1 胜率<30%建议坚守
│   ├── T8.4.2 胜率30~50%建议均衡
│   └── T8.4.3 不足5场不给建议
└── T8.5 序列化
    ├── T8.5.1 序列化防守数据
    └── T8.5.2 反序列化恢复
```

---

## 统计

| 维度 | 节点数 | 已有测试覆盖 |
|------|--------|-------------|
| T1: CRUD | 22 | ✅ HeroFormation.test.ts |
| T2: 武将上下阵 | 18 | ✅ HeroFormation.test.ts |
| T3: 羁绊/战力 | 9 | ✅ HeroFormation.test.ts |
| T4: 序列化 | 10 | ✅ HeroFormation.test.ts |
| T5: 战斗链路 | 14 | ✅ autoFormation.test.ts + integration |
| T6: 多编队 | 12 | ⚠️ 部分覆盖 |
| T7: 推荐 | 12 | ✅ FormationRecommendSystem.test.ts |
| T8: PvP防守 | 16 | ⚠️ 无独立测试文件 |
| **总计** | **113** | |

## 现有测试覆盖分析

| 测试文件 | 用例数 | 覆盖范围 |
|----------|--------|---------|
| HeroFormation.test.ts | ~35 | T1+T2+T3+T4+T6 |
| HeroFormation.autoFormation.test.ts | ~10 | T5.2 |
| FormationRecommendSystem.test.ts | ~20 | T7 |
| autoFormation.test.ts | ~10 | T5.1 |
| DEF-009-autoFormation.test.ts | ~5 | T5.1补充 |
| chain2 integration | ~12 | T5.3 |
