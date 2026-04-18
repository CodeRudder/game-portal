# 三国霸业 UI布局文档索引

> **版本**: v3.0 (完整索引) | **日期**: 2026-04-20
> **说明**: 25个模块完整索引，含功能点、旧文档对照、PRD交叉引用

---

## 一、模块索引表

| # | 模块代码 | 模块名 | 文件名 | 功能点数量 |
|---|---------|--------|--------|:----------:|
| 1 | INDEX | 索引 | INDEX.md | — |
| 2 | SPEC | 全局规范 | [SPEC-global.md](SPEC-global.md) | 7 |
| 3 | NAV | 主界面导航 | [NAV-main.md](NAV-main.md) | 12 |
| 4 | MAP | 世界地图 | [MAP-world.md](MAP-world.md) | 6 |
| 5 | CBT | 战斗系统 | [CBT-combat.md](CBT-combat.md) | 28 |
| 6 | HER | 武将系统 | [HER-heroes.md](HER-heroes.md) | 28 |
| 7 | TEC | 科技系统 | [TEC-tech.md](TEC-tech.md) | 7 |
| 8 | BLD | 建筑系统 | [BLD-buildings.md](BLD-buildings.md) | 7 |
| 9 | PRS | 声望系统 | [PRS-prestige.md](PRS-prestige.md) | 6 |
| 10 | RES | 资源系统 | [RES-resources.md](RES-resources.md) | 8 |
| 11 | NPC | NPC系统 | [NPC-npc.md](NPC-npc.md) | 8 |
| 12 | EVT | 事件系统 | [EVT-events.md](EVT-events.md) | 9 |
| 13 | QST | 任务系统 | [QST-quests.md](QST-quests.md) | 7 |
| 14 | ACT | 活动系统 | [ACT-activities.md](ACT-activities.md) | 5 |
| 15 | MAL | 邮件系统 | [MAL-mail.md](MAL-mail.md) | 6 |
| 16 | SHP | 商店系统 | [SHP-shop.md](SHP-shop.md) | 7 |
| 17 | EQP | 装备系统 | [EQP-equipment.md](EQP-equipment.md) | 9 |
| 18 | EXP | 远征系统 | [EXP-expedition.md](EXP-expedition.md) | 6 |
| 19 | SOC | 社交系统 | [SOC-social.md](SOC-social.md) | 4 |
| 20 | PVP | PVP竞技 | [PVP-arena.md](PVP-arena.md) | 5 |
| 21 | TRD | 贸易路线 | [TRD-trade.md](TRD-trade.md) | 4 |
| 22 | SET | 设置系统 | [SET-settings.md](SET-settings.md) | 8 |
| 23 | TUT | 引导系统 | [TUT-tutorial.md](TUT-tutorial.md) | 7 |
| 24 | OFR | 离线收益 | [OFR-offline.md](OFR-offline.md) | 6 |
| 25 | — | **合计 23个模块文件** | — | **204** |

---

## 二、功能点索引

### SPEC 全局规范 (7)
- [SPEC-1] 全局配色方案
- [SPEC-2] 字号体系
- [SPEC-3] 间距体系
- [SPEC-4] 组件库
- [SPEC-5] z-index 层级
- [SPEC-6] 动画规范
- [SPEC-7] 弹窗层级规范

### NAV 主界面导航 (12)
- [NAV-1] 主界面框架
  - [NAV-1-1] 资源栏
  - [NAV-1-2] 导航Tab栏
  - [NAV-1-3] 场景区
  - [NAV-1-4] 右侧面板区
  - [NAV-1-5] 居中弹窗区
  - [NAV-1-6] 全屏覆盖区
  - [NAV-1-7] 悬浮组件区
- [NAV-2] 更多下拉菜单
- [NAV-3] 手机端布局
- [NAV-4] 全局导航路径
- [NAV-5] 离线收益

### MAP 世界地图 (6)
- [MAP-1] 世界地图场景
  - [MAP-1-1] 筛选工具栏
  - [MAP-1-2] 六边形瓦片地图
  - [MAP-1-3] 小地图
- [MAP-2] 领土详情面板
- [MAP-3] 手机端地图

### CBT 战斗系统 (28)
- [CBT-1] 战役长卷
  - [CBT-1-1] 章节选择栏
  - [CBT-1-2] 关卡节点
  - [CBT-1-3] 关卡详情弹窗
- [CBT-2] 战前布阵
  - [CBT-2-1] 我方阵容区
  - [CBT-2-2] 敌方预览区
  - [CBT-2-3] 布阵信息区
  - [CBT-2-4] 武将选择列表
  - [CBT-2-5] 布阵快捷操作
- [CBT-3] 战斗场景
  - [CBT-3-1] 顶部状态栏
  - [CBT-3-2] 战斗画面
  - [CBT-3-3] 底部信息栏
  - [CBT-3-4] 战斗UI组件
  - [CBT-3-5] 回合结算面板
  - [CBT-3-6] 战斗结束结算
- [CBT-4] 手机端战斗
  - [CBT-4-1] 手机端战役长卷
  - [CBT-4-2] 手机端战前布阵
  - [CBT-4-3] 手机端战斗场景
- [CBT-5] 扫荡系统
  - [CBT-5-1] 扫荡确认面板
  - [CBT-5-2] 扫荡结果展示
- [CBT-6] 视觉规范
  - [CBT-6-1] 配色
  - [CBT-6-2] 字体
  - [CBT-6-3] 动效

### HER 武将系统 (28)
- [HER-1] 已招募武将
  - [HER-1-1] 筛选栏
  - [HER-1-2] 武将网格
  - [HER-1-3] 底部操作栏
- [HER-2] 武将名册
  - [HER-2-1] 名册网格
- [HER-3] 招募武将
  - [HER-3-1] 招募方式选择
  - [HER-3-2] 招募结果展示
  - [HER-3-3] 十连招募结果
- [HER-4] 武将详情面板
  - [HER-4-1] 基础信息区
  - [HER-4-2] 属性详情区
  - [HER-4-3] 装备槽区
  - [HER-4-4] 技能区
  - [HER-4-5] 突破/升星
- [HER-5] 手机端武将
  - [HER-5-1] 手机端已招募武将
  - [HER-5-2] 手机端武将名册
  - [HER-5-3] 手机端招募武将
  - [HER-5-4] 手机端武将详情
- [HER-6] 红点/养成提示系统
  - [HER-6-1] 红点规则
  - [HER-6-2] 养成入口提示
- [HER-7] 视觉规范
  - [HER-7-1] 配色
  - [HER-7-2] 字体
  - [HER-7-3] 动效

### TEC 科技系统 (7)
- [TEC-1] 科技树场景
  - [TEC-1-1] 科技节点
  - [TEC-1-2] 连接线
  - [TEC-1-3] 筛选栏
- [TEC-2] 科技详情面板
- [TEC-3] 研究中进度条
- [TEC-4] 手机端布局

### BLD 建筑系统 (7)
- [BLD-1] 建筑网格场景
  - [BLD-1-1] 建筑卡片
  - [BLD-1-2] 空地块
- [BLD-2] 建筑详情面板
- [BLD-3] 建造选择弹窗
- [BLD-4] 升级确认
- [BLD-5] 手机端布局

### PRS 声望系统 (6)
- [PRS-1] 声望分栏场景
  - [PRS-1-1] 声望等级展示
  - [PRS-1-2] 声望奖励预览
- [PRS-2] 转生确认弹窗
- [PRS-3] 转生结果弹窗
- [PRS-4] 手机端声望

### RES 资源系统 (8)
- [RES-1] 资源栏
  - [RES-1-1] 资源图标
  - [RES-1-2] 数值显示
  - [RES-1-3] 产出速率
  - [RES-1-4] 点击交互
  - [RES-1-5] 不足警告
- [RES-2] 资源产出汇总
- [RES-3] 手机端资源栏

### NPC NPC系统 (8)
- [NPC-1] NPC名册
  - [NPC-1-1] NPC列表
  - [NPC-1-2] NPC筛选
- [NPC-2] NPC对话
  - [NPC-2-1] 对话界面
  - [NPC-2-2] 对话选项
- [NPC-3] NPC交易弹窗
- [NPC-4] 手机端NPC

### EVT 事件系统 (9)
- [EVT-1] 地图事件弹窗
  - [EVT-1-1] 事件描述
  - [EVT-1-2] 选项按钮
- [EVT-2] 剧情事件
  - [EVT-2-1] 剧情展示
  - [EVT-2-2] 剧情选择
- [EVT-3] 随机事件
  - [EVT-3-1] 事件触发
  - [EVT-3-2] 奖励展示

### QST 任务系统 (7)
- [QST-1] 任务面板
  - [QST-1-1] 任务分类Tab
  - [QST-1-2] 任务列表
  - [QST-1-3] 任务详情
- [QST-2] 任务追踪悬浮组件
- [QST-3] 任务完成Toast
- [QST-4] 手机端布局

### ACT 活动系统 (5)
- [ACT-1] 活动列表弹窗
  - [ACT-1-1] 活动卡片
  - [ACT-1-2] 倒计时
- [ACT-2] 活动详情
- [ACT-3] 活动入口按钮
- [ACT-4] 手机端布局

### MAL 邮件系统 (6)
- [MAL-1] 邮件面板
  - [MAL-1-1] 邮件列表
  - [MAL-1-2] 邮件详情
  - [MAL-1-3] 附件领取
- [MAL-2] 新邮件提示
- [MAL-3] 手机端布局

### SHP 商店系统 (7)
- [SHP-1] 商店场景
  - [SHP-1-1] 商品网格
  - [SHP-1-2] 商品卡片
  - [SHP-1-3] 限购标记
- [SHP-2] 购买确认弹窗
- [SHP-3] 货币显示
- [SHP-4] 手机端布局

### EQP 装备系统 (9)
- [EQP-1] 背包界面
  - [EQP-1-1] 装备网格
  - [EQP-1-2] 筛选排序
  - [EQP-1-3] 批量操作
- [EQP-2] 装备详情面板
  - [EQP-2-1] 属性对比
- [EQP-3] 武将装备栏
- [EQP-4] 穿戴操作
- [EQP-5] 手机端布局

### EXP 远征系统 (6)
- [EXP-1] 远征场景
  - [EXP-1-1] 路线节点
  - [EXP-1-2] 远征队伍面板
- [EXP-2] 远征战斗结算
- [EXP-3] 远征配置弹窗
- [EXP-4] 手机端布局

### SOC 社交系统 (4)
- [SOC-1] 好友面板
- [SOC-2] 聊天面板
- [SOC-3] 排行榜面板
- [SOC-4] 手机端布局

### PVP PVP竞技 (5)
- [PVP-1] 竞技场场景
- [PVP-2] 战前布阵
- [PVP-3] 战斗结算
- [PVP-4] 防守阵容设置
- [PVP-5] 手机端布局

### TRD 贸易路线 (4)
- [TRD-1] 贸易路线场景
- [TRD-2] 派遣商队弹窗
- [TRD-3] 贸易收益面板
- [TRD-4] 手机端布局

### SET 设置系统 (8)
- [SET-1] 设置弹窗
  - [SET-1-1] 设置Tab
  - [SET-1-2] 基础设置
  - [SET-1-3] 音效设置
  - [SET-1-4] 画面设置
  - [SET-1-5] 账号设置
- [SET-2] 确认弹窗
- [SET-3] 手机端布局

### TUT 引导系统 (7)
- [TUT-1] 引导遮罩层
  - [TUT-1-1] 高亮区域
  - [TUT-1-2] 引导气泡
  - [TUT-1-3] 引导步骤指示
- [TUT-2] 军师建议面板
  - [TUT-2-1] 最小化状态
- [TUT-3] 手机端布局

### OFR 离线收益 (6)
- [OFR-1] 离线收益弹窗
  - [OFR-1-1] 收益摘要
  - [OFR-1-2] 翻倍按钮
  - [OFR-1-3] 领取按钮
- [OFR-2] 离线收益预览
- [OFR-3] 手机端布局

---

## 三、旧文档对照表

| 旧文件名 | 新文件名 |
|---------|---------|
| tk-ui-layout-01-navigation.md | NAV-main.md |
| tk-ui-layout-02-map-build-battle.md | MAP-world.md + CBT-combat.md + BLD-buildings.md |
| tk-ui-layout-03-hero-tech-prestige-res.md | HER-heroes.md + TEC-tech.md + PRS-prestige.md + RES-resources.md |
| tk-ui-layout-04-auxiliary.md | QST-quests.md + ACT-activities.md + MAL-mail.md + SHP-shop.md + EXP-expedition.md + SOC-social.md + PVP-arena.md + SET-settings.md + TUT-tutorial.md |
| tk-ui-layout-05-r1-fixes.md | 各模块增量修复（已合并） |
| tk-ui-layout-05-supplement-fixes.md | 各模块增量修复（已合并） |
| tk-ui-layout-06-npc-event-trade.md | NPC-npc.md + EVT-events.md + TRD-trade.md |
| tk-ui-layout-07-global-spec.md | SPEC-global.md |
| tk-ui-layout-08-supplements.md | 各模块增量补充（已合并） |
| tk-ui-layout-09-global-positioning.md | SPEC-global.md（定位规范） |
| tk-ui-layout-10-r3-fixes.md | 各模块增量修复（已合并） |
| tk-ui-layout-11-navigation-paths.md | NAV-main.md §NAV-4 |
| tk-ui-layout-12-battle-equipment-detail.md | CBT-combat.md + EQP-equipment.md |
| tk-ui-layout-13-hierarchy-popup-fix.md | SPEC-global.md（弹窗层级） |

---

## 四、PRD交叉引用表

| 模块代码 | 模块名 | UI布局文件 | PRD文件 |
|---------|--------|-----------|---------|
| SPEC | 全局规范 | [SPEC-global.md](SPEC-global.md) | — |
| NAV | 主界面导航 | [NAV-main.md](NAV-main.md) | [NAV-main-prd.md](../prd/NAV-main-prd.md) |
| MAP | 世界地图 | [MAP-world.md](MAP-world.md) | [MAP-world-prd.md](../prd/MAP-world-prd.md) |
| CBT | 战斗系统 | [CBT-combat.md](CBT-combat.md) | [CBT-combat-prd.md](../prd/CBT-combat-prd.md) |
| HER | 武将系统 | [HER-heroes.md](HER-heroes.md) | [HER-heroes-prd.md](../prd/HER-heroes-prd.md) |
| TEC | 科技系统 | [TEC-tech.md](TEC-tech.md) | [TEC-tech-prd.md](../prd/TEC-tech-prd.md) |
| BLD | 建筑系统 | [BLD-buildings.md](BLD-buildings.md) | [BLD-buildings-prd.md](../prd/BLD-buildings-prd.md) |
| PRS | 声望系统 | [PRS-prestige.md](PRS-prestige.md) | [PRS-prestige-prd.md](../prd/PRS-prestige-prd.md) |
| RES | 资源系统 | [RES-resources.md](RES-resources.md) | [RES-resources-prd.md](../prd/RES-resources-prd.md) |
| NPC | NPC系统 | [NPC-npc.md](NPC-npc.md) | [NPC-npc-prd.md](../prd/NPC-npc-prd.md) |
| EVT | 事件系统 | [EVT-events.md](EVT-events.md) | [EVT-events-prd.md](../prd/EVT-events-prd.md) |
| QST | 任务系统 | [QST-quests.md](QST-quests.md) | [QST-quests-prd.md](../prd/QST-quests-prd.md) |
| ACT | 活动系统 | [ACT-activities.md](ACT-activities.md) | [ACT-activities-prd.md](../prd/ACT-activities-prd.md) |
| MAL | 邮件系统 | [MAL-mail.md](MAL-mail.md) | [MAL-mail-prd.md](../prd/MAL-mail-prd.md) |
| SHP | 商店系统 | [SHP-shop.md](SHP-shop.md) | [SHP-shop-prd.md](../prd/SHP-shop-prd.md) |
| EQP | 装备系统 | [EQP-equipment.md](EQP-equipment.md) | [EQP-equipment-prd.md](../prd/EQP-equipment-prd.md) |
| EXP | 远征系统 | [EXP-expedition.md](EXP-expedition.md) | [EXP-expedition-prd.md](../prd/EXP-expedition-prd.md) |
| SOC | 社交系统 | [SOC-social.md](SOC-social.md) | [SOC-social-prd.md](../prd/SOC-social-prd.md) |
| PVP | PVP竞技 | [PVP-arena.md](PVP-arena.md) | [PVP-arena-prd.md](../prd/PVP-arena-prd.md) |
| TRD | 贸易路线 | [TRD-trade.md](TRD-trade.md) | [TRD-trade-prd.md](../prd/TRD-trade-prd.md) |
| SET | 设置系统 | [SET-settings.md](SET-settings.md) | [SET-settings-prd.md](../prd/SET-settings-prd.md) |
| TUT | 引导系统 | [TUT-tutorial.md](TUT-tutorial.md) | [TUT-tutorial-prd.md](../prd/TUT-tutorial-prd.md) |
| OFR | 离线收益 | [OFR-offline.md](OFR-offline.md) | [SPEC-offline.md](../prd/SPEC-offline.md) |

---

## 五、文档规范

### 引用格式
- 布局文档引用PRD: `> 📖 **玩法设计**: → [PRD: XXX](../prd/XXX-prd.md#编号)`
- PRD文档引用布局: `> 🎨 **UI布局**: → [UI: XXX](../ui-layout/XXX.md#编号)`

### 需求编号格式
- 1级: `[模块-1]` 如 `[BLD-1]`
- 2级: `[模块-1-1]` 如 `[BLD-1-1]`
- 3级: `[模块-1-1-1]` 如 `[BLD-1-1-1]`

### 锚点格式
所有 `##` 级标题均含显式锚点 `{#模块-编号}`（小写），支持跨文档精确跳转。
示例: `[CBT-3] 战斗场景` → 锚点 `{#cbt-3}`

---

*三国霸业 UI布局索引 v3.0 | 2026-04-20*
