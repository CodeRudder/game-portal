import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameType, GameStatus } from '@/types';
import { GameType as GameTypeEnum } from '@/types';
import { TetrisEngine } from '@/games/tetris/TetrisEngine';
import { SnakeEngine } from '@/games/snake/SnakeEngine';
import { SokobanEngine } from '@/games/sokoban/SokobanEngine';
import { FlappyBirdEngine } from '@/games/flappy-bird/FlappyBirdEngine';
import { G2048Engine } from '@/games/g2048/G2048Engine';
import { MemoryMatchEngine } from '@/games/memory-match/MemoryMatchEngine';
import { TicTacToeEngine } from '@/games/tic-tac-toe/TicTacToeEngine';
import { GameOfLifeEngine } from '@/games/game-of-life/GameOfLifeEngine';
import { MinesweeperEngine } from '@/games/minesweeper/MinesweeperEngine';
import { GomokuEngine } from '@/games/gomoku/GomokuEngine';
import { DinoRunnerEngine } from '@/games/dino-runner/DinoRunnerEngine';
import { TronEngine } from '@/games/tron/TronEngine';
import { PipeManiaEngine } from '@/games/pipe-mania/PipeManiaEngine';
import { BreakoutEngine } from '@/games/breakout/BreakoutEngine';
import { PacmanEngine } from '@/games/pacman/PacmanEngine';
import { SpaceInvadersEngine } from '@/games/space-invaders/SpaceInvadersEngine';
import { OthelloEngine } from '@/games/othello/OthelloEngine';
import { CheckersEngine } from '@/games/checkers/CheckersEngine';
import { RecordService, HighScoreService } from '@/services/StorageService';

interface Props {
  gameType: GameType;
  onStatusChange?: (status: GameStatus) => void;
}

function createEngine(type: GameType) {
  switch (type) {
    case GameTypeEnum.TETRIS: return new TetrisEngine();
    case GameTypeEnum.SNAKE: return new SnakeEngine();
    case GameTypeEnum.SOKOBAN: return new SokobanEngine();
    case GameTypeEnum.FLAPPY_BIRD: return new FlappyBirdEngine();
    case GameTypeEnum.G2048: return new G2048Engine();
    case GameTypeEnum.MEMORY_MATCH: return new MemoryMatchEngine();
    case GameTypeEnum.TIC_TAC_TOE: return new TicTacToeEngine();
    case GameTypeEnum.GAME_OF_LIFE: return new GameOfLifeEngine();
    case GameTypeEnum.MINESWEEPER: return new MinesweeperEngine();
    case GameTypeEnum.GOMOKU: return new GomokuEngine();
    case GameTypeEnum.DINO_RUNNER: return new DinoRunnerEngine();
    case GameTypeEnum.TRON: return new TronEngine();
    case GameTypeEnum.PIPE_MANIA: return new PipeManiaEngine();
    case GameTypeEnum.BREAKOUT: return new BreakoutEngine();
    case GameTypeEnum.PACMAN: return new PacmanEngine();
    case GameTypeEnum.SPACE_INVADERS: return new SpaceInvadersEngine();
    case GameTypeEnum.OTHELLO: return new OthelloEngine();
    case GameTypeEnum.CHECKERS: return new CheckersEngine();
    default: throw new Error(`Unknown game type: ${type}`);
  }
}

export default function GameContainer({ gameType, onStatusChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [showOverlay, setShowOverlay] = useState<'start' | 'paused' | 'gameover' | null>('start');
  const [isWin, setIsWin] = useState(false);
  // Sokoban 专用状态
  const [moveCount, setMoveCount] = useState(0);
  const [sokobanLevel, setSokobanLevel] = useState(1);
  const [sokobanTotal, setSokobanTotal] = useState(0);

  const BASE_W = 480;
  const BASE_H = 640;

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createEngine(gameType);
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
          metadata: eng.getState(),
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
    return () => engine.destroy();
  }, [gameType]);

  // 键盘
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

  // 点击/触摸（Flappy Bird 等需要点击的游戏）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (e: Event) => {
      e.preventDefault();
      if (!engineRef.current) return;
      if (gameType === GameTypeEnum.FLAPPY_BIRD) {
        (engineRef.current as FlappyBirdEngine).flap();
      } else if (gameType === GameTypeEnum.MEMORY_MATCH) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if (e instanceof TouchEvent) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as MouseEvent).clientX;
          clientY = (e as MouseEvent).clientY;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        (engineRef.current as MemoryMatchEngine).handleClick(canvasX, canvasY);
      } else if (gameType === GameTypeEnum.GAME_OF_LIFE) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if (e instanceof TouchEvent) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as MouseEvent).clientX;
          clientY = (e as MouseEvent).clientY;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        (engineRef.current as GameOfLifeEngine).handleClick(canvasX, canvasY);
      } else if (gameType === GameTypeEnum.MINESWEEPER) {
        // 扫雷：左键揭开，右键标旗（click 事件不含右键，由 contextmenu 处理）
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const me = e as MouseEvent;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (me.clientX - rect.left) * scaleX;
        const canvasY = (me.clientY - rect.top) * scaleY;
        (engineRef.current as MinesweeperEngine).handleClick(canvasX, canvasY, false);
      } else if (gameType === GameTypeEnum.GOMOKU) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if (e instanceof TouchEvent) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as MouseEvent).clientX;
          clientY = (e as MouseEvent).clientY;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        (engineRef.current as GomokuEngine).handleClick(canvasX, canvasY);
      } else if (gameType === GameTypeEnum.PIPE_MANIA) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if (e instanceof TouchEvent) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as MouseEvent).clientX;
          clientY = (e as MouseEvent).clientY;
        }
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        (engineRef.current as PipeManiaEngine).handleClick(canvasX, canvasY);
      } else if (gameType === GameTypeEnum.DINO_RUNNER) {
        (engineRef.current as DinoRunnerEngine).flap();
      }
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleClick, { passive: false });
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleClick);
    };
  }, [gameType]);

  // 右键事件（扫雷标旗、接水管旋转）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (gameType !== GameTypeEnum.MINESWEEPER && gameType !== GameTypeEnum.PIPE_MANIA) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      if (gameType === GameTypeEnum.MINESWEEPER) {
        (engineRef.current as MinesweeperEngine).handleClick(canvasX, canvasY, true);
      } else if (gameType === GameTypeEnum.PIPE_MANIA) {
        (engineRef.current as PipeManiaEngine).handleRightClick(canvasX, canvasY);
      }
    };

    canvas.addEventListener('contextmenu', handleContextMenu);
    return () => {
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gameType]);

  // 鼠标移动（Game of Life 悬停效果）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameType !== GameTypeEnum.GAME_OF_LIFE) return;
    const engine = engineRef.current as GameOfLifeEngine | null;
    if (!engine) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      engine.handleMouseMove(canvasX, canvasY);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 标记鼠标按下状态用于拖拽
      (engine as any)._isMouseDown = true;
    };

    const handleMouseUp = () => {
      (engine as any)._isMouseDown = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
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
                  {isSokoban && isWin && (engineRef.current as SokobanEngine)?.nextLevel && (
                    <button onClick={() => {
                      (engineRef.current as SokobanEngine).nextLevel!();
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
        {!isSokoban && gameType !== GameTypeEnum.FLAPPY_BIRD && gameType !== GameTypeEnum.DINO_RUNNER && <span>↑↓←→ / WASD 移动</span>}
        {gameType === GameTypeEnum.TETRIS && <span>↑ 旋转 · ↓ 加速 · 空格 硬降</span>}
        {gameType === GameTypeEnum.SNAKE && <span>吃食物增长 · 碰墙或自身结束</span>}
        {isSokoban && <span>方向键移动 · Z 撤销 · R 重置关卡</span>}
        {gameType === GameTypeEnum.FLAPPY_BIRD && <span>点击屏幕 / 空格键 / ↑ 跳跃 · 穿越管道得分</span>}
        {gameType === GameTypeEnum.MEMORY_MATCH && <span>点击卡牌或方向键导航 + 空格翻牌 · 配对越快分越高</span>}
        {gameType === GameTypeEnum.GAME_OF_LIFE && <span>点击放置细胞 · 空格 开始/暂停 · N 单步 · +/- 调速</span>}
        {gameType === GameTypeEnum.MINESWEEPER && <span>点击揭开 · 右键标旗 · 方向键移动 · F 标旗 · 1/2/3 切换难度</span>}
        {gameType === GameTypeEnum.GOMOKU && <span>点击/方向键落子 · T 切换模式 · R 重开</span>}
        {gameType === GameTypeEnum.DINO_RUNNER && <span>空格/↑ 跳跃 · ↓ 下蹲 · 点击屏幕跳跃</span>}
      </div>
    </div>
  );
}
