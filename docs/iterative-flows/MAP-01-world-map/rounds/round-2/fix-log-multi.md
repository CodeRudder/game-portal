# Round 2 Multi-Issue Fix Log

> **日期**: 2026-05-05
> **修复范围**: FL-MAP-01, FL-MAP-04, FL-MAP-09, FL-MAP-11, FL-MAP-16, PLAN.md, map-interfaces.md
> **修复问题数**: 8个 (P1-M-01 ~ P1-M-08, INT-R2-01, INT-R2-02)

---

## 修复汇总

| 问题编号 | 问题描述 | 修复文件 | 版本变更 |
|---------|---------|---------|---------|
| P1-M-01 | 编队战力公式统一 | FL-MAP-09, PLAN.md | v6->v6.1, v1.2->v1.3 |
| P1-M-02 | 新手引导步骤3查找算法+攻城条件修正引导 | FL-MAP-01, FL-MAP-09 | v3.2->v3.3, v6->v6.1 |
| P1-M-03 | cancelled编队清理+ForceStatus映射 | FL-MAP-16, map-interfaces.md | v4->v4.1, v1->v1.1 |
| P1-M-04 | 领取关闭弹窗通知未定义 | FL-MAP-11 | v3.2->v3.3 |
| P1-M-06 | 行军精灵点击热区未定义 | FL-MAP-04 | v3.1->v3.2 |
| P1-M-07 | PC端编队回退机制 | FL-MAP-09 | v6->v6.1 |
| P1-M-08 | 新手引导步骤3弹窗关闭时机 | FL-MAP-01 | v3.2->v3.3 |
| INT-R2-01 | PendingReward接口统一 | map-interfaces.md | v1->v1.1 |
| INT-R2-02 | BattleResult 3档/5档映射标注 | map-interfaces.md | v1->v1.1 |

---

## 详细修改记录

### P1-M-01: 编队战力公式统一

**问题**: FL-MAP-09 Stage P3 编队战力简化表述与 FL-MAP-16 S2 完整公式之间缺乏交叉引用，PLAN.md 附录 C.1 未指向完整版本。

**修复**:
1. **FL-MAP-09 Stage P3** (行200): 在"编队战力计算"后追加标注 `[P1-M-01] 编队总战力简化表述=Σ(各编队兵力×武将进攻战力系数)，完整公式见FL-MAP-16 S2 [P0-02-R2]`
2. **PLAN.md 附录 C.1** (行392): 在"基础兵力战力"标题下添加注意事项 `[P1-M-01] 注意: 此处为简化公式。完整编队总战力公式（含将领属性加成和科技加成）详见 FL-MAP-16 S2 [P0-02-R2]`

**版本变更**: FL-MAP-09 v6->v6.1, PLAN.md v1.2->v1.3

---

### P1-M-02: 新手引导步骤3查找算法 + 攻城条件修正引导

**问题**: 步骤3敌方城池查找算法描述不够简洁（已有P1-R2-01详细版本但缺少简洁摘要），攻城条件不满足时未定义优先解决顺序。

**修复**:
1. **FL-MAP-01-SP01 关键行为** (行224后): 添加 `[P1-M-02] 步骤3敌方城池查找算法` 简洁摘要版本
2. **FL-MAP-09 Stage P2** (行157): 在校验失败处理后添加 `[P1-M-02] 当多条校验不满足时，推荐优先解决顺序：(1)兵力不足→提示'补充兵力'并链接到兵力池管理；(2)粮草不足→提示'获取粮草'并链接到产出收取；(3)每日次数耗尽→提示'今日攻城次数已用完，明日再来'`

**版本变更**: FL-MAP-01 v3.2->v3.3, FL-MAP-09 v6->v6.1

---

### P1-M-03 + INT-R2-04: cancelled编队清理 + ForceStatus映射

**问题**: FL-MAP-16 映射表已有 cancelled 行但缺少 P1-M-03 标记，map-interfaces.md 缺少 cancelled ForceStatus 说明和映射行。

**修复**:
1. **FL-MAP-16 P1-39映射表** cancelled行: 添加 `[P1-M-03]` 标记
2. **map-interfaces.md ForceStatus类型** (行46): 添加注释 `[P1-M-03] cancelled: SiegeTask取消时编队直接执行销毁流程（归还兵力+释放将领），不经过cancelled ForceStatus中间状态`
3. **map-interfaces.md 编队状态映射表** (行274): 更新 completed/cancelled 行为编队销毁（与FL-MAP-16保持一致），添加 `[P1-M-03]` 标记

**版本变更**: FL-MAP-16 v4->v4.1, map-interfaces.md v1->v1.1

---

### P1-M-04: 领取关闭弹窗通知未定义

**问题**: 玩家关闭攻城奖励弹窗后，奖励领取结果的通知形式未定义。

**修复**:
1. **FL-MAP-11-04** (行158后): 在 `[V-023]` 关闭弹窗说明后追加 `[P1-M-04] 关闭弹窗后奖励领取结果通知规格`: 位置=屏幕顶部中央偏下，样式=资源到账卡片，停留=5s或手动关闭，动画=从顶部滑入

**版本变更**: FL-MAP-11 v3.2->v3.3

---

### P1-M-06: 行军精灵点击热区未定义

**问题**: 行军精灵可点击但未定义触摸热区大小和缩放行为。

**修复**:
1. **FL-MAP-04-02 精灵规格** (行128后): 添加 `[P1-M-06] 行军精灵点击热区`: 精灵实际尺寸外扩至最小44x44px触摸热区（参考FL-MAP-03-02），缩放比例<0.5时热区保持最小44x44px不随缩放缩小，热区为透明矩形不显示边框

**版本变更**: FL-MAP-04 v3.1->v3.2

---

### P1-M-07: PC端编队回退机制

**问题**: Stage P3(编队选择)到P4(策略选择)之间PC端缺少"上一步"回退按钮定义。

**修复**:
1. **FL-MAP-09 Stage P4** (行226后): 添加 `[P1-M-07] PC端Stage P4(策略选择)页面左下角显示[← 上一步]按钮，点击回到Stage P3(编队选择)保留已选将领和兵力。移动端Step Wizard自带[上一步]按钮无需额外定义`

**版本变更**: FL-MAP-09 v6->v6.1

---

### P1-M-08: 新手引导步骤3弹窗关闭时机

**问题**: 新手引导步骤3进入攻城确认弹窗后，弹窗关闭时机和按钮状态未定义，存在新手误操作风险。

**修复**:
1. **FL-MAP-01-SP01 关键行为** (行229后): 添加 `[P1-M-08] 步骤3弹窗关闭时机`:
   - 弹窗内顶部显示浮动提示条（3s后自动消失）
   - 提示消失后自动完成本步骤并关闭弹窗
   - 弹窗中禁用[确认]和[攻占]按钮（置灰），仅保留[关闭]按钮可用

**版本变更**: FL-MAP-01 v3.2->v3.3

---

### INT-R2-01: PendingReward接口统一

**问题**: map-interfaces.md 中的 PendingReward 为简单版本（4个字段），与 FL-MAP-11-03 定义的详细版本（含items列表、strategyType、status等）不一致。

**修复**:
1. **map-interfaces.md PendingReward接口** (行396-402): 替换为详细版本（7个字段 + 新增 RewardItem 子接口），字段包含: id, siegeTaskId, items, strategyType, strategyMultiplier, expiresAt, status。同步添加 `[INT-R2-01]` 标注

**版本变更**: map-interfaces.md v1->v1.1

---

### INT-R2-02: BattleResult 3档/5档映射标注

**问题**: SiegeTask.result 字段注释仅标注"战斗结果"，未说明5档UI值到3档计算值的映射关系。

**修复**:
1. **map-interfaces.md SiegeTask.result字段** (行300): 更新注释为 `[INT-R2-02] result字段：攻城5档UI值(大胜/小胜/险胜/惜败/惨败)经判定树映射为3档计算值(victory/defeat/crushing_defeat)，详见FL-MAP-17 S1映射表`

**版本变更**: map-interfaces.md v1->v1.1

---

## 文件变更汇总

| 文件 | 修改前行数 | 变更类型 | 版本 |
|------|----------|---------|------|
| `flows/FL-MAP-01-enter-tab.md` | 330 | 新增2段关键行为描述 | v3.2 -> v3.3 |
| `flows/FL-MAP-04-march-animation.md` | 239 | 新增精灵点击热区定义 | v3.1 -> v3.2 |
| `flows/FL-MAP-09-siege-warfare.md` | 728 | 新增3处标注(P1-M-01/02/07) | v6 -> v6.1 |
| `flows/FL-MAP-11-siege-rewards.md` | 223 | 新增通知规格 | v3.2 -> v3.3 |
| `flows/FL-MAP-16-expedition-force.md` | 293 | 映射表添加标记 | v4 -> v4.1 |
| `types/map-interfaces.md` | 640 | PendingReward重写+映射表更新+2处注释 | v1 -> v1.1 |
| `PLAN.md` | 473 | 附录C.1添加注意事项 | v1.2 -> v1.3 |

---

*Fix log generated 2026-05-05*
