import { useNavigate } from 'react-router-dom';
import { GameType } from '@/types';

interface GameCardProps {
  type: GameType;
}

const gameInfo: Record<GameType, { title: string; description: string; icon: string; color: string; gradient: string }> = {
  [GameType.TETRIS]: {
    title: '俄罗斯方块',
    description: '经典消行游戏，旋转、移动、消除，挑战你的极限速度！',
    icon: '🧱',
    color: 'text-cyan-400',
    gradient: 'from-cyan-600/20 to-blue-600/20',
  },
  [GameType.SNAKE]: {
    title: '贪吃蛇',
    description: '控制小蛇吃食物，越长越难操控，你能坚持多久？',
    icon: '🐍',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-emerald-600/20',
  },
  [GameType.SOKOBAN]: {
    title: '推箱子',
    description: '动动脑筋，把所有箱子推到目标位置，考验你的空间思维！',
    icon: '📦',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-red-600/20',
  },
  [GameType.FLAPPY_BIRD]: {
    title: 'Flappy Bird',
    description: '点击屏幕控制小鸟飞行，穿越管道，看你能飞多远！',
    icon: '🐦',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-amber-600/20',
  },
  [GameType.G2048]: {
    title: '2048',
    description: '滑动合并数字方块，挑战达到 2048！简单规则，无限策略。',
    icon: '🎯',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-orange-600/20',
  },
  [GameType.MEMORY_MATCH]: {
    title: '记忆翻牌',
    description: '翻开卡牌寻找配对，考验你的记忆力！配对越快分数越高。',
    icon: '🃏',
    color: 'text-pink-400',
    gradient: 'from-pink-600/20 to-purple-600/20',
  },
  [GameType.TIC_TAC_TOE]: {
    title: '井字棋',
    description: '经典双人对战棋，三子连线即胜！支持 AI 对手模式。',
    icon: '⭕',
    color: 'text-sky-400',
    gradient: 'from-sky-600/20 to-blue-600/20',
  },
  [GameType.GAME_OF_LIFE]: {
    title: '生命游戏',
    description: 'Conway 细胞自动机 — 放置细胞，观察生命的涌现与演化！',
    icon: '🧬',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-emerald-600/20',
  },
  [GameType.MINESWEEPER]: {
    title: '扫雷',
    description: '经典格子推理，揭开安全格、标记地雷！三种难度挑战。',
    icon: '💣',
    color: 'text-gray-300',
    gradient: 'from-gray-600/20 to-slate-600/20',
  },
  [GameType.GOMOKU]: {
    title: '五子棋',
    description: '经典连五棋类游戏，支持人机对战和双人对弈！',
    icon: '⚫',
    color: 'text-violet-400',
    gradient: 'from-violet-600/20 to-purple-600/20',
  },
  [GameType.DINO_RUNNER]: {
    title: '跑酷恐龙',
    description: 'Chrome 经典离线小恐龙，跳跃躲避仙人掌，看你能跑多远！',
    icon: '🦖',
    color: 'text-emerald-400',
    gradient: 'from-emerald-600/20 to-teal-600/20',
  },
  [GameType.TRON]: {
    title: '贪吃虫 Tron',
    description: '双人光线对抗！控制光线移动，碰到墙壁或轨迹就输，支持 AI 模式。',
    icon: '⚡',
    color: 'text-lime-400',
    gradient: 'from-lime-600/20 to-green-600/20',
  },
  [GameType.PIPE_MANIA]: {
    title: '接水管',
    description: '放置管道连接水源到出口，让水流通过尽可能长的管道！',
    icon: '🔧',
    color: 'text-blue-400',
    gradient: 'from-blue-600/20 to-cyan-600/20',
  },
  [GameType.BREAKOUT]: {
    title: '打砖块',
    description: '控制挡板反弹球击碎砖块，不同颜色不同分数，挑战你的反应速度！',
    icon: '🧱',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-red-600/20',
  },
  [GameType.PACMAN]: {
    title: '吃豆人',
    description: '经典吃豆人，在迷宫中吃掉所有豆子，躲避幽灵追击！',
    icon: '🟡',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-amber-600/20',
  },
  [GameType.SPACE_INVADERS]: {
    title: '太空射击',
    description: '驾驶飞船消灭外星人阵列，保护掩体，拯救地球！',
    icon: '🚀',
    color: 'text-cyan-400',
    gradient: 'from-cyan-600/20 to-purple-600/20',
  },
  [GameType.OTHELLO]: {
    title: '黑白棋',
    description: '经典翻转棋，落子翻转对手棋子，占据更多格子获胜！',
    icon: '⚫',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-emerald-600/20',
  },
  [GameType.CHECKERS]: {
    title: '跳棋',
    description: '经典西洋跳棋，吃子连跳，升变为王，击败 AI 对手！',
    icon: '🔴',
    color: 'text-red-400',
    gradient: 'from-red-600/20 to-orange-600/20',
  },
  [GameType.PINBALL]: {
    title: '弹珠台',
    description: '经典弹珠台，控制挡板弹射弹珠，碰撞bumper得分！',
    icon: '🎰',
    color: 'text-purple-400',
    gradient: 'from-purple-600/20 to-pink-600/20',
  },
  [GameType.MAHJONG_CONNECT]: {
    title: '连连看',
    description: '找到相同图案的牌面，通过不超过2个拐弯的路径连接消除！',
    icon: '🀄',
    color: 'text-teal-400',
    gradient: 'from-teal-600/20 to-cyan-600/20',
  },
  [GameType.MATCH_3]: {
    title: '消消乐',
    description: '交换相邻宝石，三连消除得分，连锁反应获得更高倍率！',
    icon: '💎',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-yellow-600/20',
  },
  [GameType.SUDOKU]: {
    title: '数独',
    description: '经典数字推理，每行每列每宫1-9不重复，三种难度挑战！',
    icon: '🔢',
    color: 'text-blue-400',
    gradient: 'from-blue-600/20 to-indigo-600/20',
  },
  [GameType.TETRIS_BATTLE]: {
    title: '方块对战',
    description: '俄罗斯方块双人对战！消行攻击对手，AI对手等你挑战！',
    icon: '⚔️',
    color: 'text-red-400',
    gradient: 'from-red-600/20 to-orange-600/20',
  },
  [GameType.FROGGER]: {
    title: '青蛙过河',
    description: '控制小青蛙穿越车流和河流，安全到达对岸！经典街机重现。',
    icon: '🐸',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-lime-600/20',
  },
  [GameType.PONG]: {
    title: '乒乓球',
    description: '经典乒乓对战！控制挡板反弹球，先得7分获胜，支持AI对手。',
    icon: '🏓',
    color: 'text-cyan-400',
    gradient: 'from-cyan-600/20 to-blue-600/20',
  },
  [GameType.CONNECT_FOUR]: {
    title: '四子棋',
    description: '双人对战策略棋！选择列落子，先连成四子者获胜，支持AI。',
    icon: '🔴',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-red-600/20',
  },
  [GameType.LIGHTS_OUT]: {
    title: '点灯',
    description: '点击切换灯光，影响相邻格子，目标是全部熄灭！考验逻辑推理。',
    icon: '💡',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-yellow-600/20',
  },
  [GameType.WHACK_A_MOLE]: {
    title: '打地鼠',
    description: '地鼠随机冒出，快速敲击得分！考验反应速度和手眼协调。',
    icon: '🔨',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-amber-600/20',
  },
};

export default function GameCard({ type }: GameCardProps) {
  const navigate = useNavigate();
  const info = gameInfo[type];

  return (
    <div
      className="game-card group cursor-pointer rounded-2xl border border-white/5 bg-gp-card p-6 backdrop-blur-sm"
      onClick={() => navigate(`/game/${type}`)}
    >
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br ${info.gradient} text-3xl`}>
        {info.icon}
      </div>
      <h3 className={`font-game text-sm ${info.color} mb-2`}>{info.title}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{info.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-white/5 px-2 py-1">⌨️ 键盘</span>
        <span className="rounded-full bg-white/5 px-2 py-1">🎯 单人</span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gp-accent opacity-0 transition-opacity group-hover:opacity-100">
        开始游戏
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

export { gameInfo };
