# R12 对抗性评测 P2 修复验证报告

## 概要

| 修复项 | 状态 | 测试结果 |
|--------|------|----------|
| P2 Fix 1: getDefenseBarColor NaN 防御 | PASS | 42/42 |
| P2 Fix 2: SiegeTaskPanel tasks 默认值 | PASS | 57/57 |
| P2 Fix 3: preparing/settling 状态图标测试 | PASS | 57/57 |

**最终验证**: 99 tests passed, 0 failed

---

## P2 Fix 1: getDefenseBarColor NaN 防御

### 问题描述
`getDefenseBarColor` 函数在接收 `NaN` 作为参数时，`Math.max(0, Math.min(1, NaN))` 返回 `NaN`，导致生成 `rgb(NaN,NaN,NaN)` 无效颜色字符串。

### 修复方案
在函数开头添加 NaN 检查，当 ratio 为 NaN 时返回默认绿色 `rgb(76,175,80)`。

### 修改文件
- `src/components/idle/panels/map/PixelWorldMap.tsx` — 第 325 行，`getDefenseBarColor` 函数开头添加 NaN 守卫
- `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx` — 新增 `ratio为NaN时返回默认绿色` 测试用例

### 代码变更
```typescript
export function getDefenseBarColor(ratio: number): string {
  if (isNaN(ratio)) return 'rgb(76,175,80)'; // NaN → 默认绿色
  const r = Math.max(0, Math.min(1, ratio));
  // ... 后续逻辑不变
}
```

### 新增测试
```typescript
it('ratio为NaN时返回默认绿色', () => {
  const color = getDefenseBarColor(NaN);
  expect(color).toBe('rgb(76,175,80)');
});
```

### 测试结果
```
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx (42 tests) 48ms
```

---

## P2 Fix 2: SiegeTaskPanel tasks 默认值

### 问题描述
`SiegeTaskPanel` 组件的 `tasks` prop 在类型定义中为必选 (`tasks: SiegeTask[]`)，如果外部未传入或传入 `undefined` 会导致 `tasks.filter` 等调用崩溃。

### 修复方案
1. 将 props 类型中 `tasks` 改为可选 (`tasks?: SiegeTask[]`)
2. 在组件解构时添加默认值 (`tasks = []`)

### 修改文件
- `src/components/idle/panels/map/SiegeTaskPanel.tsx` — props 类型和解构默认值

### 代码变更
```typescript
// 类型定义: tasks?: SiegeTask[]
export interface SiegeTaskPanelProps {
  tasks?: SiegeTask[];
  // ...
}

// 组件解构: tasks = []
const SiegeTaskPanel: React.FC<SiegeTaskPanelProps> = ({
  tasks = [],
  // ...
}) => {
```

### 测试结果
```
PASS src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx (57 tests) 116ms
```

---

## P2 Fix 3: preparing/settling 状态图标测试

### 问题描述
缺少 `preparing` 和 `settling` 状态图标渲染的单元测试覆盖。

### 修复方案
在现有状态图标测试组后新增 2 个测试用例，覆盖 `preparing` (⏳) 和 `settling` (📋) 状态的图标渲染。

### 修改文件
- `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` — 新增 2 个测试用例

### 新增测试
```typescript
it('R12: preparing状态显示正确图标 ⏳', () => {
  const task = createMockTask({ id: 'task-icon-prep', status: 'preparing' });
  render(<SiegeTaskPanel tasks={[task]} />);
  const icon = screen.getByTestId('status-icon-task-icon-prep');
  expect(icon.textContent).toContain('⏳');
});

it('R12: settling状态显示正确图标 📋', () => {
  const task = createMockTask({ id: 'task-icon-sett', status: 'settling' });
  render(<SiegeTaskPanel tasks={[task]} />);
  const icon = screen.getByTestId('status-icon-task-icon-sett');
  expect(icon.textContent).toContain('📋');
});
```

### 测试结果
```
PASS src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx (57 tests) 109ms
```

---

## 最终验证

```
RUN v1.6.1

PASS src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx (42 tests) 48ms
PASS src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx (57 tests) 116ms

Test Files  2 passed (2)
     Tests  99 passed (99)
  Duration  609ms
```

所有 99 个测试全部通过，3 个 P2 问题已修复并验证。
