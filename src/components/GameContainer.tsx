import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameType, GameStatus } from '@/types';
import { GameType as GameTypeEnum } from '@/types';
import { TetrisEngine } from '@/games/tetris/TetrisEngine';
import { SnakeEngine } from '@/games/snake/SnakeEngine';
import { SokobanEngine } from '@/games/sokoban/SokobanEngine';
import { FlappyBirdEngine } from '@/games/flappy-bird/FlappyBirdEngine';
import { G2048Engine } from '@/games/g2048/G2048Engine';
import { TicTacToeEngine } from '@/games/tic-tac-toe/TicTacToeEngine';
import { TronEngine } from '@/games/tron/TronEngine';
import { BreakoutEngine } from '@/games/breakout/BreakoutEngine';
import { PacmanEngine } from '@/games/pacman/PacmanEngine';
import { SpaceInvadersEngine } from '@/games/space-invaders/SpaceInvadersEngine';
import { OthelloEngine } from '@/games/othello/OthelloEngine';
import { CheckersEngine } from '@/games/checkers/CheckersEngine';
import { PinballEngine } from '@/games/pinball/PinballEngine';
import { TetrisBattleEngine } from '@/games/tetris-battle/TetrisBattleEngine';
import { FroggerEngine } from '@/games/frogger/FroggerEngine';
import { PongEngine } from '@/games/pong/PongEngine';
import { ConnectFourEngine } from '@/games/connect-four/ConnectFourEngine';
import { LightsOutEngine } from '@/games/lights-out/LightsOutEngine';
import { WhackAMoleEngine } from '@/games/whack-a-mole/WhackAMoleEngine';
import { KlotskiEngine } from '@/games/klotski/KlotskiEngine';
import { SolitaireEngine } from '@/games/solitaire/SolitaireEngine';
import { AsteroidsEngine } from '@/games/asteroids/AsteroidsEngine';
import { AirHockeyEngine } from '@/games/air-hockey/AirHockeyEngine';
import { FruitNinjaEngine } from '@/games/fruit-ninja/FruitNinjaEngine';
import { GalagaEngine } from '@/games/galaga/GalagaEngine';
import { BubbleShooterEngine } from '@/games/bubble-shooter/BubbleShooterEngine';
import { Snake2PEngine } from '@/games/snake-2p/Snake2PEngine';
import { MancalaEngine } from '@/games/mancala/MancalaEngine';
import { EightQueensEngine } from '@/games/eight-queens/EightQueensEngine';
import { CentipedeEngine } from '@/games/centipede/CentipedeEngine';
import { MissileCommandEngine } from '@/games/missile-command/MissileCommandEngine';
import { LunarLanderEngine } from '@/games/lunar-lander/LunarLanderEngine';
import { SliderPuzzleEngine } from '@/games/slider-puzzle/SliderPuzzleEngine';
import { TowerOfHanoiEngine } from '@/games/tower-of-hanoi/TowerOfHanoiEngine';
import { DonkeyKongEngine } from '@/games/donkey-kong/DonkeyKongEngine';
import { DigDugEngine } from '@/games/dig-dug/DigDugEngine';
import { BattleCityEngine } from '@/games/battle-city/BattleCityEngine';
import { MastermindEngine } from '@/games/mastermind/MastermindEngine';
import { Make24Engine } from '@/games/make-24/Make24Engine';
import { CookieClickerEngine } from '@/games/cookie-clicker/CookieClickerEngine';
import { ReactionTestEngine } from '@/games/reaction-test/ReactionTestEngine';
import { ZumaEngine } from '@/games/zuma/ZumaEngine';
import { PixelArtEngine } from '@/games/pixel-art/PixelArtEngine';
import { SpirographEngine } from '@/games/spirograph/SpirographEngine';
import { WordleEngine } from '@/games/wordle/WordleEngine';
import { GeometryDashEngine } from '@/games/geometry-dash/GeometryDashEngine';
import { FallDownEngine } from '@/games/fall-down/FallDownEngine';
import { CaveFlyerEngine } from '@/games/cave-flyer/CaveFlyerEngine';
import { GravityFlipEngine } from '@/games/gravity-flip/GravityFlipEngine';
import { KnightsTourEngine } from '@/games/knights-tour/KnightsTourEngine';
import { VirtualPetEngine } from '@/games/virtual-pet/VirtualPetEngine';
import { ZTypeEngine } from '@/games/ztype/ZTypeEngine';
import { WaterSortEngine } from '@/games/water-sort/WaterSortEngine';
import { ScrewPuzzleEngine } from '@/games/screw-puzzle/ScrewPuzzleEngine';
import { SandSimulationEngine } from '@/games/sand-simulation/SandSimulationEngine';
import { VideoPokerEngine } from '@/games/video-poker/VideoPokerEngine';
import { BlackjackEngine } from '@/games/blackjack/BlackjackEngine';
import { SpaceDodgeEngine } from '@/games/space-dodge/SpaceDodgeEngine';
import { BalloonPopEngine } from '@/games/balloon-pop/BalloonPopEngine';
import { MiniGoEngine } from '@/games/mini-go/MiniGoEngine';
import { HexEngine } from '@/games/hex/HexEngine';
import { RhythmEngine } from '@/games/rhythm/RhythmEngine';
import { DoodleGodEngine } from '@/games/doodle-god/DoodleGodEngine';
import { SlitherIoEngine } from '@/games/slither-io/SlitherIoEngine';
import { ChessEngine } from '@/games/chess/ChessEngine';
import { StickFighterEngine } from '@/games/stick-fighter/StickFighterEngine';
import { FreeCellEngine } from '@/games/freecell/FreeCellEngine';
import { FoldPuzzleEngine } from '@/games/fold-puzzle/FoldPuzzleEngine';
import { SlopeBallEngine } from '@/games/slope-ball/SlopeBallEngine';
import { TankDuelEngine } from '@/games/tank-duel/TankDuelEngine';
import { ChineseChessEngine } from '@/games/chinese-chess/ChineseChessEngine';
import { TempleRunEngine } from '@/games/temple-run/TempleRunEngine';
import { SenetEngine } from '@/games/senet/SenetEngine';
import { BasketballHoopsEngine } from '@/games/basketball-hoops/BasketballHoopsEngine';
import { FlappyPlaneEngine } from '@/games/flappy-plane/FlappyPlaneEngine';
import { JigsawPuzzleEngine } from '@/games/jigsaw-puzzle/JigsawPuzzleEngine';
import { BloonsEngine } from '@/games/bloons/BloonsEngine';
import { CTFEngine } from '@/games/ctf/CTFEngine';
import { BackgammonEngine } from '@/games/backgammon/BackgammonEngine';
import { Pong2PEngine } from '@/games/pong-2p/Pong2PEngine';
import { HeadSoccerEngine } from '@/games/head-soccer/HeadSoccerEngine';
import { MahjongSolitaireEngine } from '@/games/mahjong-solitaire/MahjongSolitaireEngine';
import { SpaceWarEngine } from '@/games/space-war/SpaceWarEngine';
import { DuckHuntEngine } from '@/games/duck-hunt/DuckHuntEngine';
import { FishingMasterEngine } from '@/games/fishing-master/FishingMasterEngine';
import { NinjaJumpEngine } from '@/games/ninja-jump/NinjaJumpEngine';
import { NonogramEngine } from '@/games/nonogram/NonogramEngine';
import { SkiFreeEngine } from '@/games/ski-free/SkiFreeEngine';
import { ChipsChallengeEngine } from '@/games/chips-challenge/ChipsChallengeEngine';
import { DotsAndBoxesEngine } from '@/games/dots-and-boxes/DotsAndBoxesEngine';
import { MazeEngine } from '@/games/maze/MazeEngine';
import { DoggoHomeEngine } from '@/games/doggo-home/DoggoHomeEngine';
import { KittensKingdomEngine } from '@/games/kittens-kingdom/KittensKingdomEngine';
import { PenguinEmpireEngine } from '@/games/penguin-empire/PenguinEmpireEngine';
import { AntKingdomEngine } from '@/games/ant-kingdom/AntKingdomEngine';
import { DinoRanchEngine } from '@/games/dino-ranch/DinoRanchEngine';
import { IdleXianxiaEngine } from '@/games/idle-xianxia/IdleXianxiaEngine';
import { SectRiseEngine } from '@/games/sect-rise/SectRiseEngine';
import { AlchemyMasterEngine } from '@/games/alchemy-master/AlchemyMasterEngine';
import { CivBabylonEngine } from '@/games/civ-babylon/CivBabylonEngine';
import { CivChinaEngine } from '@/games/civ-china/CivChinaEngine';
import { CivEgyptEngine } from '@/games/civ-egypt/CivEgyptEngine';
import { CivIndiaEngine } from '@/games/civ-india/CivIndiaEngine';
import { ClanSagaEngine } from '@/games/clan-saga/ClanSagaEngine';
import { DoomsdayEngine } from '@/games/doomsday/DoomsdayEngine';
import { DungeonExploreEngine } from '@/games/dungeon-explore/DungeonExploreEngine';
import { IslandDriftEngine } from '@/games/island-drift/IslandDriftEngine';
import { ModernCityEngine } from '@/games/modern-city/ModernCityEngine';
import { SpaceDriftEngine } from '@/games/space-drift/SpaceDriftEngine';
import { TribulationEngine } from '@/games/tribulation/TribulationEngine';
import { WildSurvivalEngine } from '@/games/wild-survival/WildSurvivalEngine';
import { MemoryMatchEngine } from '@/games/memory-match/MemoryMatchEngine';
import { GameOfLifeEngine } from '@/games/game-of-life/GameOfLifeEngine';
import { MinesweeperEngine } from '@/games/minesweeper/MinesweeperEngine';
import { GomokuEngine } from '@/games/gomoku/GomokuEngine';
import { DinoRunnerEngine } from '@/games/dino-runner/DinoRunnerEngine';
import { PipeManiaEngine } from '@/games/pipe-mania/PipeManiaEngine';
import { MahjongConnectEngine } from '@/games/mahjong-connect/MahjongConnectEngine';
import { Match3Engine } from '@/games/match-3/Match3Engine';
import { SudokuEngine } from '@/games/sudoku/SudokuEngine';
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
    case GameTypeEnum.PINBALL: return new PinballEngine();
    case GameTypeEnum.MAHJONG_CONNECT: return new MahjongConnectEngine();
    case GameTypeEnum.MATCH_3: return new Match3Engine();
    case GameTypeEnum.SUDOKU: return new SudokuEngine();
    case GameTypeEnum.TETRIS_BATTLE: return new TetrisBattleEngine();
    case GameTypeEnum.FROGGER: return new FroggerEngine();
    case GameTypeEnum.PONG: return new PongEngine();
    case GameTypeEnum.CONNECT_FOUR: return new ConnectFourEngine();
    case GameTypeEnum.LIGHTS_OUT: return new LightsOutEngine();
    case GameTypeEnum.WHACK_A_MOLE: return new WhackAMoleEngine();
    case GameTypeEnum.KLOTSKI: return new KlotskiEngine();
    case GameTypeEnum.SOLITAIRE: return new SolitaireEngine();
    case GameTypeEnum.ASTEROIDS: return new AsteroidsEngine();
    case GameTypeEnum.AIR_HOCKEY: return new AirHockeyEngine();
    case GameTypeEnum.FRUIT_NINJA: return new FruitNinjaEngine();
    case GameTypeEnum.GALAGA: return new GalagaEngine();
    case GameTypeEnum.BUBBLE_SHOOTER: return new BubbleShooterEngine();
    case GameTypeEnum.SNAKE_2P: return new Snake2PEngine();
    case GameTypeEnum.MANCALA: return new MancalaEngine();
    case GameTypeEnum.EIGHT_QUEENS: return new EightQueensEngine();
    case GameTypeEnum.CENTIPEDE: return new CentipedeEngine();
    case GameTypeEnum.MISSILE_COMMAND: return new MissileCommandEngine();
    case GameTypeEnum.LUNAR_LANDER: return new LunarLanderEngine();
    case GameTypeEnum.SLIDER_PUZZLE: return new SliderPuzzleEngine();
    case GameTypeEnum.TOWER_OF_HANOI: return new TowerOfHanoiEngine();
    case GameTypeEnum.DONKEY_KONG: return new DonkeyKongEngine();
    case GameTypeEnum.DIG_DUG: return new DigDugEngine();
    case GameTypeEnum.BATTLE_CITY: return new BattleCityEngine();
    case GameTypeEnum.MASTERMIND: return new MastermindEngine();
    case GameTypeEnum.MAKE_24: return new Make24Engine();
    case GameTypeEnum.COOKIE_CLICKER: return new CookieClickerEngine();
    case GameTypeEnum.REACTION_TEST: return new ReactionTestEngine();
    case GameTypeEnum.ZUMA: return new ZumaEngine();
    case GameTypeEnum.PIXEL_ART: return new PixelArtEngine();
    case GameTypeEnum.SPIROGRAPH: return new SpirographEngine();
    case GameTypeEnum.WORDLE: return new WordleEngine();
    case GameTypeEnum.GEOMETRY_DASH: return new GeometryDashEngine();
    case GameTypeEnum.FALL_DOWN: return new FallDownEngine();
    case GameTypeEnum.CAVE_FLYER: return new CaveFlyerEngine();
    case GameTypeEnum.GRAVITY_FLIP: return new GravityFlipEngine();
    case GameTypeEnum.KNIGHTS_TOUR: return new KnightsTourEngine();
    case GameTypeEnum.VIRTUAL_PET: return new VirtualPetEngine();
    case GameTypeEnum.ZTYPE: return new ZTypeEngine();
    case GameTypeEnum.WATER_SORT: return new WaterSortEngine();
    case GameTypeEnum.SCREW_PUZZLE: return new ScrewPuzzleEngine();
    case GameTypeEnum.SAND_SIMULATION: return new SandSimulationEngine();
    case GameTypeEnum.VIDEO_POKER: return new VideoPokerEngine();
    case GameTypeEnum.BLACKJACK: return new BlackjackEngine();
    case GameTypeEnum.SPACE_DODGE: return new SpaceDodgeEngine();
    case GameTypeEnum.BALLOON_POP: return new BalloonPopEngine();
    case GameTypeEnum.MINI_GO: return new MiniGoEngine();
    case GameTypeEnum.HEX: return new HexEngine();
    case GameTypeEnum.RHYTHM: return new RhythmEngine();
    case GameTypeEnum.DOODLE_GOD: return new DoodleGodEngine();
    case GameTypeEnum.SLITHER_IO: return new SlitherIoEngine();
    case GameTypeEnum.CHESS: return new ChessEngine();
    case GameTypeEnum.STICK_FIGHTER: return new StickFighterEngine();
    case GameTypeEnum.FREECELL: return new FreeCellEngine();
    case GameTypeEnum.FOLD_PUZZLE: return new FoldPuzzleEngine();
    case GameTypeEnum.SLOPE_BALL: return new SlopeBallEngine();
    case GameTypeEnum.TANK_DUEL: return new TankDuelEngine();
    case GameTypeEnum.CHINESE_CHESS: return new ChineseChessEngine();
    case GameTypeEnum.TEMPLE_RUN: return new TempleRunEngine();
    case GameTypeEnum.SENET: return new SenetEngine();
    case GameTypeEnum.BASKETBALL_HOOPS: return new BasketballHoopsEngine();
    case GameTypeEnum.FLAPPY_PLANE: return new FlappyPlaneEngine();
    case GameTypeEnum.JIGSAW_PUZZLE: return new JigsawPuzzleEngine();
    case GameTypeEnum.BLOONS: return new BloonsEngine();
    case GameTypeEnum.CTF: return new CTFEngine();
    case GameTypeEnum.BACKGAMMON: return new BackgammonEngine();
    case GameTypeEnum.PONG_2P: return new Pong2PEngine();
    case GameTypeEnum.HEAD_SOCCER: return new HeadSoccerEngine();
    case GameTypeEnum.MAHJONG_SOLITAIRE: return new MahjongSolitaireEngine();
    case GameTypeEnum.SPACE_WAR: return new SpaceWarEngine();
    case GameTypeEnum.DUCK_HUNT: return new DuckHuntEngine();
    case GameTypeEnum.FISHING_MASTER: return new FishingMasterEngine();
    case GameTypeEnum.NINJA_JUMP: return new NinjaJumpEngine();
    case GameTypeEnum.NONOGRAM: return new NonogramEngine();
    case GameTypeEnum.SKI_FREE: return new SkiFreeEngine();
    case GameTypeEnum.CHIPS_CHALLENGE: return new ChipsChallengeEngine();
    case GameTypeEnum.DOTS_AND_BOXES: return new DotsAndBoxesEngine();
    case GameTypeEnum.MAZE: return new MazeEngine();
    case GameTypeEnum.DOGGO_HOME: return new DoggoHomeEngine();
    case GameTypeEnum.KITTENS_KINGDOM: return new KittensKingdomEngine();
    case GameTypeEnum.PENGUIN_EMPIRE: return new PenguinEmpireEngine();
    case GameTypeEnum.ANT_KINGDOM: return new AntKingdomEngine();
    case GameTypeEnum.DINO_RANCH: return new DinoRanchEngine();
    case GameTypeEnum.IDLE_XIANXIA: return new IdleXianxiaEngine();
    case GameTypeEnum.SECT_RISE: return new SectRiseEngine();
    case GameTypeEnum.ALCHEMY_MASTER: return new AlchemyMasterEngine();
    case GameTypeEnum.CIV_BABYLON: return new CivBabylonEngine();
    case GameTypeEnum.CIV_CHINA: return new CivChinaEngine();
    case GameTypeEnum.CIV_EGYPT: return new CivEgyptEngine();
    case GameTypeEnum.CIV_INDIA: return new CivIndiaEngine();
    case GameTypeEnum.CLAN_SAGA: return new ClanSagaEngine();
    case GameTypeEnum.DOOMSDAY: return new DoomsdayEngine();
    case GameTypeEnum.DUNGEON_EXPLORE: return new DungeonExploreEngine();
    case GameTypeEnum.ISLAND_DRIFT: return new IslandDriftEngine();
    case GameTypeEnum.MODERN_CITY: return new ModernCityEngine();
    case GameTypeEnum.SPACE_DRIFT: return new SpaceDriftEngine();
    case GameTypeEnum.TRIBULATION: return new TribulationEngine();
    case GameTypeEnum.WILD_SURVIVAL: return new WildSurvivalEngine();
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
