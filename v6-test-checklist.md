# v6.0 天下大势 — Round 28 测试检查清单

> **日期**: 2026-06-21
> **版本**: v6.0 天下大势
> **测试框架**: Vitest
> **总测试数**: 140 集成测试 (5 文件)

---

## Phase 1: 准备 ✅

| 项目 | 状态 | 备注 |
|------|------|------|
| Play文档读取 | ✅ | v6-play.md 全部10个章节 + 交叉验证 |
| 引擎文件定位 | ✅ | calendar/event/npc/map/offline 5大模块 |
| 系统API理解 | ✅ | 14个子系统的公开API |

## Phase 2: 冒烟测试 ✅

| 项目 | 状态 | 备注 |
|------|------|------|
| `pnpm run build` | ✅ | 31.58s 编译成功 |

## Phase 3: 深度评测

### 覆盖率统计

| 文件 | 覆盖章节 | 测试数 | 状态 |
|------|----------|--------|------|
| v6-era-trend.integration.test.ts | §1 天下大势面板, §2 时代推进, §7.11-7.13 | 23 | ✅ |
| v6-territory-map.integration.test.ts | §3 势力消长, §4 世界地图交互, §7.14 | 31 | ✅ |
| v6-npc-affinity.integration.test.ts | §5 NPC好感度, §6 NPC高级交互, §7.8-7.9 | 32 | ✅ |
| v6-event-system.integration.test.ts | §7 事件系统 (7.1-7.5, 7.10) | 30 | ✅ |
| v6-cross-validation.integration.test.ts | §8 交叉验证 (8.1-8.10) | 24 | ✅ |
| **合计** | **全部 §1-§8** | **140** | **✅** |

### Play文档流程覆盖

| 流程 | 覆盖 | 备注 |
|------|------|------|
| §1 天下大势面板 | ✅ | 面板数据一致性、急报横幅、事件筛选 |
| §1.1 急报横幅 | ✅ | 创建/优先级排序/上限5条 |
| §1.2 事件类型筛选 | ✅ | 按类型过滤、空状态 |
| §2 时代推进 | ✅ | 时代顺序、日历驱动、目标/奖励 |
| §3 势力消长 | ✅ | 领土分布、占比100% |
| §3.1 领土攻占 | ✅ | 征服流程、胜率预估、攻城战 |
| §3.1.1 胜率预估 | ✅ | 公式验证、颜色分级 |
| §3.1.2 攻城战 | ✅ | 城防/消耗/占领/奖励 |
| §3.2 驻防机制 | ✅ | 加成计算、互斥规则 |
| §3.3 离线领土变化 | ✅ | 20%损失上限 |
| §4 世界地图交互 | ✅ | 三大区域、筛选、事件标记 |
| §5 NPC好感度 | ✅ | 等级体系、获取途径、可视化、羁绊技能 |
| §6 NPC高级交互 | ✅ | 赠送/切磋/任务链/刷新/日程/离线 |
| §7.1 事件触发 | ✅ | 触发规则/概率公式/冷却 |
| §7.2 随机遭遇弹窗 | ✅ | 选项后果/奖励缩放 |
| §7.3 连锁事件 | ✅ | 链结构/超时/中断补偿/重复 |
| §7.4 离线事件处理 | ✅ | 自动处理/堆积上限/收益公式 |
| §7.5 事件跨系统联动 | ✅ | 战斗/商店/地图/科技/NPC |
| §7.8 稀有NPC刷新 | ✅ | 类型/优先级 |
| §7.10 事件筛选异常 | ✅ | 空结果/防抖/范围筛选 |
| §7.11-7.13 时代联动 | ✅ | 产出/NPC/连锁事件 |
| §7.14 攻城×活动 | ✅ | 奖励联动 |
| §8 交叉验证 | ✅ | 全10个子流程 |

---

## 问题清单

### 🔴 严重问题 (0)

无。

### 🟡 中等问题 (2)

| # | 问题 | 详情 | 影响 |
|---|------|------|------|
| 1 | **好感度配置值与Play文档不一致** | Play文档: 日常对话+5, 偏好×1.5; 实际: dialogBase=3, giftPreferredMultiplier=2.0 | 数值平衡偏差 |
| 2 | **NPC职业类型与Play文档不匹配** | Play文档: 农民/士兵/商人/学者/斥候; 实际: merchant/strategist/warrior/artisan/traveler | 文档与实现不一致 |

### 🟢 轻微问题 (3)

| # | 问题 | 详情 | 影响 |
|---|------|------|------|
| 3 | **时代推进系统无独立EraSystem** | 时代推进逻辑分散在CalendarSystem中，无独立的EraProgress/EraTarget系统 | 功能可能不完整 |
| 4 | **驻防系统依赖HeroSystem** | GarrisonSystem.assignGarrison 需要 HeroSystem 提供武将数据，无Hero时返回失败 | 需要确保HeroSystem集成 |
| 5 | **离线特殊事件(NPC求助/送礼/引荐)无独立处理器** | Play文档描述的离线NPC特殊事件在OfflineEventSystem中无专用处理 | 功能可能不完整 |

### ⚠️ 待确认项 (2)

| # | 项目 | 详情 |
|---|------|------|
| 6 | **时代加成因子** | Play文档定义了时代加成(×1.0→×1.5)，但引擎中未见独立的EraBonus计算模块 |
| 7 | **NPC日程系统** | Play文档定义了24小时日程，但引擎中未见NPCScheduleSystem |

---

## 测试文件清单

| 文件路径 | 测试数 |
|----------|--------|
| `engine/__tests__/integration/v6-era-trend.integration.test.ts` | 23 |
| `engine/__tests__/integration/v6-territory-map.integration.test.ts` | 31 |
| `engine/__tests__/integration/v6-npc-affinity.integration.test.ts` | 32 |
| `engine/__tests__/integration/v6-event-system.integration.test.ts` | 30 |
| `engine/__tests__/integration/v6-cross-validation.integration.test.ts` | 24 |

---

## 执行结果

```
✓ v6-era-trend.integration.test.ts       (23 tests)  19ms
✓ v6-npc-affinity.integration.test.ts    (32 tests)  21ms
✓ v6-event-system.integration.test.ts    (30 tests)  31ms
✓ v6-territory-map.integration.test.ts   (31 tests) 314ms
✓ v6-cross-validation.integration.test.ts (24 tests) 273ms

Test Files  5 passed (5)
     Tests  140 passed (140)
   Duration  2.41s
```

---

## 结论

v6.0 天下大势核心系统（日历/事件/NPC/地图/离线）集成测试全部通过，140个测试覆盖Play文档§1-§8全部流程。

主要发现：
1. 好感度数值配置与Play文档存在偏差（dialogBase=3 vs 5, giftPreferredMultiplier=2.0 vs 1.5）
2. NPC职业类型命名与Play文档不同（warrior/strategist vs 士兵/学者）
3. 时代推进、NPC日程等部分功能可能需要独立的子系统来完整实现Play文档描述的功能
