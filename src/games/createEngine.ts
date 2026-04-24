/**
 * 游戏引擎工厂函数（动态 import 版本）
 *
 * 根据游戏类型创建对应的引擎实例。
 * 使用动态 import() 实现按需加载，每个游戏引擎独立 chunk，
 * 避免所有引擎代码打包到同一个 chunk 中。
 *
 * 性能影响：
 * - 首次访问某个游戏时需要额外的网络请求加载对应 chunk
 * - 后续访问同一游戏直接使用缓存，无额外开销
 * - 首屏 bundle 体积大幅减小
 */
import type { GameType } from '@/types';
import { GameType as GameTypeEnum } from '@/types';

/**
 * 引擎动态导入映射表
 *
 * key: GameType 枚举值
 * value: 返回引擎类的动态 import 函数
 *
 * 注意：每个 import() 会被 Vite 自动生成独立 chunk
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENGINE_IMPORTERS: Record<string, () => Promise<any>> = {
  // ── 经典街机 ──
  [GameTypeEnum.TETRIS]: () => import('@/games/tetris/TetrisEngine'),
  [GameTypeEnum.SNAKE]: () => import('@/games/snake/SnakeEngine'),
  [GameTypeEnum.SOKOBAN]: () => import('@/games/sokoban/SokobanEngine'),
  [GameTypeEnum.FLAPPY_BIRD]: () => import('@/games/flappy-bird/FlappyBirdEngine'),
  [GameTypeEnum.G2048]: () => import('@/games/g2048/G2048Engine'),
  [GameTypeEnum.MEMORY_MATCH]: () => import('@/games/memory-match/MemoryMatchEngine'),
  [GameTypeEnum.TIC_TAC_TOE]: () => import('@/games/tic-tac-toe/TicTacToeEngine'),
  [GameTypeEnum.GAME_OF_LIFE]: () => import('@/games/game-of-life/GameOfLifeEngine'),
  [GameTypeEnum.MINESWEEPER]: () => import('@/games/minesweeper/MinesweeperEngine'),
  [GameTypeEnum.GOMOKU]: () => import('@/games/gomoku/GomokuEngine'),
  [GameTypeEnum.DINO_RUNNER]: () => import('@/games/dino-runner/DinoRunnerEngine'),
  [GameTypeEnum.TRON]: () => import('@/games/tron/TronEngine'),
  [GameTypeEnum.PIPE_MANIA]: () => import('@/games/pipe-mania/PipeManiaEngine'),
  [GameTypeEnum.BREAKOUT]: () => import('@/games/breakout/BreakoutEngine'),
  [GameTypeEnum.PACMAN]: () => import('@/games/pacman/PacmanEngine'),
  [GameTypeEnum.SPACE_INVADERS]: () => import('@/games/space-invaders/SpaceInvadersEngine'),
  [GameTypeEnum.OTHELLO]: () => import('@/games/othello/OthelloEngine'),
  [GameTypeEnum.CHECKERS]: () => import('@/games/checkers/CheckersEngine'),
  [GameTypeEnum.PINBALL]: () => import('@/games/pinball/PinballEngine'),
  [GameTypeEnum.MAHJONG_CONNECT]: () => import('@/games/mahjong-connect/MahjongConnectEngine'),
  [GameTypeEnum.MATCH_3]: () => import('@/games/match-3/Match3Engine'),
  [GameTypeEnum.SUDOKU]: () => import('@/games/sudoku/SudokuEngine'),
  [GameTypeEnum.TETRIS_BATTLE]: () => import('@/games/tetris-battle/TetrisBattleEngine'),
  [GameTypeEnum.FROGGER]: () => import('@/games/frogger/FroggerEngine'),
  [GameTypeEnum.PONG]: () => import('@/games/pong/PongEngine'),
  [GameTypeEnum.CONNECT_FOUR]: () => import('@/games/connect-four/ConnectFourEngine'),
  [GameTypeEnum.LIGHTS_OUT]: () => import('@/games/lights-out/LightsOutEngine'),
  [GameTypeEnum.WHACK_A_MOLE]: () => import('@/games/whack-a-mole/WhackAMoleEngine'),
  [GameTypeEnum.KLOTSKI]: () => import('@/games/klotski/KlotskiEngine'),
  [GameTypeEnum.SOLITAIRE]: () => import('@/games/solitaire/SolitaireEngine'),
  [GameTypeEnum.ASTEROIDS]: () => import('@/games/asteroids/AsteroidsEngine'),
  [GameTypeEnum.AIR_HOCKEY]: () => import('@/games/air-hockey/AirHockeyEngine'),
  [GameTypeEnum.FRUIT_NINJA]: () => import('@/games/fruit-ninja/FruitNinjaEngine'),
  [GameTypeEnum.GALAGA]: () => import('@/games/galaga/GalagaEngine'),
  [GameTypeEnum.BUBBLE_SHOOTER]: () => import('@/games/bubble-shooter/BubbleShooterEngine'),
  [GameTypeEnum.SNAKE_2P]: () => import('@/games/snake-2p/Snake2PEngine'),
  [GameTypeEnum.MANCALA]: () => import('@/games/mancala/MancalaEngine'),
  [GameTypeEnum.EIGHT_QUEENS]: () => import('@/games/eight-queens/EightQueensEngine'),
  [GameTypeEnum.CENTIPEDE]: () => import('@/games/centipede/CentipedeEngine'),
  [GameTypeEnum.MISSILE_COMMAND]: () => import('@/games/missile-command/MissileCommandEngine'),
  [GameTypeEnum.LUNAR_LANDER]: () => import('@/games/lunar-lander/LunarLanderEngine'),
  [GameTypeEnum.SLIDER_PUZZLE]: () => import('@/games/slider-puzzle/SliderPuzzleEngine'),
  [GameTypeEnum.TOWER_OF_HANOI]: () => import('@/games/tower-of-hanoi/TowerOfHanoiEngine'),
  [GameTypeEnum.DONKEY_KONG]: () => import('@/games/donkey-kong/DonkeyKongEngine'),
  [GameTypeEnum.DIG_DUG]: () => import('@/games/dig-dug/DigDugEngine'),
  [GameTypeEnum.BATTLE_CITY]: () => import('@/games/battle-city/BattleCityEngine'),
  [GameTypeEnum.MASTERMIND]: () => import('@/games/mastermind/MastermindEngine'),
  [GameTypeEnum.MAKE_24]: () => import('@/games/make-24/Make24Engine'),
  [GameTypeEnum.COOKIE_CLICKER]: () => import('@/games/cookie-clicker/CookieClickerEngine'),
  [GameTypeEnum.REACTION_TEST]: () => import('@/games/reaction-test/ReactionTestEngine'),
  [GameTypeEnum.ZUMA]: () => import('@/games/zuma/ZumaEngine'),
  [GameTypeEnum.PIXEL_ART]: () => import('@/games/pixel-art/PixelArtEngine'),
  [GameTypeEnum.SPIROGRAPH]: () => import('@/games/spirograph/SpirographEngine'),
  [GameTypeEnum.WORDLE]: () => import('@/games/wordle/WordleEngine'),
  [GameTypeEnum.GEOMETRY_DASH]: () => import('@/games/geometry-dash/GeometryDashEngine'),
  [GameTypeEnum.FALL_DOWN]: () => import('@/games/fall-down/FallDownEngine'),
  [GameTypeEnum.CAVE_FLYER]: () => import('@/games/cave-flyer/CaveFlyerEngine'),
  [GameTypeEnum.GRAVITY_FLIP]: () => import('@/games/gravity-flip/GravityFlipEngine'),
  [GameTypeEnum.KNIGHTS_TOUR]: () => import('@/games/knights-tour/KnightsTourEngine'),
  [GameTypeEnum.VIRTUAL_PET]: () => import('@/games/virtual-pet/VirtualPetEngine'),
  [GameTypeEnum.ZTYPE]: () => import('@/games/ztype/ZTypeEngine'),
  [GameTypeEnum.WATER_SORT]: () => import('@/games/water-sort/WaterSortEngine'),
  [GameTypeEnum.SCREW_PUZZLE]: () => import('@/games/screw-puzzle/ScrewPuzzleEngine'),
  [GameTypeEnum.SAND_SIMULATION]: () => import('@/games/sand-simulation/SandSimulationEngine'),
  [GameTypeEnum.VIDEO_POKER]: () => import('@/games/video-poker/VideoPokerEngine'),
  [GameTypeEnum.BLACKJACK]: () => import('@/games/blackjack/BlackjackEngine'),
  [GameTypeEnum.SPACE_DODGE]: () => import('@/games/space-dodge/SpaceDodgeEngine'),
  [GameTypeEnum.BALLOON_POP]: () => import('@/games/balloon-pop/BalloonPopEngine'),
  [GameTypeEnum.MINI_GO]: () => import('@/games/mini-go/MiniGoEngine'),
  [GameTypeEnum.HEX]: () => import('@/games/hex/HexEngine'),
  [GameTypeEnum.RHYTHM]: () => import('@/games/rhythm/RhythmEngine'),
  [GameTypeEnum.DOODLE_GOD]: () => import('@/games/doodle-god/DoodleGodEngine'),
  [GameTypeEnum.SLITHER_IO]: () => import('@/games/slither-io/SlitherIoEngine'),
  [GameTypeEnum.CHESS]: () => import('@/games/chess/ChessEngine'),
  [GameTypeEnum.STICK_FIGHTER]: () => import('@/games/stick-fighter/StickFighterEngine'),
  [GameTypeEnum.FREECELL]: () => import('@/games/freecell/FreeCellEngine'),
  [GameTypeEnum.FOLD_PUZZLE]: () => import('@/games/fold-puzzle/FoldPuzzleEngine'),
  [GameTypeEnum.SLOPE_BALL]: () => import('@/games/slope-ball/SlopeBallEngine'),
  [GameTypeEnum.TANK_DUEL]: () => import('@/games/tank-duel/TankDuelEngine'),
  [GameTypeEnum.CHINESE_CHESS]: () => import('@/games/chinese-chess/ChineseChessEngine'),
  [GameTypeEnum.TEMPLE_RUN]: () => import('@/games/temple-run/TempleRunEngine'),
  [GameTypeEnum.SENET]: () => import('@/games/senet/SenetEngine'),
  [GameTypeEnum.BASKETBALL_HOOPS]: () => import('@/games/basketball-hoops/BasketballHoopsEngine'),
  [GameTypeEnum.FLAPPY_PLANE]: () => import('@/games/flappy-plane/FlappyPlaneEngine'),
  [GameTypeEnum.JIGSAW_PUZZLE]: () => import('@/games/jigsaw-puzzle/JigsawPuzzleEngine'),
  [GameTypeEnum.BLOONS]: () => import('@/games/bloons/BloonsEngine'),
  [GameTypeEnum.CTF]: () => import('@/games/ctf/CTFEngine'),
  [GameTypeEnum.BACKGAMMON]: () => import('@/games/backgammon/BackgammonEngine'),
  [GameTypeEnum.PONG_2P]: () => import('@/games/pong-2p/Pong2PEngine'),
  [GameTypeEnum.HEAD_SOCCER]: () => import('@/games/head-soccer/HeadSoccerEngine'),
  [GameTypeEnum.MAHJONG_SOLITAIRE]: () => import('@/games/mahjong-solitaire/MahjongSolitaireEngine'),
  [GameTypeEnum.SPACE_WAR]: () => import('@/games/space-war/SpaceWarEngine'),
  [GameTypeEnum.DUCK_HUNT]: () => import('@/games/duck-hunt/DuckHuntEngine'),
  [GameTypeEnum.FISHING_MASTER]: () => import('@/games/fishing-master/FishingMasterEngine'),
  [GameTypeEnum.NINJA_JUMP]: () => import('@/games/ninja-jump/NinjaJumpEngine'),
  [GameTypeEnum.NONOGRAM]: () => import('@/games/nonogram/NonogramEngine'),
  [GameTypeEnum.SKI_FREE]: () => import('@/games/ski-free/SkiFreeEngine'),
  [GameTypeEnum.CHIPS_CHALLENGE]: () => import('@/games/chips-challenge/ChipsChallengeEngine'),
  [GameTypeEnum.DOTS_AND_BOXES]: () => import('@/games/dots-and-boxes/DotsAndBoxesEngine'),
  [GameTypeEnum.MAZE]: () => import('@/games/maze/MazeEngine'),

  // ── 放置游戏 ──
  [GameTypeEnum.DOGGO_HOME]: () => import('@/games/doggo-home/DoggoHomeEngine'),
  [GameTypeEnum.KITTENS_KINGDOM]: () => import('@/games/kittens-kingdom/KittensKingdomEngine'),
  [GameTypeEnum.PENGUIN_EMPIRE]: () => import('@/games/penguin-empire/PenguinEmpireEngine'),
  [GameTypeEnum.ANT_KINGDOM]: () => import('@/games/ant-kingdom/AntKingdomEngine'),
  [GameTypeEnum.DINO_RANCH]: () => import('@/games/dino-ranch/DinoRanchEngine'),
  [GameTypeEnum.IDLE_XIANXIA]: () => import('@/games/idle-xianxia/IdleXianxiaEngine'),
  [GameTypeEnum.SECT_RISE]: () => import('@/games/sect-rise/SectRiseEngine'),
  [GameTypeEnum.ALCHEMY_MASTER]: () => import('@/games/alchemy-master/AlchemyMasterEngine'),
  [GameTypeEnum.CIV_BABYLON]: () => import('@/games/civ-babylon/CivBabylonEngine'),
  [GameTypeEnum.CIV_CHINA]: () => import('@/games/civ-china/CivChinaEngine'),
  [GameTypeEnum.CIV_EGYPT]: () => import('@/games/civ-egypt/CivEgyptEngine'),
  [GameTypeEnum.CIV_INDIA]: () => import('@/games/civ-india/CivIndiaEngine'),
  [GameTypeEnum.CLAN_SAGA]: () => import('@/games/clan-saga/ClanSagaEngine'),
  [GameTypeEnum.DOOMSDAY]: () => import('@/games/doomsday/DoomsdayEngine'),
  [GameTypeEnum.DUNGEON_EXPLORE]: () => import('@/games/dungeon-explore/DungeonExploreEngine'),
  [GameTypeEnum.ISLAND_DRIFT]: () => import('@/games/island-drift/IslandDriftEngine'),
  [GameTypeEnum.MODERN_CITY]: () => import('@/games/modern-city/ModernCityEngine'),
  [GameTypeEnum.SPACE_DRIFT]: () => import('@/games/space-drift/SpaceDriftEngine'),
  [GameTypeEnum.TRIBULATION]: () => import('@/games/tribulation/TribulationEngine'),
  [GameTypeEnum.WILD_SURVIVAL]: () => import('@/games/wild-survival/WildSurvivalEngine'),
  [GameTypeEnum.AGE_OF_EMPIRES]: () => import('@/games/age-of-empires/AgeOfEmpiresEngine'),
  [GameTypeEnum.BALDURS_GATE]: () => import('@/games/baldurs-gate/BaldursGateEngine'),
  [GameTypeEnum.EGYPT_MYTH]: () => import('@/games/egypt-myth/EgyptMythEngine'),
  [GameTypeEnum.FINAL_FANTASY]: () => import('@/games/final-fantasy/FinalFantasyEngine'),
  [GameTypeEnum.GREEK_GODS]: () => import('@/games/greek-gods/GreekGodsEngine'),
  [GameTypeEnum.HEROES_MIGHT]: () => import('@/games/heroes-might/HeroesMightEngine'),
  [GameTypeEnum.NORSE_VALKYRIE]: () => import('@/games/norse-valkyrie/NorseValkyrieEngine'),
  [GameTypeEnum.RED_ALERT]: () => import('@/games/red-alert/RedAlertEngine'),
  [GameTypeEnum.THREE_KINGDOMS]: () => import('@/games/three-kingdoms/engine/ThreeKingdomsEngine'),
  [GameTypeEnum.TOTAL_WAR]: () => import('@/games/total-war/TotalWarEngine'),
  [GameTypeEnum.YOKAI_NIGHT]: () => import('@/games/yokai-night/YokaiNightEngine'),
};

/**
 * 根据游戏类型异步创建对应的引擎实例
 *
 * @param type 游戏类型枚举值
 * @returns 对应的游戏引擎实例的 Promise
 * @throws 当传入未知的游戏类型时抛出错误
 *
 * @example
 * ```ts
 * // 异步创建引擎
 * const engine = await createEngine(GameType.TETRIS);
 * engine.init(canvas);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createEngine(type: GameType): Promise<any> {
  const importer = ENGINE_IMPORTERS[type];
  if (!importer) {
    throw new Error(`Unknown game type: ${type}`);
  }

  const mod = await importer();
  // 动态 import 返回模块对象，取第一个导出的构造函数
  const EngineClass = Object.values(mod)[0] as new () => unknown;
  return new EngineClass();
}
