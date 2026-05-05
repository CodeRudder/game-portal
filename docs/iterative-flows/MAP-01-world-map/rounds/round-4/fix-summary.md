# Round 4 修复摘要

> **日期**: 2026-05-05
> **修复范围**: P0 (8项) + P1 (12项) = 20项全部修复

## P0 修复 (8/8)

| ISS | 修复文件 | 修复方式 |
|-----|---------|---------|
| ISS-001 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | Stage P3 添加权威公式声明注释，标注为简化预览版。Stage P8 城防衰减公式中"攻方总战力"改为引用 FL-MAP-16 S2 完整公式。L1 Phase 3 城防衰减公式同步更新引用。公式索引同步更新。 |
| ISS-002 | FL-MAP-09-siege-warfare.md | 关键公式索引 [V-029] 标注`[已废弃，以 Stage P8 内联公式为准: 城防初始值 = (城市等级×100 + 守军×0.5) × (1.0 + 城墙等级×0.05)]` |
| ISS-003 | FL-MAP-09-siege-warfare.md, PLAN.md | 在 AC-09-01 验收标准旁添加术语区分注释: `decay_strategy_modifier`（城防衰减专用）vs `power_strategy_modifier`（编队战力修正）。PLAN.md C.2 策略修正表添加同名注释。 |
| ISS-004 | PLAN.md | C.4 节标题标注`[R4-ISS-004 已废弃]`，添加废弃原因说明（分母结构差异+策略修正差异），明确以 FL-MAP-09 AC-09-01 为权威来源。 |
| ISS-005 | FL-MAP-09-siege-warfare.md | [P2-M-06] 和 [P2-R3-21] 统一为 `rgba(0,0,0,0.6)`（60%），添加统一透明度声明注释，旧版 rgba(0,0,0,0.3) 标注废弃。 |
| ISS-006 | FL-MAP-09-攻城主流程.md | Phase 1→2 过渡描述中添加完整过渡动画序列（5步）：弹窗自动关闭→Toast→视口平移→精灵脉冲高亮→开始移动。 |
| ISS-007 | FL-MAP-09-攻城主流程.md | Phase 2 中添加行军期间全局进度指示描述：任务面板常驻显示、到达前5s倒计时Toast、视口外边缘指示器、精灵点击热区。 |
| ISS-008 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | 恢复超时从10秒改为30秒（移动端）/10秒（PC端）。更新遮罩文案、添加"继续战斗"按钮、添加pagehide事件暂停倒计时机制。同步更新 FR-09-05、AC-09-02、Stage P8 恢复视觉、CR-10、AC-M-06、ERR表等。 |

## P1 修复 (12/12)

| ISS | 修复文件 | 修复方式 |
|-----|---------|---------|
| ISS-009 | FL-MAP-09-siege-warfare.md | 明确T定义（从第1回合开始，不含集结3s），修正T范围为1~20s（每回合1s，最长20回合）。修正5档表为基于回合数判定：大胜(T<5s)、胜利(5≤T<10s)、险胜(10≤T≤20s)、失败(超时城防<30%)、惨败(超时城防≥30%)。删除不合理的30s/60s档位。 |
| ISS-010 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | P0-V07统一取消规则中补充marching阶段恢复超时条目（50%退还+扣次数+5分钟冷却）。V-006更新引用。L1取消退款汇总表和ERR-S09同步更新。 |
| ISS-011 | FL-MAP-09-siege-warfare.md | 明确settling仅指系统结算操作（约3~4s），settling→returning触发点为弹窗显示后即转换。注释编队回城与用户弹窗操作并行。 |
| ISS-012 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | Stage P8 战斗结束分支表中失败/撤退/恢复超时分支均显式标注"→ Stage P10（编队回城+销毁）"。L1结算后执行序列中标注失败时跳过奖励计算和领取步骤。 |
| ISS-013 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | 明确"同一目标"=城池ID(cityId)。攻下后归属变更冷却保留。AI攻占不重置玩家冷却。定义存储结构 `{ targetCityId: string, cooldownUntil: number }[]`。CR-12同步更新。 |
| ISS-014 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | Stage P6 旧版4级优先级描述标记为废弃（删除线），标注引用 FL-MAP-09-09 [P2-M-13]。L1 Phase 2 行军精灵规范中替换旧版4级描述为引用。 |
| ISS-015 | FL-MAP-09-siege-warfare.md, PLAN.md | 与ISS-003合并处理。在AC-09-01旁添加两组参数（decay_strategy_modifier / power_strategy_modifier）的完整区分定义。PLAN.md C.2 同步添加注释。 |
| ISS-016 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | Stage P7 和 L1 Phase 2→3 过渡中添加攻城开始通知描述：全屏通知弹窗"攻城开始！"+ 震动反馈100ms + 强制视口跳转500ms + 战鼓音效。 |
| ISS-017 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | 添加战斗信息面板完整布局描述（底部进度条>=8px + 城防百分比数字 + 三区域面板）。添加动态事件提示机制（浮动文字）。标注为体验优化项。 |
| ISS-018 | FL-MAP-09-攻城主流程.md | L1结算后执行序列中标注：计算时间<200ms时跳过中间加载态，使用数字滚动动画（从0递增到最终值，持续300ms）代替文字加载提示。 |
| ISS-019 | FL-MAP-09-siege-warfare.md, FL-MAP-09-攻城主流程.md | 添加回城后视口行为：地图停留当前视口（不跳转）、回城精灵opacity 0.6、任务面板持续显示、到达使用持久性通知卡片（非Toast）。 |
| ISS-020 | FL-MAP-09-siege-warfare.md | 与ISS-008合并处理（恢复超时30秒）。标注暂停功能不实现，记录为Backlog。 |

## 修改文件清单

| 文件 | 版本变更 | 修改内容摘要 |
|------|---------|------------|
| FL-MAP-09-攻城主流程.md | v1.0 → v1.1.R4 | ISS-001/006/007/008/010/012/013/014/016/017/018/019 修复 |
| FL-MAP-09-siege-warfare.md | v6.3 → v6.4.R4 | ISS-001/002/003/005/008/009/010/011/012/013/014/015/016/017/019/020 修复 |
| PLAN.md | v1.4 → v1.5.R4 | ISS-003/004/015 修复（C.2术语区分 + C.4废弃标注） |
| INDEX.md | v3.2 → v3.3.R4 | 版本号和状态更新 |

## 修复统计

- **P0 修复**: 8/8 (100%)
- **P1 修复**: 12/12 (100%)
- **P2 待处理**: 9项（ISS-021~ISS-029，本轮不处理）
- **P3 Backlog**: 5项（ISS-030~ISS-034，本轮不处理）
- **总修改**: 20项 ISS，涉及 4 个文件

---

*Round 4 Fix Summary v1.0 | 2026-05-05 | P0+P1 全部修复完成*
