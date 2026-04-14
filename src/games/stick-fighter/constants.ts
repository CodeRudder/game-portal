// ========== Stick Fighter 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 地面 Y 坐标 */
export const GROUND_Y = 560;

/** 重力加速度 (px/s²) */
export const GRAVITY = 1800;

/** 移动速度 (px/s) */
export const MOVE_SPEED = 250;

/** 跳跃初速度 (px/s) */
export const JUMP_VELOCITY = -650;

/** 角色宽度 */
export const FIGHTER_WIDTH = 50;

/** 角色高度 */
export const FIGHTER_HEIGHT = 100;

/** 拳击伤害 */
export const PUNCH_DAMAGE = 10;

/** 踢腿伤害 */
export const KICK_DAMAGE = 15;

/** 拳击范围 */
export const PUNCH_RANGE = 55;

/** 踢腿范围 */
export const KICK_RANGE = 70;

/** 拳击持续时间 (ms) */
export const PUNCH_DURATION = 300;

/** 踢腿持续时间 (ms) */
export const KICK_DURATION = 400;

/** 受击硬直时间 (ms) */
export const HIT_STUN_DURATION = 300;

/** 攻击冷却时间 (ms) */
export const ATTACK_COOLDOWN = 200;

/** 连招窗口时间 (ms) */
export const COMBO_WINDOW = 1500;

/** 连招伤害加成 (每层) */
export const COMBO_BONUS_DAMAGE = 2;

/** 最大连招层数 */
export const MAX_COMBO = 10;

/** 最大 HP */
export const MAX_HP = 100;

/** 防御减伤比例 */
export const DEFENSE_REDUCTION = 0.5;

/** 胜利所需局数 */
export const WINS_NEEDED = 2;

/** 总局数 */
export const TOTAL_ROUNDS = 3;

/** 回合间等待时间 (ms) */
export const ROUND_WAIT_TIME = 2000;

/** AI 决策间隔 (ms) */
export const AI_DECISION_INTERVAL = 500;

/** AI 攻击概率 */
export const AI_ATTACK_CHANCE = 0.3;

/** AI 防御概率 */
export const AI_DEFEND_CHANCE = 0.2;

/** AI 跳跃概率 */
export const AI_JUMP_CHANCE = 0.1;

/** AI 移动概率 */
export const AI_MOVE_CHANCE = 0.4;

/** 火柴人身体比例 */
export const BODY = {
  headRadius: 10,
  neckLength: 8,
  torsoLength: 30,
  upperArmLength: 20,
  lowerArmLength: 18,
  upperLegLength: 22,
  lowerLegLength: 20,
  limbWidth: 3,
  bodyWidth: 3,
};

/** 角色颜色 */
export const COLORS = {
  p1: '#ff4444',
  p2: '#4488ff',
  p1Light: '#ff8888',
  p2Light: '#88bbff',
  ground: '#333355',
  groundLine: '#555577',
  background: '#0d0d20',
  hpBarBg: '#333',
  hpBarP1: '#ff4444',
  hpBarP2: '#4488ff',
  hpBarLow: '#ff0000',
  text: '#ffffff',
  combo: '#ffdd00',
  roundText: '#ffffff',
  hitEffect: '#ffffff',
};

/** 动作枚举 */
export type FighterAction = 'idle' | 'walk' | 'jump' | 'punch' | 'kick' | 'block' | 'hit';

/** P1 初始位置 */
export const P1_START_X = 120;

/** P2 初始位置 */
export const P2_START_X = 360;

/** 键盘映射 */
export const P1_KEYS = {
  left: 'a',
  right: 'd',
  jump: 'w',
  punch: 'f',
  kick: 'g',
  block: 's',
} as const;

export const P2_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  punch: 'k',
  kick: 'l',
  block: 'ArrowDown',
} as const;

export const START_KEY = ' ';
