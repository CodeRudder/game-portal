# R11 — 深度交互体验审计报告

> **审计日期**: 2025-07-11
> **审计范围**: 所有 UI 面板的交互逻辑完整性
> **审计方法**: 逐面板阅读 TSX 源码，检查引擎调用、mock 数据、onClick 完整性、调试代码
> **涉及文件**: 22 个面板组件 + 1 个主容器

---

## 一、总览

| 面板 | 引擎调用 | 交互完整性 | 严重问题数 | 评级 |
|------|----------|-----------|-----------|------|
| BuildingPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| BuildingUpgradeModal | ✅ 完整 | ✅ 完整 | 0 | A |
| HeroTab | ✅ 完整 | ✅ 完整 | 0 | A |
| RecruitModal | ✅ 完整 | ✅ 完整 | 0 | A |
| HeroDetailModal | ✅ 完整 | ✅ 完整 | 0 | A |
| TechTab | ✅ 完整 | ✅ 完整 | 1 | B |
| CampaignTab | ✅ 完整 | ⚠️ 部分 | 2 | C+ |
| EquipmentTab | ⚠️ 降级取值 | ⚠️ 部分 | 2 | C+ |
| EquipmentPanel(旧) | ⚠️ 降级取值 | ❌ alert弹窗 | 3 | D |
| ArenaTab | ⚠️ 降级取值 | ❌ 随机回退 | 2 | D |
| MoreTab | ✅ 完整 | ✅ 完整 | 0 | A |
| QuestPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| ShopPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| MailPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| AchievementPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| ActivityPanel | ⚠️ 部分 | ⚠️ 部分 | 1 | B |
| AlliancePanel | ⚠️ 部分 | ❌ prompt弹窗 | 2 | D |
| PrestigePanel | ✅ 完整 | ✅ 完整 | 0 | A |
| HeritagePanel | ⚠️ 部分 | ⚠️ TODO占位 | 2 | C+ |
| SocialPanel | ⚠️ 部分 | ❌ TODO占位 | 2 | C+ |
| ExpeditionPanel | ✅ 完整 | ✅ 完整 | 0 | A |
| ExpeditionTab | ✅ 完整 | ✅ 完整 | 0 | A |

---

## 二、逐面板详细审计

### 2.1 BuildingPanel — 建筑 ✅

**文件**: `src/components/idle/panels/building/BuildingPanel.tsx`
**行数**: ~250行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 升级按钮调用引擎 | ✅ | `engine.upgradeBuilding(type)` 在 `handleUpgradeConfirm` |
| 资源不足提示 | ✅ | `engine.checkUpgrade(type)` 返回 `canUpgrade` + `reasons` |
| 升级进度反馈 | ✅ | `engine.getUpgradeProgress(type)` + `getUpgradeRemainingTime` |
| 建筑列表从引擎获取 | ✅ | 通过 `buildings` props（来自 `ThreeKingdomsGame` snapshot） |
| onClick 完整性 | ✅ | 所有按钮/卡片有完整回调 |
| 调试代码 | ✅ | 无 console.log/alert/prompt |
| TODO/FIXME | ✅ | 无 |

**结论**: 交互逻辑完整，无问题。

---

### 2.2 BuildingUpgradeModal — 建筑升级弹窗 ✅

**文件**: `src/components/idle/panels/building/BuildingUpgradeModal.tsx`
**行数**: ~230行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 升级预览数据 | ✅ | `engine.checkUpgrade` + `engine.getUpgradeCost` |
| 资源充足判断 | ✅ | 逐项对比 grain/gold/troops，红/绿标识 |
| 升级按钮禁用 | ✅ | `disabled={!canAfford}` |
| 关闭方式 | ✅ | ESC / 遮罩点击 / ✕按钮 三种方式 |
| 失败原因展示 | ✅ | `info.reasons` 数组渲染 |
| 调试代码 | ✅ | 无 |

**结论**: 交互逻辑完整，无问题。

---

### 2.3 HeroTab — 武将 ✅

**文件**: `src/components/idle/panels/hero/HeroTab.tsx`
**行数**: ~250行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 武将列表从引擎获取 | ✅ | `engine.getGenerals()` |
| 招募按钮调用引擎 | ✅ | 通过 RecruitModal → `engine.recruit()` |
| 升级调用引擎 | ✅ | 通过 HeroDetailModal → `engine.enhanceHero()` |
| 升星调用引擎 | ✅ | 通过 HeroStarUpModal |
| 碎片合成 | ✅ | 通过 HeroDetailModal → `heroSystem.fragmentSynthesize()` |
| 筛选/排序 | ✅ | 阵营/品质筛选 + 战力/等级/品质排序 |
| 编队管理 | ✅ | FormationPanel 子Tab |
| 武将对比 | ✅ | HeroCompareModal |
| 新手引导 | ✅ | GuideOverlay + localStorage 持久化 |
| 调试代码 | ✅ | 无 |

**结论**: 交互逻辑完整，无问题。

---

### 2.4 RecruitModal — 招募弹窗 ✅

**文件**: `src/components/idle/panels/hero/RecruitModal.tsx`
**行数**: ~300行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 招募调用引擎 | ✅ | `engine.recruit(recruitType, count)` |
| 资源不足提示 | ✅ | `Toast.danger('资源不足，无法招募')` |
| 消耗显示 | ✅ | `recruitSystem.getRecruitCost()` |
| 保底进度 | ✅ | `recruitSystem.getGachaState()` |
| 招募历史 | ✅ | `recruitSystem.getRecruitHistory()` |
| 品质揭示动画 | ✅ | CSS class 映射，逐张延迟揭示 |
| 按钮禁用 | ✅ | `disabled={!canSingle/canTen \|\| isRecruiting}` |
| 调试代码 | ✅ | 无 |

**结论**: 交互逻辑完整，无问题。

---

### 2.5 HeroDetailModal — 武将详情弹窗 ✅

**文件**: `src/components/idle/panels/hero/HeroDetailModal.tsx`
**行数**: ~300行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 武将数据从引擎获取 | ✅ | `heroSystem.calculatePower()` / `levelSystem.getExpProgress()` |
| 升级调用引擎 | ✅ | `engine.enhanceHero(general.id, targetLevel)` |
| 升级预览 | ✅ | `engine.getEnhancePreview()` 显示战力变化 |
| 碎片合成 | ✅ | `heroSystem.fragmentSynthesize()` |
| 碎片进度显示 | ✅ | `heroSystem.getSynthesizeProgress()` |
| 一键满级(+5) | ✅ | `handleEnhanceMax` 限制 `HERO_MAX_LEVEL` |
| Toast 反馈 | ✅ | 成功/失败均使用 Toast |
| 调试代码 | ✅ | 无 |

**结论**: 交互逻辑完整，无问题。

---

### 2.6 TechTab — 科技 ⚠️

**文件**: `src/components/idle/panels/tech/TechTab.tsx`
**行数**: ~300行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 科技树数据从引擎获取 | ✅ | `treeSystem.getAllNodeStates()` |
| 研究调用引擎 | ✅ | `researchSystem.startResearch(techId)` |
| 研究进度显示 | ✅ | `researchSystem.getResearchProgress()` + 1秒定时刷新 |
| 科技点显示 | ✅ | `pointSystem.getTechPointState()` |
| 互斥分支 | ✅ | `treeSystem.getChosenMutexNodes()` |
| 调试代码 | ⚠️ | **BUG-T11-01**: `console.warn('研究失败:', result.reason)` (L302) |

#### BUG-T11-01: console.warn 未清理

- **严重级**: P2（低）
- **位置**: `TechTab.tsx:302`
- **代码**: `console.warn('研究失败:', result.reason);`
- **问题**: 调试代码未清理，生产环境不应有 console.warn
- **修复**: 改为 `Toast.danger(result.reason)` 或直接移除

---

### 2.7 CampaignTab — 关卡 ⚠️

**文件**: `src/components/idle/panels/campaign/CampaignTab.tsx`
**行数**: ~350行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 关卡数据从引擎获取 | ✅ | `engine.getChapters()` + `engine.getCampaignProgress()` |
| 战斗调用引擎 | ✅ | `engine.startBattle(stage.id)` |
| 关卡状态显示 | ✅ | `campaignSystem.getStageStatus()` / `getStageStars()` |
| 星级显示 | ✅ | 三星判定 + 扫荡按钮 |
| 扫荡功能 | ⚠️ | **BUG-T11-02**: 扫荡逻辑与正式战斗混用 |
| 关卡奖励 | ⚠️ | **BUG-T11-03**: 无奖励预览弹窗 |

#### BUG-T11-02: 扫荡按钮复用战斗逻辑，未调用 SweepSystem

- **严重级**: P1（高）
- **位置**: `CampaignTab.tsx` L139-145 `handleSweep`
- **代码**:
  ```typescript
  const handleSweep = useCallback((stage: Stage) => {
    const result = engine.startBattle(stage.id);  // ← 应调用 sweepSystem
    if (result.outcome === BattleOutcome.VICTORY) {
      engine.completeBattle(stage.id, result.stars as number);
    }
    setSweepResult(result);
    setSweepStage(stage);
  }, [engine]);
  ```
- **问题**: 扫荡按钮调用了 `engine.startBattle()` 而非 `engine.getSweepSystem().executeSweep()`。扫荡应跳过战斗动画直接结算，但当前实现与正式战斗完全一致。
- **修复**: 改为 `engine.getSweepSystem().executeSweep(stageId, sweepCount)` 或 `engine.sweepStage(stageId)`

#### BUG-T11-03: 关卡缺少奖励预览

- **严重级**: P2（中）
- **位置**: `CampaignTab.tsx` — 关卡节点渲染
- **问题**: 点击已通关关卡仅显示星级，不显示奖励内容（可能获得什么资源/碎片）。玩家无法预知扫荡收益。
- **修复**: 在关卡节点 tooltip 或弹窗中展示 `stage.rewards` 数据

---

### 2.8 EquipmentTab — 装备（新Tab版） ⚠️

**文件**: `src/components/idle/panels/equipment/EquipmentTab.tsx`
**行数**: ~300行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 装备列表从引擎获取 | ⚠️ | **BUG-T11-04**: 使用 `(engine as any)` 降级取值 |
| 锻造调用引擎 | ⚠️ | 同上 |
| 强化调用引擎 | ⚠️ | 同上 |
| 分解调用引擎 | ⚠️ | 同上 |
| Toast 反馈 | ✅ | 使用 `setMessage` 内联消息条 |

#### BUG-T11-04: 引擎子系统取值使用 `(engine as any)` 非类型安全

- **严重级**: P1（高）
- **位置**: `EquipmentTab.tsx` L75-77
- **代码**:
  ```typescript
  const eqSys = (engine as any)?.equipment ?? (engine as any)?.getEquipmentSystem?.();
  const forgeSys = (engine as any)?.equipmentForge ?? (engine as any)?.getEquipmentForgeSystem?.();
  const enhanceSys = (engine as any)?.equipmentEnhance ?? (engine as any)?.getEquipmentEnhanceSystem?.();
  ```
- **问题**: 
  1. 使用 `(engine as any)` 绕过类型检查，丧失 TypeScript 类型安全
  2. 引擎已有正式 getter：`engine.getEquipmentSystem()` / `engine.getEquipmentForgeSystem()` / `engine.getEquipmentEnhanceSystem()`
  3. 双重降级取值（先尝试属性、再尝试方法）掩盖了潜在的 API 不一致
- **修复**: 改为：
  ```typescript
  const eqSys = engine.getEquipmentSystem();
  const forgeSys = engine.getEquipmentForgeSystem();
  const enhanceSys = engine.getEquipmentEnhanceSystem();
  ```

#### BUG-T11-05: Props 类型未使用 ThreeKingdomsEngine

- **严重级**: P2（中）
- **位置**: `EquipmentTab.tsx` Props 定义
- **问题**: 虽然导入了 `ThreeKingdomsEngine` 类型，但实际取值用 `(engine as any)` 绕过了类型系统
- **修复**: Props 类型应确保 `engine: ThreeKingdomsEngine`

---

### 2.9 EquipmentPanel — 装备（旧版/FeaturePanel用） ❌

**文件**: `src/components/idle/panels/equipment/EquipmentPanel.tsx`
**行数**: ~250行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ⚠️ | 同 BUG-T11-04，`(engine as any)` |
| 分解反馈 | ❌ | **BUG-T11-06**: 使用 `alert()` |
| 强化反馈 | ❌ | **BUG-T11-07**: 使用 `alert()` |
| 锻造反馈 | ❌ | **BUG-T11-08**: 使用 `alert()` |
| 排序功能 | ✅ | 支持品质/等级/部位排序 |

#### BUG-T11-06/07/08: EquipmentPanel 使用 alert() 原生弹窗

- **严重级**: P0（紧急）
- **位置**: 
  - `EquipmentPanel.tsx:88` — `alert(result.reason ?? '分解失败')`
  - `EquipmentPanel.tsx:207` — `alert(label)` (强化结果)
  - `EquipmentPanel.tsx:220` — `alert(result?.success ? ...)` (锻造结果)
- **问题**: 使用浏览器原生 `alert()` 弹窗，严重影响游戏体验：
  1. 阻塞主线程，游戏暂停
  2. 样式无法自定义，与游戏主题不符
  3. 移动端体验极差
- **修复**: 全部替换为 `Toast.success()` / `Toast.danger()`

---

### 2.10 ArenaTab — 竞技场 ❌

**文件**: `src/components/idle/panels/arena/ArenaTab.tsx`
**行数**: ~350行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 挑战调用引擎 | ⚠️ | **BUG-T11-09**: 有 Math.random 回退 |
| 排行榜数据 | ⚠️ | 使用 `rankingSys?.getTopRankings?.(10) ?? []` |
| 赛季信息 | ✅ | `seasonSys?.getSeasonData?.()` |
| 引擎类型 | ❌ | **BUG-T11-10**: Props 类型为 `any` |

#### BUG-T11-09: 挑战战斗有 Math.random 回退逻辑

- **严重级**: P0（紧急）
- **位置**: `ArenaTab.tsx:79`
- **代码**:
  ```typescript
  const result = arenaSys?.executeBattle?.(oppId) ??
    { victory: Math.random() > 0.5, scoreChange: Math.floor(Math.random() * 30) + 10 };
  ```
- **问题**: 当 `arenaSys?.executeBattle?.(oppId)` 返回 falsy 值时（如返回 `undefined`、系统未初始化），会使用 `Math.random()` 生成假战斗结果。这意味着：
  1. 玩家可能看到随机生成的虚假战斗结果
  2. 积分变化完全随机，无引擎计算
  3. 无法区分真实战斗和回退逻辑
- **修复**: 移除 `??` 回退，当引擎不可用时显示错误提示：
  ```typescript
  if (!arenaSys) return flash('竞技场系统未就绪');
  const result = arenaSys.executeBattle(oppId);
  if (!result) return flash('挑战失败');
  ```

#### BUG-T11-10: ArenaTab Props 类型为 `any`

- **严重级**: P1（高）
- **位置**: `ArenaTab.tsx` Props 定义
- **代码**: `interface ArenaTabProps { engine: any; snapshotVersion?: number; }`
- **问题**: 
  1. `engine` 类型为 `any`，丧失所有类型检查
  2. `snapshotVersion` 为可选（`?`），但其他面板都是必填
  3. 导致所有 `engine?.getXXXSystem?.()` 调用都是无类型的
- **修复**: 改为 `engine: ThreeKingdomsEngine; snapshotVersion: number;`

---

### 2.11 MoreTab — 更多功能 ✅

**文件**: `src/components/idle/panels/more/MoreTab.tsx`
**行数**: ~120行

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 红点数据从引擎获取 | ✅ | 每个功能项有 `getBadge` 函数调用对应系统 |
| 点击回调 | ✅ | `onOpenPanel(panelId)` 回调到主容器 |
| 引擎类型 | ⚠️ | `engine: any`，但因 MoreTab 本身不调用引擎方法（只传给 getBadge），影响较小 |

**结论**: 功能入口完整，无严重问题。

---

### 2.12 MoreTab 中的 9 个面板

#### QuestPanel — 任务 ✅

**文件**: `src/components/idle/panels/quest/QuestPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getQuestSystem?.() ?? engine?.quest` |
| 任务列表 | ✅ | `qs.getDailyQuests()` / `qs.getActiveQuestsByCategory()` |
| 领取奖励 | ✅ | `qs.claimReward(id)` / `qs.claimAllRewards()` |
| 活跃度里程碑 | ✅ | `qs.getActivityState()` + `qs.claimActivityMilestone()` |
| 调试代码 | ✅ | 无 |

#### ShopPanel — 商店 ✅

**文件**: `src/components/idle/panels/shop/ShopPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getShopSystem?.() ?? engine?.shop` |
| 货币显示 | ✅ | `currencySystem.getBalance()` |
| 商品列表 | ✅ | `shopSystem.getShopGoods(activeTab)` |
| 购买确认 | ✅ | 二次确认弹窗 + `shopSystem.executeBuy()` |
| 折扣计算 | ✅ | `shopSystem.calculateFinalPrice()` |
| 调试代码 | ✅ | 无 |

#### MailPanel — 邮件 ✅

**文件**: `src/components/idle/panels/mail/MailPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getMailSystem?.() ?? engine?.mail` |
| 邮件列表 | ✅ | `mailSystem.getMails({ category })` |
| 标记已读 | ✅ | `mailSystem.markRead(id)` / `markAllRead()` |
| 领取附件 | ✅ | `mailSystem.claimAttachments(id)` / `claimAllAttachments()` |
| 调试代码 | ✅ | 无 |

#### AchievementPanel — 成就 ✅

**文件**: `src/components/idle/panels/achievement/AchievementPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getAchievementSystem?.() ?? engine?.achievement` |
| 成就列表 | ✅ | `ach.getAchievementsByDimension(tab)` |
| 进度显示 | ✅ | 条件进度百分比计算 |
| 奖励领取 | ✅ | `ach.claimReward(id)` |
| 调试代码 | ✅ | 无 |

#### ActivityPanel — 活动 ⚠️

**文件**: `src/components/idle/panels/activity/ActivityPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getActivitySystem?.() ?? engine?.activity` |
| 活动列表 | ✅ | 过滤 `status === 'ACTIVE'` |
| 任务奖励领取 | ✅ | `activitySystem.claimTaskReward()` |
| 里程碑领取 | ✅ | `activitySystem.claimMilestone()` |
| 签到按钮 | ⚠️ | **BUG-T11-11**: 签到按钮无 onClick 处理 |

#### BUG-T11-11: 活动签到按钮无点击事件

- **严重级**: P1（高）
- **位置**: `ActivityPanel.tsx` 签到卡片区域
- **代码**:
  ```tsx
  <button
    style={{ ...styles.signInBtn, ...(todaySigned ? styles.signInBtnDone : {}) }}
    disabled={todaySigned}
  >
    {todaySigned ? '✅ 今日已签' : '签到'}
  </button>
  ```
- **问题**: 签到按钮没有 `onClick` 处理函数。当 `todaySigned` 为 false 时，按钮可点击但无任何效果。
- **修复**: 添加 `onClick` 调用 `activitySystem.signIn()`:
  ```tsx
  onClick={() => {
    const result = activitySystem?.signIn?.();
    setMessage(result?.success ? '🎉 签到成功！' : '签到失败');
    setTimeout(() => setMessage(null), 2000);
  }}
  ```

#### AlliancePanel — 联盟 ❌

**文件**: `src/components/idle/panels/alliance/AlliancePanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getAllianceSystem?.() ?? engine?.alliance` |
| 联盟信息展示 | ✅ | `allianceSystem.getAlliance()` |
| 创建联盟 | ❌ | **BUG-T11-12**: 使用 `prompt()` |
| 联盟任务 | ⚠️ | 数据展示有，但操作回调不完整 |

#### BUG-T11-12: 创建联盟使用 prompt() 原生弹窗

- **严重级**: P0（紧急）
- **位置**: `AlliancePanel.tsx:31-36`
- **代码**:
  ```typescript
  const handleCreate = useCallback(() => {
    const name = prompt('输入联盟名称（2-8字）:');
    if (!name) return;
    // TODO: 调用引擎创建联盟 — 需传入 playerId/playerName
    flash(`联盟「${name}」创建成功！`);
  }, [flash]);
  ```
- **问题**: 
  1. 使用浏览器原生 `prompt()` 弹窗，体验差
  2. **TODO 未完成**: 实际并未调用引擎创建联盟，只是 flash 了成功消息
  3. 玩家看到"创建成功"但实际什么都没发生
- **修复**: 
  1. 替换为自定义输入弹窗（参考 ShopPanel 的购买确认弹窗模式）
  2. 调用 `allianceSystem.createAlliance({ name, playerId, playerName })`

#### PrestigePanel — 声望 ✅

**文件**: `src/components/idle/panels/prestige/PrestigePanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getPrestigeSystem?.() ?? engine?.prestige` |
| 声望等级 | ✅ | `ps.getCurrentLevelInfo()` |
| 进度条 | ✅ | 动态计算百分比 |
| 等级奖励领取 | ✅ | `ps.claimLevelReward(lv)` |
| 获取途径展示 | ✅ | `ps.getSourceConfigs()` |
| 调试代码 | ✅ | 无 |

#### HeritagePanel — 传承 ⚠️

**文件**: `src/components/idle/panels/heritage/HeritagePanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getHeritageSystem?.() ?? engine?.heritage` |
| 统计概览 | ✅ | `heritageSystem.getState()` |
| 初始资源领取 | ✅ | `heritageSystem.claimInitialGift()` |
| 一键重建 | ✅ | `heritageSystem.executeRebuild()` |
| 传承操作UI | ❌ | **BUG-T11-13**: TODO 占位，核心功能未实现 |

#### BUG-T11-13: 传承操作 UI 为 TODO 占位

- **严重级**: P1（高）
- **位置**: `HeritagePanel.tsx:103`
- **代码**: `{/* TODO: 完整的传承操作UI — 需要选择源/目标武将或装备 */}`
- **问题**: 武将传承、装备传承、经验传承三个 Tab 只有文字描述和提示"请在武将/装备面板中选择传承对象"，但实际没有选择界面和操作流程。
- **修复**: 实现源/目标选择器 + 确认弹窗 + 调用 `heritageSystem.transferHero()` / `heritageSystem.transferEquipment()` / `heritageSystem.transferExperience()`

#### SocialPanel — 社交 ⚠️

**文件**: `src/components/idle/panels/social/SocialPanel.tsx`

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 引擎调用 | ✅ | `engine?.getFriendSystem?.() ?? engine?.social?.friendSystem` |
| 好友列表 | ✅ | `friendSystem.getFriendList()` |
| 赠送兵力 | ✅ | `friendSystem.giftTroops()` |
| 拜访城堡 | ✅ | `friendSystem.visitCastle()` |
| 聊天 Tab | ❌ | **BUG-T11-14**: TODO 占位 |
| 排行 Tab | ❌ | **BUG-T11-15**: TODO 占位 |

#### BUG-T11-14: 聊天功能为 TODO 占位

- **严重级**: P2（中）
- **位置**: `SocialPanel.tsx:123`
- **代码**: `{/* TODO: 对接 ChatSystem */}`
- **问题**: 聊天 Tab 显示"聊天功能开发中"，无任何交互
- **修复**: 对接引擎 ChatSystem 或暂时隐藏该 Tab

#### BUG-T11-15: 排行榜功能为 TODO 占位

- **严重级**: P2（中）
- **位置**: `SocialPanel.tsx:132`
- **代码**: `{/* TODO: 对接 LeaderboardSystem */}`
- **问题**: 排行 Tab 显示"排行榜功能开发中"。注意：ArenaTab 中已有排行榜实现，可复用。
- **修复**: 对接 `engine.getRankingSystem()` 或复用 ArenaTab 排行榜组件

---

## 三、全局性问题

### BUG-T11-16: 多个面板使用 `(engine as any)` 或 `engine: any` 绕过类型检查

- **严重级**: P1（高）
- **影响范围**: EquipmentTab, EquipmentPanel, ArenaTab, 所有 MoreTab 子面板（QuestPanel, ShopPanel 等）
- **问题**: 
  - ArenaTab: `engine: any`
  - EquipmentTab: `(engine as any)?.equipment`
  - MoreTab 子面板: `engine: any`
  
  引擎已有完整的 getter 方法（`getEquipmentSystem()`, `getArenaSystem()` 等），但面板使用 `any` 类型 + 可选链降级取值，导致：
  1. 丧失 TypeScript 类型安全
  2. API 变更时无编译期错误提示
  3. 取值路径不一致（有的用 `engine?.getXXXSystem?.()`，有的用 `engine?.xxx`）

- **修复**: 统一使用 `engine: ThreeKingdomsEngine` 类型 + 正式 getter 方法

### BUG-T11-17: 部分面板消息反馈使用内联 `setMessage` 而非统一 Toast

- **严重级**: P2（低）
- **影响范围**: EquipmentTab, ArenaTab, AlliancePanel, PrestigePanel, HeritagePanel, SocialPanel, QuestPanel, AchievementPanel
- **问题**: 这些面板使用 `const [message, setMessage] = useState` + `setTimeout(() => setMessage(null), 2000)` 实现消息提示，而非使用已有的 `Toast` 组件。HeroTab / RecruitModal / HeroDetailModal 等已正确使用 `Toast`。
- **影响**: 
  1. 消息样式不统一
  2. 多个 setTimeout 同时运行可能导致内存泄漏
  3. 无法支持 Toast 的队列/堆叠功能
- **修复**: 统一使用 `Toast.success()` / `Toast.danger()` / `Toast.info()`

---

## 四、问题汇总（按优先级排序）

### P0 — 必须修复（阻塞上线）

| ID | 面板 | 问题 | 类型 |
|----|------|------|------|
| T11-06/07/08 | EquipmentPanel | 使用 `alert()` 原生弹窗（3处） | 交互 |
| T11-09 | ArenaTab | `Math.random()` 回退生成假战斗结果 | 数据 |
| T11-12 | AlliancePanel | 使用 `prompt()` + TODO 未调用引擎 | 交互 |

### P1 — 强烈建议（影响体验）

| ID | 面板 | 问题 | 类型 |
|----|------|------|------|
| T11-02 | CampaignTab | 扫荡未调用 SweepSystem | 引擎 |
| T11-04 | EquipmentTab | `(engine as any)` 非类型安全取值 | 类型 |
| T11-10 | ArenaTab | `engine: any` Props 类型 | 类型 |
| T11-11 | ActivityPanel | 签到按钮无 onClick | 交互 |
| T11-13 | HeritagePanel | 传承操作 UI 为 TODO 占位 | 功能 |
| T11-16 | 多面板 | `engine: any` 绕过类型检查 | 类型 |

### P2 — 优化提升

| ID | 面板 | 问题 | 类型 |
|----|------|------|------|
| T11-01 | TechTab | `console.warn` 未清理 | 代码 |
| T11-03 | CampaignTab | 缺少关卡奖励预览 | 交互 |
| T11-05 | EquipmentTab | Props 类型未对齐 | 类型 |
| T11-14 | SocialPanel | 聊天功能 TODO 占位 | 功能 |
| T11-15 | SocialPanel | 排行榜功能 TODO 占位 | 功能 |
| T11-17 | 多面板 | 消息反馈不统一 | 交互 |

---

## 五、修复优先级路线图

### 第一批（P0 — 紧急修复，1天）

1. **EquipmentPanel**: 3处 `alert()` → `Toast`
2. **ArenaTab**: 移除 `Math.random()` 回退，引擎不可用时 Toast 报错
3. **AlliancePanel**: `prompt()` → 自定义输入弹窗 + 实际调用引擎

### 第二批（P1 — 核心体验，2天）

4. **CampaignTab**: 扫荡改用 `engine.getSweepSystem()`
5. **EquipmentTab**: 移除 `(engine as any)`，使用正式 getter
6. **ArenaTab**: Props 类型改为 `ThreeKingdomsEngine`
7. **ActivityPanel**: 签到按钮添加 onClick
8. **HeritagePanel**: 实现传承选择器 UI
9. **多面板统一**: `engine: any` → `engine: ThreeKingdomsEngine`

### 第三批（P2 — 优化提升，2天）

10. **TechTab**: 移除 `console.warn`
11. **CampaignTab**: 添加关卡奖励预览
12. **SocialPanel**: 聊天/排行对接或隐藏 Tab
13. **多面板统一**: `setMessage` → `Toast`

---

## 六、统计数据

| 指标 | 数值 |
|------|------|
| 审计面板总数 | 22 |
| 无问题面板 | 12 (55%) |
| 有问题面板 | 10 (45%) |
| P0 问题 | 3 |
| P1 问题 | 6 |
| P2 问题 | 6 |
| 总问题数 | 15 |
| alert/prompt 使用 | 4 处 |
| Math.random 回退 | 1 处 |
| TODO 占位 | 4 处 |
| console 调试代码 | 1 处 |
| engine: any 类型 | 10+ 面板 |
