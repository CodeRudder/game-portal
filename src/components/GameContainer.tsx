/**
 * GameContainer 组件
 *
 * 通用游戏容器，负责：
 * - 创建和管理游戏引擎实例
 * - Canvas 渲染和响应式缩放
 * - 键盘/鼠标/触摸事件分发
 * - HUD 显示（分数、等级、状态）
 * - 游戏叠加层（开始/暂停/结束）
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameType, GameStatus } from '@/types';
import { GameType as GameTypeEnum } from '@/types';
import { createEngine } from '@/games/createEngine';
import type { SokobanEngine } from '@/games/sokoban/SokobanEngine';
import { RecordService, HighScoreService } from '@/services/StorageService';

interface Props {
  gameType: GameType;
  onStatusChange?: (status: GameStatus) => void;
}

export default function GameContainer({ gameType, onStatusChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [showOverlay, setShowOverlay] = useState<'start' | 'paused' | 'gameover' | 'loading' | null>('loading');
  const [isWin, setIsWin] = useState(false);
  // Sokoban 专用状态
  const [moveCount, setMoveCount] = useState(0);
  const [sokobanLevel, setSokobanLevel] = useState(1);
  const [sokobanTotal, setSokobanTotal] = useState(0);

  const BASE_W = 480;
  const BASE_H = 640;

  // 初始化引擎（异步）
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    createEngine(gameType).then((engine: any) => {
      if (cancelled || !canvasRef.current) return;
      engine.setCanvas(canvasRef.current);
      engineRef.current = engine;

      engine.on('statusChange', (s: GameStatus) => {
        setStatus(s);
        onStatusChange?.(s);
        if (s === 'playing') setShowOverlay(null);
        else if (s === 'paused') setShowOverlay('paused');
        else if (s === 'gameover') {
          setShowOverlay('gameover');
          const eng = engineRef.current!;
          const win = (eng as any).isWin ?? false;
          setIsWin(win);
          // 保存记录
          RecordService.add({
            gameType,
            score: eng.score,
            level: eng.level,
            duration: Math.round(eng.elapsedTime),
            isWin: win,
            metadata: eng.getState() as Record<string, unknown>,
          });
          HighScoreService.update(gameType, eng.score);
        }
      });

      engine.on('scoreChange', (v: number) => setScore(v));
      engine.on('levelChange', (v: number) => setLevel(v));

      // Sokoban 专用：监听 move 变化
      if (gameType === GameTypeEnum.SOKOBAN) {
        engine.on('stateChange', () => {
          const sok = engineRef.current as SokobanEngine | null;
          if (sok) {
            setMoveCount(sok.moveCount);
            setSokobanLevel(sok.currentLevelIndex + 1);
            setSokobanTotal(sok.totalLevels);
          }
        });
        // 初始化 Sokoban 状态
        const sok = engine as SokobanEngine;
        setSokobanTotal(sok.totalLevels);
        setSokobanLevel(sok.currentLevelIndex + 1);
      }

      engine.init();
      setShowOverlay('start');
    }).catch((err) => {
      console.error('Failed to load engine:', err);
      setShowOverlay('start');
    });

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [gameType]);

  // 键盘事件
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }
      engineRef.current?.handleKeyDown(e.key);
    };
    const upHandler = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyUp(e.key);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, []);

  // 鼠标/触摸事件统一分发
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvasCoords = (clientX: number, clientY: number): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
    };

    // Click 事件（含触摸）
    const onClick = (e: Event) => {
      e.preventDefault();
      if (!engineRef.current) return;
      let clientX: number, clientY: number;
      if (e instanceof TouchEvent) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      const [canvasX, canvasY] = toCanvasCoords(clientX, clientY);
      engineRef.current.handleClick(canvasX, canvasY);
    };

    // MouseDown 事件
    const onMouseDown = (e: MouseEvent) => {
      if (!engineRef.current) return;
      const [canvasX, canvasY] = toCanvasCoords(e.clientX, e.clientY);
      engineRef.current.handleMouseDown(canvasX, canvasY);
    };

    // MouseUp 事件
    const onMouseUp = (e: MouseEvent) => {
      if (!engineRef.current) return;
      const [canvasX, canvasY] = toCanvasCoords(e.clientX, e.clientY);
      engineRef.current.handleMouseUp(canvasX, canvasY);
    };

    // MouseMove 事件
    const onMouseMove = (e: MouseEvent) => {
      if (!engineRef.current) return;
      const [canvasX, canvasY] = toCanvasCoords(e.clientX, e.clientY);
      engineRef.current.handleMouseMove(canvasX, canvasY);
    };

    // ContextMenu 事件（右键）
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!engineRef.current) return;
      const [canvasX, canvasY] = toCanvasCoords(e.clientX, e.clientY);
      engineRef.current.handleRightClick(canvasX, canvasY);
    };

    // DoubleClick 事件
    const onDoubleClick = (e: MouseEvent) => {
      if (!engineRef.current) return;
      const [canvasX, canvasY] = toCanvasCoords(e.clientX, e.clientY);
      engineRef.current.handleDoubleClick(canvasX, canvasY);
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onClick, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('dblclick', onDoubleClick);
    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onClick);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
    };
  }, [gameType]);

  const start = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (status === 'idle' || status === 'gameover') e.start();
    else if (status === 'paused') e.resume();
  }, [status]);

  const pause = useCallback(() => engineRef.current?.pause(), []);
  const reset = useCallback(() => {
    engineRef.current?.reset();
    setShowOverlay('start');
    setScore(0);
    setLevel(1);
    setMoveCount(0);
  }, []);

  const isSokoban = gameType === GameTypeEnum.SOKOBAN;

  return (
    <div className="relative flex flex-col items-center gap-4 w-full">
      {/* HUD */}
      <div className="flex w-full max-w-[480px] items-center justify-between rounded-xl border border-white/5 bg-gp-card/80 px-3 py-2 backdrop-blur-sm sm:px-4">
        <div className="flex gap-3 text-xs sm:text-sm sm:gap-4">
          <span className="text-gray-400">分数: <span className="font-game text-gp-neon">{score}</span></span>
          <span className="text-gray-400">等级: <span className="font-game text-gp-accent">{level}</span></span>
          {isSokoban && (
            <>
              <span className="text-gray-400">步数: <span className="font-game text-gp-accent">{moveCount}</span></span>
              <span className="text-gray-400">关卡: <span className="font-game text-gp-accent">{sokobanLevel}/{sokobanTotal}</span></span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {status === 'playing' && (
            <button onClick={pause} className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20 transition sm:px-3">⏸ 暂停</button>
          )}
          <button onClick={reset} className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20 transition sm:px-3">🔄 重置</button>
        </div>
      </div>

      {/* Canvas 响应式容器 */}
      <div
        ref={wrapperRef}
        className="relative w-full max-w-[480px] rounded-xl border-2 border-gp-accent/30 bg-[#0d0d20] shadow-lg shadow-gp-accent/10 overflow-hidden"
        style={{ aspectRatio: `${BASE_W} / ${BASE_H}` }}
      >
        <canvas
          ref={canvasRef}
          width={BASE_W}
          height={BASE_H}
          className="block h-full w-full rounded-xl"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* 叠加层 */}
        {showOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm p-4">
            {showOverlay === 'loading' && (
              <>
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gp-accent border-t-transparent" />
                <p className="text-sm text-gray-400">正在加载游戏引擎…</p>
              </>
            )}
            {showOverlay === 'start' && (
              <>
                <div className="mb-2 text-4xl sm:text-5xl">🎮</div>
                <h2 className="font-game mb-4 text-base text-gp-neon neon-text sm:text-lg">准备开始</h2>
                <button onClick={start} className="btn-pulse rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-gp-accent/30 transition hover:shadow-gp-accent/50 sm:px-8 sm:py-3 sm:text-base">
                  开始游戏
                </button>
                <p className="mt-4 text-center text-xs text-gray-500">
                  {isSokoban ? '方向键/WASD 移动 · Z 撤销 · R 重置' : '方向键/WASD 控制 · 空格暂停'}
                </p>
              </>
            )}
            {showOverlay === 'paused' && (
              <>
                <div className="mb-2 text-4xl sm:text-5xl">⏸️</div>
                <h2 className="font-game mb-4 text-base text-gp-accent sm:text-lg">已暂停</h2>
                <button onClick={start} className="btn-pulse rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-2.5 text-sm font-bold text-white shadow-lg sm:px-8 sm:py-3">
                  继续
                </button>
              </>
            )}
            {showOverlay === 'gameover' && (
              <>
                <div className="mb-2 text-4xl sm:text-5xl">{isWin ? '🎉' : '💀'}</div>
                <h2 className="font-game mb-2 text-base sm:text-lg neon-text" style={{ color: isWin ? '#00b894' : '#ff4757' }}>
                  {isWin ? '恭喜通关！' : '游戏结束'}
                </h2>
                <p className="mb-4 text-sm text-gray-400">
                  最终得分: <span className="font-game text-gp-neon">{score}</span>
                </p>
                <div className="flex gap-3">
                  <button onClick={() => { reset(); setTimeout(start, 100); }} className="btn-pulse rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-5 py-2.5 text-sm font-bold text-white shadow-lg sm:px-6 sm:py-3">
                    再来一局
                  </button>
                  {isSokoban && isWin && (engineRef.current as any)?.nextLevel && (
                    <button onClick={() => {
                      (engineRef.current as any).nextLevel!();
                      setShowOverlay('start');
                      setScore(0);
                      setMoveCount(0);
                    }} className="rounded-xl border border-gp-accent px-5 py-2.5 text-sm font-bold text-gp-accent hover:bg-gp-accent/10 transition sm:px-6 sm:py-3">
                      下一关 →
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 操作提示 */}
      <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-500">
        {!isSokoban && gameType !== GameTypeEnum.FLAPPY_BIRD && gameType !== GameTypeEnum.DINO_RUNNER && gameType !== GameTypeEnum.PINBALL && gameType !== GameTypeEnum.MAHJONG_CONNECT && gameType !== GameTypeEnum.MATCH_3 && gameType !== GameTypeEnum.SUDOKU && <span>↑↓←→ / WASD 移动</span>}
        {gameType === GameTypeEnum.TETRIS && <span>↑ 旋转 · ↓ 加速 · 空格 硬降</span>}
        {gameType === GameTypeEnum.SNAKE && <span>吃食物增长 · 碰墙或自身结束</span>}
        {isSokoban && <span>方向键移动 · Z 撤销 · R 重置关卡</span>}
        {gameType === GameTypeEnum.FLAPPY_BIRD && <span>点击屏幕 / 空格键 / ↑ 跳跃 · 穿越管道得分</span>}
        {gameType === GameTypeEnum.MEMORY_MATCH && <span>点击卡牌或方向键导航 + 空格翻牌 · 配对越快分越高</span>}
        {gameType === GameTypeEnum.GAME_OF_LIFE && <span>点击放置细胞 · 空格 开始/暂停 · N 单步 · +/- 调速</span>}
        {gameType === GameTypeEnum.MINESWEEPER && <span>点击揭开 · 右键标旗 · 方向键移动 · F 标旗 · 1/2/3 切换难度</span>}
        {gameType === GameTypeEnum.GOMOKU && <span>点击/方向键落子 · T 切换模式 · R 重开</span>}
        {gameType === GameTypeEnum.DINO_RUNNER && <span>空格/↑ 跳跃 · ↓ 下蹲 · 点击屏幕跳跃</span>}
        {gameType === GameTypeEnum.PINBALL && <span>Z/← 左挡板 · →/M 右挡板 · 空格 蓄力发射</span>}
        {gameType === GameTypeEnum.MAHJONG_CONNECT && <span>点击选牌配对 · H 提示 · S 洗牌</span>}
        {gameType === GameTypeEnum.MATCH_3 && <span>点击交换宝石 · 方向键移动+空格选择</span>}
        {gameType === GameTypeEnum.SUDOKU && <span>方向键移动 · 1-9 输入 · N 笔记 · H 提示 · Z 撤销</span>}
        {gameType === GameTypeEnum.TETRIS_BATTLE && <span>WASD/方向键 · 空格 硬降 · Q 旋转</span>}
        {gameType === GameTypeEnum.FROGGER && <span>↑↓←→ / WASD 移动 · 穿越车流到达对岸</span>}
        {gameType === GameTypeEnum.PONG && <span>↑↓ / WS 控制挡板 · 先得7分获胜</span>}
        {gameType === GameTypeEnum.CONNECT_FOUR && <span>←→ 选择列 · 空格/↓ 落子 · 四子连线获胜</span>}
        {gameType === GameTypeEnum.LIGHTS_OUT && <span>方向键移动 · 空格切换灯 · 全部熄灭过关</span>}
        {gameType === GameTypeEnum.WHACK_A_MOLE && <span>方向键移动锤子 · 空格敲击 · 打中地鼠得分</span>}
      </div>
    </div>
  );
}
