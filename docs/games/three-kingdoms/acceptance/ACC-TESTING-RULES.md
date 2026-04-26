# ACC 验收集成测试 — 强制规则

> **生效日期**: 2026-04-26
> **适用范围**: 所有ACC模块（ACC-01~ACC-13）

## 三项强制规则

### 规则1：测试绑定ACC编号
- 每个测试用例的 `describe` 或 `it` 必须包含验收标准编号 `ACC-XX-XX`
- 测试失败时必须输出格式：`FAIL: ACC-XX-XX <验收项名称> - <具体原因>`
- 测试通过时输出格式：`PASS: ACC-XX-XX <验收项名称>`

### 规则2：从严计算
- 不确定的用例一律视为 FAIL
- 存在任何问题的用例一律视为 FAIL
- 不允许模糊通过、不允许 TODO 状态跳过
- FAIL 项必须修复后重新验收

### 规则3：UI测试强制覆盖
- 涉及视觉、交互、布局的ACC条目必须有对应的UI测试覆盖
- UI测试使用 `@testing-library/react` + `vitest`
- 测试必须验证：元素存在性、文本内容、交互响应、样式类名
- 不可跳过UI层验证，不可仅验证引擎层

## 测试文件命名规范
```
src/components/idle/panels/<module>/__tests__/acc-<XX>-<模块名>.test.tsx
```

## 测试文件模板
```typescript
/**
 * ACC-XX 模块名 — 用户验收集成测试
 * 
 * 强制规则：
 * - 每个测试用例绑定 ACC-XX-XX 编号
 * - FAIL 输出格式：FAIL: ACC-XX-XX <验收项> - <原因>
 * - 视觉/交互/布局条目必须有UI测试覆盖
 */

import { describe, it, expect } from 'vitest';

describe('ACC-XX 模块名 — 用户验收集成测试', () => {
  describe('基础可见性', () => {
    it('ACC-XX-01: <验收项名称>', async () => {
      // 渲染组件
      // 断言元素存在/文本内容/样式
      // 失败时: throw new Error('FAIL: ACC-XX-01 <验收项> - <具体原因>')
    });
  });

  describe('核心交互', () => {
    it('ACC-XX-10: <验收项名称>', async () => {
      // 渲染组件
      // 模拟用户操作
      // 断言交互结果
    });
  });

  describe('数据正确性', () => {
    it('ACC-XX-20: <验收项名称>', () => {
      // 验证数据同步、计算正确性
    });
  });

  describe('边界情况', () => {
    it('ACC-XX-30: <验收项名称>', () => {
      // 验证边界条件处理
    });
  });

  describe('手机端适配', () => {
    it('ACC-XX-40: <验收项名称>', () => {
      // 验证响应式样式类、布局变化
    });
  });
});
```
