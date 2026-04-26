# 三国霸业 — 用户验收标准 (User Acceptance Criteria)

## 目录结构

每个功能模块一个独立文档，使用唯一编号前缀：

| 编号 | 模块 | 文档 |
|------|------|------|
| ACC-01 | 主界面 | [ACC-01-main-menu.md](./ACC-01-main-menu.md) |
| ACC-02 | 建筑系统 | [ACC-02-buildings.md](./ACC-02-buildings.md) |
| ACC-03 | 资源系统 | [ACC-03-resources.md](./ACC-03-resources.md) |
| ACC-04 | 武将系统 | [ACC-04-heroes.md](./ACC-04-heroes.md) |
| ACC-05 | 招贤馆 | [ACC-05-recruit.md](./ACC-05-recruit.md) |
| ACC-06 | 编队系统 | [ACC-06-formation.md](./ACC-06-formation.md) |
| ACC-07 | 战斗系统 | [ACC-07-battle.md](./ACC-07-battle.md) |
| ACC-08 | 科技系统 | [ACC-08-tech.md](./ACC-08-tech.md) |
| ACC-09 | 地图关卡 | [ACC-09-campaign.md](./ACC-09-campaign.md) |
| ACC-10 | 商店系统 | [ACC-10-shop.md](./ACC-10-shop.md) |
| ACC-11 | 引导系统 | [ACC-11-tutorial.md](./ACC-11-tutorial.md) |
| ACC-12 | 羁绊系统 | [ACC-12-bonds.md](./ACC-12-bonds.md) |
| ACC-13 | 觉醒系统 | [ACC-13-awakening.md](./ACC-13-awakening.md) |

## 编写原则

1. **纯用户视角**：只描述玩家能看到、能操作的内容，不涉及技术实现
2. **最简练**：每个验收点用一句话描述，附预期结果
3. **可验证**：每个点都能明确判断通过/不通过
4. **编号唯一**：ACC-XX-YY 格式（模块.序号）

## 验收流程

1. 生成验收标准文档
2. 遍历检查每个功能点
3. 发现问题 → 修复 → 重新验收
4. 每个模块迭代≥5轮直到评分>9.9
