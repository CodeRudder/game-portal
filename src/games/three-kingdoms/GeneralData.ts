/**
 * 三国武将立绘数据 + 对话系统数据
 *
 * 包含12位经典武将的完整信息：
 * - 基础属性（ID、姓名、称号、阵营、武器）
 * - 程序化立绘颜色配置（skin/hair/armor/weapon/accent）
 * - 四维属性值（武力/智力/统率/魅力）
 * - 多场景对话（闲聊/战斗/招募）
 *
 * @module three-kingdoms/GeneralData
 */

/** 武将阵营类型 */
export type Faction = 'shu' | 'wei' | 'wu' | 'other';

/** 对话场景类型 */
export type DialogueType = 'idle' | 'battle' | 'recruit';

/** 程序化立绘颜色配置 */
export interface PortraitColors {
  /** 肤色 (十六进制颜色值) */
  skin: number;
  /** 发色 */
  hair: number;
  /** 盔甲主色 */
  armor: number;
  /** 武器颜色 */
  weapon: number;
  /** 特征色/点缀色 */
  accent: number;
}

/** 四维属性 */
export interface GeneralStats {
  /** 武力 (1-100) */
  strength: number;
  /** 智力 (1-100) */
  intelligence: number;
  /** 统率 (1-100) */
  leadership: number;
  /** 魅力 (1-100) */
  charisma: number;
}

/** 武将对话集合 */
export interface GeneralDialogues {
  /** 闲聊对话（至少5句） */
  idle: string[];
  /** 战斗对话（至少3句） */
  battle: string[];
  /** 招募对话（至少2句） */
  recruit: string[];
}

/** 武将技能定义 */
export interface GeneralSkill {
  /** 技能名称 */
  name: string;
  /** 技能类型：attack/buff/debuff/heal */
  type: 'attack' | 'buff' | 'debuff' | 'heal';
  /** 技能目标：enemy_all/enemy_single/ally_all/ally_single */
  target: 'enemy_all' | 'enemy_single' | 'ally_all' | 'ally_single';
  /** 威力倍率 */
  power: number;
  /** 冷却回合数 */
  cooldown: number;
  /** 技能描述 */
  description: string;
}

/** 武将完整信息 */
export interface GeneralInfo {
  /** 唯一标识符 */
  id: string;
  /** 武将姓名 */
  name: string;
  /** 称号 */
  title: string;
  /** 所属阵营 */
  faction: Faction;
  /** 专属武器 */
  weapon: string;
  /** 程序化立绘颜色配置 */
  portraitColors: PortraitColors;
  /** 四维属性 */
  stats: GeneralStats;
  /** 对话集合 */
  dialogues: GeneralDialogues;
  /** 武将技能列表 */
  skills: GeneralSkill[];
}

/** 12位经典三国武将数据 */
export const GENERALS: GeneralInfo[] = [
  // ==================== 蜀国 ====================
  {
    id: 'liubei',
    name: '刘备',
    title: '仁德之君',
    faction: 'shu',
    weapon: '双剑',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0x3d2314,
      armor: 0xffffff,
      weapon: 0xc0c0c0,
      accent: 0xffd700,
    },
    stats: { strength: 75, intelligence: 80, leadership: 95, charisma: 98 },
    dialogues: {
      idle: [
        '备虽不才，愿与诸位共图大业。',
        '民为贵，社稷次之，君为轻。',
        '勿以恶小而为之，勿以善小而不为。',
        '兄弟如手足，妻子如衣服。',
        '天下兴亡，匹夫有责。',
      ],
      battle: ['兄弟们，随我冲锋！', '为了汉室，杀！', '贼军休走！'],
      recruit: ['久仰大名，愿与君共谋天下。', '备三顾茅庐，只为求得贤才。'],
    },
    skills: [
      { name: '仁德鼓舞', type: 'buff', target: 'ally_all', power: 1.2, cooldown: 3, description: '以仁德之心鼓舞全军，提升我方全体战力' },
      { name: '桃园结义', type: 'heal', target: 'ally_all', power: 0.8, cooldown: 4, description: '兄弟同心，恢复全军兵力' },
    ],
  },
  {
    id: 'guanyu',
    name: '关羽',
    title: '武圣',
    faction: 'shu',
    weapon: '青龙偃月刀',
    portraitColors: {
      skin: 0xf5c49c,
      hair: 0x1a0a00,
      armor: 0x228b22,
      weapon: 0x4682b4,
      accent: 0xff0000,
    },
    stats: { strength: 97, intelligence: 75, leadership: 90, charisma: 85 },
    dialogues: {
      idle: [
        '吾观颜良，如插标卖首耳。',
        '玉可碎而不可改其白，竹可焚而不可毁其节。',
        '关某虽不才，愿效犬马之劳。',
        '忠义二字，关某一生所求。',
        '大丈夫处世，当光明磊落。',
      ],
      battle: ['匹夫休走，关某来也！', '青龙偃月，所向披靡！', '尔等鼠辈，安敢挡我！'],
      recruit: ['关某忠义之人，不事二主。', '若主公仁德，关某愿效死力。'],
    },
    skills: [
      { name: '青龙斩', type: 'attack', target: 'enemy_single', power: 2.0, cooldown: 3, description: '青龙偃月刀蓄力一斩，对单体造成巨额伤害' },
      { name: '武圣之威', type: 'debuff', target: 'enemy_all', power: 0.8, cooldown: 4, description: '武圣之威震慑敌军，降低敌方全体战力' },
    ],
  },
  {
    id: 'zhangfei',
    name: '张飞',
    title: '万人敌',
    faction: 'shu',
    weapon: '丈八蛇矛',
    portraitColors: {
      skin: 0xd2a06d,
      hair: 0x0a0a0a,
      armor: 0x1c1c1c,
      weapon: 0x8b8682,
      accent: 0x8b0000,
    },
    stats: { strength: 98, intelligence: 30, leadership: 70, charisma: 45 },
    dialogues: {
      idle: [
        '燕人张翼德在此！谁敢与我一战！',
        '俺是个粗人，不会说漂亮话。',
        '大哥，俺老张想喝酒了！',
        '打仗就要痛快，磨磨蹭蹭算什么好汉！',
        '二哥总是那么严肃，不如跟俺去喝酒。',
      ],
      battle: ['哇呀呀呀！吃俺一矛！', '来将通名，俺张飞不杀无名之辈！', '谁敢上前！'],
      recruit: ['哼，看你还有几分胆色，俺老张认了！', '跟着大哥干，准没错！'],
    },
    skills: [
      { name: '横扫千军', type: 'attack', target: 'enemy_all', power: 1.5, cooldown: 3, description: '丈八蛇矛横扫，对敌方全体造成伤害' },
      { name: '怒吼', type: 'debuff', target: 'enemy_all', power: 1.0, cooldown: 2, description: '怒吼震慑敌军，降低敌方战力' },
    ],
  },
  {
    id: 'zhugeliang',
    name: '诸葛亮',
    title: '卧龙先生',
    faction: 'shu',
    weapon: '羽扇',
    portraitColors: {
      skin: 0xffe0bd,
      hair: 0x2c1a0e,
      armor: 0xf5f5dc,
      weapon: 0xffefd5,
      accent: 0x4169e1,
    },
    stats: { strength: 35, intelligence: 100, leadership: 95, charisma: 92 },
    dialogues: {
      idle: [
        '非淡泊无以明志，非宁静无以致远。',
        '鞠躬尽瘁，死而后已。',
        '兵法之要，在于出奇制胜。',
        '天时不如地利，地利不如人和。',
        '亮有一计，可破敌军。',
      ],
      battle: ['八阵图已成，敌军必败！', '火攻之计已备，只待东风。', '运筹帷幄之中，决胜千里之外。'],
      recruit: ['亮久居隆中，蒙主公三顾之恩，愿效犬马之劳。', '得明主而事之，此生无憾。'],
    },
    skills: [
      { name: '火攻', type: 'attack', target: 'enemy_all', power: 1.8, cooldown: 4, description: '火烧连营，对敌方全体造成大量伤害' },
      { name: '八阵图', type: 'buff', target: 'ally_all', power: 1.5, cooldown: 3, description: '布下八阵图，大幅提升我方全体战力' },
    ],
  },
  {
    id: 'zhaoyun',
    name: '赵云',
    title: '常胜将军',
    faction: 'shu',
    weapon: '龙胆枪',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0x1a1a2e,
      armor: 0xe8e8e8,
      weapon: 0xb8860b,
      accent: 0x4169e1,
    },
    stats: { strength: 96, intelligence: 72, leadership: 85, charisma: 88 },
    dialogues: {
      idle: [
        '赵子龙愿为主公赴汤蹈火。',
        '一身是胆，何惧千军万马。',
        '长坂坡一战，子龙终生难忘。',
        '忠臣不事二主，好女不更二夫。',
        '保家卫国，乃武将本分。',
      ],
      battle: ['吾乃常山赵子龙！', '枪出如龙，谁敢迎战！', '主公莫慌，子龙来也！'],
      recruit: ['若遇明主，云愿肝脑涂地。', '赵云不才，愿为前锋。'],
    },
    skills: [
      { name: '龙胆突袭', type: 'attack', target: 'enemy_single', power: 2.2, cooldown: 3, description: '龙胆枪突袭，对单体造成致命伤害' },
      { name: '一身是胆', type: 'buff', target: 'ally_single', power: 1.8, cooldown: 2, description: '激发胆气，大幅提升自身战力' },
    ],
  },
  {
    id: 'huangzhong',
    name: '黄忠',
    title: '神射老将',
    faction: 'shu',
    weapon: '大弓',
    portraitColors: {
      skin: 0xc68e6d,
      hair: 0xcccccc,
      armor: 0x8b4513,
      weapon: 0xdeb887,
      accent: 0xff6600,
    },
    stats: { strength: 93, intelligence: 60, leadership: 75, charisma: 65 },
    dialogues: {
      idle: [
        '老将虽年迈，尚能开三石之弓。',
        '百步穿杨，不在话下。',
        '人老心不老，刀快马更快。',
        '年轻人，莫要小看老夫。',
        '沙场征战数十载，从未遇敌手。',
      ],
      battle: ['看老夫神射！', '箭无虚发，百发百中！', '老将出马，一个顶俩！'],
      recruit: ['老朽虽年迈，尚能杀敌。', '若得明主，黄忠愿效死力。'],
    },
  },
  {
    id: 'machao',
    name: '马超',
    title: '锦马超',
    faction: 'shu',
    weapon: '虎头湛金枪',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0xffd700,
      armor: 0xc0c0c0,
      weapon: 0xdaa520,
      accent: 0xff4500,
    },
    stats: { strength: 97, intelligence: 48, leadership: 80, charisma: 90 },
    dialogues: {
      idle: [
        '西凉马超，谁敢来战！',
        '杀父之仇，不共戴天。',
        '银甲白马，纵横天下。',
        '马家枪法，天下无双。',
        '有朝一日，必报此仇。',
      ],
      battle: ['西凉铁骑，冲锋！', '马超在此，尔等受死！', '虎头湛金枪，所向无敌！'],
      recruit: ['若能为父报仇，超愿归顺。', '久仰皇叔仁德，超愿效犬马之劳。'],
    },
  },

  // ==================== 魏国 ====================
  {
    id: 'caocao',
    name: '曹操',
    title: '乱世奸雄',
    faction: 'wei',
    weapon: '倚天剑',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0x1a1a1a,
      armor: 0x191970,
      weapon: 0xc0c0c0,
      accent: 0xffd700,
    },
    stats: { strength: 72, intelligence: 96, leadership: 98, charisma: 90 },
    dialogues: {
      idle: [
        '宁教我负天下人，休教天下人负我。',
        '对酒当歌，人生几何。',
        '何以解忧，唯有杜康。',
        '老骥伏枥，志在千里。',
        '吾任天下之智力，以道御之，无所不可。',
      ],
      battle: ['全军出击！一统天下！', '胜败乃兵家常事，此战必胜！', '顺我者昌，逆我者亡！'],
      recruit: ['天下英雄，唯使君与操耳。', '吾爱才如命，愿与君共谋大业。'],
    },
  },
  {
    id: 'xuchu',
    name: '许褚',
    title: '虎痴',
    faction: 'wei',
    weapon: '大锤',
    portraitColors: {
      skin: 0xd2a06d,
      hair: 0x0a0a0a,
      armor: 0x4a4a4a,
      weapon: 0x696969,
      accent: 0x8b4513,
    },
    stats: { strength: 96, intelligence: 25, leadership: 55, charisma: 35 },
    dialogues: {
      idle: [
        '俺是许褚，谁敢和俺比力气！',
        '主公在哪里，许褚就在哪里。',
        '吃饱了才有力气打仗！',
        '什么计谋不计谋的，一锤子解决！',
        '俺只听主公的话，别人少来！',
      ],
      battle: ['吃俺一锤！', '虎痴来也，尔等受死！', '谁敢动主公，先过俺这关！'],
      recruit: ['哼，你要是主公的朋友，就是俺的朋友。', '跟着主公走，准没错！'],
    },
  },

  // ==================== 吴国 ====================
  {
    id: 'sunquan',
    name: '孙权',
    title: '江东之主',
    faction: 'wu',
    weapon: '吴钩',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0x2c1a0e,
      armor: 0xb22222,
      weapon: 0xcd853f,
      accent: 0xff4500,
    },
    stats: { strength: 68, intelligence: 86, leadership: 92, charisma: 85 },
    dialogues: {
      idle: [
        '江东基业，父兄所创，权必守之。',
        '举贤任能，方为明主之道。',
        '生子当如孙仲谋。',
        '长江天险，吾之屏障。',
        '天下大势，合久必分，分久必合。',
      ],
      battle: ['江东儿郎，随我出战！', '保家卫国，寸土不让！', '东吴水军，天下无敌！'],
      recruit: ['江东多才俊，愿与君共图大业。', '若肯归顺，权必以礼相待。'],
    },
  },
  {
    id: 'zhouyu',
    name: '周瑜',
    title: '美周郎',
    faction: 'wu',
    weapon: '古琴',
    portraitColors: {
      skin: 0xffe0bd,
      hair: 0x0a0a14,
      armor: 0xf5f5dc,
      weapon: 0x8b4513,
      accent: 0xff1493,
    },
    stats: { strength: 65, intelligence: 98, leadership: 95, charisma: 96 },
    dialogues: {
      idle: [
        '曲有误，周郎顾。',
        '既生瑜，何生亮。',
        '大丈夫处世，当提三尺之剑，立不世之功。',
        '江东双璧，非浪得虚名。',
        '赤壁一战，千古留名。',
      ],
      battle: ['火攻赤壁，大破曹军！', '运筹帷幄，谈笑间樯橹灰飞烟灭。', '都督令下，全军出击！'],
      recruit: ['瑜不才，愿为江东效力。', '得遇明主，瑜三生有幸。'],
    },
  },

  // ==================== 其他 ====================
  {
    id: 'lvbu',
    name: '吕布',
    title: '飞将',
    faction: 'other',
    weapon: '方天画戟',
    portraitColors: {
      skin: 0xffdbac,
      hair: 0x0a0a0a,
      armor: 0xffd700,
      weapon: 0xb22222,
      accent: 0x800080,
    },
    stats: { strength: 100, intelligence: 35, leadership: 60, charisma: 50 },
    dialogues: {
      idle: [
        '人中吕布，马中赤兔。',
        '天下英雄，谁能挡我！',
        '大丈夫生于天地间，岂能郁郁久居人下。',
        '方天画戟在手，天下我有。',
        '谁敢与我一战！',
      ],
      battle: ['天下第一武将，谁敢来战！', '方天画戟，鬼神皆泣！', '吕布在此，尔等速速受死！'],
      recruit: ['若以诚意相待，布愿归顺。', '天下诸侯，谁能容我？'],
    },
  },
];

/**
 * 根据 ID 查找武将
 * @param id 武将唯一标识符
 * @returns 武将信息，未找到返回 undefined
 */
export function getGeneralById(id: string): GeneralInfo | undefined {
  return GENERALS.find((g) => g.id === id);
}

/**
 * 根据阵营筛选武将列表
 * @param faction 阵营类型 ('shu' | 'wei' | 'wu' | 'other')
 * @returns 该阵营下所有武将
 */
export function getGeneralsByFaction(faction: string): GeneralInfo[] {
  return GENERALS.filter((g) => g.faction === faction);
}

/**
 * 获取武将随机对话
 * @param id 武将唯一标识符
 * @param type 对话场景类型
 * @returns 随机一条对话，未找到武将返回 '...'
 */
export function getRandomDialogue(id: string, type: DialogueType): string {
  const general = getGeneralById(id);
  if (!general) return '...';
  const dialogues = general.dialogues[type];
  return dialogues[Math.floor(Math.random() * dialogues.length)];
}
