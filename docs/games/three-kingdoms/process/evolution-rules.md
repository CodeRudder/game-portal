游戏迭代进化

范围：v1-v20所有的游戏版本
粒度：每次评测改进一个版本
编译要求：pnpm run build
任务执行方式： 主会话负责编排任务，使用子任务执行每个步骤

迭代进化流程：
1、读取Next游戏版本计划(plans/vx-xxx.md)的功能清单. 
evolution : process/evolution-rules.md
评测规范: checklist/ui-checklist.md, architecture/ddd-architecture.md.
进化规范: games/three-kingdoms/evolution/

2、按功能清单的每个功能点循环处理：
2.1、读取功能点关联的PRD/UI章节内容. 
追加本轮的处理进度 (three-kingdoms/evolution/progress/evolution-progress-{round}.md) 

2.2、技术审查：检查代码是否已经实现功能点且符合架构设计规范（单一职责+DDD设计+4层：引擎层/逻辑层/UI层/渲染层+每个代码文件不超过500行），生成审查结果文档（games/three-kingdoms/tech-reviews/{prd-code}-review-{round}.md ）。
2.3、修复问题：修复技术审查发现的问题，编译通过并重新启动dev-server
2.4、UI测试：使用常见UI测试工具及自研测试工具(UITreeExtractor)等检查功能点实际实现情况。
2.4.1 将常用功能操作编写为脚本，支持重复使用，如游戏初始化-“打开游戏页面url关闭相关弹窗并显示主界面”。
2.4.2 复用测试的浏览器实例（先考虑非无头模式），保留状态/现场，支持多个任务连续测试（恢复测试或者改进测试）。
2.4.3 将发现的问题记录到文档（games/three-kingdoms/ui-reviews/{prd-code}-review-{round}.md ）。
2.5、修复问题，重新跳转到2.4进行UI测试步骤。根据需要重启dev-server，一般热加载不需要重启。
2.6、修复当前迭代版本的问题后，复盘评测过程，记录经验教训( games/three-kingdoms/lessons/xxx.md, 二级索引  )
2.7、补充修订进化方法( games/three-kingdoms/evolution/xxx.md, 二级索引  )，包括不限于修订评测规则、UI检查清单、引入或者改进测试工具、优化测试流程、重构游戏引擎/基础设施支持更好评测、完善PRD/UI等。需要带启发式思维进行思考，在多轮迭代中持续进化。需要每个迭代进化的日志。
2.8、实现修订的进化方案，根据情况进行安排任务，包括开发、测试进化方案规则/工具是否达到预期。
2.9、当前功能点修复问发现的问题后，更新处理进度(evolution-progress-{round}.md)
2.10 跳转到第2点继续处理下一个功能点。

3、当前版本评测及修复完成后
3.1 进行版本评测复盘，重复2.7-2.8步骤。
3.2 继续跳转到第1点进行下一个版本的处理。

4、所有迭代版本处理完全后
4.1 进行每轮评测复盘，重复2.7-2.8步骤。
4.2 重新跳转到第1点，处理第一个版本，开启新一轮进化。

