# 三国霸业 — 经验教训

## LL-001: 资源栏脉冲动画移除

**日期**: 2026-04-27
**模块**: 资源栏 (ResourceBar)
**功能点**: #12 资源产出脉冲动画

### 问题描述
资源栏在资源数值增加时触发的脉冲动画（tk-res-item--pulse），在放置游戏高频产出场景下持续触发，形成持续的视觉干扰，影响用户注意力和沉浸感。

### 根因分析
1. **设计假设错误**: 设计时假设脉冲动画提供"产出反馈"，但放置游戏中资源每秒自动增长，脉冲动画变成持续性的视觉噪音
2. **未考虑使用频率**: 放置游戏的资源产出频率远高于手动操作游戏，动画触发频率过高
3. **违背用户偏好**: 用户明确表示不喜欢页面明暗变化效果等干扰视觉的UI设计

### 决策
- **移除**: 资源增加时的脉冲动画（resource-pulse / tk-res-item--pulse）
- **保留**: 满仓警告动画（tk-res-item--urgent / tk-res-item--full），因为这是有意义的状态警告

### 经验教训
1. **动画设计原则**: UI动画应区分"持续性反馈"和"状态变化通知"。高频事件不应使用视觉动画反馈
2. **放置游戏特殊性**: 放置游戏的自动产出机制意味着任何"产出反馈"动画都会变成持续性干扰
3. **用户偏好优先**: 当用户明确表达对某类视觉效果的厌恶时，应在设计阶段就规避，而非后期修正
4. **动画审计标准**: 新增UI动画应评估触发频率 — 超过每5秒1次的动画应避免使用视觉脉冲效果

### 影响文件
- `src/components/idle/panels/resource/ResourceBar.tsx` — 移除脉冲逻辑
- `src/components/idle/panels/resource/ResourceBar.css` — 移除脉冲动画定义
- `docs/games/three-kingdoms/ui-design/08-resource-system.md` — 标注变更
- `docs/games/three-kingdoms/play/v1-play.md` — 标注变更
- `docs/games/three-kingdoms/acceptance/ACC-*.md` — 标注变更

### 适用范围
此经验教训适用于所有放置/增量类游戏的UI动画设计决策。
