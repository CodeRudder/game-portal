# 进化迭代进度 — Round 2

> **开始日期**: 2026-04-22
> **状态**: 进行中
> **范围**: v1.0 ~ v20.0 全版本进化迭代（Round 2）
> **前置**: Round 1 已完成 v1.0~v10.0

---

## Round 2 关键变更

### 反模式修复（Phase 2）
- 删除6个 exports-vN.ts 文件（按版本导出→按DDD业务域导出）
- engine/index.ts: 616行 → 138行
- 新增4个域index.ts（resource/building/calendar/hero）
- 重命名 engine-r11-deps.ts → engine-extended-deps.ts
- 修复命名冲突（AllianceData/FormationType/SAVE_VERSION等）

### 测试基础设施（Phase 1）
- 新增 GameEventSimulator（411行）：模拟触发游戏事件
- 支持：addResources/upgradeBuilding/recruitHero/winBattle/fastForward等
- 支持：initBeginnerState/initMidGameState/initEndGameState 快速状态初始化

### 进化方法修订
- EVO-031: 按DDD业务域导出，禁止按版本号导出（exports-vN反模式）
- EVO-032: engine/index.ts 使用 `export * from './domain'` 精简模式
- EVO-033: GameEventSimulator 用于快速验证游戏流程，不需要等待自然发生

---

## 版本进度总览

| 版本 | 状态 | 技术审查 | Play文档 | UI测试 | 经验教训 | 进化修订 |
|:----:|------|:--------:|:--------:|:------:|:--------:|:--------:|
| v1.0 基业初立 | ✅完成 | ✅0P0/3P1 | ✅ | ⏭跳过 | ✅ | ✅ |
| v2.0 招贤纳士 | ✅完成 | ✅0P0/1P1 | ✅17流程 | ✅12/12通过 | ✅ | ✅EVO-R10 |
| v3.0 攻城略地-上 | ✅完成 | ✅0P0/3P2 | ✅27流程 | ✅10/10通过 | ✅ | - |
| v4.0 攻城略地-下 | 待开始 | - | - | - | - | - |
| v5.0 百家争鸣 | 待开始 | - | - | - | - | - |
| v6.0 天下大势 | 待开始 | - | - | - | - | - |
| v7.0 草木皆兵 | 待开始 | - | - | - | - | - |
| v8.0 商贸繁荣 | 待开始 | - | - | - | - | - |
| v9.0 离线收益 | 待开始 | - | - | - | - | - |
| v10.0 兵强马壮 | 待开始 | - | - | - | - | - |
| v11.0~v20.0 | 待开始 | - | - | - | - | - |
