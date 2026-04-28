# 三国霸业 — 经验教训

---

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
- **移除**: 满仓警告脉冲动画（tk-res-pulse-urgent / tk-res-pulse-full）
- **移除**: 所有资源栏闪烁动画（tk-res-blink），包括溢出徽章（1.5s）、满仓数值（1.5s）、接近上限警告（2s）
- **保留**: 满仓警告静态红框（urgent/full 红色边框+背景），作为有意义的状态提示但不使用动画
- **保留**: 横幅入场slide动画（tk-res-banner-slide，0.3s一次性），属于入场过渡而非持续脉冲

### 经验教训
1. **动画设计原则**: UI动画应区分"持续性反馈"和"状态变化通知"。高频事件不应使用视觉动画反馈
2. **放置游戏特殊性**: 放置游戏的自动产出机制意味着任何"产出反馈"动画都会变成持续性干扰
3. **用户偏好优先**: 当用户明确表达对某类视觉效果的厌恶时，应在设计阶段就规避，而非后期修正
4. **动画审计标准**: 新增UI动画应评估触发频率 — 超过每5秒1次的动画应避免使用视觉脉冲效果
5. **静态优先原则**: 即使是低频状态警告（如满仓），也应优先使用静态视觉标记（红框/变色），而非动画效果。动画应仅用于需要立即行动的紧急场景

### 影响文件
- `src/components/idle/panels/resource/ResourceBar.tsx` — 移除脉冲逻辑
- `src/components/idle/panels/resource/ResourceBar.css` — 移除脉冲动画定义
- `docs/games/three-kingdoms/ui-design/08-resource-system.md` — 标注变更
- `docs/games/three-kingdoms/play/v1-play.md` — 标注变更
- `docs/games/three-kingdoms/acceptance/ACC-*.md` — 标注变更

### 适用范围
此经验教训适用于所有放置/增量类游戏的UI动画设计决策。

---

## LL-002: ACC测试用例名必须与验证内容严格一致

**日期**: 2026-04-28
**模块**: 武将系统 (HeroStarSystem)
**对应问题**: P1 — 武将升星后四维属性不变

### 问题描述
ACC-04-23 测试用例名为"升星后属性面板立即更新"，但实际只验证了 `starUp()` 返回 `success=true` 和 `currentStar > previousStar`（星级数字变化），**未验证四维属性值变化**。导致 UI 层 `statsAtLevel()` 缺少星级倍率的 BUG 长期存在而未被发现。

### 根因分析
1. **用例名与断言不匹配**: 测试名称暗示验证"属性面板更新"，但断言只检查星级数字，未检查属性值
2. **验证"存在性"而非"正确性"**: 只确认升星操作成功返回，未确认升星后的属性计算结果是否正确
3. **验收文档降级疏漏**: ACC-04-R1 已标记"statsAtLevel 不含星级倍率"的潜在风险，但降级为"P1(监控)"后实际未运行验证

### 决策/修复
- `HeroDetailModal.tsx` 属性计算加入 `getStarMultiplier`（P0，0.5h）
- `ThreeKingdomsEngine.ts` 的 `getHeroAttrs` 加入等级系数和星级倍率（P1，1h）
- ACC-04-23 增加属性值变化断言（P1，0.5h）
- 引入统一属性计算函数 `getEffectiveStats(baseStats, level, star)`（P2，0.5h）

### 经验教训
1. **用例名即契约**: ACC 测试用例名称中提到的每一个效果，都必须有对应的显式断言验证
2. **验证正确性而非存在性**: 不能只验证操作返回成功，必须验证操作导致的实际状态变化
3. **风险标记必须有闭环**: 验收文档中标记的"潜在风险"必须有明确的验证用例和截止日期，不能降级为"监控"后遗忘

### 影响文件
- `src/components/idle/panels/hero/HeroDetailModal.tsx` — 属性计算缺少星级倍率
- `src/games/three-kingdoms/engine/hero/star-up-config.ts` — 星级倍率配置
- `src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts` — getHeroAttrs 不含倍率
- `src/games/three-kingdoms/tests/acc/ACC-04-武将系统.test.tsx` — 测试只验证星级
- `docs/games/three-kingdoms/acc/ACC-04-R1.md` — 风险标记

---

## LL-003: 禁止"降级通过"测试模式

**日期**: 2026-04-28
**模块**: 天下Tab / 地图关卡 (WorldMapTab)
**对应问题**: P2 — 天下Tab占领城池功能集成链路断裂

### 问题描述
ACC-09-18 攻城按钮测试使用 `if (siegeBtn) {...} else { assertStrict(true) }` 模式。当攻城按钮不存在时，测试也会 PASS（`else` 分支永远通过），完全失去了验收意义。这导致 `SceneRouter.tsx` 未传递 `onSiegeTerritory` 回调的集成断裂问题长期未被发现。

### 根因分析
1. **"永远通过"漏洞**: `else { assertStrict(true, ...) }` 意味着无论功能是否存在，测试都 PASS
2. **降级通过模式**: 为追求测试通过率，将"功能不存在"也视为通过，违背测试本质目的
3. **Mock 自洽**: 所有天下Tab测试使用 mock 数据，mock 引擎返回值与 mock 组件自洽，未触发真实链路

### 决策/修复
- `SceneRouter.tsx` 传递 `onSiegeTerritory` 回调（P0，0.5h）
- ACC-09-18 删除"降级通过"分支，攻城按钮不存在必须 FAIL（P0，0.5h）
- 新增攻城全流程集成测试：选中→攻城→确认→执行→状态变更（P1，2h）

### 经验教训
1. **禁止降级通过**: ACC 测试中不允许 `else { assertStrict(true) }`，功能不存在必须 FAIL
2. **测试的价值在于发现缺陷**: 测试通过率高不代表质量高，"永远通过"的测试比没有测试更危险
3. **Mock 数据需要真实验证**: 使用 mock 的测试必须补充真实引擎实例的集成测试，mock 自洽不等于功能正确

### 影响文件
- `src/components/idle/three-kingdoms/SceneRouter.tsx` — 未传递攻城回调
- `src/games/three-kingdoms/tests/acc/ACC-09-地图关卡.test.tsx` — 降级通过漏洞
- `src/games/three-kingdoms/engine/map/SiegeSystem.ts` — 引擎实现正确
- `docs/games/three-kingdoms/MAP-world-prd.md` — PRD 定义完整

---

## LL-004: 验收文档风险标记必须有验证闭环

**日期**: 2026-04-28
**模块**: 武将系统 (HeroStarSystem) / 验收流程
**对应问题**: P1 — 武将升星后四维属性不变

### 问题描述
ACC-04-R1 验收文档已明确标记了"statsAtLevel 不含星级倍率"的潜在风险，但在 R2 验收时将其降级为"P1(监控)"后，**实际未运行任何验证就通过了验收**。风险被识别但未被验证，等同于未识别。

### 根因分析
1. **降级即遗忘**: 将风险降级为"监控"后，没有后续验证动作，降级变成了忽略
2. **缺少验证截止日期**: 风险标记没有关联的验证用例和截止日期，无法追踪
3. **验收流程漏洞**: "代码层面无新风险"不能作为关闭风险的依据，必须实际运行验证

### 决策/修复
- 验收文档中标记的"潜在风险"必须有对应的 ACC 验证用例编号
- 每个风险标记必须设定验证截止日期
- 风险关闭条件必须包含实际验证结果，不能仅凭代码审查结论

### 经验教训
1. **识别≠闭环**: 发现风险只是第一步，必须完成验证才能关闭
2. **降级需要条件**: 风险降级必须附带明确的验证计划和截止日期，不能无条件降级
3. **验收标准需要可量化**: PRD 中"属性大幅提升"这类定性描述必须转化为可量化的 ACC 验收标准

### 影响文件
- `docs/games/three-kingdoms/acc/ACC-04-R1.md` — 风险标记位置
- `docs/games/three-kingdoms/acceptance/ACC-*.md` — 验收流程

---

## LL-005: E2E冒烟测试必须覆盖核心业务流程

**日期**: 2026-04-28
**模块**: E2E冒烟测试 / 全局
**对应问题**: P1+P2 — 武将升星属性不变 + 天下Tab攻城断裂

### 问题描述
当前 E2E 冒烟测试（19 用例）只验证 Tab 能切换、面板能打开、Console 无 ReferenceError，**零个用例验证核心业务流程**（如升级建筑→资源扣减、招募武将→保底计数、攻城→占领）。导致 P1 和 P2 两个 P0 级别的 BUG 在 E2E 层完全无法被发现。

### 根因分析
1. **E2E范围定义过窄**: E2E 测试被定位为"冒烟测试"，只验证渲染不崩溃，不验证业务正确性
2. **缺少业务流程维度**: 没有按核心业务流程设计 E2E 用例，只有按页面/组件维度的验证
3. **与 ACC 测试重复**: E2E 的验证内容与 ACC 测试高度重叠（都验证渲染），没有形成互补

### 决策/修复
- E2E 增加核心业务流程冒烟用例（P1，2h）
- 至少覆盖：升级建筑、招募武将、攻城占领、商店购买
- E2E 用例设计原则：每个核心业务流程至少 1 个端到端验证

### 经验教训
1. **E2E≠渲染测试**: E2E 冒烟测试不能只验证"不崩溃"，必须验证核心业务流程的端到端正确性
2. **测试层级互补**: E2E 应覆盖 ACC 无法覆盖的跨页面、跨组件完整业务流程
3. **按业务流程设计**: E2E 用例应按"用户操作路径"设计，而非按"页面/组件"设计

### 影响文件
- `src/games/three-kingdoms/tests/e2e/` — E2E 测试目录
- 所有核心业务模块的 E2E 覆盖

---

## LL-006: 引擎层和UI层各自有测试≠集成正确

**日期**: 2026-04-28
**模块**: 全局架构 / 测试策略
**对应问题**: P1+P2 — 武将升星属性不变 + 天下Tab攻城断裂

### 问题描述
引擎层 `SiegeSystem` 和 `HeroStarSystem` 各自有充分的单元测试，UI 组件层也有 ACC 测试，但**从未有测试验证 UI交互→引擎执行→状态变更→UI更新 的完整链路**。两个 P0 级别的集成问题（属性计算路径断裂、攻城回调未传递）在各自层级都"测试通过"。

### 根因分析
1. **测试层级分离**: 引擎测试和 UI 测试完全隔离运行，没有跨层集成测试
2. **Mock 遮蔽**: UI 测试使用 mock 引擎，引擎测试不涉及 UI，两侧都通过但集成断裂
3. **缺少端到端验证**: 没有测试验证"用户操作→引擎执行→UI 反映结果"的完整数据流

### 决策/修复
- 引入跨层集成测试：UI→引擎→UI 完整链路验证
- 统一属性计算入口：消除 `statsAtLevel` vs `calculateStarStats` 的分歧
- 集成测试必须使用真实引擎实例，禁止 mock

### 经验教训
1. **各层通过≠集成正确**: 每层测试都通过不代表跨层集成正确，必须有跨层集成测试
2. **Mock 是双刃剑**: Mock 适合单元隔离测试，但必须补充真实实例的集成测试
3. **验证完整数据流**: 测试策略必须包含"UI交互→引擎执行→状态变更→UI更新"的完整链路验证
4. **统一计算入口**: 同一业务逻辑（如属性计算）不能有多套实现路径，必须统一入口避免分歧

### 影响文件
- `src/components/idle/panels/hero/HeroDetailModal.tsx` — UI 层属性计算
- `src/games/three-kingdoms/engine/ThreeKingdomsEngine.ts` — 引擎层属性计算
- `src/components/idle/three-kingdoms/SceneRouter.tsx` — 集成层
- `src/games/three-kingdoms/engine/map/SiegeSystem.ts` — 引擎层攻城
- `src/games/three-kingdoms/engine/hero/star-up-config.ts` — 星级倍率配置

### 适用范围
此经验教训适用于所有采用"引擎层+UI层"架构的游戏项目，强调跨层集成测试的必要性。
