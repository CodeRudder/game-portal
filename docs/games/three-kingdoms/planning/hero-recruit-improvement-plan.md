# 武将招募系统改进计划

> **文档版本**: v1.0
> **创建日期**: 2026-04-25
> **状态**: 规划中
> **负责人**: 游戏策划组

---

## 一、执行摘要

武将招募系统是三国霸业的核心玩法之一，当前**技术实现完整**（招募逻辑、保底机制、碎片系统），但存在**严重的可玩性问题**：玩家无法获得招贤令（recruitToken），导致招募功能完全不可用。

**核心问题**：
- 🔴 **招贤令无法获得**：虽然有 0.001/秒 的被动产出，但实际玩家需要等待 16.7 分钟才能进行 1 次普通招募
- 🔴 **资源栏不显示招贤令**：ResourceBar 配置完整，但 recruitToken 值为 0 时不显示
- 🔴 **招募按钮始终禁用**：因为 recruitToken 不足，canRecruit() 返回 false
- 🔴 **子系统串连问题**：资源标签不一致（"招贤榜" vs "求贤令"）

**改进目标**：
- ✅ 增加招贤令获取途径（新手礼包、日常任务、商店、关卡奖励）
- ✅ 提高被动产出速率（0.001/秒 → 0.003/秒）
- ✅ 统一资源标签（"招贤榜" 或 "求贤令"）
- ✅ 优化资源显示逻辑（即使为 0 也显示）

---

## 二、当前实现状态分析

### 2.1 技术实现 ✅ 完整

#### 2.1.1 招募系统核心
- **文件**: `src/games/three-kingdoms/engine/hero/HeroRecruitSystem.ts`
- **功能**:
  - ✅ 单次招募 / 十连招募
  - ✅ 普通招募 / 高级招募
  - ✅ 保底机制（十连保底、硬保底）
  - ✅ 碎片系统（重复武将转碎片）
  - ✅ 每日免费招募（普通招募 1 次/天）
  - ✅ UP 武将机制

**招募消耗配置**：
```typescript
// hero-recruit-config.ts:37-48
RECRUIT_COSTS: {
  normal: { resourceType: 'recruitToken', amount: 1 },      // 普通招募 ×1
  advanced: { resourceType: 'recruitToken', amount: 100 },  // 高级招募 ×100
}
```

#### 2.1.2 资源系统集成
- **文件**: `src/games/three-kingdoms/engine/engine-hero-deps.ts`
- **依赖注入**:
  ```typescript
  systems.heroRecruit.setRecruitDeps({
    heroSystem: systems.hero,
    spendResource: (type, amount) => safeSpendResource(resource, type, amount),
    canAffordResource: (type, amount) => safeCanAfford(resource, type, amount),
    addResource: (type, amount) => { ... },
  });
  ```

**集成状态**: ✅ 正确集成，recruitDeps 已注入

#### 2.1.3 UI 组件
- **文件**: `src/components/idle/panels/hero/RecruitModal.tsx`
- **功能**:
  - ✅ 招募类型切换（普通/高级）
  - ✅ 消耗显示
  - ✅ 保底进度显示
  - ✅ 招募按钮启用/禁用逻辑
  - ✅ 招募结果展示

**按钮启用逻辑**：
```typescript
// RecruitModal.tsx:104-105
const canSingle = useMemo(() => recruitSystem.canRecruit(recruitType, 1), [recruitSystem, recruitType]);
const canTen = useMemo(() => recruitSystem.canRecruit(recruitType, 10), [recruitSystem, recruitType]);
```

---

### 2.2 存在的问题 ❌

#### 问题 A：招贤令产出极低 🔴 P0

**当前配置**：
```typescript
// resource-config.ts:45
INITIAL_PRODUCTION_RATES.recruitToken = 0.001;  // 每秒 0.001 个
```

**产出计算**：
- 每秒：0.001 个
- 每小时：3.6 个
- 每天：86.4 个
- **1 次普通招募**：需要等待 **16.7 分钟**
- **1 次高级招募**：需要等待 **27.8 小时**

**影响**：
- ❌ 玩家无法快速体验招募功能
- ❌ 新手流失率高（核心玩法不可用）
- ❌ 游戏节奏过慢

**缺失的获取途径**：
- ❌ 新手礼包
- ❌ 日常任务
- ❌ 商店购买
- ❌ 关卡奖励
- ❌ 章节奖励
- ❌ 活动奖励

---

#### 问题 B：资源标签不一致 🟡 P1

**配置位置 1**：`src/games/three-kingdoms/engine/resource/resource.types.ts:49`
```typescript
RESOURCE_LABELS: {
  recruitToken: '招贤榜',  // ← 配置中使用"招贤榜"
}
```

**配置位置 2**：`src/components/idle/panels/hero/RecruitModal.tsx:154`
```typescript
const resourceNameMap: Record<string, string> = {
  recruitToken: '求贤令',  // ← UI 中使用"求贤令"
};
```

**影响**：
- ⚠️ 资源栏显示"招贤榜"
- ⚠️ 招募弹窗显示"求贤令"
- ⚠️ 玩家困惑（两个名称指同一资源）

---

#### 问题 C：资源显示逻辑问题 🟡 P1

**当前逻辑**：`src/components/idle/panels/resource/ResourceBar.tsx:261`
```typescript
{RESOURCE_ORDER.map(type => {
  const value = resources[type];
  if (value === undefined) return null;  // ← 如果 undefined 则不显示
  // ...
})}
```

**问题分析**：
- ResourceBar 配置完整（图标、颜色、标签、顺序）
- recruitToken 在 RESOURCE_ORDER 中排第 6 位
- 但如果 `resources.recruitToken === 0`，仍然会显示（因为 0 !== undefined）
- **实际问题**：recruitToken 可能根本没有传递到 ResourceBar

**可能原因**：
1. Engine 的 `getSnapshot()` 方法未包含 recruitToken
2. ResourceSystem 的 `getResources()` 方法未返回 recruitToken
3. UI 层未正确订阅 recruitToken 变化

---

#### 问题 D：招募描述不准确 🟡 P2

**当前描述**：`src/components/idle/panels/hero/RecruitModal.tsx:44`
```typescript
const RECRUIT_TYPE_DESC: Record<RecruitType, string> = {
  normal: '消耗铜钱，概率获得武将',      // ← 错误！实际消耗 recruitToken
  advanced: '消耗求贤令，更高品质概率',  // ← 正确
};
```

**实际消耗**：
- 普通招募：recruitToken × 1（不是铜钱）
- 高级招募：recruitToken × 100

**影响**：
- ⚠️ 玩家误以为普通招募消耗铜钱
- ⚠️ 与实际消耗不符

---

## 三、改进方案

### 3.1 短期改进（1周内）— P0 优先级

#### 3.1.1 增加招贤令获取途径

**目标**：让玩家能够快速获得招贤令，体验招募功能

**方案 1：新手礼包 +10 个**

**实施位置**：
- 文件：`src/games/three-kingdoms/engine/resource/resource-config.ts`
- 修改：`INITIAL_RESOURCES.recruitToken: 0 → 10`

**效果**：
- ✅ 新玩家立即有 10 个招贤令
- ✅ 可进行 10 次普通招募
- ✅ 快速体验核心玩法

**工作量**：1 行代码修改

---

**方案 2：提高被动产出速率 3 倍**

**实施位置**：
- 文件：`src/games/three-kingdoms/engine/resource/resource-config.ts`
- 修改：`INITIAL_PRODUCTION_RATES.recruitToken: 0.001 → 0.003`

**产出计算**（改进后）：
- 每秒：0.003 个
- 每小时：10.8 个
- 每天：259.2 个
- **1 次普通招募**：等待 **5.6 分钟**（vs 当前 16.7 分钟）
- **1 次高级招募**：等待 **9.3 小时**（vs 当前 27.8 小时）

**效果**：
- ✅ 等待时间缩短 3 倍
- ✅ 玩家体验更流畅

**工作量**：1 行代码修改

---

**方案 3：关卡奖励 +10 个/大关卡**

**实施位置**：
- 文件：`src/games/three-kingdoms/engine/campaign/campaign-config.ts`
- 修改：在关卡奖励配置中添加 `recruitToken: 10`

**触发条件**：
- 每通过一个大关卡（如第 1 章、第 2 章等）
- 奖励 10 个招贤令

**效果**：
- ✅ 推进关卡有明确奖励
- ✅ 提升玩家推图动力

**工作量**：配置文件修改

---

**方案 4：每日免费招募提示**

**实施位置**：
- 文件：`src/components/idle/panels/hero/RecruitModal.tsx`
- 修改：在普通招募按钮旁显示"今日免费 1 次"

**效果**：
- ✅ 玩家知道每天有 1 次免费招募
- ✅ 提升每日活跃度

**工作量**：UI 组件修改

---

#### 3.1.2 统一资源标签

**目标**：统一使用"招贤榜"或"求贤令"

**方案**：统一使用"招贤榜"

**实施步骤**：

1. **确认标签**：使用"招贤榜"（与资源配置一致）

2. **修改 RecruitModal**：
   - 文件：`src/components/idle/panels/hero/RecruitModal.tsx:154`
   - 修改：`recruitToken: '求贤令'` → `recruitToken: '招贤榜'`

3. **修改招募描述**：
   - 文件：`src/components/idle/panels/hero/RecruitModal.tsx:44`
   - 修改：`normal: '消耗铜钱，概率获得武将'` → `normal: '消耗招贤榜，概率获得武将'`

**效果**：
- ✅ 资源栏显示"招贤榜"
- ✅ 招募弹窗显示"招贤榜"
- ✅ 玩家不再困惑

**工作量**：2 处文本修改

---

#### 3.1.3 优化资源显示逻辑

**目标**：即使 recruitToken 为 0 也显示在资源栏

**问题诊断**：
1. 检查 Engine 的 `getSnapshot()` 是否包含 recruitToken
2. 检查 ResourceSystem 的 `getResources()` 是否返回 recruitToken
3. 检查 UI 层是否正确订阅 recruitToken 变化

**实施步骤**：

1. **验证 ResourceSystem**：
   - 文件：`src/games/three-kingdoms/engine/resource/ResourceSystem.ts`
   - 检查：`getResources()` 方法是否返回完整的 Resources 对象（包含 recruitToken）

2. **验证 Engine Snapshot**：
   - 文件：`src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts`
   - 检查：`getSnapshot()` 方法是否包含 `resources.recruitToken`

3. **验证 UI 订阅**：
   - 文件：`src/components/idle/ThreeKingdomsGame.tsx`
   - 检查：是否正确订阅 `resource:changed` 事件

**效果**：
- ✅ recruitToken 始终显示在资源栏
- ✅ 玩家能看到招贤榜数量（即使为 0）

**工作量**：代码审查 + 可能的 bug 修复

---

### 3.2 中期改进（2-4周）— P1 优先级

#### 3.2.1 实现日常任务奖励

**目标**：提供稳定的每日招贤令来源

**实施步骤**：

1. **创建日常任务配置**：
   - 文件：`src/games/three-kingdoms/engine/quest/daily-quest-config.ts`
   - 内容：定义日常任务列表及奖励

2. **任务奖励配置**：
   ```typescript
   {
     id: 'daily_recruit_5',
     name: '完成 5 次招募',
     reward: { recruitToken: 1 },
   },
   {
     id: 'daily_stage_3',
     name: '通关 3 个关卡',
     reward: { recruitToken: 2 },
   },
   ```

3. **集成到任务系统**：
   - 任务完成时自动发放招贤榜
   - 每日重置任务进度

**效果**：
- ✅ 每日可获得 3-5 个招贤榜
- ✅ 提升每日活跃度

**工作量**：5-7 天

---

#### 3.2.2 实现商店购买

**目标**：提供主动购买途径

**实施步骤**：

1. **添加商店商品**：
   - 文件：`src/games/three-kingdoms/engine/shop/shop-config.ts`
   - 内容：
     ```typescript
     {
       id: 'recruitToken_daily',
       name: '招贤榜',
       price: { gold: 100 },
       stock: { recruitToken: 1 },
       dailyLimit: 30,
     }
     ```

2. **集成到商店系统**：
   - 玩家用铜钱购买招贤榜
   - 每日限购 30 个

**效果**：
- ✅ 玩家可用铜钱兑换招贤榜
- ✅ 提供资源转换途径

**工作量**：3-5 天

---

#### 3.2.3 优化资源产出显示

**目标**：避免显示 0.0/s，让玩家看到真实产出

**实施位置**：
- 文件：`src/components/idle/panels/resource/ResourceBar.tsx`

**显示规则**：
```typescript
function formatRate(rate: number): string {
  if (rate >= 1) {
    return rate.toFixed(1);      // 显示 1 位小数：10.5/s
  } else if (rate >= 0.01) {
    return rate.toFixed(2);      // 显示 2 位小数：0.05/s
  } else if (rate > 0) {
    return rate.toFixed(3);      // 显示 3 位小数：0.003/s
  } else {
    return '0';                  // 真正的 0
  }
}
```

**效果**：
- ✅ recruitToken 显示为 0.003/s（vs 0.0/s）
- ✅ 玩家清楚看到资源在增长

**工作量**：1-2 天

---

### 3.3 长期优化（1-2个月）— P2 优先级

#### 3.3.1 招募系统深度优化

**优化方向**：

1. **招募券系统**
   - 普通招募券（可用于普通招募）
   - 高级招募券（可用于高级招募）
   - 通用招募券（可用于任意招募）

2. **招募活动**
   - 限时UP武将（提升特定武将概率）
   - 招募折扣（消耗减半）
   - 保底减半（50 抽必出传说）

3. **招募成就**
   - 累计招募次数成就
   - 获得特定品质武将成就
   - 集齐特定阵营武将成就

**工作量**：20-30 天

---

#### 3.3.2 武将培养系统

**扩展方向**：

1. **武将升级**
   - 消耗经验道具升级
   - 等级上限与玩家等级关联

2. **武将进阶**
   - 消耗碎片进阶
   - 进阶提升品质和属性

3. **武将装备**
   - 武将可装备武器、防具
   - 装备提供属性加成

**工作量**：30-40 天

---

## 四、实施计划

### 4.1 时间线

```
Week 1:  新手礼包 + 被动产出提升 + 资源标签统一 + 资源显示修复
Week 2:  关卡奖励 + 每日免费提示 + 资源产出显示优化
Week 3-4: 日常任务奖励 + 商店购买
Week 5-8: 招募系统深度优化（可选）
```

### 4.2 里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|---------|
| M1: 基础可用 | Week 1 | 新手礼包 + 产出提升 | 新玩家可立即招募 10 次 |
| M2: 体验优化 | Week 2 | 关卡奖励 + 显示优化 | 资源显示正确，推图有奖励 |
| M3: 稳定来源 | Week 4 | 日常任务 + 商店 | 每日可获得 30+ 招贤榜 |
| M4: 深度优化 | Week 8 | 招募活动 + 成就 | 招募系统完整 |

### 4.3 资源需求

| 角色 | 人数 | 工作量 |
|------|------|--------|
| 前端工程师 | 1 | 兼职（2周） |
| 后端工程师 | 1 | 兼职（1周） |
| 游戏策划 | 1 | 兼职（2周） |
| 测试工程师 | 1 | 兼职（1周） |

---

## 五、风险评估

### 5.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| 资源显示问题未修复 | 中 | 高 | 充分测试、代码审查 |
| 招贤榜产出过多导致贬值 | 中 | 中 | 监控数据、动态调整 |
| 日常任务系统性能问题 | 低 | 中 | 性能测试、优化查询 |

### 5.2 业务风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| 招贤榜获取过易影响付费 | 中 | 中 | 平衡免费/付费途径 |
| 玩家不理解新获取途径 | 高 | 低 | 新手引导、帮助文档 |
| 开发周期延期 | 中 | 中 | 敏捷开发、MVP 优先 |

---

## 六、成功指标

### 6.1 核心指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|-------|--------|---------|
| 招募日活跃率 | 0% | 60% | 每日进行招募的玩家占比 |
| 平均招募次数 | 0 次/天 | 5 次/天 | 每个玩家每天平均招募次数 |
| 招贤榜获取率 | 0% | 80% | 获得过招贤榜的玩家占比 |
| 新手招募体验率 | 0% | 90% | 新手 1 小时内进行招募的占比 |

### 6.2 次级指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|-------|--------|---------|
| 招贤榜日均获得量 | 86.4 | 300+ | 每个玩家每天获得招贤榜数量 |
| 商店购买率 | - | 40% | 每日购买招贤榜的玩家占比 |
| 日常任务完成率 | - | 70% | 完成招募相关任务的玩家占比 |

---

## 七、后续优化方向

### 7.1 玩法扩展

1. **招募保底优化**
   - 可视化保底进度条
   - 保底历史记录
   - 保底转移机制（切换招募类型时保留进度）

2. **招募预览系统**
   - 查看武将池
   - 查看概率详情
   - 查看历史招募记录

3. **招募分享系统**
   - 分享招募结果到联盟
   - 招募成就展示
   - 招募排行榜

### 7.2 社交扩展

1. **联盟招募**
   - 联盟成员共享招募券
   - 联盟招募活动
   - 联盟招募排行

2. **好友招募**
   - 赠送招募券给好友
   - 好友招募助力
   - 好友招募分享

---

## 八、附录

### 8.1 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 招募 PRD | `docs/games/three-kingdoms/ui-design/prd/HER-heroes-prd.md` | 武将招募 PRD |
| v2 Play | `docs/games/three-kingdoms/play/v2-play.md` | 招募玩法流程 |
| 招募配置 | `src/games/three-kingdoms/engine/hero/hero-recruit-config.ts` | 招募数值配置 |
| 资源配置 | `src/games/three-kingdoms/engine/resource/resource-config.ts` | 资源产出配置 |
| 招贤令分析报告 | `docs/games/three-kingdoms/testing/recruit-token-analysis-report.md` | 招贤令产生方式分析 |

### 8.2 技术债务

| 债务 | 优先级 | 说明 |
|------|-------|------|
| 资源显示逻辑优化 | P0 | recruitToken 不显示问题 |
| 资源标签统一 | P1 | "招贤榜" vs "求贤令" |
| 招募描述修正 | P1 | 普通招募描述错误 |
| 招募系统性能优化 | P2 | 十连招募时卡顿 |

### 8.3 参考资料

- 《原神》祈愿系统分析
- 《明日方舟》寻访系统研究
- 《FGO》召唤系统设计参考

---

**文档维护**：
- 创建: 2026-04-25
- 更新: -
- 负责人: 游戏策划组
- 审核人: 技术负责人、产品负责人
