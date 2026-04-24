# v18.0 引导系统集成测试检查清单

> 日期：2026-04-24
> 版本：v18.0
> 范围：`engine/guide/__tests__/integration/`

## 测试文件汇总

| # | 文件 | 覆盖章节 | 通过 | 跳过 | 失败 | 状态 |
|---|------|----------|------|------|------|------|
| 1 | `tutorial-state-machine.integration.test.ts` | §1 引导状态机 | 20 | 0 | 0 | ✅ |
| 2 | `story-event.integration.test.ts` | §2 剧情事件 | 26 | 0 | 0 | ✅ |
| 3 | `tutorial-mask-skip.integration.test.ts` | §3 遮罩跳过 | 38 | 0 | 0 | ✅ |
| 4 | `tutorial-skip-replay-sync.integration.test.ts` | §4 跳过重玩同步 | 25 | 1 | 0 | ✅ |
| 5 | `tutorial-full-flow.integration.test.ts` | §5 全流程 | 23 | 0 | 0 | ✅ |
| 6 | `tutorial-stats-recovery-mobile.integration.test.ts` | §6 统计恢复移动端 | 25 | 4 | 0 | ✅ |
| 7 | `tutorial-story-mask-protection.integration.test.ts` | §7 剧情遮罩保护 | 40 | 0 | 0 | ✅ |

## 合计

- **测试文件**：7
- **测试用例**：197 passed / 5 skipped / 0 failed / 202 total
- **耗时**：2.36s
- **结果**：✅ 全部通过

## 关键覆盖点

### §1 引导状态机 (20/20)
- [x] 5阶段转换 (not_started → core_guiding → free_explore → free_play)
- [x] 首次/老用户路径
- [x] 加速跳过
- [x] 进度追踪与序列化
- [x] 冲突解决

### §2 剧情事件 (26/26)
- [x] E1桃园结义触发与播放
- [x] E2~E8剧情排队
- [x] 触发时序与优先级
- [x] 完成条件与奖励发放
- [x] 剧情与步骤联动

### §3 遮罩跳过 (38/38)
- [x] 步骤高亮与遮罩聚焦
- [x] 跳过机制（不可跳过步骤检测）
- [x] 重玩机制（watch/interactive模式）
- [x] 中断恢复（序列化/反序列化）
- [x] 新手保护
- [x] 简化模式

---

_生成时间：2026-04-24_
