# 三国霸业 — 需求编号体系 & 文档重组计划

> **版本**: v1.0 | **日期**: 2026-04-18

---

## 一、需求编号体系

### 编号格式: [模块-1级-2级-3级]

| 模块代码 | 模块名 | 对应旧文档 | 对应布局文档 |
|---------|--------|-----------|-------------|
| NAV | 全局导航 | 01-main-layout | layout-01, 11 |
| MAP | 世界地图 | 02-map-system | layout-02 |
| CBT | 战斗系统 | 03-combat-system, 26-campaign-stages | layout-02, 12 |
| HER | 武将系统 | 04-hero-system | layout-03 |
| TEC | 科技系统 | 05-tech-tree | layout-03 |
| BLD | 建筑系统 | 06-building-system | layout-02 |
| PRS | 声望系统 | 07-prestige-system | layout-03 |
| RES | 资源系统 | 08-resource-system, 23-currency-spec | layout-03 |
| NPC | NPC系统 | 09-npc-system | layout-06 |
| EVT | 事件系统 | 10-event-system | layout-06 |
| QST | 任务系统 | 11-quest-system | layout-04 |
| ACT | 活动系统 | 12-activity-system | layout-04 |
| MAL | 邮件系统 | 13-reward-mail | layout-04 |
| TUT | 引导系统 | 14-tutorial | layout-04 |
| SHP | 商店贸易 | 15-shop-trade | layout-04, 06 |
| EQP | 装备系统 | 16-equipment | layout-12 |
| EXP | 远征系统 | 17-expedition | layout-04 |
| SOC | 社交系统 | 18-social | layout-04 |
| SET | 设置系统 | 19-settings | layout-04 |
| ITR | 交互规范 | 20-interaction-spec | layout-07, 13 |
| RSP | 响应式设计 | 21-responsive | layout-07 |
| OFR | 离线收益 | 22-offline-reward-spec | layout-01 |
| PVP | PVP竞技 | 24-pvp-arena | layout-04 |
| TRD | 贸易路线 | 25-trade-route | layout-06 |
| ANI | 动画精灵 | 27-sprite-animation | layout-07 |

### 编号示例

```
[NAV-1]    = 全局导航 - 主界面
[NAV-1-1]  = 全局导航 - 主界面 - 资源栏
[NAV-1-2]  = 全局导航 - 主界面 - 导航Tab栏
[MAP-1]    = 世界地图 - 地图场景
[MAP-1-1]  = 世界地图 - 地图场景 - 筛选工具栏
[MAP-1-2]  = 世界地图 - 地图场景 - 六边形地图
[CBT-1]    = 战斗系统 - 战役长卷
[CBT-2]    = 战斗系统 - 战前布阵
[CBT-3]    = 战斗系统 - 战斗场景
[HER-1]    = 武将系统 - 已招募武将
[HER-2]    = 武将系统 - 武将名册
[HER-3]    = 武将系统 - 招募武将
[BLD-1]    = 建筑系统 - 建筑网格
[BLD-1-1]  = 建筑系统 - 建筑网格 - 农田
[EQP-1]    = 装备系统 - 背包界面
[EQP-2]    = 装备系统 - 装备详情
[EQP-2-1]  = 装备系统 - 装备详情 - 强化
```

---

## 二、文档重组结构

### 2.1 UI布局文档 (ui-layout/) — 重组为按功能模块索引

```
ui-layout/
├── INDEX.md                          # 总索引（2级：模块→功能点）
├── SPEC-global.md                    # 全局规范（合并07+13）
├── NAV-main.md                       # [NAV] 全局导航+主界面
├── MAP-world.md                      # [MAP] 世界地图
├── CBT-combat.md                     # [CBT] 战斗系统（布阵+战斗+结算）
├── HER-heroes.md                     # [HER] 武将系统（已招募+名册+招募）
├── TEC-tech.md                       # [TEC] 科技系统
├── BLD-buildings.md                  # [BLD] 建筑系统
├── PRS-prestige.md                   # [PRS] 声望系统
├── RES-resources.md                  # [RES] 资源系统
├── NPC-npc.md                        # [NPC] NPC系统
├── EVT-events.md                     # [EVT] 事件系统
├── QST-quests.md                     # [QST] 任务系统
├── ACT-activities.md                 # [ACT] 活动系统
├── MAL-mail.md                       # [MAL] 邮件系统
├── SHP-shop.md                       # [SHP] 商店系统
├── EQP-equipment.md                  # [EQP] 装备系统
├── EXP-expedition.md                 # [EXP] 远征系统
├── SOC-social.md                     # [SOC] 社交系统
├── PVP-arena.md                      # [PVP] PVP竞技
├── TRD-trade.md                      # [TRD] 贸易路线
├── SET-settings.md                   # [SET] 设置系统
├── TUT-tutorial.md                   # [TUT] 引导系统
└── reviews/                          # 评测报告归档
    ├── review-r1.md
    ├── review-r2.md
    ├── review-r3.md
    ├── review-r4.md
    └── review-r5.md
```

### 2.2 PRD文档 (prd/) — 旧UI设计文档重构

```
prd/
├── INDEX.md                          # PRD总索引
├── NAV-main-prd.md                   # [NAV] 主界面玩法设计
├── MAP-world-prd.md                  # [MAP] 地图玩法设计
├── CBT-combat-prd.md                 # [CBT] 战斗玩法设计
├── HER-heroes-prd.md                 # [HER] 武将玩法设计
├── TEC-tech-prd.md                   # [TEC] 科技玩法设计
├── BLD-buildings-prd.md              # [BLD] 建筑玩法设计
├── PRS-prestige-prd.md               # [PRS] 声望玩法设计
├── RES-resources-prd.md              # [RES] 资源玩法设计
├── NPC-npc-prd.md                    # [NPC] NPC玩法设计
├── EVT-events-prd.md                 # [EVT] 事件玩法设计
├── QST-quests-prd.md                 # [QST] 任务玩法设计
├── ACT-activities-prd.md             # [ACT] 活动玩法设计
├── MAL-mail-prd.md                   # [MAL] 邮件玩法设计
├── SHP-shop-prd.md                   # [SHP] 商店玩法设计
├── EQP-equipment-prd.md              # [EQP] 装备玩法设计
├── EXP-expedition-prd.md             # [EXP] 远征玩法设计
├── SOC-social-prd.md                 # [SOC] 社交玩法设计
├── PVP-arena-prd.md                  # [PVP] PVP玩法设计
├── TRD-trade-prd.md                  # [TRD] 贸易玩法设计
├── SET-settings-prd.md               # [SET] 设置玩法设计
├── TUT-tutorial-prd.md               # [TUT] 引导玩法设计
├── SPEC-interaction.md               # [ITR] 交互规范
├── SPEC-responsive.md                # [RSP] 响应式规范
├── SPEC-offline.md                   # [OFR] 离线收益
├── SPEC-animation.md                 # [ANI] 动画精灵
└── SPEC-currency.md                  # [RES-CUR] 货币体系
```

---

## 三、交叉引用规范

### UI布局文档中引用PRD：
```markdown
## [BLD-1] 建筑网格

> 📖 **玩法设计**: → [PRD: 建筑系统 - 建筑等级数据表](../prd/BLD-buildings-prd.md#bld-1)

### 布局 (PC端 1280×696px)
...
```

### PRD文档中引用UI布局：
```markdown
## [BLD-1] 建筑系统设计

> 🎨 **UI布局**: → [UI: 建筑网格布局](../ui-layout/BLD-buildings.md#bld-1)

### 建筑等级数据表
...
```

---

## 四、执行计划

### Phase 2: 重构UI布局文档（3个子任务并行）
- 子任务A: 创建INDEX.md + SPEC-global.md（合并全局规范）
- 子任务B: 重构核心模块布局文档（NAV/MAP/CBT/HER/BLD/TEC）
- 子任务C: 重构辅助模块布局文档（PRS/RES/NPC/EVT/QST/ACT等）

### Phase 3: 重构PRD文档（3个子任务并行）
- 子任务A: 创建INDEX.md + 重构核心PRD（NAV/MAP/CBT/HER/BLD/TEC）
- 子任务B: 重构辅助PRD（PRS/RES/NPC/EVT/QST/ACT/SHP/EQP）
- 子任务C: 重构规范PRD（SOC/PVP/TRD/SET/TUT + SPEC系列）

### Phase 4: 评审
### Phase 5: 迭代优化
