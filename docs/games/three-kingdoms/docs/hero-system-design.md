# 武将系统设计文档

> 三国霸业 v2.0 — 招贤纳士功能技术设计

---

## 1. 系统架构概览

### 1.1 子系统关系

```
ThreeKingdomsEngine (编排层)
├── HeroSystem (聚合根) — 状态管理、战力计算、碎片管理
├── HeroRecruitSystem — 概率计算、保底计数、抽卡执行
├── HeroLevelSystem — 经验管理、升级消耗、一键强化
└── ResourceSystem — 通过 safeSpendResource 回调解耦
```

| 子系统 | 文件 | 职责 |
|--------|------|------|
| **HeroSystem** | `engine/hero/HeroSystem.ts` | 武将状态管理、战力计算、碎片管理、序列化 |
| **HeroRecruitSystem** | `engine/hero/HeroRecruitSystem.ts` | 招募概率计算、保底计数、抽卡执行、重复武将处理 |
| **HeroLevelSystem** | `engine/hero/HeroLevelSystem.ts` | 经验管理、升级消耗计算、属性成长、一键强化 |

### 1.2 依赖注入

武将子系统通过回调函数解耦 `ResourceSystem`：

```typescript
// engine/engine-hero-deps.ts
interface RecruitDeps {
  heroSystem: HeroSystem;
  spendResource: (type: string, amount: number) => boolean;
  canAffordResource: (type: string, amount: number) => boolean;
}
```

引擎初始化时通过 `initHeroSystems()` 统一注入依赖。

---

## 2. 招募概率数学模型

### 2.1 招募类型与消耗

| 类型 | 消耗资源 | 单次消耗 |
|------|----------|----------|
| 普通招贤 | 铜钱 (gold) | 100 |
| 高级招贤 | 求贤令 (recruitToken) | 1 |

### 2.2 品质概率表

**普通招募**：普通 60% / 精良 25% / 稀有 10% / 史诗 4% / 传说 1%

**高级招募**：普通 30% / 精良 35% / 稀有 22% / 史诗 10% / 传说 3%

### 2.3 抽卡算法（累积概率法）

```typescript
function rollQuality(rates: QualityRate[], rng: () => number): Quality {
  const roll = rng();           // [0, 1) 均匀随机数
  let cumulative = 0;
  for (const entry of rates) {
    cumulative += entry.rate;
    if (roll < cumulative) return entry.quality;
  }
  return rates[rates.length - 1].quality;
}
```

### 2.4 保底机制

两种保底独立计数，按招募类型分别维护：

| 保底类型 | 阈值 | 最低品质 | 重置条件 |
|----------|------|----------|----------|
| 十连保底 | 累计 10 次未出稀有+ | 稀有 (RARE) | 抽到稀有及以上 |
| 硬保底 | 累计 50 次未出史诗+ | 史诗 (EPIC) | 抽到史诗及以上 |

**优先级**：硬保底 > 十连保底 > 随机品质

### 2.5 重复武将碎片转化

| 品质 | 普通 | 精良 | 稀有 | 史诗 | 传说 |
|------|------|------|------|------|------|
| 碎片 | 5 | 10 | 20 | 40 | 80 |

---

## 3. 升级公式

### 3.1 经验需求

每级所需经验 = 当前等级 × 段系数：

| 等级段 | expPerLevel | goldPerLevel |
|--------|-------------|--------------|
| 1~10 | 50 | 20 |
| 11~20 | 120 | 50 |
| 21~30 | 250 | 100 |
| 31~40 | 500 | 200 |
| 41~50 | 1000 | 400 |

等级上限：**50 级**

### 3.2 属性成长

```
属性(Lv) = floor(baseStat × (1 + (level - 1) × 0.03))
```

每级成长率 3%，示例（关羽 ATK=115）：Lv1=115, Lv10=146, Lv30=215, Lv50=284

---

## 4. 战力计算公式

```
战力 = (ATK×2.0 + DEF×1.5 + INT×2.0 + SPD×1.0) × 等级系数 × 品质系数
等级系数 = 1 + level × 0.05
```

| 品质 | 普通 | 精良 | 稀有 | 史诗 | 传说 |
|------|------|------|------|------|------|
| 系数 | 1.0 | 1.15 | 1.3 | 1.5 | 1.8 |

总战力 = Σ(所有已拥有武将的单将战力)

**示例**（关羽 LEGENDARY Lv1）：
```
statsPower = 115×2 + 90×1.5 + 65×2 + 78×1 = 573
战力 = floor(573 × 1.05 × 1.8) = 1082
```

---

## 5. 存档迁移策略（v1.0 → v2.0）

### 5.1 自动迁移机制

v1.0 存档不含 `hero`/`recruit` 字段，`engine-save.ts` 的 `applySaveData()` 通过可选字段检测自动兼容：

```typescript
// 武将系统：旧存档无 hero 字段时自动跳过，保持空状态
if (data.hero) {
  ctx.hero.deserialize(data.hero);
} else {
  console.info('[Save] v1.0 存档迁移：无武将数据，自动初始化空武将系统');
}
// 招募系统同理
if (data.recruit) {
  ctx.recruit.deserialize(data.recruit);
}
```

### 5.2 迁移流程

```
v1.0 存档 (无 hero/recruit) → load()
  → applySaveData() 跳过 hero/recruit 反序列化
  → finalizeLoad() → initHeroSystems() 注入资源回调
  → HeroSystem: 空 generals={}, 空 fragments={}
  → HeroRecruitSystem: 保底计数器全为 0
  → v2.0 引擎就绪
```

### 5.3 存档版本

| 版本 | 值 | 说明 |
|------|-----|------|
| ENGINE_SAVE_VERSION | 1 | v1.0/v2.0 共用，通过 hero/recruit 可选区分 |
| HERO_SAVE_VERSION | 1 | 武将子系统 |
| RECRUIT_SAVE_VERSION | 1 | 招募子系统 |

迁移后首次 `save()` 写入完整 v2.0 存档，后续加载无需迁移。

---

## 6. 武将数据表（10 位）

| # | ID | 名称 | 品质 | 阵营 | 攻击 | 防御 | 智力 | 速度 | Lv1战力 |
|---|-----|------|------|------|------|------|------|------|---------|
| 1 | liubei | 刘备 | 史诗 | 蜀 | 78 | 85 | 82 | 72 | 714 |
| 2 | guanyu | 关羽 | 传说 | 蜀 | 115 | 90 | 65 | 78 | 1082 |
| 3 | zhangfei | 张飞 | 史诗 | 蜀 | 105 | 78 | 45 | 68 | 627 |
| 4 | zhugeliang | 诸葛亮 | 传说 | 蜀 | 68 | 72 | 118 | 88 | 1072 |
| 5 | zhaoyun | 赵云 | 传说 | 蜀 | 108 | 95 | 72 | 98 | 1101 |
| 6 | caocao | 曹操 | 传说 | 魏 | 92 | 88 | 110 | 82 | 1064 |
| 7 | dianwei | 典韦 | 稀有 | 魏 | 95 | 82 | 35 | 55 | 538 |
| 8 | simayi | 司马懿 | 史诗 | 魏 | 62 | 78 | 105 | 85 | 659 |
| 9 | zhouyu | 周瑜 | 史诗 | 吴 | 75 | 70 | 100 | 90 | 660 |
| 10 | lvbu | 吕布 | 传说 | 群 | 120 | 75 | 40 | 85 | 1058 |

**品质分布**：传说×5 (关羽/诸葛亮/赵云/曹操/吕布)、史诗×4 (刘备/张飞/司马懿/周瑜)、稀有×1 (典韦)

**阵营分布**：蜀×5、魏×3、吴×1、群×1

> 注意：COMMON/FINE 无武将定义，抽到时 `fallbackPick` 降级到 RARE 典韦。

### 武将技能一览

| 武将 | 技能1 (类型) | 技能2 (类型) |
|------|-------------|-------------|
| 刘备 | 仁德 — 恢复全体HP (主动) | 蜀汉之主 — 蜀国攻击+5% (阵营) |
| 关羽 | 青龙偃月 — 200%物伤无视30%防 (主动) | 武圣 — 暴击+15%暴伤+30% (被动) |
| 张飞 | 怒吼长坂 — 160%物伤50%眩晕 (主动) | 万人敌 — 低血量攻击+25% (被动) |
| 诸葛亮 | 空城计 — 150%策伤全体降攻20% (主动) | 卧龙 — 每回合护盾 (被动) |
| 赵云 | 龙胆 — 180%物伤+回血 (主动) | 一身是胆 — 30%免死 (被动) |
| 曹操 | 奸雄 — 130%策伤全体偷攻10% (主动) | 魏武挥鞭 — 魏国防御+8% (阵营) |
| 典韦 | 古之恶来 — 170%物伤 (主动) | 死战 — 低血量攻击+40% (被动) |
| 司马懿 | 鹰视狼顾 — 180%策伤+灼烧 (主动) | 隐忍 — 20%反弹50%伤害 (被动) |
| 周瑜 | 火烧赤壁 — 140%策伤全体+灼烧 (主动) | 雅量高致 — 吴国智力+10% (被动) |
| 吕布 | 天下无双 — 220%物伤无视50%防 (主动) | 飞将 — 额外8%真伤 (被动) |

---

## 附录：配置常量速查

```typescript
RECRUIT_COSTS.normal = { resourceType: 'gold', amount: 100 }
RECRUIT_COSTS.advanced = { resourceType: 'recruitToken', amount: 1 }
TEN_PULL_DISCOUNT = 1.0  // 十连无折扣
TEN_PULL_THRESHOLD = 10  // 10抽保底稀有+
HARD_PITY_THRESHOLD = 50 // 50抽保底史诗+
HERO_MAX_LEVEL = 50
STAT_GROWTH_RATE = 0.03  // 每级属性成长3%
POWER_WEIGHTS = { attack: 2.0, defense: 1.5, intelligence: 2.0, speed: 1.0 }
```
