# Round 1 评测报告

> **日期**: 2026-05-03
> **评测范围**: 天下地图全功能E2E评测

---

## 评测结果

- 检查点通过率: 18/27 (66.7%)
- 发现问题数: P0=3, P1=4, P2=3, P3=2

---

## 问题清单

### P0 - 功能缺失(核心流程不可用)

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **资源点不在地图上显示** | PixelMapRenderer.renderCities() | res-*和res-spawn-*资源点完全不可见 |
| 2 | **资源点不可点击** | PixelWorldMap.findCityAt() | 资源点不在渲染列表中，无法选中 |
| 3 | **CityRenderData缺少icon字段** | PixelMapRenderer.ts:38 | 资源点无法显示对应图标(🌾💰⚔️🌟) |

### P1 - 流程断裂

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 4 | **SiegeResultModal测试全部失败** | SiegeResultModal.test.tsx | 13个测试失败，测试数据缺少launched属性 |
| 5 | **攻城后地图颜色更新未验证** | PixelWorldMap | 攻城成功后territories变化→Canvas重绘链路未端到端验证 |
| 6 | **行军精灵渲染未集成到WorldMapTab** | WorldMapTab.tsx | activeMarches prop未从WorldMapTab传入PixelWorldMap |
| 7 | **离线奖励未触发** | WorldMapTab.tsx | offlineSystem?.processOfflineTime返回值格式可能不匹配 |

### P2 - 体验问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 8 | **地图缩放不够平滑** | PixelWorldMap wheel handler | 缩放步长0.1可能过大 |
| 9 | **小地图视口矩形精度** | PixelWorldMap minimap | 视口矩形在极端缩放时可能不准 |
| 10 | **产出面板格式化** | ProductionPanel.tsx | formatRate对小数处理可能不精确 |

### P3 - 细节打磨

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 11 | **城市名称在小缩放下不可读** | PixelMapRenderer | zoom<1.0时文字过小 |
| 12 | **攻城动画与地图渲染同步** | ConquestAnimation | 动画帧率与地图帧率可能不同步 |

---

## 核心发现

### 1. 资源点完全不可见(最严重)

**原因分析**:
- `PixelMapRenderer.renderCities()` 只渲染 `this.map.cities` 中的建筑(从ASCII地图解析的┌┐结构)
- 资源点(g/m/k/t/d字符)在ASCII地图中是单字符，不是建筑框架结构
- `CityRenderData` 没有 `icon` 字段，无法显示资源图标
- `PixelWorldMap` 的 `setCityData()` 只传入了从地图解析的城市，未包含LANDMARK_POSITIONS中的资源点

**修复方案**:
1. `CityRenderData` 添加 `icon` 和 `type` 字段
2. `PixelWorldMap.setCityData()` 合并LANDMARK_POSITIONS中的所有地标(包括资源点)
3. `PixelMapRenderer.renderCities()` 对资源点使用图标渲染(而非建筑框架)

### 2. SiegeResultModal测试数据问题

**原因分析**:
- 测试数据缺少 `launched: true` 属性
- SiegeResultModal组件检查 `result.launched` 来决定显示胜利/失败

**修复方案**: 更新测试数据，添加 `launched: true`

### 3. 行军流程未端到端集成

**原因分析**:
- MarchingSystem.calculateMarchRoute() 已实现
- PixelWorldMap 已有 marchRoute 和 activeMarches props
- 但 WorldMapTab 未将这些 props 传入 PixelWorldMap

**修复方案**: WorldMapTab 中集成行军流程

---

## 测试结果

- 单元测试: 250 passed, 13 failed (SiegeResultModal预存问题)
- 集成测试: 全部通过
- 性能测试: 全部通过

---

## 改进优先级

1. **P0-1/2/3**: 资源点渲染和交互 (最影响玩家体验)
2. **P1-4**: 修复SiegeResultModal测试
3. **P1-6**: 行军流程集成
4. **P1-7**: 离线奖励触发验证

---

*Round 1 评测报告 | 2026-05-03*
