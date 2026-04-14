// ========== 虫虫大作战 Slither.io Lite 常量 ==========

/** 画布尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 虫子参数 */
export const SEGMENT_RADIUS = 6;              // 每个身体段的半径
export const SEGMENT_SPACING = 10;             // 身体段之间的间距
export const INITIAL_LENGTH = 10;              // 初始身体段数
export const SNAKE_SPEED = 2.0;                // 基础移动速度（像素/帧）
export const BOOST_SPEED = 4.0;                // 加速移动速度
export const TURN_SPEED = 0.06;                // 转向速度（弧度/帧）
export const BOOST_SHRINK_INTERVAL = 8;        // 加速时每隔多少帧消耗一段身体
export const MIN_LENGTH_FOR_BOOST = 5;         // 加速所需最短身体长度

/** 食物参数 */
export const FOOD_RADIUS = 4;                  // 食物半径
export const INITIAL_FOOD_COUNT = 40;          // 初始食物数量
export const MAX_FOOD_COUNT = 80;              // 最大食物数量
export const FOOD_SCORE = 1;                   // 每个食物的分数

/** AI 参数 */
export const AI_COUNT = 4;                     // AI 虫子数量
export const AI_TURN_SPEED = 0.04;             // AI 转向速度
export const AI_VISION_RANGE = 120;            // AI 视野范围
export const AI_FOOD_VISION = 80;              // AI 寻找食物的视野范围
export const AI_DIRECTION_CHANGE_INTERVAL = 60; // AI 随机转向间隔（帧）
export const AI_INITIAL_LENGTH_MIN = 8;        // AI 初始最小长度
export const AI_INITIAL_LENGTH_MAX = 20;       // AI 初始最大长度

/** 碰撞参数 */
export const HEAD_COLLISION_RADIUS = 8;        // 头部碰撞检测半径
export const BODY_COLLISION_RADIUS = 5;        // 身体碰撞检测半径

/** 虫子颜色 */
export const PLAYER_COLORS = ['#00ff88', '#00ffcc', '#00ff55', '#33ff99', '#66ffbb'];
export const AI_COLORS = [
  ['#ff6b6b', '#ff4444', '#ff8888', '#ff2222', '#ffaaaa'],
  ['#ffd93d', '#ffcc00', '#ffe066', '#ffb300', '#fff3b0'],
  ['#6c5ce7', '#a55eea', '#8b5cf6', '#7c3aed', '#9b7dff'],
  ['#fd79a8', '#e84393', '#f78fb3', '#d63384', '#ff9ec6'],
];

/** 食物颜色 */
export const FOOD_COLORS = [
  '#ff6b6b', '#ffd93d', '#6c5ce7', '#00ff88',
  '#fd79a8', '#00cec9', '#e17055', '#74b9ff',
  '#55efc4', '#fab1a0', '#81ecec', '#dfe6e9',
];

/** 边界边距（用于渲染边界线） */
export const BORDER_MARGIN = 5;

/** 死亡后产生的食物数量倍率 */
export const DEATH_FOOD_RATIO = 2;             // 每N段身体产生1个食物
