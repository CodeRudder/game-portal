# 🚀 Game Portal 放置游戏专区 — 开发计划文档

> **项目**: Game Portal 放置游戏专区（Idle Games Zone）  
> **版本**: v2.0  
> **日期**: 2026-04-14  
> **技术路线**: H5 (HTML5 Canvas + React + TypeScript + Tailwind CSS)  
> **目标平台**: PC / 移动端自适应  
> **仓库**: git@github.com:CodeRudder/game-portal.git  
> **规模**: 20 大主题系列 × 100 款放置游戏 × 20 个批次

---

## 一、项目总览

### 1.1 项目目标

在现有 Game Portal 项目中新增 **"放置游戏专区"（Idle Games Zone）**，规划 **20 大主题系列、100 款放置游戏**，分 **20 个批次** 开发完成。

### 1.2 核心原则

| 原则 | 描述 |
|------|------|
| **H5跨平台** | 单一代码库，PC/手机/平板自适应 |
| **多画质风格** | 6种画风（像素/Q版/水墨/扁平/日系/手绘），自动适配设备性能 |
| **题材忠实** | 人物形象及故事世界贴近原始题材及画风 |
| **引擎复用** | 通用放置游戏引擎，每款游戏继承扩展 |
| **离线可玩** | 支持离线收益、自动存档、存档导入导出 |
| **渐进式复杂度** | 从简单点击到复杂策略，新手友好 |

### 1.3 开发里程碑

```
Phase 0: 基础设施 (1 周)
  └── 通用放置引擎 + UI框架 + 自适应系统

Phase 1: Batch 1~4 (8 周, 20 款游戏)
  └── 萌宠/修仙/文明/生存 四个基础系列

Phase 2: Batch 5~8 (8 周, 20 款游戏)
  └── 神话/策略致敬/RPG致敬/D&D 系列

Phase 3: Batch 9~12 (8 周, 20 款游戏)
  └── 仙侠RPG/金庸武侠/古龙武侠/网游回忆 系列

Phase 4: Batch 13~16 (8 周, 20 款游戏)
  └── 动漫热血/动漫温情/影视文学/休闲益智 系列

Phase 5: Batch 17~20 (8 周, 20 款游戏)
  └── 射击竞技/经典致敬综合/策略经营/休闲创意 系列

总计: ~33 周, 100 款游戏
```

---

## 二、通用放置游戏引擎设计

### 2.1 引擎架构

```
src/engines/idle/
├── IdleGameEngine.ts          — 放置游戏基类
├── systems/
│   ├── ResourceSystem.ts      — 资源管理
│   ├── UpgradeSystem.ts       — 升级管理
│   ├── PrestigeSystem.ts      — 转生/重置
│   ├── AutomationSystem.ts    — 自动化
│   ├── AchievementSystem.ts   — 成就系统
│   ├── EventSystem.ts         — 随机事件
│   ├── OfflineSystem.ts       — 离线收益
│   └── SaveSystem.ts          — 存档管理
├── math/
│   ├── BigNumber.ts           — 大数运算
│   ├── Formulas.ts            — 数值公式
│   └── BalanceConfig.ts       — 平衡配置
└── renderer/
    ├── AdaptiveRenderer.ts    — 自适应渲染
    ├── PixelRenderer.ts       — 像素风
    ├── InkRenderer.ts         — 水墨风
    ├── AnimeRenderer.ts       — 日系动画
    └── FlatRenderer.ts        — 扁平风
```

### 2.2 IdleGameEngine 核心接口

```typescript
interface IdleGameState {
  resources: Record<string, Resource>;
  upgrades: Record<string, Upgrade>;
  achievements: string[];
  prestige: PrestigeData;
  statistics: GameStatistics;
  lastSaveTime: number;
  gamePhase: number;
}

interface Resource {
  id: string; name: string;
  amount: BigNumber; perSecond: BigNumber;
  maxAmount: BigNumber; unlocked: boolean;
}

interface Upgrade {
  id: string; name: string; description: string;
  baseCost: Record<string, BigNumber>;
  costMultiplier: number;
  level: number; maxLevel: number;
  effect: UpgradeEffect;
  unlocked: boolean; requires?: string[];
}

interface PrestigeData {
  currency: BigNumber; multiplier: number;
  count: number; unlocks: string[];
}
```

### 2.3 离线收益系统

```typescript
class OfflineSystem {
  calculateOfflineProgress(
    state: IdleGameState, offlineMs: number,
    config: { maxOfflineHours: number; efficiency: number }
  ): { earnedResources: Record<string, BigNumber>; events: OfflineEvent[] } {
    const maxMs = config.maxOfflineHours * 3600 * 1000;
    const effectiveMs = Math.min(offlineMs, maxMs);
    const earned: Record<string, BigNumber> = {};
    for (const [id, resource] of Object.entries(state.resources)) {
      if (resource.perSecond.gt(0)) {
        earned[id] = resource.perSecond.multiply(effectiveMs / 1000).multiply(config.efficiency);
      }
    }
    return { earnedResources: earned, events: this.generateOfflineEvents(effectiveMs, state) };
  }
}
```

---

## 三、100 款游戏开发清单

### 📦 Batch 1: 萌宠王国系列 (Idle v1.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 1 | 猫咪王国 | kittens-kingdom | 像素萌系 | 猫咪文明发展 | ~800行 | 150+ |
| 2 | 狗狗家园 | doggo-home | 卡通Q版 | 狗狗牧场经营 | ~700行 | 130+ |
| 3 | 企鹅帝国 | penguin-empire | 冰晶卡通 | 南极企鹅文明 | ~750行 | 140+ |
| 4 | 恐龙牧场 | dino-ranch | 像素复古 | 侏罗纪恐龙培育 | ~700行 | 130+ |
| 5 | 蚂蚁王国 | ant-kingdom | 微观写实 | 蚁巢建设+兵种 | ~750行 | 140+ |

**开发重点**: 建立放置引擎基类 + 像素/卡通渲染器 + 自适应 UI 框架

### 📦 Batch 2: 修仙传说系列 (Idle v2.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 6 | 挂机修仙·凡人篇 | idle-xianxia | 水墨国风 | 境界修炼+突破 | ~900行 | 170+ |
| 7 | 宗门崛起 | sect-rise | 水墨国风 | 宗门经营+弟子 | ~850行 | 160+ |
| 8 | 家族风云 | clan-saga | 水墨工笔 | 家族传承+领地 | ~800行 | 150+ |
| 9 | 渡劫飞升 | tribulation | 水墨特效 | 天劫+仙界 | ~750行 | 140+ |
| 10 | 炼丹大师 | alchemy-master | 水墨国风 | 炼丹炼器 | ~700行 | 130+ |

**开发重点**: 水墨风渲染器 + 境界突破系统 + 宗门管理 AI

### 📦 Batch 3: 文明演进系列 (Idle v3.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 11 | 四大文明·古埃及 | civ-egypt | 壁画风 | 尼罗河文明 | ~850行 | 160+ |
| 12 | 四大文明·古巴比伦 | civ-babylon | 壁画风 | 两河流域 | ~800行 | 150+ |
| 13 | 四大文明·古印度 | civ-india | 壁画风 | 恒河文明 | ~800行 | 150+ |
| 14 | 四大文明·古中国 | civ-china | 国风工笔 | 华夏文明 | ~900行 | 170+ |
| 15 | 现代都市 | modern-city | 扁平现代 | 城市建设 | ~850行 | 160+ |

**开发重点**: 科技树系统 + 时代演进 + 壁画渲染器 + 扁平渲染器

### 📦 Batch 4: 生存冒险系列 (Idle v4.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 16 | 海岛漂流 | island-drift | 像素热带 | 荒岛生存 | ~800行 | 150+ |
| 17 | 野外求生 | wild-survival | 像素自然 | 荒野建造 | ~850行 | 160+ |
| 18 | 末日生存 | doomsday | 灰暗像素 | 废土避难所 | ~800行 | 150+ |
| 19 | 太空漂流 | space-drift | 科幻UI | 飞船探索 | ~850行 | 160+ |
| 20 | 地下城探险 | dungeon-explore | 暗黑像素 | 地牢探索 | ~750行 | 140+ |

**开发重点**: 生存系统（饥饿/健康/温度）+ 探索地图 + 随机事件引擎

### 📦 Batch 5: 神话传说系列 (Idle v5.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 21 | 封神演义 | fengshen | 国风工笔重彩 | 神仙收集+对战 | ~900行 | 170+ |
| 22 | 希腊众神 | greek-gods | 陶瓶风 | 众神养成 | ~800行 | 150+ |
| 23 | 北欧英灵 | norse-valkyrie | 维京像素 | 英灵殿+Ragnarok | ~850行 | 160+ |
| 24 | 日本妖怪 | yokai-night | 浮世绘 | 百鬼收集 | ~800行 | 150+ |
| 25 | 埃及神话 | egypt-myth | 壁画风 | 神殿+法老 | ~750行 | 140+ |

**开发重点**: 角色收集系统 + 战斗引擎 + 多种文化渲染器

### 📦 Batch 6: 经典策略致敬系列 (Idle v6.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 26 | 红色警戒 | red-alert | 军事像素 | 即时战略+基地 | ~900行 | 170+ |
| 27 | 三国志 | three-kingdoms | 国风水墨 | 势力经营+武将 | ~950行 | 180+ |
| 28 | 全面战争 | total-war | 写实策略 | 大规模战争 | ~1000行 | 190+ |
| 29 | 帝国时代 | age-of-empires | 等距像素 | 文明发展+资源 | ~900行 | 170+ |
| 30 | 英雄无敌 | heroes-might | 奇幻卡通 | 英雄养成+城堡 | ~900行 | 170+ |

**开发重点**: 基地建设系统 + 兵种训练 + 资源采集链 + 势力对抗 AI

### 📦 Batch 7: 经典RPG致敬系列 (Idle v7.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 31 | 最终幻想 | final-fantasy | 日系像素RPG | 回合制+召唤兽 | ~950行 | 180+ |
| 32 | 博德之门 | baldurs-gate | 暗黑奇幻 | 团队冒险+选择 | ~900行 | 170+ |
| 33 | 上古卷轴 | elder-scrolls | 写实奇幻 | 开放世界+公会 | ~950行 | 180+ |
| 34 | 猎魔传说 | witcher-tale | 暗黑写实 | 猎魔任务+炼金 | ~900行 | 170+ |
| 35 | 暗黑破坏神 | diablo-idle | 暗黑哥特 | 地牢刷装备 | ~950行 | 180+ |

**开发重点**: 角色成长系统 + 装备收集 + 技能树 + 队伍管理

### 📦 Batch 8: 龙与地下城系列 (Idle v8.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 36 | 龙与地下城 | dnd-adventure | 奇幻插画 | 跑团冒险+角色 | ~900行 | 170+ |
| 37 | 无冬之夜 | neverwinter | D&D写实 | 城市冒险+地下城 | ~850行 | 160+ |
| 38 | 龙之信条 | dragons-dogma | 暗黑奇幻 | 职业战斗+随从 | ~900行 | 170+ |
| 39 | 地牢围攻 | dungeon-siege | 暗黑欧美 | 组队地牢探险 | ~850行 | 160+ |
| 40 | 天国降临 | kingdom-come | 写实中世纪 | 中世纪生存 | ~850行 | 160+ |

**开发重点**: D20骰子系统 + 职业/种族选择 + 地下城随机生成 + 随从系统

### 📦 Batch 9: 中国仙侠RPG系列 (Idle v9.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 41 | 仙剑奇侠传 | chinese-paladin | 国风唯美 | 回合制+情感剧情 | ~900行 | 170+ |
| 42 | 轩辕剑 | xuanyuan-sword | 国风水墨 | 炼妖壶+机关术 | ~850行 | 160+ |
| 43 | 仙侠情缘 | xianxia-romance | 仙侠Q版 | 修仙+情缘系统 | ~800行 | 150+ |
| 44 | 幻想三国志 | fantasy-three | 日系国风 | 三国+幻想元素 | ~800行 | 150+ |
| 45 | 武林群侠传 | wulin-heroes | 国风像素 | 自由养成+门派探索 | ~850行 | 160+ |

**开发重点**: 情缘系统 + 炼妖壶收集 + 机关术制造 + 自由养成系统（多维度成长）

### 📦 Batch 10: 金庸武侠系列 (Idle v10.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 46 | 射雕英雄传 | eagle-shooting | 武侠水墨 | 郭靖成长+武功 | ~850行 | 160+ |
| 47 | 神雕侠侣 | condor-heroes | 武侠水墨 | 杨过小龙女 | ~850行 | 160+ |
| 48 | 倚天屠龙记 | heaven-sword | 武侠水墨 | 张无忌+明教 | ~850行 | 160+ |
| 49 | 天龙八部 | eight-dragons | 武侠水墨 | 三兄弟传奇 | ~900行 | 170+ |
| 50 | 鹿鼎记 | deer-cauldron | 武侠Q版 | 韦小宝+天地会 | ~800行 | 150+ |

**开发重点**: 武功修炼系统（内功/外功/轻功）+ 门派系统 + 江湖声望 + 奇遇事件

### 📦 Batch 11: 古龙武侠系列 (Idle v11.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 51 | 小李飞刀 | flying-dagger | 武侠写意 | 李寻欢+飞刀绝技 | ~800行 | 150+ |
| 52 | 楚留香传奇 | chu-liuxiang | 武侠写意 | 盗帅+推理冒险 | ~850行 | 160+ |
| 53 | 陆小凤传奇 | lu-xiaofeng | 武侠写意 | 灵犀一指+破案 | ~800行 | 150+ |
| 54 | 天涯明月刀 | horizon-blade | 武侠写意 | 傅红雪+复仇 | ~750行 | 140+ |
| 55 | 新绝代双骄 | twin-heroes | 武侠Q版 | 小鱼儿花无缺 | ~800行 | 150+ |

**开发重点**: 轻功身法系统 + 推理探案系统 + 飞刀/剑法绝技 + 酒馆情报

### 📦 Batch 12: 网游回忆系列 (Idle v12.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 56 | 梦幻挂机 | fantasy-west | Q版国风 | 回合制+宠物 | ~900行 | 170+ |
| 57 | 大话修仙 | great-journey | Q版国风 | 剧情挂机+伙伴 | ~850行 | 160+ |
| 58 | 艾泽拉斯挂机 | azeroth-idle | 魔兽Q版 | 副本+装备 | ~900行 | 170+ |
| 59 | 玛法传奇 | legend-of-mir | 复古像素 | 打怪爆装+攻城 | ~850行 | 160+ |
| 60 | 热血江湖梦 | hot-blood | Q版武侠 | 武侠RPG+门派 | ~800行 | 150+ |

**开发重点**: 宠物/伙伴系统 + 副本挑战 + 装备强化 + PVP竞技

### 📦 Batch 13: 动漫联动·热血篇 (Idle v13.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 61 | 龙珠战士 | dragon-warriors | 龙珠原画 | 战斗力+变身 | ~900行 | 170+ |
| 62 | 灌篮高手 | slam-dunk | 井上画风 | 篮球养成+比赛 | ~800行 | 150+ |
| 63 | 海贼王冒险 | pirate-adventure | 尾田画风 | 航海+伙伴 | ~900行 | 170+ |
| 64 | 魂斗罗挂机 | contra-idle | 8-bit像素 | 横版射击 | ~800行 | 150+ |
| 65 | 名侦探挂机 | detective-conan | 日系动画 | 推理破案+线索 | ~800行 | 150+ |

**开发重点**: 战斗力/变身系统 + 体育比赛引擎 + 航海系统 + 推理系统

### 📦 Batch 14: 动漫联动·温情篇 (Idle v14.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 66 | 战国犬夜叉 | inuyasha-sengoku | 日系古风 | 穿越冒险+碎片 | ~850行 | 160+ |
| 67 | 蜡笔小新的日常 | crayon-days | 蜡笔原画 | 搞笑日常 | ~650行 | 120+ |
| 68 | 哆啦A梦的口袋 | doraemon-pocket | 藤子风 | 道具收集+冒险 | ~750行 | 140+ |
| 69 | 熊出没森林 | bear-forest | 国产卡通 | 森林攻防+光头强对抗 | ~700行 | 130+ |
| 70 | 猫鼠大战 | tom-and-jerry | 美式卡通 | 追逐策略+陷阱 | ~750行 | 140+ |

**开发重点**: 手绘渲染器 + 碎片收集系统 + 道具发明 + 领地攻防

### 📦 Batch 15: 影视文学系列 (Idle v15.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 71 | 贝克街探案 | baker-street | 英伦复古 | 侦探推理+案件 | ~800行 | 150+ |
| 72 | 摩登时代 | modern-times | 黑白默片 | 默片喜剧+工厂 | ~700行 | 130+ |
| 73 | 皮皮鲁历险 | pipilu-adventure | 童话手绘 | 奇幻冒险 | ~750行 | 140+ |
| 74 | 舒克贝塔 | shuke-beta | 童话手绘 | 飞行+坦克冒险 | ~750行 | 140+ |
| 75 | 魔方大厦 | magic-cube | 童话手绘 | 迷宫探索+解谜 | ~700行 | 130+ |

**开发重点**: 推理系统 + 喜剧事件 + 想象力系统 + 飞行/驾驶 + 迷宫解谜

### 📦 Batch 16: 休闲益智系列 (Idle v16.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 76 | 植物大战 | plant-war | 卡通清新 | 塔防+植物收集 | ~800行 | 150+ |
| 77 | 梦想小镇 | dream-town | 扁平现代 | 小镇建设+经营 | ~750行 | 140+ |
| 78 | 星际飞行 | star-flight | 像素科幻 | 飞机升级+弹幕 | ~800行 | 150+ |
| 79 | 极速传说 | speed-legend | 赛车卡通 | 赛车改装+竞速 | ~750行 | 140+ |
| 80 | 赛马物语 | horse-story | 日系Q版 | 马匹培育+赛事 | ~700行 | 130+ |

**开发重点**: 塔防布阵 + 经营收益 + 弹幕射击引擎 + 赛车改装 + 基因培育

### 📦 Batch 17: 射击竞技系列 (Idle v17.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 81 | 反恐精英 | counter-strike | 写实军事 | 团队射击+武器 | ~850行 | 160+ |
| 82 | 古墓探险家 | tomb-raider | 3D像素 | 遗迹探索+宝藏 | ~900行 | 170+ |
| 83 | 魔兽挂机 | warcraft-idle | 魔兽Q版 | 英雄+兵种+基地 | ~950行 | 180+ |
| 84 | 帝国建造者 | empire-builder | 中世纪像素 | 即时战略挂机 | ~900行 | 170+ |
| 85 | 刺客暗影 | assassin-shadow | 写实暗黑 | 潜行刺杀 | ~850行 | 160+ |

**开发重点**: 武器升级系统 + 探索地图 + 英雄技能 + 兵种训练 + 潜行系统

### 📦 Batch 18: 经典游戏致敬·综合篇 (Idle v18.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 86 | 文明缔造者 | civ-builder | 等距像素 | 回合制文明挂机 | ~1000行 | 190+ |
| 87 | 龙之崛起 | dragon-rise | 国风像素 | 中国古代城建 | ~850行 | 160+ |
| 88 | 沙滩排球 | beach-volleyball | 清新卡通 | 度假岛经营 | ~700行 | 130+ |
| 89 | 宝可梦训练师 | monster-trainer | 日系Q版 | 精灵收集+对战 | ~950行 | 180+ |
| 90 | 完美世界 | perfect-world | 仙侠Q版 | 飞行+修仙+PK | ~850行 | 160+ |

**开发重点**: 科技树 + 风水系统 + 排球小游戏 + 属性克制 + 飞行系统

### 📦 Batch 19: 策略经营系列 (Idle v19.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 91 | 酒馆物语 | tavern-tale | 欧美中世纪 | 冒险者酒馆经营 | ~750行 | 140+ |
| 92 | 学院风云 | magic-academy | 奇幻卡通 | 魔法学院经营 | ~800行 | 150+ |
| 93 | 工厂帝国 | factory-empire | 科技扁平 | 自动化生产线 | ~850行 | 160+ |
| 94 | 海盗王 | pirate-king | 卡通海盗 | 海盗舰队经营 | ~800行 | 150+ |
| 95 | 提瓦特冒险 | teyvat-adventure | 日系动画 | 元素反应+角色 | ~950行 | 180+ |

**开发重点**: 顾客管理 + 生产线自动化 + 贸易路线 + 元素反应 + 角色切换

### 📦 Batch 20: 休闲创意系列 (Idle v20.0)

| # | 游戏 | 英文ID | 画风 | 核心玩法 | 预估代码 | 测试 |
|---|------|--------|------|----------|---------|------|
| 96 | 炼金术士 | alchemist-lab | 魔法手绘 | 物质合成+发现 | ~700行 | 130+ |
| 97 | 时间花园 | time-garden | 水彩清新 | 时间管理+种植 | ~650行 | 120+ |
| 98 | 美食帝国 | food-empire | 美食卡通 | 餐厅连锁经营 | ~700行 | 130+ |
| 99 | 音乐节拍 | rhythm-beat | 霓虹潮流 | 音乐节奏挂机 | ~700行 | 130+ |
| 100 | 笑傲江湖 | laughing-hero | 武侠水墨 | 武侠门派+剑法 | ~850行 | 160+ |

**开发重点**: 合成配方 + 季节/时间系统 + 菜谱研发 + 节奏评分 + 剑法修炼

---

## 四、文件结构规划

### 4.1 项目目录结构

```
game-portal/src/
├── components/idle/                     — 放置游戏专区组件
│   ├── IdleGameZone.tsx                 — 专区首页
│   ├── IdleGameCard.tsx                 — 游戏卡片
│   ├── IdleGamePlayer.tsx               — 游戏播放器
│   ├── IdleResourceBar.tsx              — 资源栏
│   ├── IdleUpgradePanel.tsx             — 升级面板
│   ├── IdlePrestigeModal.tsx            — 转生弹窗
│   ├── IdleAchievementPanel.tsx         — 成就面板
│   ├── IdleSettingsPanel.tsx            — 设置面板
│   ├── IdleOfflineReport.tsx            — 离线收益报告
│   └── IdleSaveManager.tsx              — 存档管理
├── engines/idle/                        — 放置游戏引擎
│   ├── IdleGameEngine.ts                — 基类
│   ├── systems/                         — 通用系统
│   ├── math/                            — 数值计算
│   └── renderer/                        — 渲染器
├── engines/<game-id>/                   — 每款游戏独立目录
│   ├── <GameName>Engine.ts
│   ├── constants.ts
│   └── __tests__/
└── games/idle/                          — 放置游戏页面组件
```

### 4.2 每款游戏标准文件

```
engines/<game-id>/
├── <GameName>Engine.ts          — 游戏引擎（继承 IdleGameEngine）
├── constants.ts                 — 常量定义
├── types.ts                     — 类型定义（如需要）
├── renderer.ts                  — 自定义渲染（如需要）
└── __tests__/
    └── <GameName>Engine.test.ts — 单元测试（120~190 用例）
```

---

## 五、组件化架构设计

### 5.1 组件化设计理念

放置游戏专区采用**组件化架构**，将通用功能抽象为独立可复用组件，并为后续注册登录、付费等功能预留扩展接口。

### 5.2 核心组件清单

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 🏆 游戏排名 | `Leaderboard.tsx` | ✅ 首期 | 多维度排名（分数/速度/Prestige/收集度），时间筛选，本地→全局 |
| 📖 游戏攻略 | `StrategyGuide.tsx` | ✅ 首期 | 分阶段攻略，渐进式解锁，防剧透机制 |
| 💾 存档管理 | `SaveManager.tsx` | ✅ 首期 | 多存档槽位，导入/导出（Base64+文件上传），加密，自动存档 |
| 🏪 商店 | `Shop.tsx` | 🔲 预留 | 游戏内增益道具、皮肤主题，预留付费接口 |
| 🔐 认证 | `AuthModule.ts` | 🔲 预留 | 注册/登录（邮箱/手机/OAuth），全局排名同步，云端存档 |
| 💳 支付 | `PaymentModule.ts` | 🔲 预留 | 支付渠道（微信/支付宝/Stripe），订单管理，订阅服务 |

### 5.3 组件文件结构

```
src/
├── components/idle/
│   ├── IdleGameZone.tsx           — 放置游戏专区首页
│   ├── IdleGameCard.tsx           — 游戏卡片
│   ├── IdleGamePlayer.tsx         — 游戏播放器（Canvas容器）
│   ├── IdleResourceBar.tsx        — 资源栏
│   ├── IdleUpgradePanel.tsx       — 升级面板
│   ├── IdlePrestigeModal.tsx      — 转生弹窗
│   ├── IdleAchievementPanel.tsx   — 成就面板
│   ├── IdleSettingsPanel.tsx      — 设置面板
│   ├── IdleOfflineReport.tsx      — 离线收益报告
│   ├── IdleTabContainer.tsx       — Tab容器（移动端）
│   ├── Leaderboard.tsx            — 🏆 游戏排名组件
│   ├── StrategyGuide.tsx          — 📖 游戏攻略组件
│   ├── SaveManager.tsx            — 💾 存档管理组件
│   ├── Shop.tsx                   — 🏪 商店组件（预留）
│   └── hooks/
│       ├── useIdleGame.ts         — 游戏引擎Hook
│       ├── useLeaderboard.ts      — 排名数据Hook
│       ├── useSaveData.ts         — 存档数据Hook
│       └── useGameGuide.ts        — 攻略数据Hook
├── modules/
│   ├── AuthModule.ts              — 🔐 认证模块（预留）
│   └── PaymentModule.ts          — 💳 支付模块（预留）
└── services/
    ├── leaderboardService.ts      — 排名服务（本地→远程）
    ├── saveService.ts             — 存档服务（LS→IDB→云端）
    └── guideService.ts           — 攻略服务（静态→UGC）
```

### 5.4 扩展路线图

```
Phase 0 (当前 — 组件化首期):
  ✅ 本地排名（LocalStorage）
  ✅ 静态攻略（内置Markdown，渐进解锁）
  ✅ 本地存档（LocalStorage + IndexedDB）
  ✅ 存档导入/导出（Base64字符串 + 文件上传）

Phase 1 (注册登录后):
  🔲 全局排名（API服务）
  🔲 云端存档同步
  🔲 用户资料与头像
  🔲 社区攻略（UGC投稿）

Phase 2 (付费系统后):
  🔲 游戏内商店
  🔲 增益道具购买
  🔲 皮肤/主题商城
  🔲 订阅服务（广告去除/加速等）
```

### 5.5 排名组件详细设计

```typescript
interface LeaderboardProps {
  gameId: string;
  category: 'score' | 'speedrun' | 'prestige' | 'collection';
  timeRange: 'daily' | 'weekly' | 'monthly' | 'alltime';
  limit?: number;
}

// 排名维度:
// - score: 最高分数/资源总量
// - speedrun: 最快达成某里程碑
// - prestige: Prestige/转生次数
// - collection: 收集完成度（图鉴/成就百分比）
```

### 5.6 攻略组件详细设计

```typescript
interface StrategyGuideProps {
  gameId: string;
  currentPhase: number;
  discoveredContent: string[];
}

// 攻略分级:
// - beginner: 新手入门（始终可见）
// - advanced: 进阶攻略（达到中期解锁）
// - prestige: 转生攻略（首次Prestige后解锁）
// - hidden: 隐藏内容（发现后解锁）
// - tips: 小技巧（社区贡献，预留UGC）
```

### 5.7 存档组件详细设计

```typescript
interface SaveSlot {
  slotId: number;
  saveName: string;
  timestamp: number;
  playTime: number;
  phase: number;
  summary: string;
  size: number;
}

// 存档功能:
// - 3个自动存档槽 + 5个手动存档槽
// - 导出: Base64编码字符串 + .json文件下载
// - 导入: 粘贴字符串 + 文件上传
// - 加密: AES加密防篡改
// - 自动存档: 可配置间隔（30s/60s/300s）
// - 存档预览: 显示游戏阶段、资源摘要、游玩时长
```

---

## 六、开发规范

### 5.1 引擎继承规范

```typescript
export class KittensKingdomEngine extends IdleGameEngine<KittensState> {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, {
      gameName: 'Kittens Kingdom',
      designWidth: 800, designHeight: 600,
      maxOfflineHours: 24, offlineEfficiency: 0.7,
      autoSaveInterval: 30000,
    });
  }
  protected initializeResources(): void { ... }
  protected initializeUpgrades(): void { ... }
  protected initializeAchievements(): void { ... }
  protected onUpdate(deltaTime: number): void { ... }
  protected onRender(): void { ... }
  protected onPrestige(): PrestigeResult { ... }
}
```

### 5.2 测试规范

每款游戏 120~190 用例，覆盖：初始化、资源系统、升级系统、离线收益、Prestige、成就、自动化、存档、游戏特定系统、边界条件。

### 5.3 画质规范

| 画质等级 | 分辨率倍率 | 粒子效果 | 帧率 | 适用设备 |
|----------|-----------|---------|------|---------|
| Ultra | 1.0x (DPR) | 100% | 60fps | 高端PC |
| High | 0.75x | 75% | 60fps | 普通PC/旗舰手机 |
| Medium | 0.5x | 50% | 30fps | 中端手机 |
| Low | 0.35x | 25% | 30fps | 低端手机 |
| Battery | 0.25x | 0% | 15fps | 省电模式 |

---

## 七、技术方案详解

### 6.1 大数运算

```typescript
class BigNumber {
  mantissa: number;  // 1~9.999...
  exponent: number;  // 10的指数
  // 支持: +, -, *, /, ^, log, sqrt
  // 格式化: "1.5K", "3.2M", "1.7B", "5.3e15"
}
```

### 6.2 程序化美术资源

```
像素风: 程序化像素角色生成器 + 建筑瓦片 + 帧动画
水墨风: Canvas水墨笔触模拟 + 程序化山水 + 毛笔字效果
日系风: 赛璐珞渲染 + 表情参数化 + 简化动画帧
```

### 6.3 存档系统

```
LocalStorage: 小存档(<5MB)，自动保存
IndexedDB: 大存档(≥5MB)，异步保存
导出/导入: Base64 编码，支持跨设备
多存档槽: 3个存档位，可切换
```

### 6.4 移动端优化

```
触摸优化: 按钮≥44px, 长按=右键, 双指缩放
性能优化: 脏矩形渲染, Page Visibility API, rAF节流
省电模式: 后台降帧, 关闭粒子, 简化动画, 暗色主题
```

---

## 八、验收标准

### 7.1 每款游戏验收

| 项目 | 标准 |
|------|------|
| 功能完整性 | 核心玩法可玩，无阻塞性 Bug |
| 测试覆盖 | 120+ 用例全部通过 |
| 离线收益 | 正确计算，有离线报告 |
| 自适应 | PC/平板/手机正常游玩 |
| 画质切换 | 至少 3 个画质等级 |
| 存档 | 自动+手动+导入导出 |
| 画风一致 | 符合题材设定 |

### 7.2 整体验收

| 项目 | 标准 |
|------|------|
| 游戏数量 | 100 款全部完成 |
| 全量测试 | 100 文件 15000+ 用例全部通过 |
| 构建体积 | JS < 3MB, CSS < 120KB |
| 加载速度 | 首屏 < 3s (4G) |
| 帧率 | PC 60fps, 中端手机 ≥ 30fps |

---

## 九、风险管理

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| LLM子任务超时 | 高 | 中 | 分批开发，检查部分产出，补测 |
| 画风实现困难 | 中 | 高 | 像素风优先，程序化生成 |
| 数值平衡 | 中 | 中 | 数学模型+自动化测试 |
| 移动端性能 | 中 | 高 | 画质分级，Canvas优化 |
| 存档丢失 | 低 | 高 | 多重存档，导出功能 |
| IP版权 | 中 | 高 | "致敬"命名，避免直接使用IP |

---

## 十、开发进度追踪

### 9.1 进度总览

```
总进度: 0/100 (0%)

Phase 0 — 基础设施:  ⬜⬜⬜⬜⬜ (0%)
Phase 1 — Batch 1:    ⬜⬜⬜⬜⬜ (0/5)  萌宠王国
Phase 1 — Batch 2:    ⬜⬜⬜⬜⬜ (0/5)  修仙传说
Phase 1 — Batch 3:    ⬜⬜⬜⬜⬜ (0/5)  文明演进
Phase 2 — Batch 4:    ⬜⬜⬜⬜⬜ (0/5)  生存冒险
Phase 2 — Batch 5:    ⬜⬜⬜⬜⬜ (0/5)  神话传说
Phase 2 — Batch 6:    ⬜⬜⬜⬜⬜ (0/5)  经典策略致敬
Phase 2 — Batch 7:    ⬜⬜⬜⬜⬜ (0/5)  经典RPG致敬
Phase 3 — Batch 8:    ⬜⬜⬜⬜⬜ (0/5)  龙与地下城
Phase 3 — Batch 9:    ⬜⬜⬜⬜⬜ (0/5)  中国仙侠RPG
Phase 3 — Batch 10:   ⬜⬜⬜⬜⬜ (0/5)  金庸武侠
Phase 3 — Batch 11:   ⬜⬜⬜⬜⬜ (0/5)  古龙武侠
Phase 4 — Batch 12:   ⬜⬜⬜⬜⬜ (0/5)  网游回忆
Phase 4 — Batch 13:   ⬜⬜⬜⬜⬜ (0/5)  动漫·热血
Phase 4 — Batch 14:   ⬜⬜⬜⬜⬜ (0/5)  动漫·温情
Phase 4 — Batch 15:   ⬜⬜⬜⬜⬜ (0/5)  影视文学
Phase 5 — Batch 16:   ⬜⬜⬜⬜⬜ (0/5)  休闲益智
Phase 5 — Batch 17:   ⬜⬜⬜⬜⬜ (0/5)  射击竞技
Phase 5 — Batch 18:   ⬜⬜⬜⬜⬜ (0/5)  经典致敬·综合
Phase 5 — Batch 19:   ⬜⬜⬜⬜⬜ (0/5)  策略经营
Phase 5 — Batch 20:   ⬜⬜⬜⬜⬜ (0/5)  休闲创意
```

### 9.2 Checklist

<details>
<summary>📋 Batch 1: 萌宠王国系列</summary>

- [ ] 1. 猫咪王国 (kittens-kingdom) — 像素萌系
- [ ] 2. 狗狗家园 (doggo-home) — 卡通Q版
- [ ] 3. 企鹅帝国 (penguin-empire) — 冰晶卡通
- [ ] 4. 恐龙牧场 (dino-ranch) — 像素复古
- [ ] 5. 蚂蚁王国 (ant-kingdom) — 微观写实

</details>

<details>
<summary>📋 Batch 2: 修仙传说系列</summary>

- [ ] 6. 挂机修仙·凡人篇 (idle-xianxia) — 水墨国风
- [ ] 7. 宗门崛起 (sect-rise) — 水墨国风
- [ ] 8. 家族风云 (clan-saga) — 水墨工笔
- [ ] 9. 渡劫飞升 (tribulation) — 水墨特效
- [ ] 10. 炼丹大师 (alchemy-master) — 水墨国风

</details>

<details>
<summary>📋 Batch 3: 文明演进系列</summary>

- [ ] 11. 四大文明·古埃及 (civ-egypt) — 壁画风
- [ ] 12. 四大文明·古巴比伦 (civ-babylon) — 壁画风
- [ ] 13. 四大文明·古印度 (civ-india) — 壁画风
- [ ] 14. 四大文明·古中国 (civ-china) — 国风工笔
- [ ] 15. 现代都市 (modern-city) — 扁平现代

</details>

<details>
<summary>📋 Batch 4: 生存冒险系列</summary>

- [ ] 16. 海岛漂流 (island-drift) — 像素热带
- [ ] 17. 野外求生 (wild-survival) — 像素自然
- [ ] 18. 末日生存 (doomsday) — 灰暗像素
- [ ] 19. 太空漂流 (space-drift) — 科幻UI
- [ ] 20. 地下城探险 (dungeon-explore) — 暗黑像素

</details>

<details>
<summary>📋 Batch 5: 神话传说系列</summary>

- [ ] 21. 封神演义 (fengshen) — 国风工笔重彩
- [ ] 22. 希腊众神 (greek-gods) — 陶瓶风
- [ ] 23. 北欧英灵 (norse-valkyrie) — 维京像素
- [ ] 24. 日本妖怪 (yokai-night) — 浮世绘
- [ ] 25. 埃及神话 (egypt-myth) — 壁画风

</details>

<details>
<summary>📋 Batch 6: 经典策略致敬系列</summary>

- [ ] 26. 红色警戒 (red-alert) — 军事像素
- [ ] 27. 三国志 (three-kingdoms) — 国风水墨
- [ ] 28. 全面战争 (total-war) — 写实策略
- [ ] 29. 帝国时代 (age-of-empires) — 等距像素
- [ ] 30. 英雄无敌 (heroes-might) — 奇幻卡通

</details>

<details>
<summary>📋 Batch 7: 经典RPG致敬系列</summary>

- [ ] 31. 最终幻想 (final-fantasy) — 日系像素RPG
- [ ] 32. 博德之门 (baldurs-gate) — 暗黑奇幻
- [ ] 33. 上古卷轴 (elder-scrolls) — 写实奇幻
- [ ] 34. 猎魔传说 (witcher-tale) — 暗黑写实
- [ ] 35. 暗黑破坏神 (diablo-idle) — 暗黑哥特

</details>

<details>
<summary>📋 Batch 8: 龙与地下城系列</summary>

- [ ] 36. 龙与地下城 (dnd-adventure) — 奇幻插画
- [ ] 37. 无冬之夜 (neverwinter) — D&D写实
- [ ] 38. 龙之信条 (dragons-dogma) — 暗黑奇幻
- [ ] 39. 地牢围攻 (dungeon-siege) — 暗黑欧美
- [ ] 40. 天国降临 (kingdom-come) — 写实中世纪

</details>

<details>
<summary>📋 Batch 9: 中国仙侠RPG系列</summary>

- [ ] 41. 仙剑奇侠传 (chinese-paladin) — 国风唯美
- [ ] 42. 轩辕剑 (xuanyuan-sword) — 国风水墨
- [ ] 43. 仙侠情缘 (xianxia-romance) — 仙侠Q版
- [ ] 44. 幻想三国志 (fantasy-three) — 日系国风
- [ ] 45. 星之冒险 (earthbound-idle) — 复古像素

</details>

<details>
<summary>📋 Batch 10: 金庸武侠系列</summary>

- [ ] 46. 射雕英雄传 (eagle-shooting) — 武侠水墨
- [ ] 47. 神雕侠侣 (condor-heroes) — 武侠水墨
- [ ] 48. 倚天屠龙记 (heaven-sword) — 武侠水墨
- [ ] 49. 天龙八部 (eight-dragons) — 武侠水墨
- [ ] 50. 鹿鼎记 (deer-cauldron) — 武侠Q版

</details>

<details>
<summary>📋 Batch 11: 古龙武侠系列</summary>

- [ ] 51. 小李飞刀 (flying-dagger) — 武侠写意
- [ ] 52. 楚留香传奇 (chu-liuxiang) — 武侠写意
- [ ] 53. 陆小凤传奇 (lu-xiaofeng) — 武侠写意
- [ ] 54. 天涯明月刀 (horizon-blade) — 武侠写意
- [ ] 55. 新绝代双骄 (twin-heroes) — 武侠Q版

</details>

<details>
<summary>📋 Batch 12: 网游回忆系列</summary>

- [ ] 56. 梦幻挂机 (fantasy-west) — Q版国风
- [ ] 57. 大话修仙 (great-journey) — Q版国风
- [ ] 58. 艾泽拉斯挂机 (azeroth-idle) — 魔兽Q版
- [ ] 59. 玛法传奇 (legend-of-mir) — 复古像素
- [ ] 60. 热血江湖梦 (hot-blood) — Q版武侠

</details>

<details>
<summary>📋 Batch 13: 动漫联动·热血篇</summary>

- [ ] 61. 龙珠战士 (dragon-warriors) — 龙珠原画
- [ ] 62. 灌篮高手 (slam-dunk) — 井上画风
- [ ] 63. 海贼王冒险 (pirate-adventure) — 尾田画风
- [ ] 64. 魂斗罗挂机 (contra-idle) — 8-bit像素
- [ ] 65. 名侦探挂机 (detective-conan) — 日系动画

</details>

<details>
<summary>📋 Batch 14: 动漫联动·温情篇</summary>

- [ ] 66. 战国犬夜叉 (inuyasha-sengoku) — 日系古风
- [ ] 67. 蜡笔小新的日常 (crayon-days) — 蜡笔原画
- [ ] 68. 哆啦A梦的口袋 (doraemon-pocket) — 藤子风
- [ ] 69. 熊出没森林 (bear-forest) — 国产卡通
- [ ] 70. 猫鼠大战 (tom-and-jerry) — 美式卡通

</details>

<details>
<summary>📋 Batch 15: 影视文学系列</summary>

- [ ] 71. 贝克街探案 (baker-street) — 英伦复古
- [ ] 72. 摩登时代 (modern-times) — 黑白默片
- [ ] 73. 皮皮鲁历险 (pipilu-adventure) — 童话手绘
- [ ] 74. 舒克贝塔 (shuke-beta) — 童话手绘
- [ ] 75. 魔方大厦 (magic-cube) — 童话手绘

</details>

<details>
<summary>📋 Batch 16: 休闲益智系列</summary>

- [ ] 76. 植物大战 (plant-war) — 卡通清新
- [ ] 77. 梦想小镇 (dream-town) — 扁平现代
- [ ] 78. 星际飞行 (star-flight) — 像素科幻
- [ ] 79. 极速传说 (speed-legend) — 赛车卡通
- [ ] 80. 赛马物语 (horse-story) — 日系Q版

</details>

<details>
<summary>📋 Batch 17: 射击竞技系列</summary>

- [ ] 81. 反恐精英 (counter-strike) — 写实军事
- [ ] 82. 古墓探险家 (tomb-raider) — 3D像素
- [ ] 83. 魔兽挂机 (warcraft-idle) — 魔兽Q版
- [ ] 84. 帝国建造者 (empire-builder) — 中世纪像素
- [ ] 85. 刺客暗影 (assassin-shadow) — 写实暗黑

</details>

<details>
<summary>📋 Batch 18: 经典游戏致敬·综合篇</summary>

- [ ] 86. 文明缔造者 (civ-builder) — 等距像素
- [ ] 87. 龙之崛起 (dragon-rise) — 国风像素
- [ ] 88. 沙滩排球 (beach-volleyball) — 清新卡通
- [ ] 89. 宝可梦训练师 (monster-trainer) — 日系Q版
- [ ] 90. 完美世界 (perfect-world) — 仙侠Q版

</details>

<details>
<summary>📋 Batch 19: 策略经营系列</summary>

- [ ] 91. 酒馆物语 (tavern-tale) — 欧美中世纪
- [ ] 92. 学院风云 (magic-academy) — 奇幻卡通
- [ ] 93. 工厂帝国 (factory-empire) — 科技扁平
- [ ] 94. 海盗王 (pirate-king) — 卡通海盗
- [ ] 95. 提瓦特冒险 (teyvat-adventure) — 日系动画

</details>

<details>
<summary>📋 Batch 20: 休闲创意系列</summary>

- [ ] 96. 炼金术士 (alchemist-lab) — 魔法手绘
- [ ] 97. 时间花园 (time-garden) — 水彩清新
- [ ] 98. 美食帝国 (food-empire) — 美食卡通
- [ ] 99. 音乐节拍 (rhythm-beat) — 霓虹潮流
- [ ] 100. 笑傲江湖 (laughing-hero) — 武侠水墨

</details>

---

## 附录 A: IP 参考映射表

| 游戏 | IP来源 | 核心致敬元素 |
|------|--------|-------------|
| 猫咪王国 | Kittens Game | 猫咪文明、资源管理、科技树 |
| 蚂蚁王国 | 蚂蚁帝国/原创 | 蚁巢建设、兵种培育、微观世界 |
| 挂机修仙·凡人篇 | 凡人修仙传 | 境界修炼、灵根、秘境探索 |
| 宗门崛起 | 修仙掌门人 | 宗门经营、弟子培养、门派争斗 |
| 四大文明·古中国 | 文明/龙之崛起 | 华夏文明、朝代更替、奇观建造 |
| 现代都市 | 模拟城市/现代城市 | 城市建设、人口管理、基础设施 |
| 红色警戒 | C&C Red Alert | 基地建设、坦克大军、超级武器 |
| 三国志 | 三国志系列 | 武将收集、势力争霸、内政外交 |
| 全面战争 | Total War | 千军万马、帝国经营、实时战术 |
| 帝国时代 | Age of Empires | 资源采集、时代升级、文明特色 |
| 英雄无敌 | Heroes of M&M | 英雄养成、城堡建设、奇幻兵种 |
| 最终幻想 | Final Fantasy | 召唤兽、ATB战斗、宏大叙事 |
| 博德之门 | Baldur's Gate | D&D规则、团队冒险、选择分支 |
| 上古卷轴 | Elder Scrolls | 开放世界、公会系统、自由探索 |
| 猎魔传说 | The Witcher 3 (巫师3) | 猎魔任务、炼金、道德选择 |
| 暗黑破坏神 | Diablo | 地牢刷装、技能树、暗黑哥特 |
| 龙与地下城 | D&D | 跑团冒险、角色构建、D20骰子 |
| 无冬之夜 | Neverwinter Nights | 城市冒险、地下城、模组系统 |
| 龙之信条 | Dragon's Dogma 2 | 职业系统、随从、巨龙战斗 |
| 地牢围攻 | Dungeon Siege | 组队探险、无缝地牢 |
| 天国降临 | Kingdom Come (天国) | 中世纪写实、生存、历史还原 |
| 仙剑奇侠传 | 仙剑奇侠传系列 | 回合制、情感剧情、五灵法术 |
| 轩辕剑 | 轩辕剑系列 | 炼妖壶、机关术、上古神话 |
| 仙侠情缘 | 仙侠情缘系列 | 修仙恋爱、情缘系统 |
| 幻想三国志 | 幻想三国志系列 | 三国+幻想元素、多线剧情 |
| 武林群侠传 | 武林群侠传（致敬地球冒险EarthBound的自由养成理念） | 自由养成、门派探索、多维成长 |
| 射雕英雄传 | 金庸·射雕英雄传 | 郭靖成长、降龙十八掌 |
| 神雕侠侣 | 金庸·神雕侠侣 | 杨过小龙女、绝情谷 |
| 倚天屠龙记 | 金庸·倚天屠龙记 | 张无忌、明教、六大派 |
| 天龙八部 | 金庸·天龙八部 | 乔峰段誉虚竹、三线叙事 |
| 鹿鼎记 | 金庸·鹿鼎记 | 韦小宝、天地会、七个老婆 |
| 小李飞刀 | 古龙·多情剑客无情剑 | 李寻欢、飞刀绝技、写意武侠 |
| 楚留香传奇 | 古龙·楚留香传奇 | 盗帅推理、风流冒险 |
| 陆小凤传奇 | 古龙·陆小凤传奇 | 灵犀一指、推理破局 |
| 天涯明月刀 | 古龙·天涯明月刀 | 傅红雪、复仇之路 |
| 新绝代双骄 | 古龙·绝代双骄 | 小鱼儿花无缺、双线冒险 |
| 梦幻挂机 | 梦幻西游 | 回合制、宠物养成、师门任务 |
| 大话修仙 | 大话西游 | 剧情任务、伙伴收集、修炼 |
| 艾泽拉斯挂机 | 魔兽世界 | 副本、装备、天赋树 |
| 玛法传奇 | 传奇世界 | 打怪爆装、攻城战、红名 |
| 热血江湖梦 | 热血江湖 | 武侠RPG、门派、PK |
| 龙珠战士 | 七龙珠 | 战斗力、超级赛亚人变身 |
| 灌篮高手 | 灌篮高手 | 篮球养成、比赛、角色成长 |
| 海贼王冒险 | 海贼王 | 航海、伙伴招募、恶魔果实 |
| 魂斗罗挂机 | 魂斗罗 | 横版射击、武器升级、Boss战 |
| 名侦探挂机 | 名侦探柯南 | 推理破案、线索收集、案件还原 |
| 战国犬夜叉 | 犬夜叉 | 穿越冒险、四魂之玉碎片 |
| 蜡笔小新的日常 | 蜡笔小新 | 搞笑日常、春日部探索 |
| 哆啦A梦的口袋 | 哆啦A梦 | 道具收集、冒险、时光机 |
| 熊出没森林 | 熊出没/光头强 | 森林攻防、光头强对抗 |
| 猫鼠大战 | 猫和老鼠 | 追逐、陷阱、美式卡通 |
| 贝克街探案 | 福尔摩斯 | 推理探案、线索收集、雾都伦敦 |
| 摩登时代 | 卓别林/Charlie Chaplin | 默片喜剧、工厂经营、流浪汉 |
| 皮皮鲁历险 | 郑渊洁·皮皮鲁 | 奇幻冒险、想象力 |
| 舒克贝塔 | 郑渊洁·舒克贝塔 | 飞行驾驶、坦克冒险 |
| 魔方大厦 | 郑渊洁·魔方大厦 | 迷宫探索、解谜 |
| 植物大战 | 植物大战僵尸/PvZ | 塔防、植物收集、阳光经济 |
| 梦想小镇 | 模拟经营 | 小镇建设、资源管理 |
| 星际飞行 | 飞行射击 | 飞机升级、弹幕、Boss战 |
| 极速传说 | 赛车类 | 赛车改装、比赛、赛道 |
| 赛马物语 | 赛马养成 | 马匹培育、赛事、血统 |
| 反恐精英 | CS/反恐精英系列 | 武器收集、团队对抗、拆弹 |
| 古墓探险家 | 古墓丽影/Tomb Raider | 遗迹探索、宝藏收集、机关 |
| 魔兽挂机 | 魔兽争霸3/Warcraft 3 | 英雄技能、兵种升级、基地建设 |
| 帝国建造者 | 帝国时代2/3 | 即时战略、资源采集、文明发展 |
| 刺客暗影 | 刺客信条/Assassin's Creed | 潜行刺杀、历史城市、兄弟会 |
| 文明缔造者 | 文明系列/Civilization | 科技树、时代演进、奇观建造 |
| 龙之崛起 | 龙之崛起/Emperor | 中国古代城建、风水系统 |
| 沙滩排球 | 死或生沙滩排球/DOAX | 度假岛经营、排球小游戏 |
| 宝可梦训练师 | 宝可梦/Pokemon | 精灵收集、属性克制、道馆 |
| 完美世界 | 完美世界 | 飞行系统、修仙、PK |
| 酒馆物语 | 原创 | 冒险者酒馆经营 |
| 学院风云 | 哈利波特 | 魔法学院经营、魔药课 |
| 工厂帝国 | Factorio | 自动化生产线、物流 |
| 海盗王 | 大航海时代 | 海盗舰队经营、航海探索 |
| 提瓦特冒险 | 原神/Genshin | 元素反应、角色收集、探索 |
| 炼金术士 | 原创 | 物质合成、元素发现 |
| 时间花园 | 原创 | 时间管理、花园种植 |
| 美食帝国 | 原创 | 餐厅连锁经营、菜谱研发 |
| 音乐节拍 | 原创 | 音乐节奏挂机、节拍挑战 |
| 笑傲江湖 | 笑傲江湖 | 武侠门派、剑法修炼、自由江湖 |

---

> **文档维护**: 随开发进度持续更新，每完成一个 Batch 更新 Checklist 和进度追踪。