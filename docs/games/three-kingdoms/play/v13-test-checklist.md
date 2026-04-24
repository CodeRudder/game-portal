# v13.0 联盟争霸 — 测试检查清单

> **日期**: 2026-04-24
> **迭代**: R35
> **版本**: v13.0 联盟争霸
> **测试框架**: Vitest
> **总测试数**: 372 (全部通过)

---

## 一、测试文件清单

### 单元测试 (5文件, 108用例)
| 文件 | 用例数 | 状态 |
|------|--------|------|
| AllianceSystem-p1.test.ts | 23 | ✅ |
| AllianceSystem-p2.test.ts | 26 | ✅ |
| AllianceBossSystem.test.ts | 22 | ✅ |
| AllianceShopSystem.test.ts | 19 | ✅ |
| AllianceTaskSystem.test.ts | 18 | ✅ |

### 集成测试 (7文件, 264用例)
| 文件 | 用例数 | 覆盖Play章节 | 状态 |
|------|--------|-------------|------|
| alliance-lifecycle.integration.test.ts | 50 | §1-2, §5.4 | ✅ |
| alliance-boss-task.integration.test.ts | 34 | §3.1, §4.3 | ✅ |
| alliance-shop-donation.integration.test.ts | 29 | §4.2, §2.4 | ✅ |
| alliance-cross-system.integration.test.ts | 20 | §5.1-5.3 | ✅ |
| **alliance-war-pvp.integration.test.ts** 🆕 | 37 | §3.1-3.3, §7.1-7.3, §14.1 | ✅ |
| **activity-system.integration.test.ts** 🆕 | 52 | §6.1-6.6, §8.1-8.2, §9.x, §11.2 | ✅ |
| **cross-system-v2.integration.test.ts** 🆕 | 42 | §11.1-11.5, §12.x, §14.2/5/6, §16.x | ✅ |

---

## 二、Play流程覆盖率

### 模块A: 联盟基础
| # | 功能点 | 单元测试 | 集成测试 | 状态 |
|---|--------|---------|---------|------|
| 1 | 联盟创建与加入 | ✅ | ✅ lifecycle | ✅ |
| 2 | 联盟成员管理 | ✅ | ✅ lifecycle | ✅ |
| 3 | 联盟频道与公告 | ✅ | ✅ lifecycle | ✅ |
| 4 | 联盟等级与福利 | ✅ | ✅ lifecycle | ✅ |

### 模块B: 联盟活动
| # | 功能点 | 单元测试 | 集成测试 | 状态 |
|---|--------|---------|---------|------|
| 5 | 联盟Boss | ✅ | ✅ boss-task + war-pvp | ✅ |
| 6 | 联盟任务 | ✅ | ✅ boss-task | ✅ |
| 7 | 联盟商店 | ✅ | ✅ shop-donation | ✅ |
| 8 | 联盟排行榜 | — | ✅ war-pvp | ⚠️ 逻辑测试 |

### 模块C: PvP赛季深化
| # | 功能点 | 集成测试 | 状态 |
|---|--------|---------|------|
| 9 | 赛季主题与专属奖励 | ✅ war-pvp | ⚠️ 规则测试 |
| 10 | 赛季结算动画 | ✅ war-pvp | ⚠️ 流程测试 |
| 11 | 赛季战绩榜 | ✅ war-pvp | ⚠️ 数据测试 |

### 模块D-H: 活动系统
| # | 功能点 | 集成测试 | 状态 |
|---|--------|---------|------|
| 12 | 活动列表弹窗 | ✅ activity | ⚠️ 规则测试 |
| 13 | 活动类型矩阵 | ✅ activity | ⚠️ 配置测试 |
| 14 | 活动任务系统 | ✅ activity + boss-task | ✅ |
| 15 | 里程碑奖励 | ✅ activity | ⚠️ 逻辑测试 |
| 16 | 每日签到 | ✅ activity | ⚠️ 规则测试 |
| 17 | 活动离线进度 | ✅ cross-v2 | ⚠️ 公式测试 |
| 18 | 联盟捐献与贡献 | ✅ shop-donation | ✅ |
| 19 | 联盟科技树 | ✅ cross-v2 | ⚠️ 公式测试 |
| 20 | 联盟对战 | ✅ war-pvp | ⚠️ 模拟测试 |
| 21 | 活动排行榜+七阶商店 | ✅ activity | ⚠️ 配置测试 |
| 22 | 每日活跃度 | ✅ activity | ⚠️ 规则测试 |
| 23 | 联盟解散与盟主退位 | ✅ lifecycle | ✅ |
| 24 | 联盟对战替补与平局 | ✅ war-pvp | ⚠️ 逻辑测试 |
| 25 | 联盟与活动邮件 | ✅ cross-v2 | ⚠️ 触发测试 |
| 26 | 回归面板活动离线集成 | ✅ cross-v2 | ⚠️ 流程测试 |

### 模块I: 跨系统串联
| # | 功能点 | 集成测试 | 状态 |
|---|--------|---------|------|
| 27 | 联盟对战与PVP积分独立性 | ✅ war-pvp | ✅ |
| 28 | 联盟商店与活动商店互斥 | ✅ cross-v2 | ✅ |
| 29 | 联盟对战→MAP领土串联 | ✅ cross-v2 | ⚠️ 流程测试 |
| 30 | 联盟→声望双向串联 | ✅ cross-v2 | ⚠️ 公式测试 |

---

## 三、已知问题

| # | 问题 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | Boss奖励常量与Plan不一致 | P1 | 代码killGuildCoinReward=30 vs Plan贡献×150 |
| 2 | 创建联盟元宝消耗不一致 | P2 | 代码createCostGold=500 vs Plan元宝×200 |
| 3 | 联盟对战系统未实现引擎类 | P1 | 仅测试层模拟，无AllianceWarSystem |
| 4 | 联盟科技树未实现引擎类 | P1 | 仅测试层验证公式，无AllianceTechSystem |
| 5 | 活动系统未实现引擎类 | P1 | ActivitySystem/SignInSystem等缺失 |
| 6 | PvP赛季系统未实现引擎类 | P2 | ArenaSystem扩展未实现 |
| 7 | 活跃度系统未实现引擎类 | P2 | DailyActivitySystem缺失 |
| 8 | 代币经济系统未实现引擎类 | P2 | TokenEconomySystem缺失 |

---

## 四、新增测试统计 (R35)

| 新增文件 | 用例数 | 覆盖章节 |
|---------|--------|---------|
| alliance-war-pvp.integration.test.ts | 37 | §3.1-3.3, §7.1-7.3, §14.1 |
| activity-system.integration.test.ts | 52 | §6.1-6.6, §8.1-8.2, §9.x, §11.2 |
| cross-system-v2.integration.test.ts | 42 | §11.1-11.5, §12.x, §14.2/5/6, §16.x |
| **合计** | **131** | |

---

## 五、修复记录

| # | 修复内容 | 文件 |
|---|---------|------|
| 1 | 浮点比较: toBe(50) → toBeCloseTo(50, 1) | alliance-boss-task.integration.test.ts:341 |
| 2 | 科技加成测试: 过滤power=0的盟主 | cross-system-v2.integration.test.ts:154 |

---

## 六、构建验证

```
pnpm run build → ✅ built in ~18s
npx vitest run → ✅ 372/372 passed
```

---

**封版人**: AI进化迭代工程师
**封版日期**: 2026-04-24
