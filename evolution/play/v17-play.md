# v17.0 竖屏适配 — Play 文档 (Round 2)

> 版本: v17.0 竖屏适配 | 引擎域: engine/responsive/(6子系统)
> 日期: 2025-07-21 | 轮次: Round 2

## P1: PC桌面端 → 画布等比缩放 → 留白装饰 → 快捷键操作

```
1. ResponsiveLayoutManager.updateViewport(1920, 1080, 1.0)
   → detectBreakpoint(1920) = DesktopL(≥1920)
   → isDesktop=true, isMobile=false
2. calculateCanvasScale(1920, 1080, DesktopL)
   → rawScale = min(1920/1280, 1080/800) = min(1.5, 1.35) = 1.35
   → scale = min(1.35, 2.0) = 1.35
   → canvas = 1280×1.35=1728 × 800×1.35=1080
   → offsetX = (1920-1728)/2 = 96, offsetY = 0
   → whitespace = CenterDecorated
3. TouchInputSystem.handleKeyDown('t') → action='open-map'
4. handleKeyDown('h') → action='open-heroes'
```
**验证**: 4K(3840×2160) → scale=min(3.0,2.0)=**2.0上限生效**

## P2: 平板端 → 断点检测 → 等比缩放 → 触控+鼠标双模式

```
1. updateViewport(1024, 768) → TabletL(≥1024)
   → scale = min(1024/1280, 768/800) = min(0.8, 0.96) = 0.8
   → canvas = 1024×640, offsetX=0, offsetY=64
2. TouchInputSystem: 桌面端交互 + 手势识别双通道
   → Click事件 + Tap手势均可响应
3. 底部Tab栏不显示(isMobile=false)
   → 使用侧边导航
```
**验证**: 768×1024竖屏iPad → Tablet(≥768) → scale=**0.6**

## P3: 手机竖屏 → 流式布局 → 底部Tab → 全屏面板 → 左滑返回

```
1. updateViewport(375, 667) → Mobile(≥375)
   → isMobile=true → scale=1, canvas=375×667
2. MobileLayoutManager.calculateMobileLayout(375, 667)
   → resourceBar=48px + quickIconBar=36px + tabBar=76px
   → sceneArea = 667-48-36-76 = 507px
3. switchTab('heroes') → activeTabId='heroes'
4. openFullScreenPanel('hero-detail', '关羽') → panel.isOpen=true
   → pushBreadcrumb('hero-detail', '关羽')
5. handleSwipeBack() → closeFullScreenPanel() → 返回列表
```
**验证**: 375×667 → 场景区 = **507px**, 安全面区76px(56+20)

## P4: 横竖屏切换 → 断点变化 → 布局策略自动切换 → 过渡遮罩

```
1. 竖屏(375×667) → Mobile → 流式布局+底部Tab
2. 旋转 → 横屏(667×375) → Tablet(≥768)? No → MobileL(≥428)? No
   → Mobile(≥375) → 仍是手机但横屏
   → orientation='landscape'
3. updateViewport(812, 375) → Tablet(≥768)? Yes
   → 断点变化 Mobile→Tablet → _notifyLayout()
   → 所有layoutListeners收到新快照
4. 响应: 隐藏底部Tab → 显示侧边导航 → 画布缩放切换
```
**验证**: iPhone 14 Pro Max(430×932) → MobileL → 横屏(932×430) → **Tablet**

## P5: 省电模式 → 自动检测低电量 → 降帧30fps → 关闭粒子 → 充电恢复

```
1. PowerSaveSystem.setLevel(Auto)
   → _updateActiveState() → isActive=false(电量未知)
2. updateBatteryStatus(15, false) // 电量15%, 未充电
   → Auto模式: 15 ≤ 20 且 !charging → isActive=true
   → _currentFps = 30, shouldDisableParticles=true
3. getFrameInterval() = 1000/30 = 33.3ms
   → shouldSkipFrame(last, now) 控制帧节流
4. updateBatteryStatus(80, true) // 充电中
   → Auto模式: !charging=false → isActive=false
   → _currentFps = 60, 粒子恢复
```
**验证**: Auto+电量15%未充电 → **30fps+关闭粒子**, 充电 → **60fps恢复**

---

## 交叉验证矩阵

| 流程 | ResponsiveMgr | MobileMgr | PowerSave | MobileSettings | TouchInput | TouchInteract | Types |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| P1   | ✅ | — | — | — | ✅ | ✅ | ✅ |
| P2   | ✅ | — | — | — | ✅ | ✅ | ✅ |
| P3   | ✅ | ✅ | — | — | — | — | ✅ |
| P4   | ✅ | ✅ | — | — | — | — | ✅ |
| P5   | — | — | ✅ | ✅ | — | — | ✅ |
