import { useParams, useNavigate } from 'react-router-dom';
import { GameType } from '@/types';
import Header from '../components/Header';
import GameContainer from '../components/GameContainer';
import { gameInfo } from '../components/GameCard';

// 枚举值是小写：tetris, snake, sokoban
const VALID_TYPES: Record<string, GameType> = {
  tetris: GameType.TETRIS,
  snake: GameType.SNAKE,
  sokoban: GameType.SOKOBAN,
  'flappy-bird': GameType.FLAPPY_BIRD,
  'g2048': GameType.G2048,
  'memory-match': GameType.MEMORY_MATCH,
  'tic-tac-toe': GameType.TIC_TAC_TOE,
  'game-of-life': GameType.GAME_OF_LIFE,
  minesweeper: GameType.MINESWEEPER,
  gomoku: GameType.GOMOKU,
  'dino-runner': GameType.DINO_RUNNER,
  tron: GameType.TRON,
  'pipe-mania': GameType.PIPE_MANIA,
  breakout: GameType.BREAKOUT,
  pacman: GameType.PACMAN,
  'space-invaders': GameType.SPACE_INVADERS,
  othello: GameType.OTHELLO,
  checkers: GameType.CHECKERS,
  pinball: GameType.PINBALL,
  'mahjong-connect': GameType.MAHJONG_CONNECT,
  'match-3': GameType.MATCH_3,
  sudoku: GameType.SUDOKU,
  'tetris-battle': GameType.TETRIS_BATTLE,
  frogger: GameType.FROGGER,
  pong: GameType.PONG,
  'connect-four': GameType.CONNECT_FOUR,
  'lights-out': GameType.LIGHTS_OUT,
  'whack-a-mole': GameType.WHACK_A_MOLE,
  klotski: GameType.KLOTSKI,
  solitaire: GameType.SOLITAIRE,
  asteroids: GameType.ASTEROIDS,
  'air-hockey': GameType.AIR_HOCKEY,
  'fruit-ninja': GameType.FRUIT_NINJA,
  galaga: GameType.GALAGA,
  'bubble-shooter': GameType.BUBBLE_SHOOTER,
  'snake-2p': GameType.SNAKE_2P,
  mancala: GameType.MANCALA,
  'eight-queens': GameType.EIGHT_QUEENS,
  centipede: GameType.CENTIPEDE,
  'missile-command': GameType.MISSILE_COMMAND,
  'lunar-lander': GameType.LUNAR_LANDER,
  'slider-puzzle': GameType.SLIDER_PUZZLE,
  'tower-of-hanoi': GameType.TOWER_OF_HANOI,
  'donkey-kong': GameType.DONKEY_KONG,
  'dig-dug': GameType.DIG_DUG,
  'battle-city': GameType.BATTLE_CITY,
  mastermind: GameType.MASTERMIND,
  'make-24': GameType.MAKE_24,
  'cookie-clicker': GameType.COOKIE_CLICKER,
  'reaction-test': GameType.REACTION_TEST,
  zuma: GameType.ZUMA,
  'pixel-art': GameType.PIXEL_ART,
  spirograph: GameType.SPIROGRAPH,
  wordle: GameType.WORDLE,
  'geometry-dash': GameType.GEOMETRY_DASH,
  'fall-down': GameType.FALL_DOWN,
  'cave-flyer': GameType.CAVE_FLYER,
  'gravity-flip': GameType.GRAVITY_FLIP,
  'knights-tour': GameType.KNIGHTS_TOUR,
  'virtual-pet': GameType.VIRTUAL_PET,
  ztype: GameType.ZTYPE,
  'water-sort': GameType.WATER_SORT,
  'sand-simulation': GameType.SAND_SIMULATION,
  'screw-puzzle': GameType.SCREW_PUZZLE,
  'video-poker': GameType.VIDEO_POKER,
  blackjack: GameType.BLACKJACK,
  'dots-and-boxes': GameType.DOTS_AND_BOXES,
  'space-dodge': GameType.SPACE_DODGE,
  'balloon-pop': GameType.BALLOON_POP,
  'mini-go': GameType.MINI_GO,
  hex: GameType.HEX,
  rhythm: GameType.RHYTHM,
  'doodle-god': GameType.DOODLE_GOD,
  'slither-io': GameType.SLITHER_IO,
  chess: GameType.CHESS,
  'stick-fighter': GameType.STICK_FIGHTER,
  freecell: GameType.FREECELL,
  'fold-puzzle': GameType.FOLD_PUZZLE,
  'slope-ball': GameType.SLOPE_BALL,
  'tank-duel': GameType.TANK_DUEL,
  'chinese-chess': GameType.CHINESE_CHESS,
  'temple-run': GameType.TEMPLE_RUN,
  senet: GameType.SENET,
  'basketball-hoops': GameType.BASKETBALL_HOOPS,
  'flappy-plane': GameType.FLAPPY_PLANE,
  'jigsaw-puzzle': GameType.JIGSAW_PUZZLE,
  bloons: GameType.BLOONS,
  ctf: GameType.CTF,
  backgammon: GameType.BACKGAMMON,
  'pong-2p': GameType.PONG_2P,
  'head-soccer': GameType.HEAD_SOCCER,
  'mahjong-solitaire': GameType.MAHJONG_SOLITAIRE,
  'space-war': GameType.SPACE_WAR,
  'duck-hunt': GameType.DUCK_HUNT,
  'fishing-master': GameType.FISHING_MASTER,
  'ninja-jump': GameType.NINJA_JUMP,
  nonogram: GameType.NONOGRAM,
  'ski-free': GameType.SKI_FREE,
};

export default function GamePage() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate = useNavigate();

  const type = gameType ? VALID_TYPES[gameType.toLowerCase()] : undefined;
  const isValid = !!type;
  const info = type ? gameInfo[type] : null;

  if (!isValid || !info) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="mb-4 text-6xl">🤔</div>
          <h2 className="mb-4 font-game text-lg text-gp-neon">游戏未找到</h2>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl bg-gp-accent px-6 py-3 text-white transition hover:bg-gp-accent/80"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* 标题区 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <div>
            <h1 className={`font-game text-lg ${info.color}`}>{info.icon} {info.title}</h1>
            <p className="text-sm text-gray-400">{info.description}</p>
          </div>
        </div>

        {/* 游戏区域 */}
        <div className="flex justify-center">
          <GameContainer gameType={type} />
        </div>
      </div>
    </div>
  );
}
