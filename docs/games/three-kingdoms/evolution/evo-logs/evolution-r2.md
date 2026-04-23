# 进化日志 R2 — v2.0招贤纳士

## 日期
2026-04-22

## 进化内容

### 1. 新增进化规则
- EVO-006: 新增即导出 — 每次新增引擎文件必须同步更新门面导出
- EVO-007: 选择器先探后测 — 测试脚本先做DOM探测确认class名

### 2. 测试工具改进
- game-actions.cjs需添加DOM探测工具函数
- 需要支持更灵活的元素查找策略

### 3. 发现的流程改进
- UI测试脚本的选择器应动态获取，而非硬编码
- CSS文件500行限制需要明确是否包含媒体查询

## EVO-006: 全局唯一性检查（来自v2.0 LL-v2-001）
- 所有"添加到集合"操作必须检查全局唯一性约束
- 不仅检查当前集合，还要检查所有相关集合

## EVO-007: 死引用定期清理（来自v2.0 LL-v2-002）
- 定期扫描未使用的import语句
- 建议在tsconfig中启用noUnusedLocals/noUnusedParameters

## EVO-008: 配置数据SSOT原则（来自v2.0 LL-v2-003）
- 同一业务概念的数据必须单一来源
- 跨文件引用而非复制，避免数据不一致

## EVO-009: DDD分层隔离红线（来自v2.0 LL-v2-004）
- UI层禁止直接调用引擎聚合根的写操作
- 必须通过门面/ViewModel/UseCase间接调用

## EVO-010: 新子系统ISubsystem检查清单（来自v2.0 LL-v2-006）
- 新子系统创建时第一项检查：实现ISubsystem接口
- 包含init/update/getState/reset四个方法

## EVO-011: 死代码扫描机制（来自v3.0 LL-v3-002）
- 每次重构后执行死代码扫描
- 检查是否有文件未被任何业务代码import
- 死代码立即移至bak/目录

## EVO-012: 禁止dangerouslySetInnerHTML（来自v3.0 LL-v3-004）
- 动态内容必须通过React组件渲染
- 禁止使用dangerouslySetInnerHTML渲染任何动态数据

## EVO-013: 工具函数提取三步法（来自v3.0 LL-v3-005）
- 提取=创建新文件+修改引用+删除原位定义
- 三步缺一不可，必须验证所有引用路径

## EVO-014: CSS文件创建同步import（来自v3.0 LL-v3-006）
- 新CSS文件创建时同步在对应组件中添加import
- 避免创建孤立的CSS文件

## EVO-015: useEffect依赖完整性（来自v3.0 LL-v3-007）
- useEffect依赖数组必须真实反映所有依赖
- 闭包变量变化使用useRef追踪，禁止空依赖+eslint-disable
