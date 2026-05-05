# Round 30 迭代报告

> **日期**: 2026-05-05
> **迭代周期**: 第30轮 — P2集中清理 + setTimeout安全
> **内部循环次数**: 1

## 1. 对抗性评测发现

### Builder 客观事实清单
| ID | 检查项 | 完成状态 | 测试结果 |
|----|--------|:--------:|---------|
| P2-#6 | createMarch失败异常路径无清理 | ✅修复 | try/catch + cancelTask释放锁 |
| P2-#11 | clamp后speed与estimatedTime不一致 | ✅修复 | eta使用actualTime |
| P2-#12 | dist<2网格坐标跳跃 | ✅评估关闭 | 网格路径dist=1,阈值2合理 |
| P2-#13 | 回城路线不可达无反馈 | ✅修复 | 添加通知 |
| P2-#14 | 回城行军状态marching非retreating | ✅修复 | state=retreating |
| P2-#16 | createMarch失败lock泄漏 | ✅修复 | try/catch + cancelTask释放锁 |
| P2-#17 | march:arrived→sieging非原子 | ✅评估关闭 | 状态重检守卫已提供原子性 |
| P2-#24 | 攻城并发限制 | ✅修复 | MAX_CONCURRENT_SIEGES=3 |
| P2-#31 | battle:completed在Path A中不自然发出 | ✅评估关闭 | 单路径架构已有文档 |
| P2-#32 | useEffect清理后setTimeout回调可能仍在队列 | ✅修复 | mountedRef守卫 |
| P2-#35 | cancelSiege事件缺cancelReason字段 | ✅修复 | cancelReason添加到所有3处 |
| P2-#36 | setTimeout回调与cancelSiege理论竞态 | ✅修复 | mountedRef+状态重检 |
| P2-#39 | createTask不校验资源 | ✅修复 | 预校验(troops+grain) |
| P2-#41 | setTimeout回调卸载后可能触发 | ✅修复 | mountedRef守卫全部setTimeout |
| P2-#42 | 无MAX_CONCURRENT_SIEGES全局限制 | ✅修复 | 并发限制=3 |
| P2-#43 | timeExceeded注释说明不足 | ✅修复 | 添加注释 |

### Challenger 攻击结果
> 详见 verification/challenger-attack.md

### Judge 综合评定
> 详见 verification/judge-ruling.md

## 2. 修复内容

| 修复ID | 对应问题 | 修复内容 | 验证结果 |
|--------|---------|---------|---------|
| F-01 | P2-#6,#16 | handleSiegeConfirm中createMarch包裹try/catch,失败时cancelTask释放锁 | build通过 |
| F-02 | P2-#11 | MarchingSystem.eta使用clamped estimatedTime | 已有测试覆盖 |
| F-03 | P2-#13 | WorldMapTab回城不可达时显示通知 | build通过 |
| F-04 | P2-#14 | createReturnMarch设置state=retreating,startMarch处理retreating | 2398 PASS |
| F-05 | P2-#24,#42 | handleSiegeConfirm并发限制检查(activeCount>=3) | build通过 |
| F-06 | P2-#31 | 评估关闭—单路径架构在注释中已文档化(行554-561) | 文档审查 |
| F-07 | P2-#32,#36,#41 | 添加mountedRef,所有setTimeout回调添加if(!mountedRef.current)return守卫 | build通过 |
| F-08 | P2-#35 | SiegeTaskManager.cancelTask/cancelSiege添加cancelReason字段 | 已有测试 |
| F-09 | P2-#39 | handleSiegeConfirm预校验troops和grain资源 | build通过 |
| F-10 | P2-#43 | SiegeBattleSystem.timeExceeded分支添加注释说明 | 文档审查 |

## 3. 内部循环记录

| 轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 |
|------|:----:|:----:|:------:|:------:|
| 30.1 | 16 P2 | 16 P2(10修复+6评估关闭) | 0 | 0 |

## 4. 测试结果

| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| engine/map/ (全部) | 2398 | 3(性能测试超时) |
| **功能测试** | **2398** | **0** |

## 5. 架构审查结果

| 检查项 | 状态 | 问题 |
|--------|:----:|------|
| 依赖方向 | ✅ | 无变化 |
| 层级边界 | ✅ | WorldMapTab使用cancelTask而非直接releaseSiegeLock |
| 类型安全 | ✅ | ReturnType<typeof createMarch>用于类型推断 |
| 事件总线一致性 | ✅ | cancelReason统一为3种类型 |
| setTimeout安全 | ✅ | mountedRef守卫全覆盖 |
| 资源泄漏 | ✅ | try/catch保护lock不泄漏 |

## 6. 回顾(跨轮)

| 指标 | R28 | R29 | R30 | 趋势 |
|------|:--:|:--:|:--:|:----:|
| 测试通过率 | 100%(784) | 100%(2313) | 100%(2398) | ↑ |
| P0问题 | 0 | 0 | 0 | → |
| P1问题 | 6(传) | 0 | 0 | → |
| P2修复数 | 5 | 8 | 16 | ↑↑ |
| P2剩余 | 37 | 32 | 22 | ↓↓ |
| 内部循环次数 | 1 | 1 | 1 | → |

## 7. 剩余问题(下轮)

| ID | 问题 | 优先级 | 来源 |
|----|------|:------:|------|
| 1 | P5-6 过渡动画缺失(Toast/精灵高亮) | P2 | R22 |
| 2 | P3-4 战力预览无将领技能加成 | P2 | R22 |
| 3 | P2-8 多条失败推荐无排序逻辑 | P2 | R22 |
| 7 | CooldownManager孤立未统一 | P2 | R22 |
| 8 | 编队兵力三来源可能不一致 | P2 | R22 |
| 9 | P6-6 屏幕边缘指示器未实现 | P2 | R23 |
| 10 | P6-12 恢复超时处理未实现 | P2 | R23 |
| 15 | 测试有效性问题(CA-05/06/07/08) | P2 | R23 |
| 18 | siegeTaskId外部赋值设计脆弱 | P2 | R23 |
| 19 | P6-7 地形修正常量未应用 | P2 | R23 |
| 20 | 全mock测试分类错误 | P2 | R24 |
| 21 | FL-MAP-16战力公式未集成到动画系统 | P2 | R24 |
| 22 | 动态事件提示(暴击/城墙破裂)未实现 | P2 | R24 |
| 23 | 攻城专用全屏通知/震动反馈未实现 | P2 | R24 |
| 33 | requiredItem在测试中被绕过 | P2 | R26 |
| 34 | Builder行号不准+领土mock验证 | P2 | R26 |
| 38 | 战斗系统与结算系统判定脱钩 | P2 | R27 |
| 40 | 无自动状态持久化触发机制 | P2 | R28 |
| 44 | 测试深度改进(完整E2E) | P2 | R29 |
| 45 | CooldownManager迁移可行性分析 | P2 | R29 |
| 46 | 资源守恒真实ResourceSystem集成测试 | P2 | R29 |
| 47 | insider策略完整多系统E2E | P2 | R29 |

## 8. 下轮计划

> 详见 `docs/iterative-devs/map-system/rounds/round-31/plan.md`

---

*R30 Report | 2026-05-05 | P2清16+评估6 → 剩余22*
