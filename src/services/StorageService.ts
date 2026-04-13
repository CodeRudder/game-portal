import {
  GameType,
  GameRecord,
  HighScore,
  Favorite,
  GameComment,
  UserProfile,
  GameMeta,
} from '@/types';

// ========== 游戏元信息 ==========
export const GAME_META: Record<GameType, GameMeta> = {
  [GameType.TETRIS]: {
    type: GameType.TETRIS,
    name: '俄罗斯方块',
    description: '经典俄罗斯方块，消除行数越多分数越高！支持加速下落、硬降等操作。',
    icon: '🧱',
    color: '#6c5ce7',
    gradient: 'from-purple-600 to-blue-500',
    controls: '← → 移动 | ↑ 旋转 | ↓ 加速 | 空格 硬降 | P 暂停',
    difficulty: '中等',
  },
  [GameType.SNAKE]: {
    type: GameType.SNAKE,
    name: '贪吃蛇',
    description: '控制小蛇吃食物，越长越难操控！碰到墙壁或自己就Game Over。',
    icon: '🐍',
    color: '#00b894',
    gradient: 'from-green-500 to-emerald-400',
    controls: '方向键 / WASD 控制方向 | P 暂停',
    difficulty: '简单',
  },
  [GameType.SOKOBAN]: {
    type: GameType.SOKOBAN,
    name: '推箱子',
    description: '经典益智游戏，把所有箱子推到目标位置即可过关。考验逻辑思维！',
    icon: '📦',
    color: '#e17055',
    gradient: 'from-orange-500 to-red-400',
    controls: '方向键 / WASD 移动 | R 重置关卡 | Z 撤销',
    difficulty: '困难',
  },
  [GameType.FLAPPY_BIRD]: {
    type: GameType.FLAPPY_BIRD,
    name: 'Flappy Bird',
    description: '点击屏幕让小鸟跳跃，穿越管道间的缝隙。看似简单，实则极具挑战！',
    icon: '🐦',
    color: '#ffd32a',
    gradient: 'from-yellow-400 to-orange-400',
    controls: '点击屏幕 / 空格 / ↑ 跳跃 | 穿越管道得分',
    difficulty: '困难',
  },
  [GameType.G2048]: {
    type: GameType.G2048,
    name: '2048',
    description: '滑动合并数字方块，挑战达到 2048！简单规则，无限策略。',
    icon: '🎯',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-400',
    controls: '方向键 / WASD 滑动 | 合并相同数字',
    difficulty: '中等',
  },
  [GameType.MEMORY_MATCH]: {
    type: GameType.MEMORY_MATCH,
    name: '记忆翻牌',
    description: '翻开卡牌寻找配对，考验你的记忆力！配对越快分数越高。',
    icon: '🃏',
    color: '#ec4899',
    gradient: 'from-pink-500 to-purple-500',
    controls: '方向键导航 + 空格/回车翻牌 | 鼠标点击',
    difficulty: '简单',
  },
  [GameType.TIC_TAC_TOE]: {
    type: GameType.TIC_TAC_TOE,
    name: '井字棋',
    description: '经典双人对战棋，三子连线即胜！支持 AI 对手模式。',
    icon: '⭕',
    color: '#38bdf8',
    gradient: 'from-sky-500 to-blue-500',
    controls: '方向键移动光标 + 空格/回车落子 | R 重开 | P 暂停',
    difficulty: '简单',
  },
  [GameType.GAME_OF_LIFE]: {
    type: GameType.GAME_OF_LIFE,
    name: '生命游戏',
    description: 'Conway 生命游戏 — 经典细胞自动机！放置初始细胞，观察生命的演化与涌现。',
    icon: '🧬',
    color: '#00ff88',
    gradient: 'from-green-400 to-emerald-500',
    controls: '点击放置细胞 | 空格 开始/暂停 | N 单步 | +/- 调速 | 1-9 预设图案',
    difficulty: '简单',
  },
  [GameType.MINESWEEPER]: {
    type: GameType.MINESWEEPER,
    name: '扫雷',
    description: '经典扫雷游戏，根据数字线索推理出所有地雷的位置。支持三种难度！',
    icon: '💣',
    color: '#94a3b8',
    gradient: 'from-gray-500 to-slate-500',
    controls: '点击揭开 · 右键标旗 · 方向键移动光标 · F 标旗 · 1/2/3 切换难度',
    difficulty: '中等',
  },
  [GameType.GOMOKU]: {
    type: GameType.GOMOKU,
    name: '五子棋',
    description: '15×15 棋盘上先连成五子者胜！支持人机对战和双人对弈。',
    icon: '⚫',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-500',
    controls: '点击/方向键落子 · T 切换模式 · R 重开',
    difficulty: '中等',
  },
  [GameType.DINO_RUNNER]: {
    type: GameType.DINO_RUNNER,
    name: '跑酷恐龙',
    description: 'Chrome 经典离线恐龙跑酷！跳跃躲避仙人掌和翼龙，速度越来越快。',
    icon: '🦖',
    color: '#34d399',
    gradient: 'from-emerald-400 to-teal-400',
    controls: '空格/↑ 跳跃 · ↓ 下蹲 · 点击屏幕跳跃',
    difficulty: '简单',
  },
  [GameType.TRON]: {
    type: GameType.TRON,
    name: '贪吃虫 Tron',
    description: '双人光线对抗！各自控制一条光线，碰到墙壁或轨迹就输。支持 AI 模式。',
    icon: '⚡',
    color: '#a3e635',
    gradient: 'from-lime-400 to-green-400',
    controls: '玩家1 WASD · 玩家2 方向键 · 碰墙或轨迹即输',
    difficulty: '中等',
  },
  [GameType.PIPE_MANIA]: {
    type: GameType.PIPE_MANIA,
    name: '接水管',
    description: '放置管道连接水源到出口，让水流通过尽可能长的管道！',
    icon: '🔧',
    color: '#60a5fa',
    gradient: 'from-blue-400 to-cyan-400',
    controls: '点击网格放置管道 · 空格跳过 · 倒计时结束后开始流水',
    difficulty: '中等',
  },
  [GameType.BREAKOUT]: {
    type: GameType.BREAKOUT,
    name: '打砖块',
    description: '控制挡板反弹球击碎砖块，不同颜色不同分数，挑战你的反应速度！',
    icon: '🧱',
    color: '#f97316',
    gradient: 'from-orange-400 to-red-400',
    controls: '← → 移动挡板 · 空格发射球',
    difficulty: '中等',
  },
  [GameType.PACMAN]: {
    type: GameType.PACMAN,
    name: '吃豆人',
    description: '经典吃豆人，在迷宫中吃掉所有豆子，躲避幽灵追击！',
    icon: '🟡',
    color: '#facc15',
    gradient: 'from-yellow-400 to-amber-400',
    controls: '方向键/WASD 移动 · 吃大力丸反击幽灵',
    difficulty: '中等',
  },
  [GameType.SPACE_INVADERS]: {
    type: GameType.SPACE_INVADERS,
    name: '太空射击',
    description: '驾驶飞船消灭外星人阵列，保护掩体，拯救地球！',
    icon: '🚀',
    color: '#22d3ee',
    gradient: 'from-cyan-400 to-purple-400',
    controls: '← → 移动飞船 · 空格发射子弹',
    difficulty: '中等',
  },
  [GameType.OTHELLO]: {
    type: GameType.OTHELLO,
    name: '黑白棋',
    description: '经典翻转棋，落子翻转对手棋子，占据更多格子获胜！',
    icon: '⚫',
    color: '#22c55e',
    gradient: 'from-green-400 to-emerald-400',
    controls: '点击棋盘落子 · AI 自动对弈',
    difficulty: '中等',
  },
  [GameType.CHECKERS]: {
    type: GameType.CHECKERS,
    name: '跳棋',
    description: '经典西洋跳棋，吃子升王，策略对弈！',
    icon: '🟤',
    color: '#f59e0b',
    gradient: 'from-amber-400 to-orange-400',
    controls: '点击选子 · 点击落子',
    difficulty: '中等',
  },
  [GameType.PINBALL]: {
    type: GameType.PINBALL,
    name: '弹珠台',
    description: '经典弹珠台，控制挡板弹射弹珠，碰撞bumper得分！',
    icon: '🎰',
    color: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
    controls: 'Z/← 左挡板 · →/M 右挡板 · 空格 蓄力发射',
    difficulty: '中等',
  },
  [GameType.MAHJONG_CONNECT]: {
    type: GameType.MAHJONG_CONNECT,
    name: '连连看',
    description: '找到相同图案的牌面，通过不超过2个拐弯的路径连接消除！',
    icon: '🀄',
    color: '#14b8a6',
    gradient: 'from-teal-500 to-cyan-500',
    controls: '点击选牌配对 · H 提示 · S 洗牌',
    difficulty: '中等',
  },
  [GameType.MATCH_3]: {
    type: GameType.MATCH_3,
    name: '消消乐',
    description: '交换相邻宝石，三连消除得分，连锁反应获得更高倍率！',
    icon: '💎',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    controls: '点击交换宝石 · 方向键移动+空格选择',
    difficulty: '简单',
  },
  [GameType.SUDOKU]: {
    type: GameType.SUDOKU,
    name: '数独',
    description: '经典数字推理，每行每列每宫1-9不重复，三种难度挑战！',
    icon: '🔢',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-500',
    controls: '方向键移动 · 1-9 输入 · N 笔记 · H 提示 · Z 撤销',
    difficulty: '中等',
  },
  [GameType.TETRIS_BATTLE]: {
    type: GameType.TETRIS_BATTLE,
    name: '方块对战',
    description: '俄罗斯方块双人对战！消行攻击对手，AI对手等你挑战！',
    icon: '⚔️',
    color: '#ef4444',
    gradient: 'from-red-500 to-orange-500',
    controls: 'WASD/方向键 · 空格 硬降 · Q 旋转',
    difficulty: '困难',
  },
  [GameType.FROGGER]: {
    type: GameType.FROGGER,
    name: '青蛙过河',
    description: '控制小青蛙穿越车流和河流，安全到达对岸！经典街机重现。',
    icon: '🐸',
    color: '#22c55e',
    gradient: 'from-green-500 to-lime-400',
    controls: '↑↓←→ / WASD 移动 · 穿越车流到达对岸',
    difficulty: '中等',
  },
  [GameType.PONG]: {
    type: GameType.PONG,
    name: '乒乓球',
    description: '经典乒乓对战！控制挡板反弹球，先得7分获胜，支持AI对手。',
    icon: '🏓',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
    controls: '↑↓ / WS 控制挡板 · 先得7分获胜',
    difficulty: '简单',
  },
  [GameType.CONNECT_FOUR]: {
    type: GameType.CONNECT_FOUR,
    name: '四子棋',
    description: '双人对战策略棋！选择列落子，先连成四子者获胜，支持AI。',
    icon: '🔴',
    color: '#eab308',
    gradient: 'from-yellow-500 to-red-500',
    controls: '←→ 选择列 · 空格/↓ 落子 · 四子连线获胜',
    difficulty: '简单',
  },
  [GameType.LIGHTS_OUT]: {
    type: GameType.LIGHTS_OUT,
    name: '点灯',
    description: '点击切换灯光，影响相邻格子，目标是全部熄灭！考验逻辑推理。',
    icon: '💡',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    controls: '方向键移动 · 空格切换灯 · 全部熄灭过关',
    difficulty: '中等',
  },
  [GameType.WHACK_A_MOLE]: {
    type: GameType.WHACK_A_MOLE,
    name: '打地鼠',
    description: '地鼠随机冒出，快速敲击得分！考验反应速度和手眼协调。',
    icon: '🔨',
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-400',
    controls: '方向键移动锤子 · 空格敲击 · 打中地鼠得分',
    difficulty: '简单',
  },
  [GameType.KLOTSKI]: {
    type: GameType.KLOTSKI,
    name: '华容道',
    description: '经典三国滑块益智，移动方块为曹操开路，助其从底部逃脱！',
    icon: '🏯',
    color: '#ef4444',
    gradient: 'from-red-500 to-amber-400',
    controls: '方向键/WASD 移动方块 · 目标让曹操从底部逃脱',
    difficulty: '困难',
  },
  [GameType.SOLITAIRE]: {
    type: GameType.SOLITAIRE,
    name: '纸牌接龙',
    description: '经典 Windows 纸牌，将牌按花色从 A 到 K 依次移到基础堆！',
    icon: '🃏',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-400',
    controls: '鼠标点击拖拽移牌 · 双击自动归堆',
    difficulty: '中等',
  },
  [GameType.ASTEROIDS]: {
    type: GameType.ASTEROIDS,
    name: '小行星',
    description: '经典街机射击！驾驶飞船旋转射击，摧毁四面八方的小行星！',
    icon: '☄️',
    color: '#9ca3af',
    gradient: 'from-gray-500 to-slate-400',
    controls: '← → 旋转 · ↑ 加速 · 空格射击',
    difficulty: '中等',
  },
  [GameType.AIR_HOCKEY]: {
    type: GameType.AIR_HOCKEY,
    name: '空气曲棍球',
    description: '双人桌上曲棍球对决！滑动推杆击球，先得7分获胜，支持AI对手。',
    icon: '🏒',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-400',
    controls: '鼠标/触摸控制推杆 · 先得7分获胜',
    difficulty: '中等',
  },
  [GameType.FRUIT_NINJA]: {
    type: GameType.FRUIT_NINJA,
    name: '水果忍者',
    description: '滑动切割飞出的水果，躲避炸弹，挑战最高连击！',
    icon: '🍉',
    color: '#eab308',
    gradient: 'from-yellow-500 to-green-400',
    controls: '鼠标/触摸滑动切水果 · 躲避炸弹',
    difficulty: '简单',
  },
  [GameType.GALAGA]: {
    type: GameType.GALAGA,
    name: '小蜜蜂',
    description: '经典街机射击！驾驶战机消灭外星虫群，躲避俯冲攻击！',
    icon: '🐝',
    color: '#facc15',
    gradient: 'from-yellow-500 to-orange-400',
    controls: '← → 移动 · 空格射击',
    difficulty: '中等',
  },
  [GameType.BUBBLE_SHOOTER]: {
    type: GameType.BUBBLE_SHOOTER,
    name: '泡泡龙',
    description: '瞄准发射泡泡，三个同色即可消除！清空全部泡泡过关。',
    icon: '🫧',
    color: '#ec4899',
    gradient: 'from-pink-500 to-purple-500',
    controls: '鼠标瞄准点击发射 · 方向键调整角度 · 空格发射',
    difficulty: '简单',
  },
  [GameType.SNAKE_2P]: {
    type: GameType.SNAKE_2P,
    name: '双人贪吃蛇',
    description: '双蛇同屏竞技！WASD vs 方向键，比拼谁活到最后！',
    icon: '🐍',
    color: '#a3e635',
    gradient: 'from-lime-500 to-green-400',
    controls: '玩家1 WASD · 玩家2 方向键 · 碰墙或对方即输',
    difficulty: '中等',
  },
  [GameType.MANCALA]: {
    type: GameType.MANCALA,
    name: '曼卡拉',
    description: '古老非洲播棋策略游戏，收集最多种子获胜！支持AI对手。',
    icon: '🫘',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-400',
    controls: '点击选择坑位 · 按逆时针播种 · AI自动对弈',
    difficulty: '中等',
  },
  [GameType.EIGHT_QUEENS]: {
    type: GameType.EIGHT_QUEENS,
    name: '八皇后',
    description: '经典棋盘谜题，在8×8棋盘上放置8个互不攻击的皇后！',
    icon: '👑',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-500',
    controls: '点击/方向键放置皇后 · H 提示 · R 重置',
    difficulty: '困难',
  },
  [GameType.CENTIPEDE]: {
    type: GameType.CENTIPEDE,
    name: '蜈蚣',
    description: '经典街机射击！消灭从顶部蜿蜒而下的蜈蚣，躲避蜘蛛和蝎子！',
    icon: '🐛',
    color: '#4ade80',
    gradient: 'from-green-500 to-lime-500',
    controls: '鼠标移动瞄准 · 点击射击 · 蜈蚣分段击杀',
    difficulty: '中等',
  },
  [GameType.MISSILE_COMMAND]: {
    type: GameType.MISSILE_COMMAND,
    name: '导弹指挥官',
    description: '发射拦截导弹保护城市！瞄准来袭导弹，保卫最后防线！',
    icon: '🚀',
    color: '#f87171',
    gradient: 'from-red-500 to-orange-500',
    controls: '鼠标点击发射导弹 · 保护城市不被摧毁',
    difficulty: '中等',
  },
  [GameType.LUNAR_LANDER]: {
    type: GameType.LUNAR_LANDER,
    name: '月球着陆器',
    description: '控制推力安全着陆月球！注意燃料消耗，平稳降落在着陆区！',
    icon: '🌙',
    color: '#d1d5db',
    gradient: 'from-gray-400 to-slate-500',
    controls: '↑/空格 主推力 · ←→ 旋转 · 平稳着陆得分',
    difficulty: '中等',
  },
  [GameType.SLIDER_PUZZLE]: {
    type: GameType.SLIDER_PUZZLE,
    name: '滑块拼图',
    description: '经典数字滑块益智，滑动方块将数字按顺序排列！',
    icon: '🧩',
    color: '#60a5fa',
    gradient: 'from-blue-500 to-indigo-500',
    controls: '方向键/点击滑动方块 · 按数字顺序排列',
    difficulty: '中等',
  },
  [GameType.TOWER_OF_HANOI]: {
    type: GameType.TOWER_OF_HANOI,
    name: '河内塔',
    description: '经典递归益智，将所有圆盘从A柱移到C柱，大盘不能放在小盘上！',
    icon: '🗼',
    color: '#fbbf24',
    gradient: 'from-amber-500 to-yellow-500',
    controls: '点击/方向键选柱 · 放置圆盘 · 大盘不能压小盘',
    difficulty: '中等',
  },
  [GameType.DONKEY_KONG]: {
    type: GameType.DONKEY_KONG,
    name: '大金刚',
    description: '经典街机平台跳跃！攀爬梯子、躲避障碍，营救被大金刚抓走的人质！',
    icon: '🦍',
    color: '#f97316',
    gradient: 'from-orange-500 to-red-500',
    controls: '← → 移动 · ↑/空格 跳跃 · 躲避滚筒和障碍',
    difficulty: '困难',
  },
  [GameType.DIG_DUG]: {
    type: GameType.DIG_DUG,
    name: '挖掘者',
    description: '经典街机挖掘游戏！在地下挖隧道，用气泵消灭怪物，越深分数越高！',
    icon: '⛏️',
    color: '#22d3ee',
    gradient: 'from-cyan-500 to-blue-500',
    controls: '方向键移动 · 空格充气攻击 · 挖隧道消灭怪物',
    difficulty: '中等',
  },
  [GameType.BATTLE_CITY]: {
    type: GameType.BATTLE_CITY,
    name: '坦克大战',
    description: '经典坦克射击！保卫基地，消灭敌方坦克，支持多种地形和道具！',
    icon: '🪖',
    color: '#facc15',
    gradient: 'from-yellow-500 to-amber-500',
    controls: '方向键移动 · 空格射击 · 保卫基地消灭敌军',
    difficulty: '中等',
  },
  [GameType.MASTERMIND]: {
    type: GameType.MASTERMIND,
    name: '猜数字',
    description: '经典逻辑推理！猜出隐藏的数字组合，根据提示逐步推理，考验你的头脑！',
    icon: '🔮',
    color: '#a855f7',
    gradient: 'from-purple-500 to-violet-500',
    controls: '方向键选择数字 · 空格确认 · 根据提示推理',
    difficulty: '中等',
  },
  [GameType.MAKE_24]: {
    type: GameType.MAKE_24,
    name: '算术24点',
    description: '用4个数字和加减乘除运算，凑出24！锻炼数学思维和速算能力！',
    icon: '🧮',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-500',
    controls: '方向键选择 · 空格确认 · 用四则运算凑出24',
    difficulty: '中等',
  },
  [GameType.COOKIE_CLICKER]: {
    type: GameType.COOKIE_CLICKER,
    name: 'Cookie Clicker',
    description: '放置类经典！点击生产饼干，购买升级自动产出，看你的饼干帝国能有多大！',
    icon: '🍪',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-400',
    controls: '空格/点击 生产饼干 · ↑↓ 选择升级 · Enter 购买',
    difficulty: '简单',
  },
  [GameType.REACTION_TEST]: {
    type: GameType.REACTION_TEST,
    name: '反应力测试',
    description: '测试你的反应速度！屏幕变绿后尽快按键，多轮测试取平均值，挑战极限！',
    icon: '⚡',
    color: '#00b894',
    gradient: 'from-green-500 to-emerald-400',
    controls: '空格/点击 反应 · 等屏幕变绿后尽快按键',
    difficulty: '简单',
  },
  [GameType.ZUMA]: {
    type: GameType.ZUMA,
    name: '祖玛',
    description: '彩色球沿螺旋轨道前进，射出彩球插入链中，同色三连消除，连锁加分！',
    icon: '🔮',
    color: '#a55eea',
    gradient: 'from-purple-500 to-violet-500',
    controls: '← → 旋转发射器 · 空格 发射 · ↑↓ 切换球颜色',
    difficulty: '中等',
  },
  [GameType.PIXEL_ART]: {
    type: GameType.PIXEL_ART,
    name: '涂色画板',
    description: '像素涂色画板！在网格上绘画创作，支持画笔、橡皮擦、填充、取色等工具，多种模板任你选择！',
    icon: '🎨',
    color: '#ec4899',
    gradient: 'from-pink-500 to-fuchsia-500',
    controls: '方向键移动光标 · 空格使用工具 · B/E/F/I 切换工具 · C 切换颜色 · 1-9 快速选色 · S 保存 · L 加载',
    difficulty: '简单',
  },
  [GameType.SPIROGRAPH]: {
    type: GameType.SPIROGRAPH,
    name: '万花尺',
    description: '经典万花尺 Spirograph！调节内外圆半径和笔距，绘制精美的数学曲线图案，支持多种预设和颜色方案！',
    icon: '🌀',
    color: '#00ff88',
    gradient: 'from-green-400 to-cyan-400',
    controls: '空格 绘制/暂停 · ←→ 调整内圆半径 · ↑↓ 调整笔距 · Q/W 调整外圆半径 · C 切换颜色 · E 切换曲线类型 · 1-5 预设 · R 重置',
    difficulty: '简单',
  },
  [GameType.WORDLE]: {
    type: GameType.WORDLE,
    name: 'Wordle',
    description: '经典猜词游戏！6次机会猜出5字母单词，根据颜色提示推理，考验你的词汇量和逻辑！',
    icon: '🔤',
    color: '#538d4e',
    gradient: 'from-emerald-500 to-green-400',
    controls: '字母键输入 · Enter 提交 · Backspace 删除 · 灰色=不在答案 · 黄色=位置错 · 绿色=正确',
    difficulty: '中等',
  },
  [GameType.GEOMETRY_DASH]: {
    type: GameType.GEOMETRY_DASH,
    name: '跑跑跳跳',
    description: 'Geometry Dash Lite！方块自动奔跑，跳跃躲避尖刺和障碍物，速度越来越快，节奏感超强！',
    icon: '🔷',
    color: '#00ff88',
    gradient: 'from-green-400 to-cyan-400',
    controls: '空格/↑ 跳跃 · 长按跳更高 · R 重新开始 · 躲避障碍物通关',
    difficulty: '困难',
  },
  [GameType.CAVE_FLYER]: {
    type: GameType.CAVE_FLYER,
    name: '洞穴飞行',
    description: '驾驶直升机穿越洞穴！按住上升松开下降，躲避地形和障碍物，收集星星加分，速度逐渐加快！',
    icon: '🚁',
    color: '#ff6348',
    gradient: 'from-orange-500 to-amber-400',
    controls: '↑/空格 上升（按住） · 松开下降 · R 重新开始 · 收集星星加分',
    difficulty: '中等',
  },
  [GameType.GRAVITY_FLIP]: {
    type: GameType.GRAVITY_FLIP,
    name: '重力翻转',
    description: '角色自动奔跑，按空格翻转重力方向，在天花板和地面之间切换躲避障碍物！速度逐渐加快，考验你的反应力！',
    icon: '🔄',
    color: '#a855f7',
    gradient: 'from-purple-500 to-indigo-500',
    controls: '空格/↑ 翻转重力 · R 重新开始 · 躲避障碍物',
    difficulty: '中等',
  },
  [GameType.KNIGHTS_TOUR]: {
    type: GameType.KNIGHTS_TOUR,
    name: '骑士巡游',
    description: '国际象棋马走日字，尝试遍历棋盘每一格恰好一次！支持 Warnsdorff 提示和撤销功能，考验你的策略思维！',
    icon: '♞',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-yellow-400',
    controls: '方向键选择位置 · 空格确认 · H 提示 · U 撤销 · R 重开 · 1/2/3 切换棋盘',
    difficulty: '困难',
  },
  [GameType.FALL_DOWN]: {
    type: GameType.FALL_DOWN,
    name: '下落跑酷',
    description: '控制小球穿过上升平台的间隙，被顶到顶部则游戏结束！速度越来越快，你能坚持多久？',
    icon: '⬇️',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-400',
    controls: '左右方向键移动 · 空格开始',
    difficulty: '中等',
  },
  [GameType.VIRTUAL_PET]: {
    type: GameType.VIRTUAL_PET,
    name: '电子宠物',
    description: '照顾你的虚拟宠物！喂食、洗澡、玩耍、睡觉，保持它的各项属性，看它从蛋成长为成年宠物！',
    icon: '🐾',
    color: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
    controls: '1 喂食 · 2 洗澡 · 3 玩耍 · 4 睡觉 · 方向键 切换属性面板',
    difficulty: '简单',
  },
  [GameType.ZTYPE]: {
    type: GameType.ZTYPE,
    name: '打字练习 ZType',
    description: '单词从天而降，快速输入消灭它们！连击加分、难度递增，挑战你的打字速度和准确度！',
    icon: '⌨️',
    color: '#00ff88',
    gradient: 'from-emerald-400 to-cyan-400',
    controls: 'A-Z 输入字母 · Backspace 删除 · Escape 取消输入',
    difficulty: '中等',
  },
  [GameType.WATER_SORT]: {
    type: GameType.WATER_SORT,
    name: '水排序',
    description: '将不同颜色的水在试管间倒来倒去，最终让每根试管只有一种颜色！考验逻辑与耐心！',
    icon: '🧪',
    color: '#00d4ff',
    gradient: 'from-cyan-400 to-blue-400',
    controls: '← → 选择试管 · 空格/回车 选中/倒出 · U 撤销 · R 重置 · N 下一关',
    difficulty: '中等',
  },
  [GameType.SCREW_PUZZLE]: {
    type: GameType.SCREW_PUZZLE,
    name: '拧螺丝',
    description: '拧下螺丝让板掉落！按正确顺序拧下所有螺丝，让所有板掉落即可过关！',
    icon: '🔧',
    color: '#9ca3af',
    gradient: 'from-gray-400 to-slate-400',
    controls: '↑↓←→ 选择螺丝 · 空格/回车 拧螺丝 · U 撤销 · R 重置',
    difficulty: '中等',
  },
  [GameType.SAND_SIMULATION]: {
    type: GameType.SAND_SIMULATION,
    name: '沙盒粒子',
    description: '在网格上绘制沙子、水、石头、火、木头等材质，观察它们按物理规则相互作用！',
    icon: '🏜️',
    color: '#f59e0b',
    gradient: 'from-yellow-400 to-amber-400',
    controls: '方向键移动光标 · 空格放置 · 1-5 切换材质 · +/- 调整画笔 · C 清空',
    difficulty: '简单',
  },
  [GameType.VIDEO_POKER]: {
    type: GameType.VIDEO_POKER,
    name: 'Video Poker',
    description: '经典扑克！发5张牌，选择保留/换牌，根据牌型获得赔率。皇家同花顺800倍！',
    icon: '🃏',
    color: '#e74c3c',
    gradient: 'from-red-500 to-purple-500',
    controls: '1-5 保留/取消 · 空格/Enter 发牌换牌 · ↑↓ 调整下注',
    difficulty: '中等',
  },
  [GameType.BLACKJACK]: {
    type: GameType.BLACKJACK,
    name: '21点 Blackjack',
    description: '经典21点！与庄家比牌点数，尽量接近21点但不超过。支持要牌、停牌、加倍，Blackjack赔率1.5倍！',
    icon: '🂡',
    color: '#00b894',
    gradient: 'from-green-500 to-emerald-400',
    controls: 'H 要牌 · S 停牌 · D 加倍 · ↑↓ 调整赌注 · 空格/Enter 开始',
    difficulty: '中等',
  },
  [GameType.SPACE_DODGE]: {
    type: GameType.SPACE_DODGE,
    name: '太空陨石躲避',
    description: '驾驶飞船在太空中躲避陨石，生存越久得分越高！收集能量球加分，速度逐渐递增！',
    icon: '☄️',
    color: '#22d3ee',
    gradient: 'from-cyan-400 to-indigo-400',
    controls: '← → / A D 移动飞船 · 空格 开始/重新开始 · 躲避陨石生存',
    difficulty: '中等',
  },
  [GameType.BALLOON_POP]: {
    type: GameType.BALLOON_POP,
    name: '气球射击',
    description: '用准星瞄准射击上升的气球！不同气球不同分数，连击获得倍率加成，小心炸弹！',
    icon: '🎈',
    color: '#FF6B6B',
    gradient: 'from-red-400 to-pink-400',
    controls: '方向键/WASD 移动准星 · 空格 射击 · 60秒限时挑战',
    difficulty: '中等',
  },
};

// ========== Storage Keys ==========
const KEYS = {
  RECORDS: 'gp_records',
  HIGH_SCORES: 'gp_high_scores',
  FAVORITES: 'gp_favorites',
  COMMENTS: 'gp_comments',
  PROFILE: 'gp_profile',
};

// ========== Helper ==========
const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2);

const safeGet = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
};

// ========== 游戏记录服务 ==========
export const RecordService = {
  getAll(): GameRecord[] {
    return safeGet<GameRecord[]>(KEYS.RECORDS, []);
  },

  getByGame(gameType: GameType): GameRecord[] {
    return this.getAll()
      .filter((r) => r.gameType === gameType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  add(record: Omit<GameRecord, 'id' | 'date'>): GameRecord {
    const records = this.getAll();
    const newRecord: GameRecord = {
      ...record,
      id: generateId(),
      date: new Date().toISOString(),
    };
    records.push(newRecord);
    safeSet(KEYS.RECORDS, records);
    return newRecord;
  },

  getRecent(gameType: GameType, limit = 10): GameRecord[] {
    return this.getByGame(gameType).slice(0, limit);
  },

  getStats(gameType: GameType) {
    const records = this.getByGame(gameType);
    const totalGames = records.length;
    const totalScore = records.reduce((sum, r) => sum + r.score, 0);
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const totalTime = records.reduce((sum, r) => sum + r.duration, 0);
    return { totalGames, totalScore, avgScore, totalTime };
  },
};

// ========== 最高分服务 ==========
export const HighScoreService = {
  getAll(): HighScore[] {
    return safeGet<HighScore[]>(KEYS.HIGH_SCORES, []);
  },

  get(gameType: GameType): number {
    const scores = this.getAll();
    const found = scores.find((s) => s.gameType === gameType);
    return found?.score ?? 0;
  },

  update(gameType: GameType, score: number): boolean {
    const current = this.get(gameType);
    if (score > current) {
      const scores = this.getAll().filter((s) => s.gameType !== gameType);
      scores.push({ gameType, score, date: new Date().toISOString() });
      safeSet(KEYS.HIGH_SCORES, scores);
      return true; // 新纪录！
    }
    return false;
  },
};

// ========== 收藏服务 ==========
export const FavoriteService = {
  getAll(): Favorite[] {
    return safeGet<Favorite[]>(KEYS.FAVORITES, []);
  },

  isFavorite(gameType: GameType): boolean {
    return this.getAll().some((f) => f.gameType === gameType);
  },

  toggle(gameType: GameType): boolean {
    const favorites = this.getAll();
    const index = favorites.findIndex((f) => f.gameType === gameType);
    if (index >= 0) {
      favorites.splice(index, 1);
      safeSet(KEYS.FAVORITES, favorites);
      return false;
    } else {
      favorites.push({ gameType, addedAt: new Date().toISOString() });
      safeSet(KEYS.FAVORITES, favorites);
      return true;
    }
  },
};

// ========== 评论服务 ==========
export const CommentService = {
  getAll(): GameComment[] {
    return safeGet<GameComment[]>(KEYS.COMMENTS, []);
  },

  getByGame(gameType: GameType): GameComment[] {
    return this.getAll()
      .filter((c) => c.gameType === gameType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  add(gameType: GameType, nickname: string, content: string, rating: number): GameComment {
    const comments = this.getAll();
    const newComment: GameComment = {
      id: generateId(),
      gameType,
      nickname,
      content,
      rating,
      date: new Date().toISOString(),
      likes: 0,
    };
    comments.push(newComment);
    safeSet(KEYS.COMMENTS, comments);
    return newComment;
  },

  like(commentId: string): void {
    const comments = this.getAll();
    const comment = comments.find((c) => c.id === commentId);
    if (comment) {
      comment.likes++;
      safeSet(KEYS.COMMENTS, comments);
    }
  },

  getAverageRating(gameType: GameType): number {
    const comments = this.getByGame(gameType);
    if (comments.length === 0) return 0;
    const total = comments.reduce((sum, c) => sum + c.rating, 0);
    return Math.round((total / comments.length) * 10) / 10;
  },
};

// ========== 用户配置服务 ==========
export const ProfileService = {
  get(): UserProfile {
    return safeGet<UserProfile>(KEYS.PROFILE, {
      nickname: '玩家',
      avatar: '🎮',
      theme: 'dark',
      soundEnabled: true,
      favoriteGames: [],
    });
  },

  update(profile: Partial<UserProfile>): UserProfile {
    const current = this.get();
    const updated = { ...current, ...profile };
    safeSet(KEYS.PROFILE, updated);
    return updated;
  },
};
