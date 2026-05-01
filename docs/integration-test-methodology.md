# 三国霸业 — 分段式集成测试方法论

> **版本**: v1.0  
> **日期**: 2025-07-11  
> **目标**: 系统性枚举所有游戏流程，拆分为可独立验证的流程段，通过组合测试确保系统完整性和正确性

---

## 一、方法论概述

### 1.1 核心问题

传统集成测试的三大盲区：

| 盲区 | 表现 | 后果 |
|------|------|------|
| **流程断裂** | A系统输出 ≠ B系统输入 | 玩家卡在某个流程无法继续 |
| **资源割裂** | 同名资源在不同系统中不是同一份 | 商店铜钱 ≠ 生产铜钱 |
| **边界缺失** | 只测中间态，不测 0→max 全链路 | 升级5级后数值溢出或归零 |

**根本原因**：测试按"子系统"维度组织，而非按"玩家实际操作流程"维度组织。

### 1.2 方法论核心思想

```
玩家体验 = 流程段 F1 → F2 → F3 → ... → Fn（有序组合）

每个流程段 Fi：
  - 有明确的「前置状态」（进入条件）
  - 有明确的「操作步骤」（玩家行为）
  - 有明确的「后置状态」（预期结果）
  - 可独立测试（通过直接设置前置状态跳过前面的流程）
  - 可组合测试（F1→F2→F3 端到端验证）
```

### 1.3 方法论四步法

```
Step 1: 流程枚举 — 从玩家视角穷举所有游戏流程
Step 2: 流程拆分 — 将长流程切分为独立的流程段
Step 3: 流程段测试 — 每段独立编写测试，验证段内正确性
Step 4: 组合测试 — 多段组合验证跨段衔接
```

---

## 二、Step 1: 流程枚举 — 从玩家视角穷举

### 2.1 枚举方法：玩家旅程地图

从三种视角枚举流程，取并集：

| 视角 | 枚举方式 | 示例 |
|------|---------|------|
| **时间线视角** | 按玩家从第1分钟到第100天的体验顺序 | 开局→建造→招募→征战→... |
| **系统视角** | 按子系统枚举每个"入口→出口" | 商店入口→选择商品→支付→获得物品 |
| **异常视角** | 枚举每个"失败/阻断"场景 | 资源不足→升级失败→提示→获取资源→重试 |

### 2.2 三国霸业完整流程枚举

#### A. 核心生存线（P0 — 必须畅通无阻）

| 编号 | 流程名称 | 起点 | 终点 | 涉及系统 |
|------|---------|------|------|---------|
| **FL-01** | 开局初始化 | 新游戏 | 初始资源+建筑+引导 | Engine/Resource/Building/Guide |
| **FL-02** | 资源生产循环 | 建筑存在 | 资源持续产出 | Building/Resource/Calendar |
| **FL-03** | 建筑升级链 | 资源充足 | 建筑升级完成+产出变化 | Resource/Building/Event |
| **FL-04** | 武将招募链 | 招贤令充足 | 获得武将+可编队 | Resource/Hero/Formation |
| **FL-05** | 编队组建链 | 有武将 | 编队激活+可出战 | Hero/Formation/Bond |
| **FL-06** | 关卡征战链 | 编队就绪 | 战斗完成+奖励发放+进度推进 | Formation/Battle/Campaign/Reward/Resource |
| **FL-07** | 存档恢复链 | 游戏中任意状态 | 保存→关闭→加载→状态完全恢复 | Save/All |

#### B. 经济循环线（P1 — 核心养成循环）

| 编号 | 流程名称 | 起点 | 终点 | 涉及系统 |
|------|---------|------|------|---------|
| **FL-08** | 铜钱获取→消费循环 | 产出铜钱 | 在商店消费铜钱 | Resource/Currency/Shop |
| **FL-09** | 商店购买→使用链 | 铜钱/货币充足 | 购买物品→使用物品 | Shop/Currency/Equipment/Hero |
| **FL-10** | 装备获取→装备→强化链 | 获得装备 | 装备到武将→强化提升 | Equipment/Hero/Resource |
| **FL-11** | 武将升级→升星→觉醒链 | 有武将 | 等级提升→星级提升→觉醒 | Hero/Resource/Bond |
| **FL-12** | 科技研究→加成应用链 | 科技点充足 | 研究完成→产出加成生效 | Tech/Resource/Building |

#### C. 扩展玩法线（P2 — 中后期内容）

| 编号 | 流程名称 | 起点 | 终点 | 涉及系统 |
|------|---------|------|------|---------|
| **FL-13** | 天下Tab领土征战链 | 有兵力 | 相邻判断→攻城→占领→驻防 | Map/Territory/Siege/Garrison/Resource |
| **FL-14** | 远征派遣→收益链 | 有空闲武将 | 派遣→等待→领取收益 | Expedition/Hero/Resource |
| **FL-15** | PvP竞技链 | 有编队 | 挑战→积分→段位→奖励 | PvP/Battle/Ranking/Resource |
| **FL-16** | 联盟玩法链 | 加入联盟 | 捐献→Boss→任务→商店 | Alliance/Resource/Shop |
| **FL-17** | 活动参与链 | 活动开启 | 签到→获得代币→商店兑换 | Activity/SignIn/Currency/Shop |
| **FL-18** | 声望→转生链 | 声望达标 | 转生→永久加成→重新开始 | Prestige/Rebirth/Resource |

#### D. 辅助系统线（P3 — 辅助体验）

| 编号 | 流程名称 | 起点 | 终点 | 涉及系统 |
|------|---------|------|------|---------|
| **FL-19** | 离线收益链 | 下线 | 上线→计算收益→领取 | Offline/Resource/Mail |
| **FL-20** | 邮件→奖励领取链 | 收到邮件 | 读取→领取附件 | Mail/Resource |
| **FL-21** | 任务完成→领奖链 | 条件达成 | 任务完成→领取奖励 | Quest/Resource |
| **FL-22** | 成就解锁链 | 条件达成 | 成就解锁→奖励 | Achievement/Resource |
| **FL-23** | 引导教程链 | 首次进入 | 步骤推进→完成→奖励 | Guide/Tutorial/Resource |
| **FL-24** | NPC互动链 | 遇到NPC | 送礼→好感→对话→任务→奖励 | NPC/Event/Quest/Resource |

---

## 三、Step 2: 流程拆分 — 切分为独立可测的流程段

### 3.1 拆分原则

**核心原则：每个流程段必须满足以下条件**

```
流程段 Fi = {
  前置状态: PreState,    // 可通过直接设置数据达到
  操作步骤: Actions,     // 1~5步玩家操作
  后置断言: PostState,   // 可明确验证的结果
  副作用:   SideEffects  // 跨系统的影响
}
```

**拆分粒度标准：**

| 粒度 | 操作步数 | 适用场景 |
|------|---------|---------|
| **原子段** | 1步操作 | 单个系统调用（如"消耗铜钱"） |
| **微流程** | 2~3步 | 单系统内完整操作（如"购买商品"） |
| **小流程** | 3~5步 | 跨2~3个系统（如"购买并装备武器"） |
| **中流程** | 5~10步 | 跨3~5个系统（如"招募→编队→战斗→领奖"） |
| **大流程** | 10+步 | 完整游戏体验（如"新手0→中期玩家"） |

**推荐粒度：以「小流程」为主（3~5步，跨2~3系统），这是集成测试性价比最高的粒度。**

### 3.2 拆分示例：FL-06 关卡征战链

原始流程：编队就绪 → 选择关卡 → 战斗 → 胜利 → 发放奖励 → 推进进度 → 解锁下一关

拆分为：

```
F6a: 编队就绪验证
  前置: 有武将（直接 addHeroDirectly）
  操作: createFormation('main') → setFormation('main', ['liubei','guanyu','zhangfei'])
  断言: getActiveFormation() 不为空，编队含3名武将

F6b: 关卡可挑战验证
  前置: 有编队（直接设置编队数据）
  操作: getStageList() → canChallenge(stageId)
  断言: 第一个关卡可挑战，未通关关卡不可挑战

F6c: 战斗执行验证
  前置: 编队就绪 + 关卡可挑战（直接设置前置状态）
  操作: startBattle(stageId)
  断言: 返回 BattleResult，含 outcome/stars/damage 等字段

F6d: 奖励发放验证
  前置: 战斗已完成（直接调用 startBattle）
  操作: completeBattle(stageId, 3)
  断言: 资源增加、碎片增加、经验增加（精确验证增量）

F6e: 进度推进验证
  前置: completeBattle 已执行
  操作: getCampaignProgress()
  断言: 关卡标记为已通关、下一关卡解锁
```

### 3.3 拆分示例：FL-10 装备获取→装备→强化链

```
F10a: 装备生成验证
  前置: 引擎已初始化
  操作: generateEquipment('weapon', 'rare', 'forge')
  断言: 装备有 uid/slot/rarity/stats，数值在合理范围

F10b: 装备入包验证
  前置: 有装备实例（直接生成）
  操作: addToBag(equipment)
  断言: getAllEquipments() 包含该装备，isBagFull() 为 false

F10c: 装备到武将验证
  前置: 有武将 + 背包有装备（直接设置两者）
  操作: equipItem('liubei', equipment.uid)
  断言: getHeroEquips('liubei').weapon === equipment.uid
         背包中装备标记为已装备

F10d: 卸下装备验证
  前置: 武将已装备武器（直接设置装备状态）
  操作: unequipItem('liubei', 'weapon')
  断言: getHeroEquips('liubei').weapon === null
         装备回到背包且标记为未装备

F10e: 装备强化验证
  前置: 背包有装备 + 铜钱充足（直接设置）
  操作: enhance(equipment.uid)
  断言: 装备等级+1、属性提升、铜钱减少
```

### 3.4 拆分示例：FL-08 铜钱获取→消费循环

这个问题揭示了最关键的断裂类型——**同名资源割裂**：

```
F08a: 建筑产出铜钱验证
  前置: 市集存在（upgradeBuilding('market')）
  操作: fastForward(60000) — 快进60秒
  断言: gold 数量增加，增量 = 市集产出速率 × 60

F08b: 关卡奖励铜钱验证
  前置: 有编队 + 可挑战关卡
  操作: startBattle(stageId) → completeBattle(stageId, 3)
  断言: gold 数量增加，增量 = 关卡奖励表中的 gold 数值

F08c: 商店消耗铜钱验证
  前置: gold 充足（直接 addResource）
  操作: shop.executeBuy({ shopType:'normal', defId:'xxx', count:1 })
  断言: gold 减少，减少量 = 商品价格

F08d: 铜钱循环验证（组合测试）
  前置: 市集Lv1
  操作: fastForward(60s) → 记录 gold → shop.executeBuy() → 检查 gold
  断言: 产出的 gold 和消费的 gold 是同一份资源（同一 getAmount('gold')）
```

---

## 四、Step 3: 流程段测试 — 每段独立编写测试

### 4.1 测试编写模板

每个流程段的测试遵循统一模板：

```typescript
describe('流程段 F{xx}{字母}: {名称}', () => {
  // ============================================
  // 段描述
  // ============================================
  // 前置状态: ...
  // 操作步骤: ...
  // 预期结果: ...
  // 涉及系统: ...
  // ============================================

  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
    engine.init();
  });

  afterEach(() => {
    engine.reset();
  });

  // --- 辅助函数：设置前置状态 ---
  function setupPreState() {
    // 直接设置数据，跳过前置流程
  }

  it('正常路径: {具体场景}', () => {
    setupPreState();
    // 执行操作
    // 断言结果
  });

  it('边界条件: {具体边界}', () => {
    setupPreState();
    // 设置边界值
    // 执行操作
    // 断言结果
  });

  it('异常路径: {具体异常}', () => {
    setupPreState();
    // 设置异常条件
    // 执行操作
    // 断言错误处理
  });
});
```

### 4.2 前置状态设置策略

**核心原则：前置状态通过直接设置数据达到，不依赖前置流程的执行。**

| 策略 | 适用场景 | 实现方式 |
|------|---------|---------|
| **资源注入** | 需要资源充足 | `addResources({ grain: 999999, gold: 999999 })` |
| **建筑直达** | 需要建筑等级 | `upgradeBuildingTo('castle', 5)` |
| **武将直达** | 需要武将存在 | `addHeroDirectly('liubei')` |
| **编队直达** | 需要编队就绪 | `createFormation('main')` + `setFormation(...)` |
| **关卡直达** | 需要关卡进度 | 直接调用 `completeStage()` |
| **存档直达** | 需要特定游戏状态 | 构造 JSON → `deserialize()` |
| **Simulator快捷** | 需要中期状态 | `initMidGameState()` |

### 4.3 断言强度分级

| 级别 | 名称 | 断言方式 | 适用场景 |
|------|------|---------|---------|
| **L1 弱断言** | `toBeDefined()`, `toBeTruthy()` | 仅验证存在性 | 快速冒烟测试 |
| **L2 中断言** | `toBeGreaterThan(0)`, `toContain()` | 验证方向正确 | 基本功能验证 |
| **L3 强断言** | `toBe(精确值)`, `toEqual(精确对象)` | 精确验证数值 | **集成测试必须** |
| **L4 不变断言** | `expect(后 - 前).toBe(增量)` | 验证变化量 | 资源/经验类验证 |
| **L5 跨系统断言** | A系统视角验证B系统状态 | 交叉验证 | **断裂检测核心** |

**规则：集成测试中，所有涉及数值的断言必须达到 L3 以上。L5 是检测断裂的关键。**

### 4.4 L5 跨系统断言示例

```typescript
// ❌ 弱断言 — 只验证了商店自身
it('购买成功', () => {
  const result = shop.executeBuy(request);
  expect(result.success).toBe(true);
});

// ✅ L5 跨系统断言 — 验证商店→资源→背包的完整链路
it('购买武器→铜钱扣减→装备入包→可装备到武将', () => {
  const goldBefore = engine.getResourceAmount('gold');
  const bagBefore = engine.getEquipmentSystem().getAllEquipments();

  // Step 1: 购买
  const result = shop.executeBuy({ shopType:'normal', defId:'weapon_rare', count:1 });
  expect(result.success).toBe(true);

  // Step 2: 验证铜钱扣减（跨系统：Shop → Resource）
  const goldAfter = engine.getResourceAmount('gold');
  expect(goldBefore - goldAfter).toBe(result.cost.gold);

  // Step 3: 验证装备入包（跨系统：Shop → Equipment）
  const bagAfter = engine.getEquipmentSystem().getAllEquipments();
  expect(bagAfter.length).toBe(bagBefore.length + 1);

  // Step 4: 验证可装备（跨系统：Shop → Equipment → Hero）
  const newEquip = bagAfter[bagAfter.length - 1];
  engine.getEquipmentSystem().equipItem('liubei', newEquip.uid);
  expect(engine.getEquipmentSystem().getHeroEquips('liubei').weapon).toBe(newEquip.uid);
});
```

---

## 五、Step 4: 组合测试 — 多段衔接验证

### 5.1 组合策略

组合测试的核心是验证 **流程段之间的衔接点**：

```
衔接点验证清单：
  □ Fi 的后置状态 == Fj 的前置状态？（数据一致性）
  □ Fi 的副作用是否被 Fj 正确感知？（事件传播）
  □ Fi 产生的资源是否可被 Fj 消费？（资源流通）
  □ Fi 产生的物品是否可被 Fj 使用？（物品流通）
```

### 5.2 组合测试类型

| 类型 | 范围 | 示例 |
|------|------|------|
| **邻接组合** | Fi → Fi+1 | 招募武将 → 编队 |
| **跳跃组合** | Fi → Fi+2..n | 商店购买 → 装备 → 强化 |
| **主线组合** | F1 → F2 → ... → Fn | 新手开局 → 建筑升级 → 招募 → 编队 → 战斗 |
| **分支组合** | Fi → Fj（非顺序） | 战斗获得装备 → 装备到武将 → 再战斗 |
| **循环组合** | Fi → Fj → Fi | 战斗 → 获得资源 → 升级建筑 → 再战斗 |
| **全链路组合** | 所有P0流程串联 | FL-01 → FL-07 全部 |

### 5.3 组合测试编写模式

```typescript
describe('组合测试: F4→F5→F6 招募→编队→征战完整链路', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
    engine.init();
    // 仅设置 F4 的前置状态（资源充足）
    addResources({ recruitToken: 100, gold: 50000 });
  });

  it('完整链路: 招募3名武将→组建编队→征战第一关→获得奖励', () => {
    // === F4: 招募武将 ===
    const recruitResult = engine.recruit('normal', 10);
    expect(recruitResult).toBeDefined();
    const generals = engine.getGenerals();
    expect(generals.length).toBeGreaterThanOrEqual(3);

    // === 衔接点验证: F4→F5 ===
    // 招募的武将可被编队系统识别
    const availableIds = generals.map(g => g.id);
    expect(availableIds.length).toBeGreaterThanOrEqual(3);

    // === F5: 组建编队 ===
    const formation = engine.createFormation('main');
    expect(formation).toBeDefined();
    const setted = engine.setFormation('main', availableIds.slice(0, 3));
    expect(setted.generalIds).toHaveLength(3);

    // === 衔接点验证: F5→F6 ===
    // 编队可被战斗系统使用
    const activeFormation = engine.getActiveFormation();
    expect(activeFormation).toBeDefined();
    expect(activeFormation!.generalIds).toHaveLength(3);

    // === F6a: 选择关卡 ===
    const stages = engine.getStageList();
    const firstStage = stages[0];
    expect(firstStage).toBeDefined();

    // === F6b: 战斗 ===
    const goldBefore = engine.getResourceAmount('gold');
    const battleResult = engine.startBattle(firstStage.id);
    expect(battleResult.outcome).toBeDefined();

    // === F6c: 完成战斗 + 奖励 ===
    engine.completeBattle(firstStage.id, 3);
    const goldAfter = engine.getResourceAmount('gold');

    // === L5 跨系统断言 ===
    // 战斗系统 → 资源系统：奖励已发放
    expect(goldAfter).toBeGreaterThan(goldBefore);
    // 战斗系统 → 关卡系统：进度已推进
    const progress = engine.getCampaignProgress();
    expect(progress.stageStates[firstStage.id].stars).toBe(3);
  });
});
```

### 5.4 针对已知断裂的组合测试

基于你提到的5个具体断裂问题，设计专项组合测试：

```typescript
describe('断裂验证 #1: 天下Tab领土征战流程', () => {
  it('领土相邻判断+兵力要求应在新手可达范围', () => {
    // 设置新手可达状态
    engine.initMidGameState(); // 或自定义中等状态
    const territories = engine.getTerritorySystem().getOwnedTerritories();
    const adjacent = engine.getTerritorySystem().getAdjacentTerritories(territories[0].id);
    // 断言: 相邻判断可执行且返回合理结果
    expect(adjacent).toBeDefined();
    expect(adjacent.length).toBeGreaterThan(0);
    // 断言: 兵力要求在新手范围
    const siegeCost = engine.getSiegeSystem().getSiegeCost(adjacent[0].id);
    expect(siegeCost.troops).toBeLessThan(engine.getResourceAmount('troops'));
  });
});

describe('断裂验证 #2: 建筑升级5级后完整性', () => {
  it('主城升级到5级: 资源消耗+产出变化+上限更新全链路', () => {
    engine.init();
    addMassiveResources(engine);

    for (let level = 1; level <= 5; level++) {
      const cost = engine.getUpgradeCost('castle');
      expect(cost).toBeDefined();
      // 关键断言: 升级消耗不超过当前资源
      expect(cost!.grain).toBeLessThanOrEqual(engine.getResourceAmount('grain'));

      const grainBefore = engine.getResourceAmount('grain');
      engine.upgradeBuilding('castle');
      engine.building.forceCompleteUpgrades();

      // L4 不变断言: 资源精确扣减
      expect(engine.getResourceAmount('grain')).toBe(grainBefore - cost!.grain);

      // L5 跨系统: 产出加成更新
      const bonus = engine.building.getCastleBonusMultiplier();
      expect(bonus).toBeGreaterThan(1);
    }
  });
});

describe('断裂验证 #3: 征战和军队创建', () => {
  it('创建编队→征战→战斗完整流程', () => {
    engine.init();
    engine.addHeroDirectly('liubei');
    engine.addHeroDirectly('guanyu');

    // 创建编队
    const formation = engine.createFormation('main');
    expect(formation).not.toBeNull(); // 断裂点: 编队创建是否成功

    engine.setFormation('main', ['liubei', 'guanyu']);
    expect(engine.getActiveFormation()).toBeDefined();

    // 征战
    const stages = engine.getStageList();
    const result = engine.startBattle(stages[0].id);
    expect(result).toBeDefined(); // 断裂点: 战斗是否可执行
    expect(result.outcome).toBeDefined();
  });
});

describe('断裂验证 #4: 铜钱统一性', () => {
  it('资源系统gold === 商店消费gold === 关卡奖励gold', () => {
    engine.init();
    engine.initMidGameState();

    // 验证1: 关卡奖励的gold进入资源系统
    const goldBefore = engine.getResourceAmount('gold');
    engine.startBattle(stageId);
    engine.completeBattle(stageId, 3);
    const goldAfterBattle = engine.getResourceAmount('gold');
    expect(goldAfterBattle).toBeGreaterThan(goldBefore);

    // 验证2: 商店消费的gold从资源系统扣除
    const shop = engine.getShopSystem();
    const goods = shop.getShopGoods('normal');
    const affordable = goods.find(g => g.price <= goldAfterBattle);
    if (affordable) {
      shop.executeBuy({ shopType:'normal', defId:affordable.defId, count:1 });
      expect(engine.getResourceAmount('gold')).toBeLessThan(goldAfterBattle);
    }
  });
});

describe('断裂验证 #5: 商店购买装备可装备', () => {
  it('商店购买武器→出现在背包→可装备到武将', () => {
    engine.init();
    engine.initMidGameState();

    const shop = engine.getShopSystem();
    const equipSys = engine.getEquipmentSystem();

    // 购买装备
    const goods = shop.getShopGoods('normal');
    const weapon = goods.find(g => g.category === 'equipment');
    const goldBefore = engine.getResourceAmount('gold');
    const bagBefore = equipSys.getAllEquipments().length;

    const result = shop.executeBuy({ shopType:'normal', defId:weapon.defId, count:1 });
    expect(result.success).toBe(true);

    // 断裂点1: 铜钱扣减
    expect(engine.getResourceAmount('gold')).toBeLessThan(goldBefore);

    // 断裂点2: 装备入包
    expect(equipSys.getAllEquipments().length).toBe(bagBefore + 1);

    // 断裂点3: 可装备到武将
    const newEquip = equipSys.getAllEquipments()[equipSys.getAllEquipments().length - 1];
    equipSys.equipItem('liubei', newEquip.uid);
    expect(equipSys.getHeroEquips('liubei').weapon).toBe(newEquip.uid);
  });
});
```

---

## 六、完整流程段清单（三国霸业实例）

### 6.1 P0 核心生存线流程段

#### FL-01 开局初始化

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F01a | 初始资源验证 | `new Engine()` | `init()` | grain=500, gold=300, troops=50 |
| F01b | 初始建筑验证 | `init()` | `getBuildingLevel()` | castle=1, farmland=1, 其余=0 |
| F01c | 初始武将验证 | `init()` | `getGenerals()` | 空列表或含初始武将 |
| F01d | 引导触发验证 | `init()` | `getTutorialStateMachine()` | 处于第一步 |

#### FL-02 资源生产循环

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F02a | 基础产出验证 | `init()` | `fastForward(60000)` | grain增加（基础速率×60） |
| F02b | 建筑加成验证 | 农田Lv2 | `fastForward(60000)` | grain增量 > 基础速率×60 |
| F02c | 主城加成验证 | 主城Lv3 | `fastForward(60000)` | 产出含castle加成系数 |
| F02d | 上限截断验证 | grain接近上限 | `fastForward(大时间)` | grain ≤ 上限 |
| F02e | 产出速率为0的资源 | `init()` | `fastForward(60000)` | gold/troops不因tick增加 |

#### FL-03 建筑升级链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F03a | 升级检查验证 | 资源充足 | `checkUpgrade('farmland')` | canUpgrade=true |
| F03b | 升级扣费验证 | 资源充足 | `upgradeBuilding('farmland')` | 资源精确减少 |
| F03c | 升级完成验证 | 升级中 | `forceCompleteUpgrades()` | 等级+1 |
| F03d | 产出更新验证 | 农田升级完成 | `getProductionRates()` | grain产出速率提升 |
| F03e | 上限更新验证 | 农田升级完成 | `getCaps()` | grain上限提升 |
| F03f | 主城锁验证 | 主城Lv1 | `upgradeBuilding('market')` | 失败（需主城Lv2） |
| F03g | 5级完整性验证 | 主城Lv4 | 升级到Lv5 | 资源消耗合理+产出正确+解锁城墙 |

#### FL-04 武将招募链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F04a | 招募消耗验证 | recruitToken≥10 | `recruit('normal',1)` | recruitToken减少 |
| F04b | 招募获得武将 | recruitToken充足 | `recruit('normal',1)` | getGenerals()增加 |
| F04c | 免费招募验证 | 每日未用 | `freeRecruit('normal')` | 成功，不消耗token |
| F04d | 碎片合成验证 | 碎片足够 | 合成操作 | 新武将获得 |

#### FL-05 编队组建链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F05a | 创建编队 | 有武将 | `createFormation('main')` | 编队存在 |
| F05b | 设置成员 | 有编队+武将 | `setFormation('main', ids)` | 编队含指定武将 |
| F05c | 羁绊激活 | 编队含羁绊组合 | 查询羁绊 | 羁绊生效+属性加成 |
| F05d | 战力计算 | 编队就绪 | `calculateTotalPower()` | 战力 > 各武将战力之和（羁绊加成） |

#### FL-06 关卡征战链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F06a | 关卡列表验证 | `init()` | `getStageList()` | 非空，第一关可挑战 |
| F06b | 战斗执行验证 | 编队+可挑战 | `startBattle(stageId)` | BattleResult完整 |
| F06c | 奖励发放验证 | 战斗完成 | `completeBattle(stageId, 3)` | 资源/碎片/经验增加 |
| F06d | 进度推进验证 | completeBattle | `getCampaignProgress()` | 关卡标记已通关+下关解锁 |
| F06e | 失败处理验证 | 编队弱 | 战斗失败 | 无奖励，可重试 |

#### FL-07 存档恢复链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F07a | 序列化验证 | 中期状态 | `serialize()` | JSON完整，含所有子系统数据 |
| F07b | 反序列化验证 | 有存档JSON | `deserialize(json)` | 所有子系统状态恢复 |
| F07c | 离线收益验证 | 有存档+时间差 | `load()` | 返回离线收益，资源增加 |
| F07d | 跨版本兼容 | 旧版存档 | `fixSaveData()` | 缺失字段补全 |

### 6.2 P1 经济循环线流程段

#### FL-08 铜钱循环

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F08a | 市集产出铜钱 | 市集Lv1 | `fastForward(60s)` | gold增加 |
| F08b | 关卡奖励铜钱 | 战斗完成 | 检查gold增量 | gold增加=关卡奖励表 |
| F08c | 商店消费铜钱 | gold充足 | `executeBuy()` | gold减少=商品价格 |
| F08d | **统一性验证** | 市集产出gold | 用产出的gold购买 | 同一份gold，无割裂 |

#### FL-09 商店购买→使用链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F09a | 商品列表验证 | `init()` | `getShopGoods('normal')` | 非空，含价格/库存信息 |
| F09b | 购买扣费验证 | gold充足 | `executeBuy()` | gold减少 |
| F09c | 库存扣减验证 | 商品有库存 | `executeBuy()` | 库存-1 |
| F09d | 购买物品可用验证 | 购买装备类 | 检查背包/武将 | 物品可被使用 |

#### FL-10 装备全链路

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F10a | 装备生成 | `init()` | `generateEquipment()` | 装备实例完整 |
| F10b | 装备入包 | 有装备 | `addToBag()` | 背包+1 |
| F10c | 装备到武将 | 武将+背包有装备 | `equipItem()` | 武将装备槽更新 |
| F10d | 卸下装备 | 武将已装备 | `unequipItem()` | 装备回到背包 |
| F10e | 替换装备 | 武将已有该槽装备 | `equipItem(新)` | 旧装备自动卸下+新装备装备 |
| F10f | 强化装备 | 装备+gold充足 | `enhance()` | 等级+1, 属性提升, gold减少 |
| F10g | 锻造装备 | 材料充足 | `forge()` | 新装备生成 |
| F10h | 套装激活 | 2件以上同套装 | 检查套装效果 | 套装加成生效 |

#### FL-11 武将养成链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F11a | 升级消耗验证 | gold充足 | `enhanceHero()` | gold减少, 经验增加 |
| F11b | 升星消耗验证 | 碎片充足 | 升星操作 | 碎片减少, 星级+1 |
| F11c | 觉醒消耗验证 | 天命充足 | 觉醒操作 | 天命减少, 属性大幅提升 |
| F11d | 战力联动验证 | 升级/升星/觉醒 | `calculateTotalPower()` | 战力提升 |

#### FL-12 科技研究链

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F12a | 科技点获取 | 书院存在 | `fastForward()` | techPoint增加 |
| F12b | 研究启动 | techPoint充足 | `startTechResearch()` | 研究开始 |
| F12c | 研究完成 | 研究中 | `fastForward(完成时间)` | 研究完成 |
| F12d | 加成生效 | 研究完成 | `getProductionRates()` | 产出加成提升 |

### 6.3 P2 扩展玩法线流程段

#### FL-13 天下Tab领土征战

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F13a | 地图初始化 | `init()` | `getWorldMapSystem()` | 地图数据存在 |
| F13b | 领土相邻判断 | 有领土 | `getAdjacentTerritories()` | 返回相邻领土列表 |
| F13c | 兵力要求合理性 | 新手状态 | `getSiegeCost()` | 兵力要求≤当前兵力 |
| F13d | 攻城执行 | 兵力充足 | 攻城操作 | 兵力消耗+领土变更 |
| F13e | 驻防配置 | 有领土 | 驻防操作 | 武将派驻成功 |

#### FL-14 远征系统

| 段编号 | 名称 | 前置 | 操作 | 断言 |
|--------|------|------|------|------|
| F14a | 路线解锁 | 主城等级达标 | `unlockRoute()` | 路线可用 |
| F14b | 派遣队伍 | 有空闲武将 | `dispatchTeam()` | 武将标记为远征中 |
| F14c | 收益领取 | 远征完成 | 领取操作 | 资源增加 |

---

## 七、0→Max 全链路演进测试

### 7.1 演进阶段定义

这是方法论最关键的部分——确保游戏从开局到满级每个阶段都畅通无阻：

```
阶段0: 新手期 (0~5分钟)
  ├─ 开局初始化
  ├─ 第一次建筑升级
  └─ 资源开始产出

阶段1: 起步期 (5~30分钟)
  ├─ 主城升到Lv3
  ├─ 解锁市集/兵营/铁匠铺/书院
  ├─ 第一次招募武将
  └─ 第一次征战

阶段2: 发展期 (30分钟~2小时)
  ├─ 主城升到Lv5
  ├─ 编队成型（3~5名武将）
  ├─ 通关第一章
  ├─ 科技研究开始
  └─ 装备锻造开始

阶段3: 壮大期 (2~8小时)
  ├─ 建筑全面升级
  ├─ 武将升星/觉醒
  ├─ 装备强化+套装
  ├─ 领土扩张开始
  └─ 远征派遣

阶段4: 巅峰期 (8小时+)
  ├─ 主城满级
  ├─ 武将满星满级
  ├─ 装备满强化
  ├─ PvP竞技
  └─ 统一天下
```

### 7.2 演进测试编写模式

```typescript
describe('0→Max 全链路演进测试', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('阶段0→1→2: 新手到发展期完整链路', () => {
    // ===== 阶段0: 新手期 =====
    engine.init();
    expect(engine.getResourceAmount('grain')).toBe(500);
    expect(engine.getBuildingLevel('castle')).toBe(1);

    // 等待资源积累
    engine.fastForward(300000); // 5分钟
    expect(engine.getResourceAmount('grain')).toBeGreaterThan(500);

    // ===== 阶段1: 起步期 =====
    // 升级主城到Lv2（解锁市集和兵营）
    addResources({ grain: 5000, gold: 3000 });
    engine.upgradeBuilding('castle');
    engine.building.forceCompleteUpgrades();
    expect(engine.getBuildingLevel('castle')).toBe(2);

    // 解锁并升级市集
    engine.upgradeBuilding('market');
    engine.building.forceCompleteUpgrades();

    // 解锁并升级兵营
    engine.upgradeBuilding('barracks');
    engine.building.forceCompleteUpgrades();

    // 招募武将
    addResources({ recruitToken: 100 });
    engine.recruit('normal', 10);
    expect(engine.getGenerals().length).toBeGreaterThanOrEqual(1);

    // 第一次征战
    if (engine.getGenerals().length >= 1) {
      engine.createFormation('main');
      engine.setFormation('main', [engine.getGenerals()[0].id]);
      const stages = engine.getStageList();
      engine.startBattle(stages[0].id);
      engine.completeBattle(stages[0].id, 3);
      expect(engine.getCampaignProgress().stageStates[stages[0].id].stars).toBe(3);
    }

    // ===== 阶段2: 发展期 =====
    // 主城升到Lv5
    addResources({ grain: 50000, gold: 30000, troops: 10000 });
    for (let i = 0; i < 3; i++) {
      engine.upgradeBuilding('castle');
      engine.building.forceCompleteUpgrades();
    }
    expect(engine.getBuildingLevel('castle')).toBe(5);

    // 验证所有建筑解锁
    expect(engine.getBuildingLevel('wall')).toBe(0); // 城墙解锁但未升级

    // 编队成型
    addResources({ recruitToken: 200 });
    while (engine.getGenerals().length < 5) {
      engine.recruit('normal', 10);
    }
    engine.createFormation('main');
    engine.setFormation('main', engine.getGenerals().slice(0, 5).map(g => g.id));
    expect(engine.getActiveFormation()!.generalIds).toHaveLength(5);
  });

  it('阶段2→3→4: 发展到巅峰期完整链路', () => {
    // 使用 initMidGameState 快速到达中期
    engine.init();
    engine.initMidGameState();

    // 验证中期状态完整
    expect(engine.getBuildingLevel('castle')).toBeGreaterThanOrEqual(5);
    expect(engine.getGenerals().length).toBeGreaterThanOrEqual(5);

    // ===== 阶段3: 壮大期 =====
    // 武将升级
    const hero = engine.getGenerals()[0];
    engine.enhanceHero(hero.id, 10);
    expect(engine.getGeneral(hero.id)!.level).toBeGreaterThan(1);

    // 装备获取和装备
    const equipSys = engine.getEquipmentSystem();
    const weapon = equipSys.generateEquipment('weapon', 'rare', 'forge');
    equipSys.addToBag(weapon);
    equipSys.equipItem(hero.id, weapon.uid);
    expect(equipSys.getHeroEquips(hero.id).weapon).toBe(weapon.uid);

    // 科技研究
    addResources({ techPoint: 1000 });
    engine.startTechResearch('agriculture_1');
    engine.fastForward(3600000); // 1小时
    // 验证科技效果

    // ===== 阶段4: 巅峰期 =====
    // 存档→加载→状态完全恢复
    const json = engine.serialize();
    const engine2 = new ThreeKingdomsEngine();
    engine2.deserialize(json);
    expect(engine2.getBuildingLevel('castle')).toBe(engine.getBuildingLevel('castle'));
    expect(engine2.getGenerals().length).toBe(engine.getGenerals().length);
  });
});
```

---

## 八、断裂检测清单

### 8.1 通用断裂模式

每个流程段都应检查以下断裂模式：

| 断裂模式 | 检测方法 | 典型表现 |
|----------|---------|---------|
| **资源割裂** | A系统产出gold，B系统消费gold，检查是否同一份 | 商店铜钱≠生产铜钱 |
| **数据不传递** | A系统产生数据，B系统读不到 | 购买装备不在背包中 |
| **状态不同步** | A系统状态变更，B系统未感知 | 装备后战力未更新 |
| **前置条件过严** | 后续流程要求远超前置流程产出 | 5级消耗=5级上限=无法升级 |
| **解锁断裂** | A完成后应解锁B，但B仍锁定 | 主城升级后新建筑不可用 |
| **奖励断裂** | A完成后应发放奖励，但奖励未到账 | 战斗胜利后资源未增加 |
| **存档断裂** | 保存的数据加载后不完整 | 加载后装备丢失 |
| **事件断裂** | A触发事件，B未监听或未响应 | 建筑升级后产出未更新 |

### 8.2 断裂检测测试模板

```typescript
/**
 * 断裂检测测试模板
 * 用于验证两个系统之间的衔接点
 */
describe('断裂检测: {系统A} → {系统B}', () => {
  it('数据传递: {A的输出} 能被 {B} 正确读取', () => { ... });
  it('资源统一: {A产出的资源} 和 {B消费的资源} 是同一份', () => { ... });
  it('状态同步: {A的状态变更} 能被 {B} 感知', () => { ... });
  it('事件传播: {A触发的事件} 能被 {B} 正确处理', () => { ... });
});
```

---

## 九、测试优先级和执行策略

### 9.1 优先级矩阵

| 优先级 | 范围 | 流程段数 | 执行频率 |
|--------|------|---------|---------|
| **P0 冒烟** | FL-01~FL-07 核心线 | ~30段 | 每次提交 |
| **P1 经济线** | FL-08~FL-12 经济线 | ~25段 | 每日/PR |
| **P2 扩展线** | FL-13~FL-18 扩展线 | ~20段 | 每周/版本 |
| **P3 辅助线** | FL-19~FL-24 辅助线 | ~15段 | 版本发布前 |
| **全链路** | 0→Max 演进测试 | ~5段 | 里程碑 |

### 9.2 测试文件组织

```
tests/
├── integration/
│   ├── segments/                    # 流程段测试
│   │   ├── F01-init.segment.test.ts
│   │   ├── F02-production.segment.test.ts
│   │   ├── F03-building.segment.test.ts
│   │   ├── F04-recruit.segment.test.ts
│   │   ├── F05-formation.segment.test.ts
│   │   ├── F06-campaign.segment.test.ts
│   │   ├── F07-save.segment.test.ts
│   │   ├── F08-copper-cycle.segment.test.ts
│   │   ├── F09-shop.segment.test.ts
│   │   ├── F10-equipment.segment.test.ts
│   │   ├── F11-hero-growth.segment.test.ts
│   │   ├── F12-tech.segment.test.ts
│   │   ├── F13-territory.segment.test.ts
│   │   └── ...
│   ├── combos/                      # 组合测试
│   │   ├── combo-recruit-to-battle.test.ts      # F4→F5→F6
│   │   ├── combo-shop-to-equip.test.ts          # F9→F10
│   │   ├── combo-copper-cycle.test.ts           # F08a→F08b→F08c
│   │   ├── combo-build-to-produce.test.ts       # F3→F2
│   │   └── ...
│   ├── fractures/                   # 断裂检测测试
│   │   ├── fracture-shop-resource.test.ts       # 商店→资源断裂
│   │   ├── fracture-shop-equipment.test.ts      # 商店→装备断裂
│   │   ├── fracture-building-level5.test.ts     # 建筑5级断裂
│   │   ├── fracture-territory-access.test.ts    # 领土可达性断裂
│   │   └── ...
│   └── evolution/                   # 演进测试
│       ├── evo-stage0-1.test.ts                 # 新手→起步
│       ├── evo-stage1-2.test.ts                 # 起步→发展
│       ├── evo-stage2-3.test.ts                 # 发展→壮大
│       ├── evo-stage3-4.test.ts                 # 壮大→巅峰
│       └── evo-full-0-to-max.test.ts            # 完整0→Max
```

---

## 十、方法论检查清单

### 10.1 每个流程段必须回答的问题

```
□ 前置状态是否可通过直接设置数据达到？（不依赖前置流程执行）
□ 操作步骤是否是玩家真实的操作？（不是开发者视角的API调用）
□ 后置断言是否达到L3以上强度？（精确数值验证）
□ 是否包含L5跨系统断言？（至少验证1个跨系统衔接点）
□ 是否覆盖正常路径+边界条件+异常路径？
□ 是否检测了8种断裂模式？
```

### 10.2 组合测试必须回答的问题

```
□ Fi的后置状态是否等于Fj的前置状态？（数据一致性）
□ Fi的副作用是否被Fj正确感知？（事件传播）
□ Fi产生的资源是否可被Fj消费？（资源流通）
□ 组合后的流程是否模拟了真实玩家体验？
```

### 10.3 演进测试必须回答的问题

```
□ 每个阶段的资源获取量是否足够支撑下一阶段？
□ 每个阶段的解锁条件是否在前一阶段可达范围内？
□ 从0到Max的完整路径是否畅通无阻？
□ 是否存在"卡点"——玩家无法继续推进的位置？
```

---

## 附录A: 已知断裂问题→流程段映射

| 用户报告的断裂 | 对应流程段 | 检测方式 |
|---------------|-----------|---------|
| 天下Tab流程断裂，无法判断相邻 | F13b, F13c | 相邻判断API返回空或错误 |
| 兵力要求超过新手范围 | F13c | siegeCost.troops > 当前troops |
| 建筑升级5级后断裂 | F03g | 升级消耗≥资源上限 |
| 主城要求5k粮草，max也是5k | F03g | cost.grain ≥ cap.grain |
| 征战和军队断裂，无法创建军队 | F05a, F06b | createFormation返回null |
| 商店铜钱和资源生产铜钱断裂 | F08d | 产出gold ≠ 消费gold |
| 商店购买武器装备无法装备 | F09d, F10c | 购买后背包为空或equipItem失败 |

## 附录B: 35+子系统→流程段覆盖矩阵

| 子系统 | 覆盖的流程段 | 被覆盖次数 |
|--------|-------------|-----------|
| Resource | F02a-e, F03b, F04a, F06c, F08a-d, F09b, F10f, F11a-c, F12d | 18 |
| Building | F02b-c, F03a-g, F12a | 10 |
| Hero | F04b, F05a-d, F06b, F10c-e, F11a-d | 12 |
| Formation | F05a-d, F06b | 5 |
| Battle | F06b-e | 4 |
| Campaign | F06a-e | 5 |
| Shop | F08c-d, F09a-d | 6 |
| Equipment | F10a-h | 8 |
| Tech | F12a-d | 4 |
| Map/Territory | F13a-e | 5 |
| Save | F07a-d | 4 |
| Currency | F08a-d, F09b | 5 |

---

## 附录C: 方法论速查卡片

```
┌─────────────────────────────────────────────────────────┐
│          分段式集成测试方法论 — 速查卡片                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 流程枚举                                       │
│    □ 时间线视角 × 系统视角 × 异常视角 = 流程全集         │
│    □ 每个流程编号 FL-XX                                  │
│                                                         │
│  Step 2: 流程拆分                                       │
│    □ 每段 3~5步操作，跨 2~3 系统                         │
│    □ 每段有明确的前置/操作/断言/副作用                    │
│    □ 前置状态可直达（不依赖前置流程执行）                  │
│                                                         │
│  Step 3: 流程段测试                                     │
│    □ 正常路径 + 边界条件 + 异常路径                      │
│    □ 断言 ≥ L3（精确数值）                               │
│    □ 至少1个 L5 跨系统断言                               │
│                                                         │
│  Step 4: 组合测试                                       │
│    □ 邻接组合 Fi→Fi+1                                   │
│    □ 跳跃组合 Fi→Fi+n                                   │
│    □ 全链路 F1→Fn（0→Max）                               │
│    □ 断裂检测：8种断裂模式                               │
│                                                         │
│  断裂模式速查：                                          │
│    □ 资源割裂  □ 数据不传递  □ 状态不同步                │
│    □ 前置过严  □ 解锁断裂    □ 奖励断裂                  │
│    □ 存档断裂  □ 事件传播断裂                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
