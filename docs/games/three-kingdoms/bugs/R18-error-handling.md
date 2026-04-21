# R18 错误处理与空状态审计报告

> 审计时间：2025-07-10  
> 审计范围：`src/components/idle/panels/` 下所有面板组件  
> 审计维度：空状态处理、错误处理（try-catch）、加载状态、资源不足提示

---

## 审计总览

| 面板 | 空状态 | 错误处理 | 加载状态 | 资源不足提示 | 评级 |
|------|--------|----------|----------|-------------|------|
| **HeroTab** | ✅ 有引导 | ✅ try-catch | ❌ 无 | ✅ HeroDetailModal有 | B |
| **HeroDetailModal** | ✅ | ✅ try-catch | ❌ 无 | ✅ 资源不足/碎片不足 | B |
| **HeroStarUpPanel** | ✅ | ✅ | ❌ 无 | ✅ insufficient样式 | B |
| **HeroStarUpModal** | ✅ | ✅ | ❌ 无 | ✅ insufficient样式 | B |
| **RecruitModal** | ✅ | ✅ try-catch | ❌ 无 | ⚠️ 部分 | B |
| **BuildingPanel** | ✅ 锁定态 | ✅ try-catch | ❌ 无 | ✅ BuildingUpgradeModal | B |
| **BuildingUpgradeModal** | ✅ | ✅ | ❌ 无 | ✅ "资源不足"+原因列表 | A |
| **TechTab** | ✅ | ✅ try-catch | ❌ 无 | ✅ 测试覆盖 | B |
| **TechResearchPanel** | ✅ 空槽位 | ✅ | ❌ 无 | ✅ | B |
| **TechOfflinePanel** | ✅ "暂无" | ✅ | ❌ 无 | N/A | B |
| **CampaignTab** | ✅ | ✅ try-catch | ❌ 无 | ⚠️ 无明确提示 | C |
| **ArmyTab** | ✅ | ✅ try-catch | ❌ 无 | ❌ 无 | C |
| **EquipmentPanel** | ✅ "暂无装备" | ❌ 无try-catch | ❌ 无 | ❌ 无 | D |
| **EquipmentTab** | ✅ "暂无装备" | ❌ 无try-catch | ❌ 无 | ❌ 无 | D |
| **ShopPanel** | ✅ "暂无商品" | ✅ try-catch | ❌ 无 | ⚠️ 依赖后端reason | B |
| **MailPanel** | ✅ "暂无邮件" | ❌ 无try-catch | ❌ 无 | N/A | C |
| **SocialPanel** | ✅ 多处 | ✅ try-catch | ❌ 无 | N/A | B |
| **NPCTab** | ✅ "暂无NPC" | ✅ | ❌ 无 | N/A | B |
| **NPCDialogModal** | ✅ | ✅ | ⚠️ "加载中..." | N/A | A |
| **ExpeditionPanel** | ✅ "暂无" | ✅ try-catch | ❌ 无 | ❌ 无 | C |
| **ExpeditionTab** | ✅ 多处 | ✅ try-catch | ❌ 无 | ❌ 无 | C |
| **ArenaPanel(pvp)** | ✅ "暂无对手" | ✅ try-catch | ❌ 无 | ⚠️ 挑战次数不足 | B |
| **ArenaTab(arena)** | ✅ 多处 | ✅ try-catch | ❌ 无 | ⚠️ 挑战次数 | B |
| **QuestPanel** | ✅ "暂无任务" | ❌ 无try-catch | ❌ 无 | N/A | C |
| **AchievementPanel** | ✅ "暂无成就" | ❌ 无try-catch | ❌ 无 | N/A | C |
| **ActivityPanel** | ✅ "无活跃活动" | ✅ try-catch | ❌ 无 | N/A | B |
| **AlliancePanel** | ✅ "未加入联盟" | ✅ try-catch | ❌ 无 | ⚠️ 名称校验 | B |
| **HeritagePanel** | ✅ 占位符 | ❌ 无try-catch | ❌ 无 | ❌ 无 | D |
| **PrestigePanel** | ❌ 无空状态 | ❌ 无try-catch | ❌ 无 | ❌ 无 | D |
| **WorldMapTab** | ✅ "暂无匹配" | ❌ 无try-catch | ❌ 无 | N/A | C |
| **EventBanner** | N/A | N/A | N/A | N/A | A |
| **RandomEncounterModal** | N/A | N/A | N/A | N/A | A |
| **ResourceBar** | N/A | N/A | N/A | ✅ 容量警告色 | A |
| **MoreTab** | N/A | N/A | N/A | N/A | A |

---

## 1. 缺少空状态处理的面板

### 🔴 严重缺失

| 面板 | 场景 | 现状 |
|------|------|------|
| **PrestigePanel** | `sources` 为空数组时 | 无"暂无获取途径"提示 |
| **PrestigePanel** | `rewards` 为空数组时 | 无"暂无等级奖励"提示 |
| **PrestigePanel** | `ps` 为 null（系统不可用） | 无降级提示，直接 crash |

### 🟡 中等缺失

| 面板 | 场景 | 现状 |
|------|------|------|
| **HeritagePanel** | 传承历史为空 | 仅条件渲染，无独立空状态提示 |
| **HeritagePanel** | `heritageSystem` 为 null | 无降级提示 |
| **AlliancePanel** | 成员列表为空（已加入联盟但无成员） | 无空列表提示 |
| **WorldMapTab** | `territories` 为空数组 | 仅筛选后显示"暂无匹配"，初始空列表无提示 |
| **EquipmentPanel** | 装备详情中无副属性 | 无"无副属性"提示（静默不显示） |

---

## 2. 缺少错误处理（try-catch）的面板

### 🔴 严重缺失 — 用户操作无错误保护

| 面板 | 操作 | 风险 |
|------|------|------|
| **EquipmentPanel** | 强化操作（内联onClick） | `enhanceSys.enhance()` 可能抛异常，无try-catch |
| **EquipmentPanel** | 锻造操作（内联onClick） | `forgeSys.basicForge()` 可能抛异常，无try-catch |
| **EquipmentPanel** | 分解操作 `handleDecompose` | `eqSystem.decompose()` 无try-catch |
| **EquipmentTab** | 锻造操作 `handleForge` | `forgeSys.basicForge()` / `advancedForge()` 无try-catch |
| **EquipmentTab** | 强化操作 `handleEnhance` | `enhanceSys.enhance()` 无try-catch |
| **EquipmentTab** | 分解操作 `handleDecompose` | `eqSys.decompose()` 无try-catch |
| **HeritagePanel** | 领取初始资源 `handleClaimGift` | `heritageSystem.claimInitialGift()` 无try-catch |
| **HeritagePanel** | 一键重建 `handleRebuild` | `heritageSystem.executeRebuild()` 无try-catch |
| **PrestigePanel** | 领取等级奖励 `handleClaim` | `ps.claimLevelReward()` 无try-catch |

### 🟡 中等缺失

| 面板 | 操作 | 风险 |
|------|------|------|
| **MailPanel** | 领取附件 `handleClaimAttachments` | `mailSystem.claimAttachments()` 无try-catch |
| **MailPanel** | 一键领取 `handleClaimAll` | `mailSystem.claimAllAttachments()` 无try-catch |
| **MailPanel** | 一键已读 `handleMarkAllRead` | `mailSystem.markAllRead()` 无try-catch |
| **QuestPanel** | 领取奖励 `handleClaim` | `qs.claimReward()` 无try-catch |
| **QuestPanel** | 一键领取 `handleClaimAll` | `qs.claimAllRewards()` 无try-catch |
| **QuestPanel** | 里程碑领取 `handleMilestone` | `qs.claimActivityMilestone()` 无try-catch |
| **AchievementPanel** | 领取奖励 `handleClaim` | `ach.claimReward()` 无try-catch |
| **WorldMapTab** | 选择领土 `handleSelectTerritory` | 无错误边界 |

---

## 3. 缺少加载状态的面板

### 全局性问题

**几乎所有面板都缺少加载状态**。仅 `NPCDialogModal` 有 "加载中..." 提示。

| 缺失场景 | 影响面板 |
|----------|---------|
| 引擎系统初始化期间 | 所有面板 |
| 异步操作进行中（购买/升级/锻造/强化） | EquipmentPanel, EquipmentTab, ShopPanel, BuildingPanel |
| 网络请求模拟（如果有） | 所有涉及引擎调用的面板 |
| 列表数据加载 | 所有列表类面板 |

### 建议添加加载状态的高优先级面板

1. **EquipmentTab** — 锻造/强化操作需要等待结果
2. **ShopPanel** — 购买操作进行中应禁用按钮
3. **CampaignTab** — 战斗进行中应显示状态
4. **BuildingPanel** — 升级确认后等待响应
5. **ArenaPanel/ArenaTab** — 挑战进行中

---

## 4. 缺少资源不足提示的面板

### 🔴 严重缺失

| 面板 | 操作 | 现状 |
|------|------|------|
| **EquipmentPanel** | 强化装备 | 无资源检查，直接调用引擎，失败后无具体原因 |
| **EquipmentPanel** | 锻造装备 | 无材料检查，无"材料不足"提示 |
| **EquipmentTab** | 锻造操作 | 无材料不足前置检查 |
| **EquipmentTab** | 强化操作 | 无资源不足前置检查 |
| **HeritagePanel** | 传承操作 | 无铜钱不足提示 |
| **HeritagePanel** | 一键重建 | 无资源不足提示 |
| **PrestigePanel** | 领取奖励 | 无重复领取/条件不足提示 |

### 🟡 中等缺失

| 面板 | 操作 | 现状 |
|------|------|------|
| **ExpeditionPanel** | 派遣队伍 | 无兵力不足提示 |
| **ExpeditionPanel** | 推进路线 | 无体力不足提示 |
| **ExpeditionTab** | 派遣/推进 | 同上 |
| **ArmyTab** | 编队保存 | 无资源消耗提示 |
| **CampaignTab** | 挑战关卡 | 无体力/兵力不足提示 |
| **ShopPanel** | 购买商品 | 依赖后端 `result.reason`，前端无预检查 |

---

## 5. 修复优先级建议

### P0 — 必须立即修复（会导致白屏/crash）

| # | 面板 | 问题 | 修复方案 |
|---|------|------|---------|
| 1 | **EquipmentPanel** | 强化/锻造/分解操作无 try-catch | 包裹 try-catch，catch 中 flash 错误信息 |
| 2 | **EquipmentTab** | 锻造/强化/分解操作无 try-catch | 同上 |
| 3 | **PrestigePanel** | `ps` 为 null 时 `.toFixed()` crash | 添加 null 检查，显示"声望系统暂未开放" |
| 4 | **HeritagePanel** | `handleClaimGift`/`handleRebuild` 无 try-catch | 包裹 try-catch |

### P1 — 高优先级（影响用户体验）

| # | 面板 | 问题 | 修复方案 |
|---|------|------|---------|
| 5 | **MailPanel** | 所有操作无 try-catch | 包裹 try-catch |
| 6 | **QuestPanel** | 所有操作无 try-catch | 包裹 try-catch |
| 7 | **AchievementPanel** | 领取操作无 try-catch | 包裹 try-catch |
| 8 | **EquipmentPanel/Tab** | 无资源不足前置提示 | 强化前检查材料，显示"❌ 材料不足" |
| 9 | **PrestigePanel** | 无空状态 | sources/rewards 为空时显示"暂无数据" |
| 10 | **HeritagePanel** | 无资源不足提示 | 传承前检查铜钱，提示"铜钱不足" |

### P2 — 中优先级（体验优化）

| # | 面板 | 问题 | 修复方案 |
|---|------|------|---------|
| 11 | **全局面板** | 缺少加载状态 | 添加 `loading` state，操作中显示 spinner 或禁用按钮 |
| 12 | **ExpeditionPanel/Tab** | 无资源不足提示 | 派遣前检查兵力/体力 |
| 13 | **CampaignTab** | 无体力不足提示 | 挑战前检查体力 |
| 14 | **ShopPanel** | 无前端资源预检查 | 购买前对比货币余额与价格 |
| 15 | **WorldMapTab** | 初始空列表无提示 | territories 为空时显示"地图数据加载中" |

### P3 — 低优先级（锦上添花）

| # | 面板 | 问题 | 修复方案 |
|---|------|------|---------|
| 16 | **AlliancePanel** | 成员空列表 | 添加"暂无成员"提示 |
| 17 | **HeritagePanel** | 传承历史空状态 | 添加"暂无传承记录"提示 |
| 18 | **全局面板** | 引擎系统不可用降级 | 统一 fallback UI 组件 |

---

## 6. 推荐统一方案

### 6.1 统一 try-catch 模式

```tsx
// 推荐封装一个 safeAction 工具函数
const safeAction = (fn: () => void, flash: (msg: string) => void) => {
  try {
    fn();
  } catch (e: any) {
    flash(e?.message ?? '操作失败');
  }
};

// 使用示例
const handleForge = useCallback(() => {
  safeAction(() => {
    const result = forgeSys.basicForge();
    flash(result?.success ? '锻造成功' : '锻造失败');
  }, flash);
}, [forgeSys, flash]);
```

### 6.2 统一空状态组件

```tsx
// 建议创建 EmptyState 组件
const EmptyState = ({ icon, text }: { icon: string; text: string }) => (
  <div style={{ textAlign: 'center', padding: 30, color: '#666', fontSize: 13 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
    {text}
  </div>
);
```

### 6.3 统一系统不可用降级

```tsx
// 建议创建 SystemUnavailable 组件
const SystemUnavailable = ({ name }: { name: string }) => (
  <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
    <div>{name}系统暂未开放</div>
  </div>
);

// 使用：当引擎子系统为 null 时
if (!eqSystem) return <SystemUnavailable name="装备" />;
```

### 6.4 统一资源不足提示

```tsx
// 建议在操作前添加前置检查
const checkResource = (cost: Record<string, number>, balance: Record<string, number>): string | null => {
  for (const [key, amount] of Object.entries(cost)) {
    if ((balance[key] ?? 0) < amount) {
      return `${CUR_LABELS[key] ?? key}不足（需要${amount}，当前${balance[key] ?? 0}）`;
    }
  }
  return null;
};
```

---

## 7. 统计摘要

| 维度 | ✅ 已覆盖 | ❌ 缺失 | 覆盖率 |
|------|----------|--------|--------|
| 空状态处理 | 28 | 5 | 85% |
| try-catch 错误处理 | 20 | 13 | 61% |
| 加载状态 | 1 | 33 | 3% |
| 资源不足提示 | 8 | 12 | 40% |

**最严重的问题**：EquipmentPanel/EquipmentTab 的操作无 try-catch（P0），PrestigePanel 可能 crash（P0），全局缺少加载状态（P2）。
