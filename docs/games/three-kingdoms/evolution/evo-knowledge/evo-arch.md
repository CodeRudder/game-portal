# 架构实践知识 (EVO-ARCH)

> **来源**: R1~R20 评测迭代中发现的架构级经验。
> **不归档**: 持续有效，新增时追加。

---

### EVO-ARCH-001: 新增即导出
- 每次新增引擎文件必须同步更新门面导出(engine/index.ts)
- 按业务域命名(如 `exports-pvp.ts`)，禁止按版本号(如 `exports-v9.ts`)
- 检查: `find src/ -name "exports-v*" -type f`
- **来源**: R2 | 原EVO-006,049 合并

### EVO-ARCH-002: 门面违规检测
- 技术审查必须包含门面违规检测
- 完整模式: `grep -rn "from.*engine/(resource|building|calendar|hero|battle|campaign|tech|npc|event|map|shop|trade|mail|equipment|expedition|pvp|social|alliance|prestige|quest|activity|bond|heritage|guide|settings|responsive|currency|advisor|offline)" src/components/ src/games/three-kingdoms/ui/`
- 发现违规立即修复并补充缺失导出；每次新增engine/子目录时同步更新检测模式
- **来源**: R3,R18 | 原EVO-008,015,037 合并

### EVO-ARCH-003: Mixin模式用于引擎扩展
- 引擎主类getter方法通过mixin模式外移到engine-getters.ts
- 新增子系统getter时添加到engine-getters.ts而非引擎主类
- **来源**: R3 | 原EVO-010,017 合并

### EVO-ARCH-004: ISubsystem同步实现
- 新增子系统时必须同步实现ISubsystem接口，覆盖率目标100%
- 检查: `grep -rn "implements ISubsystem" src/games/three-kingdoms/engine/`
- **来源**: R4 | 原EVO-025,046 合并

### EVO-ARCH-005: 子系统接入检查清单
- 新增子系统接入引擎时6项必检: create/register/init/reset/getter/export
- 代码审查时逐项检查，建议在PR模板中增加勾选项
- **来源**: R6,R18 | 原EVO-030,036 合并

### EVO-ARCH-006: 复杂域四层拆分模式
- 子系统>5的域按"数据管理/流程控制/效果计算/辅助功能"拆分
- 范例: TechTreeSystem+TechResearchSystem+TechEffectSystem+TechOfflineSystem
- **来源**: R4 | 原EVO-024

### EVO-ARCH-007: 域内子系统命名统一
- 遵循 `{Domain}{Function}System` 模式
- **来源**: R4 | 原EVO-027

### EVO-ARCH-008: core层聚合导出模式
- 按功能域拆分，主文件做聚合re-export
- 范例: encounter-templates.ts按章节拆分4个子文件，主文件仅做聚合导出(139行)
- **来源**: R4 复盘 | 原EVO-048

### EVO-ARCH-009: 子系统重叠迁移策略
- 新旧并存时：标注推荐版本→@deprecated旧版→设定截止版本→不同时加新功能
- 6对重叠系统需逐一治理
- **来源**: R19,R2 | 原EVO-040,052 合并

---

*文档版本: v4.1 | 更新日期: 2026-04-23 | 删除文件行数预警(已在review-rules ARCH-01)，10→9条*
