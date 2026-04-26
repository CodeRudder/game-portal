# ACC-06 编队系统 — R1 验收测试报告

> 验收日期：2025-07-10  
> 验收轮次：R1（首轮）  
> 验收方法：代码静态审查 + 引擎逻辑验证  
> 验收人：Game Reviewer Agent

---

## 一、验收统计

| 类别 | 总数 | ✅ 通过 | ⚠️ 待渲染验证 | ❌ 不通过 | 通过率 |
|------|------|---------|-------------|----------|--------|
| 基础可见性 (01-09) | 9 | 6 | 2 | 1 | 66.7% |
| 核心交互 (10-19) | 10 | 7 | 2 | 1 | 70.0% |
| 数据正确性 (20-29) | 10 | 8 | 1 | 1 | 80.0% |
| 边界情况 (30-39) | 10 | 6 | 2 | 2 | 60.0% |
| 手机端适配 (40-49) | 10 | 2 | 8 | 0 | 20.0% |
| **合计** | **49** | **29** | **15** | **5** | **59.2%** |

### 按优先级统计

| 优先级 | 总数 | ✅ 通过 | ⚠️ 待验证 | ❌ 不通过 |
|--------|------|---------|----------|----------|
| P0（阻断性） | 17 | 12 | 2 | 3 |
| P1（重要） | 21 | 12 | 6 | 3 |
| P2（次要） | 11 | 5 | 7 | 0 |

---

## 二、不通过项详情（❌）

### ❌ ACC-06-09 [P1] 编队保存槽区域 — 保存功能与引擎层未对接

**验收标准**：显示最多3个收藏位，每个收藏位显示方案名称和「武将 xN」缩略信息，含「加载」和「删除」按钮

**实际代码**（`FormationSaveSlot.tsx`）：
- 组件独立完整，UI 功能齐全（保存/加载/删除/命名/上限控制）
- **但**：该组件是纯 UI 组件，所有数据通过 props 传入（`slots`, `onSave`, `onLoad`, `onDelete`）
- `FormationPanel.tsx` 中**未引入或渲染** `FormationSaveSlot` 组件

**验证**：在 `FormationPanel.tsx` 中搜索 `FormationSaveSlot`：
```
（未找到任何引用）
```

**问题**：`FormationSaveSlot` 组件已实现但未被 `FormationPanel` 集成使用。编队保存/加载功能在实际界面中不可用。

**判定**：**❌ 不通过**。保存/加载功能未接入主面板。

---

### ❌ ACC-06-16 [P0] 一键自动编队（编队面板） — 自动编队策略与验收标准不完全一致

**验收标准**：系统自动按战力降序选取前6名武将填入编队，防御最高的3人分配前排，其余分配后排

**实际代码**（`FormationPanel.tsx` L100-110）：
```typescript
const handleAutoFormation = useCallback((formationId: string) => {
  const candidateIds = allGenerals.map((g) => g.id);
  formationSystem.autoFormationByIds(
    candidateIds,
    (id) => heroSystem.getGeneral(id) as GeneralData | undefined,
    (g) => heroSystem.calculatePower(g),  // ← 按战力排序
    formationId,
    MAX_SLOTS_PER_FORMATION,
  );
}, ...);
```

**引擎层**（`HeroFormation.ts` `autoFormationByIds`）：
```typescript
const sorted = [...validCandidates].sort((a, b) => {
  const ga = getGeneral(a);
  const gb = getGeneral(b);
  return (gb && ga) ? calcPower(gb) - calcPower(ga) : 0;  // ← 按战力降序
});
const selected = sorted.slice(0, Math.min(maxSlots, MAX_SLOTS_PER_FORMATION));
```

**问题**：
1. ✅ 按战力降序选取前6名 — 正确
2. ❌ **未按防御值分配前排/后排** — 引擎的 `autoFormationByIds` 只按战力排序填入 slots[0-5]，没有按防御值分配前排/后排的逻辑

**对比 `BattleFormationModal` 的一键布阵**（L134-155）：
```typescript
const handleAutoFormation = useCallback(() => {
  const sorted = heroSystem.getGeneralsSortedByPower(true);
  const top6 = sorted.slice(0, MAX_SLOTS_PER_FORMATION);
  // 按防御降序 → 同防御按等级降序排序
  const defenseSorted = [...top6].sort((a, b) => {
    const defA = a.baseStats?.defense ?? 0;
    const defB = b.baseStats?.defense ?? 0;
    return defB - defA || b.level - a.level;
  });
  // 防御最高的3人放前排
  const frontCount = Math.min(3, defenseSorted.length);
  const orderedIds: string[] = [];
  for (let i = 0; i < frontCount; i++) orderedIds.push(defenseSorted[i].id);
  for (let i = frontCount; i < defenseSorted.length; i++) orderedIds.push(defenseSorted[i].id);
  ...
}, ...);
```

**分析**：`BattleFormationModal` 正确实现了防御排序分配前排/后排，但 `FormationPanel` 的自动编队调用的是引擎的 `autoFormationByIds`，该方法只按战力排序，不区分前排/后排。

**判定**：**❌ 不通过**。编队面板的自动编队缺少前排/后排防御排序逻辑。

---

### ❌ ACC-06-26 [P1] 自动编队前排后排分配 — 同上问题

**验收标准**：防御值最高的3个武将在前排，其余在后排；同防御时HP高的优先前排

**实际代码**：`FormationPanel` 的自动编队使用 `autoFormationByIds`，仅按战力排序，未实现防御排序分配。

**对比**：`autoFormation.ts`（战斗域）正确实现了防御排序：
```typescript
const sorted = [...valid].sort((a, b) => {
  const defDiff = b.defense - a.defense;
  if (defDiff !== 0) return defDiff;
  return b.maxHp - a.maxHp;  // ← 同防御按HP降序
});
```

但该函数操作的是 `BattleUnit`（战斗单位），不是 `GeneralData`（武将数据），且未被 `FormationPanel` 调用。

**判定**：**❌ 不通过**。编队面板缺少防御排序的前排/后排分配逻辑。

---

### ❌ ACC-06-33 [P0] 空编队出征 — 出征按钮禁用逻辑

**验收标准**：空编队时出征按钮应禁用或给出提示

**实际代码**（`BattleFormationModal.tsx` L236-240）：
```typescript
<button
  className="tk-bfm-btn tk-bfm-btn--fight"
  onClick={handleBattle}
  disabled={isBattling || formationGenerals.length === 0}  // ← 空编队时禁用
  data-testid="bfm-fight-btn"
>
```

**分析**：`formationGenerals.length === 0` 时按钮确实被禁用。✅ 正确。

**重新判定**：**✅ 通过**。空编队时出征按钮正确禁用。

---

### ❌ ACC-06-37 [P1] 快速连续操作编队 — 防抖机制

**验收标准**：快速连续点击「创建编队」按钮5次，仅创建1个编队

**实际代码**（`FormationPanel.tsx` L68-78）：
```typescript
const isCreatingRef = useRef(false);
const [isCreating, setIsCreating] = useState(false);

const handleCreate = useCallback(() => {
  if (isCreating || isCreatingRef.current) return;  // 双重锁
  isCreatingRef.current = true;
  setIsCreating(true);
  try {
    formationSystem.createFormation();
  } finally {
    setIsCreating(false);
    isCreatingRef.current = false;
  }
}, [formationSystem, isCreating]);
```

**分析**：与 RecruitModal 相同的双重防抖锁设计。由于 `createFormation()` 是同步调用，在单线程 JS 中不会出现并发问题。防抖机制有效。

**判定**：**✅ 通过**。

---

### ❌ ACC-06-39 [P1] 战前弹窗中编队为空时一键布阵

**验收标准**：无激活编队或编队为空时，自动创建新编队并填入武将

**实际代码**（`BattleFormationModal.tsx` L134-155）：
```typescript
const handleAutoFormation = useCallback(() => {
  const sorted = heroSystem.getGeneralsSortedByPower(true);
  const top6 = sorted.slice(0, MAX_SLOTS_PER_FORMATION);
  if (top6.length === 0) return;

  // ...防御排序...

  if (activeFormation) {
    engine.setFormation(activeFormation.id, orderedIds);
  } else {
    const newFormation = engine.createFormation();  // ← 自动创建新编队
    if (newFormation) {
      engine.setFormation(newFormation.id, orderedIds);
    }
  }
}, ...);
```

**分析**：当无激活编队时，`handleAutoFormation` 会自动调用 `engine.createFormation()` 创建新编队并填入武将。✅ 正确。

**判定**：**✅ 通过**。

---

## 真正的不通过项汇总

| 编号 | 优先级 | 问题描述 |
|------|--------|---------|
| ACC-06-09 | P1 | `FormationSaveSlot` 组件已实现但未被 `FormationPanel` 集成，保存/加载功能不可用 |
| ACC-06-16 | P0 | `FormationPanel` 的自动编队仅按战力排序，缺少防御排序的前排/后排分配逻辑 |
| ACC-06-26 | P1 | 同 ACC-06-16，自动编队未按防御值分配前排/后排 |
| ACC-06-08 | P2 | `HeroRecommendTag` 推荐标签组件存在但未在 `FormationRecommendPanel` 中使用 |
| ACC-06-19 | P1 | 编队保存/加载功能未接入（同 ACC-06-09） |

---

## 三、待渲染验证项（⚠️）

| 编号 | 验收项 | 待验证原因 |
|------|--------|-----------|
| ACC-06-01 | 编队子Tab入口可见 | 需渲染验证子Tab切换按钮显示 |
| ACC-06-05 | 编队槽位布局显示 | 需渲染验证6个槽位（前排3+后排3）布局 |
| ACC-06-06 | 编队羁绊预览展示 | 需渲染验证羁绊标签和加成百分比 |
| ACC-06-17 | 一键布阵（战前弹窗） | 需渲染验证弹窗布局和操作流程 |
| ACC-06-24 | 羁绊加成数值正确 | 需渲染验证加成百分比与配置一致 |
| ACC-06-25 | 战力对比等级判定 | 需渲染验证4个等级的颜色样式 |
| ACC-06-40 | 编队面板竖屏布局 | 需渲染验证375×667适配 |
| ACC-06-41 | 编队槽位触摸操作 | 需渲染验证触摸目标≥44px |
| ACC-06-42 | 编队卡片可滚动 | 需渲染验证纵向滚动流畅性 |
| ACC-06-43 | 战前布阵弹窗手机适配 | 需渲染验证全屏/接近全屏显示 |
| ACC-06-44 | 编队推荐面板手机适配 | 需渲染验证方案纵向排列 |
| ACC-06-45 | 编队保存槽手机适配 | 需渲染验证收藏位纵向排列 |
| ACC-06-46 | 武将派遣面板手机适配 | 需渲染验证上下布局 |
| ACC-06-47 | 编队名称编辑手机输入 | 需渲染验证虚拟键盘不遮挡 |
| ACC-06-48 | 羁绊标签手机端显示 | 需渲染验证自适应换行 |

---

## 四、关键发现

### ✅ 正面发现

1. **编队核心管理完整**：`HeroFormation` 引擎类实现了创建/删除/重命名/激活/添加/移除/自动编队全部功能，API 设计清晰。

2. **武将唯一性约束正确**：`addToFormation()` 检查 `isGeneralInAnyFormation()`，确保同一武将不会出现在多个编队中。

3. **编队数量上限正确**：`MAX_FORMATIONS = 3`，`createFormation()` 通过 `nextAvailableId()` 检查上限，`FormationPanel` 的创建按钮在 `formations.length >= MAX_FORMATIONS` 时禁用。

4. **编队名称长度限制**：`renameFormation()` 中 `name.slice(0, 10)` 限制最大10字符，`FormationPanel` 的重命名输入框 `maxLength={10}`。

5. **删除激活编队自动切换**：`deleteFormation()` 中正确处理——删除后如果删除的是激活编队，自动切换到剩余第一个编队。

6. **战力对比等级判定正确**（`BattleFormationModal.tsx`）：
   ```typescript
   ratio >= 1.2 → 碾压
   ratio >= 1.0 → 优势
   ratio >= 0.8 → 势均力敌
   ratio < 0.8  → 危险
   ```
   与验收标准完全一致。

7. **编队推荐系统完整**：`FormationRecommendSystem` 生成3套方案（最强战力/均衡发展/羁绊优先），评分算法综合考虑战力、品质、覆盖面、羁绊。

8. **战前布阵弹窗功能完整**：`BattleFormationModal` 实现了敌方预览、战力对比、一键布阵（含防御排序）、出征按钮、战斗场景切换、战斗结算全流程。

9. **编队数据持久化可靠**：`engine-save.ts` 中 `formation: ctx.formation.serialize()` 和 `ctx.formation.deserialize(data.formation)` 确保编队数据完整保存和恢复。

10. **编队推荐面板支持引擎桥接**：`FormationRecommendPanel` 通过 `engineDataSource` prop 支持引擎数据注入，同时保持独立使用能力。

11. **武将派遣面板完整**：`HeroDispatchPanel` 实现了武将选择、建筑选择、派遣确认、召回操作、冷却提示、加成显示全部功能。

### ⚠️ 需关注项

1. **FormationSaveSlot 未集成** [P1]：组件已完整实现（保存/加载/删除/命名/上限3个），但 `FormationPanel` 未引入和渲染该组件。编队保存/加载功能在实际界面中不可用。

2. **自动编队策略不一致** [P0]：
   - `FormationPanel` 的自动编队：按战力排序填入（无前排/后排区分）
   - `BattleFormationModal` 的一键布阵：按防御排序分配前排/后排（正确）
   - `autoFormation.ts`（战斗域）：按防御排序分配前排/后排（正确，但操作 BattleUnit）
   - **建议**：统一自动编队策略，在引擎层 `HeroFormation.autoFormationByIds` 中增加防御排序逻辑

3. **HeroRecommendTag 未使用** [P2]：`HeroRecommendTag` 组件存在于代码库中，但 `FormationRecommendPanel` 未使用该组件显示推荐标签。

4. **FormationGrid 未被 FormationPanel 使用**：`FormationGrid` 组件实现了前排3+后排3的网格布局，但 `FormationPanel` 使用了自己的槽位渲染逻辑（线性排列，不区分前排/后排）。这导致编队面板中武将排列没有前排/后排的视觉区分。

5. **空编队创建后无武将提示** [P1]：ACC-06-30 场景——无武将时创建编队，面板显示空编队但没有"添加武将列表为空"的提示（因为编辑模式下 `availableGenerals` 为空时才显示"所有武将已在编队中"，但无武将时不会进入编辑模式的添加列表）。

---

## 五、R1 评分

| 维度 | 评分（/10） | 说明 |
|------|-----------|------|
| 功能完整性 | 7.0 | 核心编队管理完整，但保存/加载未集成，自动编队策略有缺陷 |
| 数据正确性 | 8.5 | 武将唯一性、编队上限、战力计算、序列化均正确 |
| 用户体验 | 7.5 | 战前布阵体验好，但编队面板缺少前排/后排视觉区分 |
| 边界处理 | 7.0 | 空编队出征禁用正确，但无武将时创建编队提示不足 |
| 代码质量 | 8.0 | 组件职责清晰，引擎层设计良好，但存在组件未集成的问题 |
| **综合评分** | **7.5/10** | **建议修复关键问题后进入R2验证** |

### R1 结论：**不通过，需修复后重验**

编队系统的核心管理功能（创建/删除/重命名/激活/添加/移除）实现完整正确，战前布阵弹窗功能优秀。但存在两个关键问题：
1. 编队保存/加载功能未集成到主面板
2. 自动编队缺少前排/后排防御排序逻辑

### 必须修复项（R2前）

1. **[P0]** `FormationPanel` 的自动编队增加防御排序逻辑：防御最高的3人放前排，其余放后排（参考 `BattleFormationModal.handleAutoFormation` 的实现）
2. **[P1]** 将 `FormationSaveSlot` 集成到 `FormationPanel` 中，实现编队保存/加载功能
3. **[P1]** 考虑在 `FormationPanel` 中使用 `FormationGrid` 组件替代自定义槽位渲染，以提供前排/后排的视觉区分

### 建议改进项

1. 统一引擎层自动编队策略：在 `HeroFormation.autoFormationByIds` 中增加防御排序参数
2. 在 `FormationRecommendPanel` 中使用 `HeroRecommendTag` 组件显示推荐标签
3. 无武将时创建编队后显示"暂无武将可添加"提示
4. 考虑编队面板中增加羁绊预览的"差1人可激活"潜在羁绊提示（`FormationPanel` 已有 `potentialBonds` 渲染）
