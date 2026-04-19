import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  GRAVITY,
  MOVE_SPEED,
  JUMP_VELOCITY,
  FIGHTER_WIDTH,
  FIGHTER_HEIGHT,
  PUNCH_DAMAGE,
  KICK_DAMAGE,
  PUNCH_RANGE,
  KICK_RANGE,
  PUNCH_DURATION,
  KICK_DURATION,
  HIT_STUN_DURATION,
  ATTACK_COOLDOWN,
  COMBO_WINDOW,
  COMBO_BONUS_DAMAGE,
  MAX_COMBO,
  MAX_HP,
  DEFENSE_REDUCTION,
  WINS_NEEDED,
  ROUND_WAIT_TIME,
  AI_DECISION_INTERVAL,
  AI_ATTACK_CHANCE,
  AI_DEFEND_CHANCE,
  AI_JUMP_CHANCE,
  AI_MOVE_CHANCE,
  P1_START_X,
  P2_START_X,
  P1_KEYS,
  P2_KEYS,
  START_KEY,
  COLORS,
  BODY,
  type FighterAction,
} from './constants';

// ========== 战斗者接口 ==========
export interface Fighter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  action: FighterAction;
  facingRight: boolean;
  isGrounded: boolean;
  isBlocking: boolean;
  attackTimer: number;
  attackCooldown: number;
  hitStunTimer: number;
  comboCount: number;
  comboTimer: number;
  color: string;
  lightColor: string;
  wins: number;
  // 动画帧
  animFrame: number;
  // 受击效果
  hitEffectTimer: number;
  hitEffectX: number;
  hitEffectY: number;
}

// ========== 游戏状态 ==========
export type RoundState = 'waiting' | 'fighting' | 'roundEnd' | 'matchEnd';

// ========== StickFighterEngine ==========
export class StickFighterEngine extends GameEngine {
  private p1!: Fighter;
  private p2!: Fighter;
  private roundState: RoundState = 'waiting';
  private currentRound: number = 1;
  private roundWaitTimer: number = 0;
  private roundWinner: number = 0; // 0=none, 1=p1, 2=p2
  private matchWinner: number = 0;
  private keys: Set<string> = new Set();
  private isAIMode: boolean = false;
  private aiTimer: number = 0;
  private aiAction: FighterAction = 'idle';
  private aiMoveDir: number = 0; // -1 left, 0 none, 1 right

  // 公共标记
  public isWin: boolean = false;

  // ========== 初始化 ==========
  protected onInit(): void {
    this.resetFighters();
  }

  protected onStart(): void {
    this.resetFighters();
    this.roundState = 'fighting';
    this.currentRound = 1;
    this.matchWinner = 0;
    this.isWin = false;
  }

  protected onReset(): void {
    this.resetFighters();
    this.roundState = 'waiting';
    this.currentRound = 1;
    this.roundWinner = 0;
    this.matchWinner = 0;
    this.isWin = false;
    this.keys.clear();
    this.aiTimer = 0;
    this.aiAction = 'idle';
    this.aiMoveDir = 0;
  }

  protected onGameOver(): void {
    // matchEnd handled
  }

  // ========== 创建战斗者 ==========
  createFighter(x: number, color: string, lightColor: string): Fighter {
    return {
      x,
      y: GROUND_Y - FIGHTER_HEIGHT,
      vx: 0,
      vy: 0,
      hp: MAX_HP,
      maxHp: MAX_HP,
      action: 'idle',
      facingRight: x < CANVAS_WIDTH / 2,
      isGrounded: true,
      isBlocking: false,
      attackTimer: 0,
      attackCooldown: 0,
      hitStunTimer: 0,
      comboCount: 0,
      comboTimer: 0,
      color,
      lightColor,
      wins: 0,
      animFrame: 0,
      hitEffectTimer: 0,
      hitEffectX: 0,
      hitEffectY: 0,
    };
  }

  private resetFighters(): void {
    this.p1 = this.createFighter(P1_START_X, COLORS.p1, COLORS.p1Light);
    this.p2 = this.createFighter(P2_START_X, COLORS.p2, COLORS.p2Light);
    this.p1.facingRight = true;
    this.p2.facingRight = false;
  }

  private resetRound(): void {
    this.p1.x = P1_START_X;
    this.p1.y = GROUND_Y - FIGHTER_HEIGHT;
    this.p1.vx = 0;
    this.p1.vy = 0;
    this.p1.hp = MAX_HP;
    this.p1.action = 'idle';
    this.p1.isGrounded = true;
    this.p1.isBlocking = false;
    this.p1.attackTimer = 0;
    this.p1.attackCooldown = 0;
    this.p1.hitStunTimer = 0;
    this.p1.comboCount = 0;
    this.p1.comboTimer = 0;
    this.p1.animFrame = 0;
    this.p1.hitEffectTimer = 0;

    this.p2.x = P2_START_X;
    this.p2.y = GROUND_Y - FIGHTER_HEIGHT;
    this.p2.vx = 0;
    this.p2.vy = 0;
    this.p2.hp = MAX_HP;
    this.p2.action = 'idle';
    this.p2.isGrounded = true;
    this.p2.isBlocking = false;
    this.p2.attackTimer = 0;
    this.p2.attackCooldown = 0;
    this.p2.hitStunTimer = 0;
    this.p2.comboCount = 0;
    this.p2.comboTimer = 0;
    this.p2.animFrame = 0;
    this.p2.hitEffectTimer = 0;
  }

  // ========== 公共访问器 ==========
  getP1(): Fighter { return this.p1; }
  getP2(): Fighter { return this.p2; }
  getRoundState(): RoundState { return this.roundState; }
  getCurrentRound(): number { return this.currentRound; }
  getRoundWinner(): number { return this.roundWinner; }
  getMatchWinner(): number { return this.matchWinner; }
  getIsAIMode(): boolean { return this.isAIMode; }

  setAIMode(enabled: boolean): void {
    this.isAIMode = enabled;
  }

  // ========== 键盘处理 ==========
  handleKeyDown(key: string): void {
    this.keys.add(key);

    // 空格开始/重新开始
    if (key === START_KEY) {
      if (this.roundState === 'waiting' || this.roundState === 'matchEnd') {
        if (this._status === 'idle' || this._status === 'gameover') {
          this.start();
        }
      }
      return;
    }

    // Tab 切换 AI 模式
    if (key === 'Tab') {
      this.isAIMode = !this.isAIMode;
      return;
    }
  }

  handleKeyUp(key: string): void {
    this.keys.delete(key);
  }

  // ========== 主更新循环 ==========
  update(deltaTime: number): void {
    if (this.roundState === 'waiting') return;

    const dt = deltaTime / 1000; // 转为秒

    if (this.roundState === 'roundEnd') {
      this.roundWaitTimer -= deltaTime;
      if (this.roundWaitTimer <= 0) {
        this.startNextRound();
      }
      return;
    }

    if (this.roundState === 'matchEnd') return;

    // 更新 AI
    if (this.isAIMode) {
      this.updateAI(dt);
    }

    // 处理输入
    this.processInput(this.p1, P1_KEYS, dt);
    if (!this.isAIMode) {
      this.processInput(this.p2, P2_KEYS, dt);
    }

    // 更新物理
    this.updateFighter(this.p1, dt);
    this.updateFighter(this.p2, dt);

    // 面向对手
    this.updateFacing();

    // 碰撞检测（攻击判定）
    this.checkAttack(this.p1, this.p2);
    this.checkAttack(this.p2, this.p1);

    // 角色碰撞（不能重叠）
    this.resolveFighterCollision();

    // 更新连招计时器
    this.updateCombo(this.p1, dt);
    this.updateCombo(this.p2, dt);

    // 检查回合结束
    this.checkRoundEnd();
  }

  // ========== 输入处理 ==========
  private processInput(fighter: Fighter, keys: typeof P1_KEYS | typeof P2_KEYS, dt: number): void {
    if (fighter.hitStunTimer > 0) return; // 硬直中无法操作

    const leftPressed = this.keys.has(keys.left);
    const rightPressed = this.keys.has(keys.right);
    const jumpPressed = this.keys.has(keys.jump);
    const punchPressed = this.keys.has(keys.punch);
    const kickPressed = this.keys.has(keys.kick);
    const blockPressed = this.keys.has(keys.block);

    // 防御
    if (blockPressed && fighter.attackTimer <= 0) {
      fighter.isBlocking = true;
      fighter.action = 'block';
      fighter.vx = 0;
      return;
    } else {
      fighter.isBlocking = false;
    }

    // 攻击中不能移动
    if (fighter.attackTimer > 0) return;

    // 攻击
    if (punchPressed && fighter.attackCooldown <= 0) {
      fighter.action = 'punch';
      fighter.attackTimer = PUNCH_DURATION;
      fighter.attackCooldown = ATTACK_COOLDOWN;
      fighter.vx = 0;
      return;
    }

    if (kickPressed && fighter.attackCooldown <= 0) {
      fighter.action = 'kick';
      fighter.attackTimer = KICK_DURATION;
      fighter.attackCooldown = ATTACK_COOLDOWN;
      fighter.vx = 0;
      return;
    }

    // 跳跃
    if (jumpPressed && fighter.isGrounded) {
      fighter.vy = JUMP_VELOCITY;
      fighter.isGrounded = false;
      fighter.action = 'jump';
    }

    // 移动
    if (leftPressed) {
      fighter.vx = -MOVE_SPEED;
      if (fighter.isGrounded) fighter.action = 'walk';
    } else if (rightPressed) {
      fighter.vx = MOVE_SPEED;
      if (fighter.isGrounded) fighter.action = 'walk';
    } else {
      fighter.vx = 0;
      if (fighter.isGrounded && fighter.action !== 'jump') {
        fighter.action = 'idle';
      }
    }
  }

  // ========== 物理更新 ==========
  private updateFighter(fighter: Fighter, dt: number): void {
    // 重力
    if (!fighter.isGrounded) {
      fighter.vy += GRAVITY * dt;
    }

    // 位置更新
    fighter.x += fighter.vx * dt;
    fighter.y += fighter.vy * dt;

    // 地面碰撞
    if (fighter.y >= GROUND_Y - FIGHTER_HEIGHT) {
      fighter.y = GROUND_Y - FIGHTER_HEIGHT;
      fighter.vy = 0;
      fighter.isGrounded = true;
      if (fighter.action === 'jump') {
        fighter.action = 'idle';
      }
    }

    // 边界限制
    if (fighter.x < 0) fighter.x = 0;
    if (fighter.x > CANVAS_WIDTH - FIGHTER_WIDTH) {
      fighter.x = CANVAS_WIDTH - FIGHTER_WIDTH;
    }

    // 攻击计时器
    if (fighter.attackTimer > 0) {
      fighter.attackTimer -= dt * 1000;
      if (fighter.attackTimer <= 0) {
        fighter.attackTimer = 0;
        fighter.action = fighter.isGrounded ? 'idle' : 'jump';
      }
    }

    // 攻击冷却
    if (fighter.attackCooldown > 0) {
      fighter.attackCooldown -= dt * 1000;
      if (fighter.attackCooldown < 0) fighter.attackCooldown = 0;
    }

    // 硬直计时器
    if (fighter.hitStunTimer > 0) {
      fighter.hitStunTimer -= dt * 1000;
      if (fighter.hitStunTimer <= 0) {
        fighter.hitStunTimer = 0;
        fighter.action = fighter.isGrounded ? 'idle' : 'jump';
      }
    }

    // 受击效果计时器
    if (fighter.hitEffectTimer > 0) {
      fighter.hitEffectTimer -= dt * 1000;
      if (fighter.hitEffectTimer < 0) fighter.hitEffectTimer = 0;
    }

    // 动画帧
    fighter.animFrame += dt * 8;
  }

  // ========== 面向对手 ==========
  private updateFacing(): void {
    this.p1.facingRight = this.p1.x < this.p2.x;
    this.p2.facingRight = this.p2.x < this.p1.x;
  }

  // ========== 攻击判定 ==========
  checkAttack(attacker: Fighter, defender: Fighter): boolean {
    if (attacker.attackTimer <= 0) return false;

    const isPunch = attacker.action === 'punch';
    const isKick = attacker.action === 'kick';
    if (!isPunch && !isKick) return false;

    // 只在攻击的前半段判定（防止多次命中）
    const maxDuration = isPunch ? PUNCH_DURATION : KICK_DURATION;
    const elapsed = maxDuration - attacker.attackTimer;
    if (elapsed > maxDuration * 0.5) return false;

    // 计算攻击范围
    const range = isPunch ? PUNCH_RANGE : KICK_RANGE;
    const attackDir = attacker.facingRight ? 1 : -1;
    const attackX = attacker.x + (attacker.facingRight ? FIGHTER_WIDTH : 0);
    const attackEndX = attackX + attackDir * range;

    // 防御者碰撞盒
    const defLeft = defender.x;
    const defRight = defender.x + FIGHTER_WIDTH;
    const defTop = defender.y;
    const defBottom = defender.y + FIGHTER_HEIGHT;

    // 攻击判定区域
    const atkMinX = Math.min(attackX, attackEndX);
    const atkMaxX = Math.max(attackX, attackEndX);

    // 检查是否命中
    const hitX = atkMaxX >= defLeft && atkMinX <= defRight;
    const hitY = true; // Y 轴简化判定，同一高度即可

    if (hitX && hitY) {
      // 计算伤害
      let damage = isPunch ? PUNCH_DAMAGE : KICK_DAMAGE;

      // 连招加成
      if (attacker.comboCount > 0 && attacker.comboTimer > 0) {
        damage += COMBO_BONUS_DAMAGE * Math.min(attacker.comboCount, MAX_COMBO);
      }

      // 防御减伤
      if (defender.isBlocking) {
        damage = Math.floor(damage * DEFENSE_REDUCTION);
      }

      // 应用伤害
      defender.hp = Math.max(0, defender.hp - damage);

      // 受击硬直
      if (!defender.isBlocking) {
        defender.hitStunTimer = HIT_STUN_DURATION;
        defender.action = 'hit';
        defender.vx = 0;
      }

      // 更新连招
      attacker.comboCount++;
      attacker.comboTimer = COMBO_WINDOW;

      // 受击效果
      defender.hitEffectTimer = 200;
      defender.hitEffectX = defender.x + FIGHTER_WIDTH / 2;
      defender.hitEffectY = defender.y + FIGHTER_HEIGHT / 3;

      // 击退
      const knockback = defender.isBlocking ? 30 : 60;
      const dir = attacker.facingRight ? 1 : -1;
      defender.x += dir * knockback;

      return true;
    }

    return false;
  }

  // ========== 角色碰撞 ==========
  private resolveFighterCollision(): void {
    const overlap = this.getOverlap(this.p1, this.p2);
    if (overlap > 0) {
      const push = overlap / 2;
      if (this.p1.x < this.p2.x) {
        this.p1.x -= push;
        this.p2.x += push;
      } else {
        this.p1.x += push;
        this.p2.x -= push;
      }
    }
  }

  private getOverlap(a: Fighter, b: Fighter): number {
    const aLeft = a.x;
    const aRight = a.x + FIGHTER_WIDTH;
    const bLeft = b.x;
    const bRight = b.x + FIGHTER_WIDTH;
    const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
    return overlapX > 0 ? overlapX : 0;
  }

  // ========== 连招更新 ==========
  private updateCombo(fighter: Fighter, dt: number): void {
    if (fighter.comboTimer > 0) {
      fighter.comboTimer -= dt * 1000;
      if (fighter.comboTimer <= 0) {
        fighter.comboCount = 0;
        fighter.comboTimer = 0;
      }
    }
  }

  // ========== 回合结束检查 ==========
  private checkRoundEnd(): void {
    if (this.p1.hp <= 0) {
      this.endRound(2);
    } else if (this.p2.hp <= 0) {
      this.endRound(1);
    }
  }

  private endRound(winner: number): void {
    this.roundWinner = winner;
    this.roundState = 'roundEnd';
    this.roundWaitTimer = ROUND_WAIT_TIME;

    if (winner === 1) {
      this.p1.wins++;
    } else {
      this.p2.wins++;
    }

    // 检查是否比赛结束
    if (this.p1.wins >= WINS_NEEDED) {
      this.matchWinner = 1;
      this.roundState = 'matchEnd';
      this.isWin = true;
      this._score = this.p1.wins * 1000 + this.p1.hp * 10;
      this.gameOver();
    } else if (this.p2.wins >= WINS_NEEDED) {
      this.matchWinner = 2;
      this.roundState = 'matchEnd';
      this.isWin = !this.isAIMode; // P1 赢才算赢
      this._score = this.p2.wins * 1000 + this.p2.hp * 10;
      this.gameOver();
    }
  }

  private startNextRound(): void {
    this.currentRound++;
    this.roundWinner = 0;
    this.resetRound();
    this.roundState = 'fighting';
  }

  // ========== AI 系统 ==========
  private updateAI(dt: number): void {
    this.aiTimer -= dt * 1000;
    if (this.aiTimer > 0) return;
    this.aiTimer = AI_DECISION_INTERVAL;

    const dist = Math.abs(this.p2.x - this.p1.x);
    const rand = Math.random();

    // 简单 AI 决策
    if (dist < PUNCH_RANGE + 20) {
      // 近距离：攻击或防御
      if (rand < AI_ATTACK_CHANCE) {
        // 攻击
        if (Math.random() < 0.5) {
          this.aiAction = 'punch';
        } else {
          this.aiAction = 'kick';
        }
        this.aiMoveDir = 0;
      } else if (rand < AI_ATTACK_CHANCE + AI_DEFEND_CHANCE) {
        this.aiAction = 'block';
        this.aiMoveDir = 0;
      } else {
        this.aiAction = 'idle';
        // 后退
        this.aiMoveDir = this.p2.x > this.p1.x ? 1 : -1;
      }
    } else {
      // 远距离：接近
      if (rand < AI_MOVE_CHANCE) {
        this.aiAction = 'idle';
        this.aiMoveDir = this.p2.x > this.p1.x ? -1 : 1;
      } else if (rand < AI_MOVE_CHANCE + AI_JUMP_CHANCE) {
        this.aiAction = 'jump';
        this.aiMoveDir = 0;
      } else {
        this.aiAction = 'idle';
        this.aiMoveDir = this.p2.x > this.p1.x ? -1 : 1;
      }
    }

    // 应用 AI 决策到 P2
    this.applyAIAction();
  }

  private applyAIAction(): void {
    // 清除之前的 AI 按键
    this.keys.delete(P2_KEYS.left);
    this.keys.delete(P2_KEYS.right);
    this.keys.delete(P2_KEYS.jump);
    this.keys.delete(P2_KEYS.punch);
    this.keys.delete(P2_KEYS.kick);
    this.keys.delete(P2_KEYS.block);

    // 移动
    if (this.aiMoveDir < 0) {
      this.keys.add(P2_KEYS.left);
    } else if (this.aiMoveDir > 0) {
      this.keys.add(P2_KEYS.right);
    }

    // 动作
    switch (this.aiAction) {
      case 'punch':
        this.keys.add(P2_KEYS.punch);
        break;
      case 'kick':
        this.keys.add(P2_KEYS.kick);
        break;
      case 'block':
        this.keys.add(P2_KEYS.block);
        break;
      case 'jump':
        this.keys.add(P2_KEYS.jump);
        break;
    }
  }

  // ========== 渲染 ==========
  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    // 地面
    this.drawGround(ctx, w, h);

    // 血条
    this.drawHPBar(ctx, this.p1, 20, 20, 200, 20, true);
    this.drawHPBar(ctx, this.p2, w - 220, 20, 200, 20, false);

    // 回合信息
    this.drawRoundInfo(ctx, w);

    // 角色
    this.drawStickFighter(ctx, this.p1);
    this.drawStickFighter(ctx, this.p2);

    // 受击效果
    this.drawHitEffects(ctx);

    // 连招显示
    this.drawCombo(ctx, this.p1, 30, 60);
    this.drawCombo(ctx, this.p2, w - 100, 60);

    // 状态覆盖
    if (this.roundState === 'waiting') {
      this.drawOverlay(ctx, w, h, '按空格开始', COLORS.text);
    } else if (this.roundState === 'roundEnd') {
      const winnerName = this.roundWinner === 1 ? 'P1 胜' : 'P2 胜';
      this.drawOverlay(ctx, w, h, `${winnerName} - 第 ${this.currentRound} 局`, COLORS.combo);
    } else if (this.roundState === 'matchEnd') {
      const winnerName = this.matchWinner === 1 ? 'P1 获胜！' : 'P2 获胜！';
      this.drawOverlay(ctx, w, h, winnerName, COLORS.combo);
    }
  }

  // ========== 绘制地面 ==========
  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
    ctx.strokeStyle = COLORS.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(w, GROUND_Y);
    ctx.stroke();
  }

  // ========== 绘制血条 ==========
  drawHPBar(ctx: CanvasRenderingContext2D, fighter: Fighter, x: number, y: number, w: number, h: number, isLeft: boolean): void {
    const ratio = fighter.hp / fighter.maxHp;

    // 背景
    ctx.fillStyle = COLORS.hpBarBg;
    ctx.fillRect(x, y, w, h);

    // 血条
    const barColor = ratio < 0.25 ? COLORS.hpBarLow :
      (fighter.color === COLORS.p1 ? COLORS.hpBarP1 : COLORS.hpBarP2);
    ctx.fillStyle = barColor;

    if (isLeft) {
      ctx.fillRect(x, y, w * ratio, h);
    } else {
      ctx.fillRect(x + w * (1 - ratio), y, w * ratio, h);
    }

    // 边框
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // HP 文字
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(fighter.hp)}/${fighter.maxHp}`, x + w / 2, y + h / 2 + 4);

    // 胜利标记
    for (let i = 0; i < fighter.wins; i++) {
      ctx.fillStyle = COLORS.combo;
      ctx.beginPath();
      ctx.arc(x + (isLeft ? w + 15 + i * 15 : -15 - i * 15), y + h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ========== 绘制回合信息 ==========
  private drawRoundInfo(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.roundText;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${this.currentRound} 局`, w / 2, 15);

    // 比分
    ctx.font = '12px monospace';
    ctx.fillText(`${this.p1.wins} - ${this.p2.wins}`, w / 2, 50);
  }

  // ========== 绘制火柴人 ==========
  drawStickFighter(ctx: CanvasRenderingContext2D, fighter: Fighter): void {
    const cx = fighter.x + FIGHTER_WIDTH / 2;
    const baseY = fighter.y + FIGHTER_HEIGHT;
    const dir = fighter.facingRight ? 1 : -1;
    const color = fighter.color;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = BODY.limbWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 受击闪烁
    if (fighter.hitStunTimer > 0 && Math.floor(fighter.animFrame) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    const headY = baseY - BODY.headRadius * 2 - BODY.neckLength - BODY.torsoLength;
    const neckY = baseY - BODY.torsoLength;
    const hipY = baseY - BODY.upperLegLength - BODY.lowerLegLength;

    // 头
    ctx.beginPath();
    ctx.arc(cx, headY + BODY.headRadius, BODY.headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 脖子
    ctx.beginPath();
    ctx.moveTo(cx, headY + BODY.headRadius * 2);
    ctx.lineTo(cx, neckY);
    ctx.stroke();

    // 身体
    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    // 手臂和腿根据动作变化
    const { armAngle1, armAngle2, legAngle1, legAngle2 } = this.getActionAngles(fighter);

    // 左臂
    const shoulderY = neckY + 5;
    const arm1EndX = cx + Math.cos(armAngle1) * BODY.upperArmLength;
    const arm1EndY = shoulderY + Math.sin(armAngle1) * BODY.upperArmLength;
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY);
    ctx.lineTo(arm1EndX, arm1EndY);
    ctx.stroke();

    const arm1HandX = arm1EndX + Math.cos(armAngle1 + 0.5) * BODY.lowerArmLength;
    const arm1HandY = arm1EndY + Math.sin(armAngle1 + 0.5) * BODY.lowerArmLength;
    ctx.beginPath();
    ctx.moveTo(arm1EndX, arm1EndY);
    ctx.lineTo(arm1HandX, arm1HandY);
    ctx.stroke();

    // 右臂
    const arm2EndX = cx + Math.cos(armAngle2) * BODY.upperArmLength;
    const arm2EndY = shoulderY + Math.sin(armAngle2) * BODY.upperArmLength;
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY);
    ctx.lineTo(arm2EndX, arm2EndY);
    ctx.stroke();

    const arm2HandX = arm2EndX + Math.cos(armAngle2 - 0.5) * BODY.lowerArmLength;
    const arm2HandY = arm2EndY + Math.sin(armAngle2 - 0.5) * BODY.lowerArmLength;
    ctx.beginPath();
    ctx.moveTo(arm2EndX, arm2EndY);
    ctx.lineTo(arm2HandX, arm2HandY);
    ctx.stroke();

    // 左腿
    const leg1EndX = cx + Math.cos(legAngle1) * BODY.upperLegLength;
    const leg1EndY = hipY + Math.sin(legAngle1) * BODY.upperLegLength;
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(leg1EndX, leg1EndY);
    ctx.stroke();

    const leg1FootX = leg1EndX + Math.cos(legAngle1 + 0.3) * BODY.lowerLegLength;
    const leg1FootY = leg1EndY + Math.sin(legAngle1 + 0.3) * BODY.lowerLegLength;
    ctx.beginPath();
    ctx.moveTo(leg1EndX, leg1EndY);
    ctx.lineTo(leg1FootX, leg1FootY);
    ctx.stroke();

    // 右腿
    const leg2EndX = cx + Math.cos(legAngle2) * BODY.upperLegLength;
    const leg2EndY = hipY + Math.sin(legAngle2) * BODY.upperLegLength;
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(leg2EndX, leg2EndY);
    ctx.stroke();

    const leg2FootX = leg2EndX + Math.cos(legAngle2 - 0.3) * BODY.lowerLegLength;
    const leg2FootY = leg2EndY + Math.sin(legAngle2 - 0.3) * BODY.lowerLegLength;
    ctx.beginPath();
    ctx.moveTo(leg2EndX, leg2EndY);
    ctx.lineTo(leg2FootX, leg2FootY);
    ctx.stroke();

    ctx.restore();
  }

  // ========== 获取动作角度 ==========
  private getActionAngles(fighter: Fighter): {
    armAngle1: number; armAngle2: number;
    legAngle1: number; legAngle2: number;
  } {
    const dir = fighter.facingRight ? 1 : -1;
    const walkCycle = Math.sin(fighter.animFrame * 2) * 0.4;

    switch (fighter.action) {
      case 'idle':
        return {
          armAngle1: Math.PI * 0.6,
          armAngle2: Math.PI * 0.4,
          legAngle1: Math.PI * 0.55,
          legAngle2: Math.PI * 0.45,
        };
      case 'walk':
        return {
          armAngle1: Math.PI * 0.5 + walkCycle,
          armAngle2: Math.PI * 0.5 - walkCycle,
          legAngle1: Math.PI * 0.5 - walkCycle * 0.8,
          legAngle2: Math.PI * 0.5 + walkCycle * 0.8,
        };
      case 'jump':
        return {
          armAngle1: Math.PI * 0.3,
          armAngle2: Math.PI * 0.7,
          legAngle1: Math.PI * 0.3,
          legAngle2: Math.PI * 0.7,
        };
      case 'punch': {
        const punchExtend = dir > 0 ? 0 : Math.PI;
        return {
          armAngle1: Math.PI * 0.6,
          armAngle2: punchExtend,
          legAngle1: Math.PI * 0.55,
          legAngle2: Math.PI * 0.45,
        };
      }
      case 'kick': {
        const kickExtend = dir > 0 ? Math.PI * 0.1 : Math.PI * 0.9;
        return {
          armAngle1: Math.PI * 0.7,
          armAngle2: Math.PI * 0.3,
          legAngle1: Math.PI * 0.5,
          legAngle2: kickExtend,
        };
      }
      case 'block':
        return {
          armAngle1: Math.PI * 0.3,
          armAngle2: Math.PI * 0.7,
          legAngle1: Math.PI * 0.55,
          legAngle2: Math.PI * 0.45,
        };
      case 'hit':
        return {
          armAngle1: Math.PI * 0.7,
          armAngle2: Math.PI * 0.8,
          legAngle1: Math.PI * 0.5,
          legAngle2: Math.PI * 0.6,
        };
      default:
        return {
          armAngle1: Math.PI * 0.5,
          armAngle2: Math.PI * 0.5,
          legAngle1: Math.PI * 0.5,
          legAngle2: Math.PI * 0.5,
        };
    }
  }

  // ========== 绘制受击效果 ==========
  private drawHitEffects(ctx: CanvasRenderingContext2D): void {
    [this.p1, this.p2].forEach(f => {
      if (f.hitEffectTimer > 0) {
        const alpha = f.hitEffectTimer / 200;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = COLORS.hitEffect;
        ctx.lineWidth = 2;
        const size = 10 + (1 - alpha) * 20;
        // 星形效果
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + (1 - alpha) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(f.hitEffectX, f.hitEffectY);
          ctx.lineTo(
            f.hitEffectX + Math.cos(angle) * size,
            f.hitEffectY + Math.sin(angle) * size
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }

  // ========== 绘制连招 ==========
  private drawCombo(ctx: CanvasRenderingContext2D, fighter: Fighter, x: number, y: number): void {
    if (fighter.comboCount >= 2 && fighter.comboTimer > 0) {
      ctx.fillStyle = COLORS.combo;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${fighter.comboCount} COMBO!`, x, y);
    }
  }

  // ========== 绘制覆盖层 ==========
  private drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2);
    ctx.restore();
  }

  // ========== 获取状态 ==========
  getState(): Record<string, unknown> {
    return {
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      roundState: this.roundState,
      currentRound: this.currentRound,
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      isAIMode: this.isAIMode,
    };
  }
}
