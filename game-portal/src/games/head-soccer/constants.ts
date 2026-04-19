// ========== 顶球对战 Head Soccer 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 地面
export const GROUND_Y = 580;
export const GROUND_THICKNESS = 4;

// 球门
export const GOAL_WIDTH = 120;
export const GOAL_HEIGHT = 80;
export const GOAL_DEPTH = 20;
export const GOAL_LEFT_X = 0;
export const GOAL_RIGHT_X = CANVAS_WIDTH - GOAL_WIDTH;

// 角色
export const PLAYER_WIDTH = 50;
export const PLAYER_HEIGHT = 70;
export const HEAD_RADIUS = 22;
export const PLAYER_SPEED = 4;
export const JUMP_FORCE = -10;
export const GRAVITY = 0.5;
export const KICK_FORCE = 8;

// 球
export const BALL_RADIUS = 15;
export const BALL_GRAVITY = 0.35;
export const BALL_BOUNCE = 0.7;
export const BALL_FRICTION = 0.99;
export const BALL_MAX_SPEED = 15;

// 碰撞
export const PLAYER_BALL_BOUNCE = 1.2;
export const HEAD_BALL_BOUNCE = 1.5;

// 得分
export const WIN_SCORE = 5;

// AI
export const AI_REACTION_SPEED = 0.06;
export const AI_JUMP_CHANCE = 0.02;
export const AI_KICK_RANGE = 60;

// 重置位置
export const P1_START_X = 120;
export const P2_START_X = CANVAS_WIDTH - 120 - PLAYER_WIDTH;
export const PLAYER_START_Y = GROUND_Y - PLAYER_HEIGHT;
export const BALL_START_X = CANVAS_WIDTH / 2;
export const BALL_START_Y = 200;

// 发球延迟（ms）
export const SERVE_DELAY = 1000;

// 颜色
export const BG_COLOR = '#1a1a2e';
export const GROUND_COLOR = '#2d6a4f';
export const GOAL_COLOR = '#e9ecef';
export const GOAL_NET_COLOR = '#495057';
export const BALL_COLOR = '#ffffff';
export const BALL_OUTLINE = '#333333';
export const P1_COLOR = '#e74c3c';
export const P1_HEAD_COLOR = '#ff6b6b';
export const P2_COLOR = '#3498db';
export const P2_HEAD_COLOR = '#74b9ff';
export const SCORE_COLOR = '#ffffff';
export const FIELD_LINE_COLOR = 'rgba(255,255,255,0.15)';
