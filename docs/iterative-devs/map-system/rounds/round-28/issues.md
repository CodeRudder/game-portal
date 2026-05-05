# Round 28 问题追踪

> **轮次**: Round 28 — 异常处理路径审核 + P2集中清理
> **创建**: 2026-05-05
> **来源**: Builder对抗性审核 + P2批量修复

## 问题清单

| ID | 严重度 | 类型 | 来源 | 描述 | 涉及文件 | 状态 |
|----|:------:|------|:----:|------|---------|:----:|
| R28-I01 | P1 | 测试 | Builder | 6个defeatTroopLoss断言与R27修复不同步 | 3个集成测试文件 | ✅ |
| R28-I02 | P2 | 功能 | Builder ERR-1 | 无自动状态持久化触发机制 | SiegeTaskManager.ts | ➡️ |
| R28-I03 | P2 | 时序 | Builder ERR-5 | handleArrived内setTimeout(0)回调在卸载后可能触发 | WorldMapTab.tsx | ➡️ |
| R28-I04 | P2 | 功能 | Builder ERR-4 | 无MAX_CONCURRENT_SIEGES全局并发限制 | WorldMapTab.tsx | ➡️ |
| P2-#26 | P2 | 功能 | P2清理 | deductSiegeResources缺siege:resourceError事件 | SiegeSystem.ts | ✅ |
| P2-#25 | P2 | UX | P2清理 | SiegeResultModal缺5秒自动关闭fallback | SiegeResultModal.tsx | ✅ |
| P2-#5 | P2 | 代码 | P2清理 | configRegistry vs config命名不匹配 | 4个测试文件 | ✅ |
| P2-#29 | P2 | 文档 | P2清理 | "智取"策略不存在，计划与代码命名不对齐 | round-26/plan.md | ✅ |
| P2-#4 | P2 | 功能 | P2清理 | cancelSiege注释声称释放锁但代码未实现 | SiegeTaskManager.ts | ✅ |

## 修复记录

### R28-I01 ✅ 已修复
- **问题**: R27修复将defeatTroopLoss从30%改为0，但6个集成测试仍断言旧值
- **修复**: 更新3个测试文件中6处断言为`expect(result.defeatTroopLoss).toBe(0)`
- **验证**: 784/784集成测试通过

### P2-#26 ✅ 已修复
- deductSiegeResources的catch块添加`this.deps?.eventBus.emit('siege:resourceError', ...)`

### P2-#25 ✅ 已修复
- SiegeResultModal添加useEffect定时器，5秒后自动调用onClose

### P2-#5 ✅ 已修复
- 4个测试文件将configRegistry统一为config

### P2-#29 ✅ 已修复
- plan.md E2E-9更新为"围困策略timeMultiplier=2.0"

### P2-#4 ✅ 已修复
- cancelSiege的returning路径添加releaseSiegeLock

## 传递问题

### 活跃P1传递(6个→检查状态)
| ID | 问题 | 处理 |
|----|------|------|
| R24-I08 | 失败条件死代码(timeExceeded不可达) | Builder确认Path A中不可达是架构特性，➡️→R29 |
| R26-I03 | setTimeout(0)竞态风险 | Builder分析竞态风险极低，➡️→R29 |
| R26-I07 | 资源守恒未验证 | ➡️→R29 |
| R27-I02 | cancelSiege settling全量兵力(防御性) | ➡️→R29 |
| R27-I03 | settling cancel资源守恒 | ➡️→R29 |
| R27-I06 | 缺settling cancel e2e测试 | ➡️→R29 |

---
*issues.md | Round 28 | 2026-05-05*
