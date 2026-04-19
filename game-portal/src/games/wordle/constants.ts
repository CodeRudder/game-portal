// ========== Wordle 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 游戏规则 */
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** 字母表 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 反馈颜色 */
export const COLOR_ABSENT = '#3a3a4c';      // 灰色：字母不在答案中
export const COLOR_PRESENT = '#b59f3b';      // 黄色：字母在答案中但位置不对
export const COLOR_CORRECT = '#538d4e';      // 绿色：字母在答案中且位置正确
export const COLOR_EMPTY = '#2a2a3c';        // 空格子背景
export const COLOR_BORDER = '#565670';       // 格子边框
export const COLOR_BORDER_ACTIVE = '#8787a0'; // 当前输入行边框
export const COLOR_TEXT = '#ffffff';
export const COLOR_BG = '#121213';
export const COLOR_KEY_BG = '#818384';
export const COLOR_KEY_TEXT = '#ffffff';

/** 键盘布局 */
export const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

/** 布局参数 */
export const TILE_SIZE = 56;
export const TILE_GAP = 6;
export const GRID_PADDING_X = 24;
export const GRID_TOP = 70;
export const KEY_HEIGHT = 48;
export const KEY_GAP = 6;
export const KEYBOARD_TOP = 440;
export const KEYBOARD_PADDING_X = 12;

/** 分数计算 */
export const BASE_SCORE = 1000;
export const GUESS_PENALTY = 100;
export const WIN_BONUS = 500;

/** 词库：至少 100 个常见 5 字母英文单词 */
export const WORD_LIST: string[] = [
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE',
  'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
  'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM',
  'ALERT', 'ALIEN', 'ALIGN', 'ALIVE', 'ALLOW',
  'ALONE', 'ALTER', 'AMONG', 'ANGEL', 'ANGER',
  'ANGLE', 'ANGRY', 'APART', 'APPLE', 'APPLY',
  'ARENA', 'ARGUE', 'ARISE', 'ARRAY', 'ASIDE',
  'ASSET', 'AVOID', 'AWARD', 'AWARE', 'BADLY',
  'BASIC', 'BEGAN', 'BEGIN', 'BEING', 'BELOW',
  'BENCH', 'BIBLE', 'BIRTH', 'BLACK', 'BLADE',
  'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLEED',
  'BLEND', 'BLIND', 'BLOCK', 'BLOOD', 'BOARD',
  'BONUS', 'BOUND', 'BRAIN', 'BRAND', 'BRAVE',
  'BREAD', 'BREAK', 'BREED', 'BRICK', 'BRIEF',
  'BRING', 'BROAD', 'BROKE', 'BROWN', 'BRUSH',
  'BUILD', 'BUNCH', 'BURST', 'CABIN', 'CARRY',
  'CATCH', 'CAUSE', 'CHAIN', 'CHAIR', 'CHARM',
  'CHART', 'CHASE', 'CHEAP', 'CHECK', 'CHEST',
  'CHIEF', 'CHILD', 'CHINA', 'CLAIM', 'CLASS',
  'CLEAN', 'CLEAR', 'CLIMB', 'CLOCK', 'CLOSE',
  'CLOUD', 'COACH', 'COAST', 'COULD', 'COUNT',
  'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRASH',
  'CRAZY', 'CREAM', 'CRIME', 'CROSS', 'CROWD',
  'CRUEL', 'CRUSH', 'CURVE', 'CYCLE', 'DAILY',
  'DANCE', 'DEATH', 'DELAY', 'DEPTH', 'DIRTY',
  'DOUBT', 'DRAFT', 'DRAIN', 'DRAMA', 'DRAWN',
  'DREAM', 'DRESS', 'DRINK', 'DRIVE', 'EAGER',
  'EARLY', 'EARTH', 'EIGHT', 'ELECT', 'ELITE',
  'EMPTY', 'ENEMY', 'ENJOY', 'ENTER', 'ENTRY',
  'EQUAL', 'ERROR', 'EVENT', 'EVERY', 'EXACT',
  'EXIST', 'EXTRA', 'FAITH', 'FALSE', 'FAULT',
  'FEAST', 'FIBER', 'FIELD', 'FIGHT', 'FINAL',
  'FLAME', 'FLASH', 'FLEET', 'FLESH', 'FLOAT',
  'FLOOD', 'FLOOR', 'FLUID', 'FOCUS', 'FORCE',
  'FOUND', 'FRAME', 'FRANK', 'FRESH', 'FRONT',
  'FRUIT', 'FULLY', 'FUNNY', 'GIANT', 'GIVEN',
  'GLASS', 'GLOBE', 'GOING', 'GRACE', 'GRADE',
  'GRAIN', 'GRAND', 'GRANT', 'GRASS', 'GRAVE',
  'GREAT', 'GREEN', 'GROSS', 'GROUP', 'GROWN',
  'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'HAPPY',
  'HARSH', 'HEART', 'HEAVY', 'HORSE', 'HOTEL',
  'HOUSE', 'HUMAN', 'HUMOR', 'IDEAL', 'IMAGE',
  'INDEX', 'INNER', 'INPUT', 'ISSUE', 'IVORY',
  'JOINT', 'JUDGE', 'JUICE', 'KNOWN', 'LABEL',
  'LARGE', 'LASER', 'LATER', 'LAUGH', 'LAYER',
  'LEARN', 'LEAVE', 'LEGAL', 'LEVEL', 'LIGHT',
  'LIMIT', 'LINEN', 'LIVER', 'LOCAL', 'LOGIC',
  'LOOSE', 'LOVER', 'LOWER', 'LUCKY', 'LUNCH',
  'MAGIC', 'MAJOR', 'MAKER', 'MARCH', 'MATCH',
  'MAYOR', 'MEDIA', 'MERCY', 'METAL', 'MIGHT',
  'MINOR', 'MINUS', 'MODEL', 'MONEY', 'MONTH',
  'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH',
  'MOVIE', 'MUSIC', 'NAIVE', 'NERVE', 'NEVER',
  'NIGHT', 'NOBLE', 'NOISE', 'NORTH', 'NOTED',
  'NOVEL', 'NURSE', 'OCCUR', 'OCEAN', 'OFFER',
  'OFTEN', 'ONSET', 'OPERA', 'ORBIT', 'ORDER',
  'OTHER', 'OUGHT', 'OUTER', 'OWNER', 'PAINT',
  'PANEL', 'PAPER', 'PARTY', 'PATCH', 'PAUSE',
  'PEACE', 'PHASE', 'PHONE', 'PHOTO', 'PIANO',
  'PIECE', 'PILOT', 'PITCH', 'PIXEL', 'PLACE',
  'PLAIN', 'PLANE', 'PLANT', 'PLATE', 'PLAZA',
  'POINT', 'POUND', 'POWER', 'PRESS', 'PRICE',
  'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE',
  'PROOF', 'PROUD', 'PROVE', 'QUEEN', 'QUEST',
  'QUICK', 'QUIET', 'QUITE', 'QUOTE', 'RADAR',
  'RADIO', 'RAISE', 'RANGE', 'RAPID', 'RATIO',
  'REACH', 'READY', 'REALM', 'REBEL', 'REIGN',
  'RELAX', 'REPLY', 'RIGHT', 'RISEN', 'RISKY',
  'RIVAL', 'RIVER', 'ROBIN', 'ROBOT', 'ROCKY',
  'ROMAN', 'ROUGH', 'ROUND', 'ROUTE', 'ROYAL',
  'RURAL', 'SADLY', 'SAINT', 'SALAD', 'SCALE',
  'SCENE', 'SCOPE', 'SCORE', 'SENSE', 'SERVE',
  'SEVEN', 'SHALL', 'SHAPE', 'SHARE', 'SHARP',
  'SHEEP', 'SHEER', 'SHEET', 'SHELF', 'SHELL',
  'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT',
  'SHORT', 'SHOUT', 'SIGHT', 'SINCE', 'SIXTH',
  'SIXTY', 'SIZED', 'SKILL', 'SLEEP', 'SLICE',
  'SLIDE', 'SMALL', 'SMART', 'SMELL', 'SMILE',
  'SMOKE', 'SNAKE', 'SOLAR', 'SOLID', 'SOLVE',
  'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE',
  'SPEAK', 'SPEED', 'SPEND', 'SPENT', 'SPILL',
  'SPINE', 'SPLIT', 'SPOKE', 'SPORT', 'SPRAY',
  'SQUAD', 'STACK', 'STAFF', 'STAGE', 'STAKE',
  'STAND', 'START', 'STATE', 'STEAL', 'STEAM',
  'STEEL', 'STEEP', 'STERN', 'STICK', 'STIFF',
  'STILL', 'STOCK', 'STONE', 'STOOD', 'STORE',
  'STORM', 'STORY', 'STRIP', 'STUCK', 'STUFF',
  'STYLE', 'SUGAR', 'SUITE', 'SUPER', 'SURGE',
  'SWEAR', 'SWEEP', 'SWEET', 'SWIFT', 'SWING',
  'SWORD', 'TABLE', 'TASTE', 'TEACH', 'TEETH',
  'THEME', 'THICK', 'THING', 'THINK', 'THIRD',
  'THOSE', 'THREE', 'THREW', 'THROW', 'TIGHT',
  'TIRED', 'TITLE', 'TODAY', 'TOKEN', 'TOTAL',
  'TOUCH', 'TOUGH', 'TOWER', 'TOXIC', 'TRACE',
  'TRACK', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT',
  'TRASH', 'TREAT', 'TREND', 'TRIAL', 'TRIBE',
  'TRICK', 'TRIED', 'TROOP', 'TRUCK', 'TRULY',
  'TRUNK', 'TRUST', 'TRUTH', 'TWICE', 'TWIST',
  'ULTRA', 'UNCLE', 'UNDER', 'UNION', 'UNITY',
  'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'USAGE',
  'USUAL', 'VALID', 'VALUE', 'VIDEO', 'VIGOR',
  'VIRUS', 'VISIT', 'VITAL', 'VIVID', 'VOCAL',
  'VOICE', 'VOTER', 'WASTE', 'WATCH', 'WATER',
  'WEAVE', 'WEIGH', 'WEIRD', 'WHALE', 'WHEAT',
  'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE',
  'WHOLE', 'WHOSE', 'WOMAN', 'WORLD', 'WORRY',
  'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND',
  'WRIST', 'WRITE', 'WRONG', 'WROTE', 'YIELD',
  'YOUNG', 'YOUTH',
];

/** 反馈类型 */
export enum LetterStatus {
  /** 未使用 */
  UNUSED = 'unused',
  /** 不在答案中（灰色） */
  ABSENT = 'absent',
  /** 在答案中但位置错误（黄色） */
  PRESENT = 'present',
  /** 位置正确（绿色） */
  CORRECT = 'correct',
}

/** 猜测记录 */
export interface GuessResult {
  word: string;
  feedback: LetterStatus[];
}

/** 游戏统计 */
export interface WordleStats {
  totalGames: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** 猜测次数分布：guessDistribution[0] = 1次猜中, ..., guessDistribution[5] = 6次猜中 */
  guessDistribution: number[];
}
