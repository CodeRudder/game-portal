import { vi } from 'vitest';
import { SpaceInvadersEngine } from '@/games/space-invaders/SpaceInvadersEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  SHIP_WIDTH, SHIP_SPEED, SHIP_Y,
  BULLET_SPEED, MAX_BULLETS,
  ALIEN_ROWS, ALIEN_COLS, ALIEN_SPEED_BASE, ALIEN_SPEED_INCREASE,
  ALIEN_SCORES, ALIEN_DROP,
  BUNKER_COUNT, BUNKER_BLOCK_SIZE,
  INITIAL_LIVES,
} from '@/games/space-invaders/constants';

const mockCtx = {
  fillRect: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  strokeRect: vi.fn(), stroke: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
};

const mockCanvas = {
  width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
  getContext: vi.fn(() => mockCtx),
} as unknown as HTMLCanvasElement;

function createEngine(): SpaceInvadersEngine {
  const engine = new SpaceInvadersEngine();
  engine.init(mockCanvas);
  return engine;
}

describe('SpaceInvadersEngine', () => {
  describe('初始化', () => {
    it('init 后状态为 idle', () => expect(createEngine().status).toBe('idle'));
    it('init 后分数为 0', () => expect(createEngine().score).toBe(0));
    it('init 后等级为 1', () => expect(createEngine().level).toBe(1));
    it('init 后生命数正确', () => expect(createEngine().lives).toBe(INITIAL_LIVES));
    it('飞船居中', () => {
      expect(createEngine().shipX).toBe((CANVAS_WIDTH - SHIP_WIDTH) / 2);
    });
    it('外星人数量正确', () => {
      expect(createEngine().aliensAlive).toBe(ALIEN_ROWS * ALIEN_COLS);
    });
    it('外星人阵列正确', () => {
      const engine = createEngine();
      expect(engine.aliens.length).toBe(ALIEN_ROWS * ALIEN_COLS);
    });
    it('所有外星人初始 alive', () => {
      const engine = createEngine();
      expect(engine.aliens.every(a => a.alive)).toBe(true);
    });
    it('外星人分数按行分配', () => {
      const engine = createEngine();
      expect(engine.aliens[0].score).toBe(ALIEN_SCORES[0]);
      expect(engine.aliens[ALIEN_COLS * 4].score).toBe(ALIEN_SCORES[4]);
    });
    it('初始无子弹', () => expect(createEngine().bullets.length).toBe(0));
    it('初始外星人方向为右', () => expect(createEngine().alienDir).toBe(1));
  });

  describe('游戏状态', () => {
    it('start 后 playing', () => { const e = createEngine(); e.start(); expect(e.status).toBe('playing'); });
    it('pause 后 paused', () => { const e = createEngine(); e.start(); e.pause(); expect(e.status).toBe('paused'); });
    it('resume 后 playing', () => { const e = createEngine(); e.start(); e.pause(); e.resume(); expect(e.status).toBe('playing'); });
    it('reset 后 idle', () => { const e = createEngine(); e.start(); e.reset(); expect(e.status).toBe('idle'); });
  });

  describe('飞船移动', () => {
    it('按左键飞船左移', () => {
      const e = createEngine(); e.start();
      const before = e.shipX;
      e.handleKeyDown('ArrowLeft');
      e.update(16);
      expect(e.shipX).toBeLessThan(before);
    });
    it('按右键飞船右移', () => {
      const e = createEngine(); e.start();
      const before = e.shipX;
      e.handleKeyDown('ArrowRight');
      e.update(16);
      expect(e.shipX).toBeGreaterThan(before);
    });
    it('A/D 键也可移动', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown('a');
      e.update(16);
      expect(e.shipX).toBeLessThan((CANVAS_WIDTH - SHIP_WIDTH) / 2);
    });
    it('飞船不超出左边界', () => {
      const e = createEngine(); e.start();
      (e as any)._shipX = 0;
      e.handleKeyDown('ArrowLeft');
      e.update(16);
      expect(e.shipX).toBeGreaterThanOrEqual(0);
    });
    it('飞船不超出右边界', () => {
      const e = createEngine(); e.start();
      (e as any)._shipX = CANVAS_WIDTH - SHIP_WIDTH;
      e.handleKeyDown('ArrowRight');
      e.update(16);
      expect(e.shipX).toBeLessThanOrEqual(CANVAS_WIDTH - SHIP_WIDTH);
    });
  });

  describe('射击', () => {
    it('空格键发射子弹', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      expect(e.bullets.length).toBe(1);
      expect(e.bullets[0].isAlien).toBe(false);
    });
    it('子弹向上移动', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      const startY = e.bullets[0].y;
      e.update(16);
      expect(e.bullets[0].y).toBeLessThan(startY);
    });
    it('子弹速度正确', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      expect(Math.abs(e.bullets[0].dy)).toBe(BULLET_SPEED);
    });
    it('最多 MAX_BULLETS 发子弹', () => {
      const e = createEngine(); e.start();
      (e as any)._shootCooldown = 0;
      for (let i = 0; i < MAX_BULLETS + 2; i++) e.handleKeyDown(' ');
      const playerBullets = e.bullets.filter(b => !b.isAlien);
      expect(playerBullets.length).toBeLessThanOrEqual(MAX_BULLETS);
    });
    it('子弹飞出屏幕消失', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      (e as any)._bullets[0].y = HUD_HEIGHT - 10;
      e.update(16);
      expect(e.bullets.filter(b => !b.isAlien).length).toBe(0);
    });
  });

  describe('外星人', () => {
    it('外星人左右移动', () => {
      const e = createEngine(); e.start();
      const startX = e.aliens[0].x;
      e.update(100);
      expect(e.aliens[0].x).not.toBe(startX);
    });
    it('击杀外星人得分', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      // Place bullet on first alien
      const alien = e.aliens[0];
      (e as any)._bullets[0].x = alien.x + 5;
      (e as any)._bullets[0].y = alien.y + 5;
      e.update(16);
      expect(e.score).toBe(alien.score);
    });
    it('击杀外星人后 aliensAlive 减少', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      const alien = e.aliens[0];
      (e as any)._bullets[0].x = alien.x + 5;
      (e as any)._bullets[0].y = alien.y + 5;
      const before = e.aliensAlive;
      e.update(16);
      expect(e.aliensAlive).toBe(before - 1);
    });
    it('击杀外星人后速度增加', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      const alien = e.aliens[0];
      (e as any)._bullets[0].x = alien.x + 5;
      (e as any)._bullets[0].y = alien.y + 5;
      e.update(16);
      expect((e as any)._alienSpeed).toBeGreaterThan(ALIEN_SPEED_BASE);
    });
    it('外星人到达底部 game over', () => {
      const e = createEngine(); e.start();
      // Move alien to bottom
      e.aliens[0].y = SHIP_Y - 5;
      e.update(16);
      expect(e.status).toBe('gameover');
    });
    it('消灭所有外星人进入下一关', () => {
      const e = createEngine(); e.start();
      for (const a of e.aliens) a.alive = false;
      (e as any)._aliensAlive = 0;
      e.update(16);
      expect(e.level).toBe(2);
    });
  });

  describe('掩体', () => {
    it('掩体数量正确', () => {
      const e = createEngine();
      expect(e.bullets).toBeDefined();
      // bunkers is private, check via internal
      expect((e as any)._bunkers.length).toBe(BUNKER_COUNT);
    });
    it('掩体被子弹摧毁', () => {
      const e = createEngine(); e.start();
      e.handleKeyDown(' ');
      // Place bullet on a bunker block
      const block = (e as any)._bunkers[0].find((b: any) => b.alive);
      (e as any)._bullets[0].x = block.x;
      (e as any)._bullets[0].y = block.y;
      e.update(16);
      expect(block.alive).toBe(false);
    });
  });

  describe('生命与 game over', () => {
    it('被外星人子弹击中失去生命', () => {
      const e = createEngine(); e.start();
      (e as any)._bullets.push({
        x: e.shipX + SHIP_WIDTH / 2,
        y: SHIP_Y - 5,
        dy: BULLET_SPEED * 0.7,
        isAlien: true,
        alive: true,
      });
      const before = e.lives;
      e.update(16);
      expect(e.lives).toBeLessThan(before);
    });
    it('3 次被击中 game over', () => {
      const e = createEngine(); e.start();
      for (let i = 0; i < INITIAL_LIVES; i++) {
        (e as any)._bullets = [];
        (e as any)._bullets.push({
          x: e.shipX + SHIP_WIDTH / 2,
          y: SHIP_Y - 5,
          dy: BULLET_SPEED * 0.7,
          isAlien: true,
          alive: true,
        });
        e.update(16);
      }
      expect(e.status).toBe('gameover');
    });
  });

  describe('事件', () => {
    it('start 触发 statusChange', () => {
      const e = createEngine();
      const h = vi.fn(); e.on('statusChange', h);
      e.start();
      expect(h).toHaveBeenCalledWith('playing');
    });
    it('失去生命触发 loseLife', () => {
      const e = createEngine(); e.start();
      const h = vi.fn(); e.on('loseLife', h);
      (e as any)._bullets.push({
        x: e.shipX + SHIP_WIDTH / 2, y: SHIP_Y - 5,
        dy: BULLET_SPEED * 0.7, isAlien: true, alive: true,
      });
      e.update(16);
      expect(h).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('返回正确状态', () => {
      const e = createEngine();
      const s = e.getState();
      expect(s.score).toBe(0);
      expect(s.level).toBe(1);
      expect(s.lives).toBe(INITIAL_LIVES);
      expect(s.aliensAlive).toBe(ALIEN_ROWS * ALIEN_COLS);
    });
  });

  describe('重置与销毁', () => {
    it('reset 恢复初始状态', () => {
      const e = createEngine(); e.start();
      e.reset();
      expect(e.status).toBe('idle');
      expect(e.score).toBe(0);
      expect(e.lives).toBe(INITIAL_LIVES);
    });
    it('destroy 清理', () => {
      const e = createEngine(); e.start();
      e.destroy();
      expect(e.status).toBe('idle');
    });
  });
});
