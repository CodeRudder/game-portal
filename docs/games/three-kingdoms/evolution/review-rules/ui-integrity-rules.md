# UI 完整性检查规则

> **来源**: EVO-011, EVO-014 等，从进化规则和评测经验中提炼。
> **进化**: 每轮评测发现新 UI 问题时，新增规则。

---

## P0 规则

### UI-01: data-testid 强制覆盖
- 所有 UI 组件根元素必须有 data-testid
- 命名规范: kebab-case（如 `data-testid="resource-bar"`）
- 动态列表项使用模板（如 `data-testid="resource-item-${id}"`）
- 检查: `grep -rn "data-testid" src/components/ | wc -l`
- **来源**: EVO-011, EVO-014

### UI-02: 弹窗独立组件
- 所有弹窗必须独立为单独文件，使用 SharedPanel 统一容器
- ESC 关闭 + 遮罩关闭 + X 关闭 三种方式必须全部支持
- **来源**: EVO-002

### UI-03: 内联弹窗禁止
- 弹窗不得内联在父组件中，违反单一职责
- **来源**: EVO-002

---

## P1 规则

### UI-04: 选择器先探后测
- UI 测试脚本先做 DOM 探测确认 class 名，再编写断言
- 优先使用 data-testid 定位元素
- **来源**: EVO-007

### UI-05: 截图辅助测试
- UI 测试应结合截图分析，不能仅依赖 DOM 文字搜索
- 资源图标应有 aria-label 或 data-testid 辅助测试
- **来源**: EVO-013

### UI-06: UI 测试不可跳过
- 每个功能必须启动 dev-server 真实验证
- 禁止仅凭代码推理判定 UI 正确性
- **来源**: 进化核心原则

### UI-07: 修复必须回归
- 修复 UI 问题后必须重新测试验证
- 回归不通过则继续修复直到通过
- **来源**: 进化核心原则

---

## 检查命令

```bash
# data-testid 覆盖
grep -rn "data-testid" src/components/idle/ | wc -l

# 弹窗独立检查
grep -rl "SharedPanel\|Modal\|Dialog" src/components/idle/panels/

# 内联弹窗检查
grep -rn "className.*modal\|className.*popup" src/components/idle/panels/*.tsx
```

---

## 进化记录

| 日期 | 变更 | 来源 |
|------|------|------|
| 2026-04-23 | 从进化规则和评测经验抽取 | 文档重构 |
