# R9 Task 5: SiegeTaskPanel 点击聚焦行军路线 — 实施记录

> **日期**: 2026-05-04
> **任务**: R9 Task 5 — I10 攻占任务面板支持"点击查看行军路线"
> **状态**: 已完成

## 变更概要

将 SiegeTaskPanel 的 `onFocusMarchRoute` 回调连接到 WorldMapTab 的视窗平移和 PixelWorldMap 的高亮行军路线渲染。

## 修改文件清单

### 1. `src/components/idle/panels/map/WorldMapTab.tsx`

**变更内容:**

- **新增 state `highlightedTaskId`**: 用于跟踪当前高亮的攻占任务ID，传递给 PixelWorldMap 进行渲染。

  ```typescript
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  ```

- **新增回调 `handleFocusMarchRoute`**: 当用户点击 SiegeTaskPanel 中的"聚焦路线"按钮时触发。
  - 设置 `selectedId` 为目标城池ID（触发右侧信息面板更新）
  - 如果任务状态为 `marching` 或 `returning`，设置 `highlightedTaskId`
  - 通过 CustomEvent `map-center` 触发像素地图视窗居中到目标城池

  ```typescript
  const handleFocusMarchRoute = useCallback((taskId: string) => {
    const task = siegeTaskManagerRef.current?.getTask(taskId);
    if (!task) return;
    setSelectedId(task.targetId);
    if (task.status === 'marching' || task.status === 'returning') {
      setHighlightedTaskId(taskId);
    }
    // 居中到目标城池
    const event = new CustomEvent('map-center', { detail: { territoryId: task.targetId } });
    window.dispatchEvent(event);
  }, []);
  ```

- **新增计算属性 `defenseRatiosMap`**: 从 `siegeBattleAnimRef`（SiegeBattleAnimationSystem）的活跃动画中提取 `taskId -> defenseRatio` 映射。依赖 `activeSiegeAnims` 触发重计算。

  ```typescript
  const defenseRatiosMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!siegeBattleAnimRef.current) return map;
    const anims = siegeBattleAnimRef.current.getActiveAnimations();
    for (const anim of anims) {
      map[anim.taskId] = anim.defenseRatio;
    }
    return map;
  }, [activeSiegeAnims]);
  ```

- **新增计算属性 `returnETAsMap`**: 从 `marchingSystemRef`（MarchingSystem）的活跃行军中提取 `siegeTaskId -> eta` 映射。依赖 `activeMarches` 触发重计算。

  ```typescript
  const returnETAsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const marchingSystem = marchingSystemRef.current;
    if (!marchingSystem) return map;
    const marches = marchingSystem.getActiveMarches();
    for (const march of marches) {
      if (march.siegeTaskId && march.eta) {
        map[march.siegeTaskId] = march.eta;
      }
    }
    return map;
  }, [activeMarches]);
  ```

- **更新 SiegeTaskPanel props**: 传入三个新 prop。

  ```tsx
  <SiegeTaskPanel
    tasks={activeSiegeTasks}
    onSelectTask={(task) => { setSelectedId(task.targetId); }}
    onFocusMarchRoute={handleFocusMarchRoute}
    defenseRatios={defenseRatiosMap}
    returnETAs={returnETAsMap}
  />
  ```

- **更新 PixelWorldMap props**: 传入 `highlightedTaskId`。

  ```tsx
  <PixelWorldMap
    ...
    highlightedTaskId={highlightedTaskId}
  />
  ```

### 2. `src/components/idle/panels/map/PixelWorldMap.tsx`

**变更内容:**

- **扩展 Props 接口**: 新增 `highlightedTaskId?: string | null`。

  ```typescript
  export interface PixelWorldMapProps {
    ...
    /** R9 Task5: 高亮的攻占任务ID(用于渲染高亮行军路线) */
    highlightedTaskId?: string | null;
  }
  ```

- **新增 ref `highlightedTaskIdRef`**: 用于在渲染循环中同步读取高亮任务ID。

  ```typescript
  const highlightedTaskIdRef = useRef<string | null | undefined>(highlightedTaskId);
  ```

- **新增 useEffect 同步 highlightedTaskId**: 当 prop 变更时同步到 ref 并触发重绘。

  ```typescript
  useEffect(() => {
    highlightedTaskIdRef.current = highlightedTaskId;
    markDirtyRef.current();
  }, [highlightedTaskId]);
  ```

- **新增渲染函数 `renderHighlightedMarchOverlay`**: 在动画循环中调用，为匹配高亮任务ID的行军单位绘制加粗高亮路线。
  - 半透明黄色外发光（宽度 ts*1.2）
  - 脉冲闪烁黄色虚线主线（宽度 ts*0.4，alpha 0.7~1.0 呼吸效果）
  - 起点绿色圆点标记
  - 终点红色圆点标记
  - 仅当 `highlightedTaskIdRef.current` 有值且能匹配到活跃行军的 `siegeTaskId` 时绘制

- **动画循环中插入调用**: 在 `renderMarchSpritesOverlay` 和 `renderSiegeAnimationOverlay` 之间。

### 3. `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx`

**无修改** — 已有 41 个测试覆盖了全部 R9 场景（Task 4 中已编写），包括：
- `onFocusMarchRoute` 回调触发
- `defenseRatios` 驱动攻城进度条
- `returnETAs` 驱动回城 ETA
- 已完成任务展开/收起
- 多任务同时渲染
- 点击任务项触发 `onSelectTask`

## 测试结果

```
SiegeTaskPanel.test.tsx     41 tests passed
PixelWorldMap.test.tsx      31 tests passed
PixelWorldMapMarchSprites.test.tsx  16 tests passed
PixelWorldMap.defense-bar.test.tsx  20 tests passed
PixelWorldMap.siege-render.test.tsx 32 tests passed
```

全部 140 个测试通过，无回归。

## 数据流图

```
用户点击"聚焦路线"按钮
  │
  ▼
SiegeTaskPanel.onFocusMarchRoute(taskId)
  │
  ▼
WorldMapTab.handleFocusMarchRoute(taskId)
  ├── setSelectedId(task.targetId)           → 信息面板更新
  ├── setHighlightedTaskId(taskId)           → PixelWorldMap 高亮
  └── CustomEvent('map-center')              → 视窗居中
        │
        ▼
PixelWorldMap.handleMapCenter               → renderer.setViewport()
  │
  ▼
PixelWorldMap.renderHighlightedMarchOverlay  → 黄色加粗路线渲染
```

## 向后兼容性

- `highlightedTaskId` prop 是可选的（`string | null | undefined`），不传时不影响现有行为
- `defenseRatios` 和 `returnETAs` 在 SiegeTaskPanel 中已是可选 props
- `onFocusMarchRoute` 不传时 SiegeTaskPanel 不渲染"聚焦路线"按钮
- 所有修改仅在现有接口上扩展，不破坏已有功能
