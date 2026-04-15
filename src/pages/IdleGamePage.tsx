/**
 * IdleGamePage — 放置游戏详情页
 *
 * 路由: /idle/:gameId
 * 根据 gameId 创建对应的引擎并渲染 IdleGamePlayer。
 */
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import ThreeKingdomsPixiGame from '@/components/idle/ThreeKingdomsPixiGame';

/** 放置游戏注册信息 */
interface IdleGameConfig {
  name: string;
  icon: string;
  description: string;
  legacyRoute: string; // 当前指向原始 GameContainer 路由
  pixiComponent?: boolean; // 使用独立 PixiJS 组件渲染
}

const IDLE_GAME_REGISTRY: Record<string, IdleGameConfig> = {
  'cookie-clicker': {
    name: 'Cookie Clicker',
    icon: '🍪',
    description: '点击生产饼干，购买升级自动产出，打造你的饼干帝国！',
    legacyRoute: '/game/cookie-clicker',
  },
  'doggo-home': {
    name: '狗狗家园',
    icon: '🐕',
    description: '收集各种可爱狗狗，升级建筑，打造温馨的狗狗家园！',
    legacyRoute: '/game/doggo-home',
  },
  'kittens-kingdom': {
    name: '猫咪王国',
    icon: '🐱',
    description: '点击产鱼干，解锁猫咪品种，建设你的猫咪王国！',
    legacyRoute: '/game/kittens-kingdom',
  },
  'penguin-empire': {
    name: '企鹅帝国',
    icon: '🐧',
    description: '收集冰块，建造设施，征服南极大陆！',
    legacyRoute: '/game/penguin-empire',
  },
  'ant-kingdom': {
    name: '蚂蚁王国',
    icon: '🐜',
    description: '建立蚁巢，繁殖工蚁，打造地下蚂蚁帝国！',
    legacyRoute: '/game/ant-kingdom',
  },
  'dino-ranch': {
    name: '恐龙牧场',
    icon: '🦕',
    description: '饲养恐龙，升级牧场，打造史前恐龙乐园！',
    legacyRoute: '/game/dino-ranch',
  },
  'idle-xianxia': {
    name: '修仙放置',
    icon: '🏔️',
    description: '修炼灵气，突破境界，踏上修仙之路！',
    legacyRoute: '/game/idle-xianxia',
  },
  'sect-rise': {
    name: '宗门崛起',
    icon: '⚔️',
    description: '创建宗门，招收弟子，成就修仙霸业！',
    legacyRoute: '/game/sect-rise',
  },
  'alchemy-master': {
    name: '炼金大师',
    icon: '⚗️',
    description: '调配药剂，炼制神器，成为传奇炼金术士！',
    legacyRoute: '/game/alchemy-master',
  },
  'civ-babylon': {
    name: '巴比伦文明',
    icon: '🏛️',
    description: '建造空中花园，发展两河文明，成就帝国霸业！',
    legacyRoute: '/game/civ-babylon',
  },
  'civ-china': {
    name: '华夏文明',
    icon: '🐉',
    description: '发展农耕丝织，建设万里长城，缔造华夏盛世！',
    legacyRoute: '/game/civ-china',
  },
  'civ-egypt': {
    name: '埃及文明',
    icon: '🏺',
    description: '建造金字塔，统治尼罗河，成就法老王朝！',
    legacyRoute: '/game/civ-egypt',
  },
  'civ-india': {
    name: '印度文明',
    icon: '🕉️',
    description: '种植香料，修建神庙，繁荣恒河流域！',
    legacyRoute: '/game/civ-india',
  },
  'three-kingdoms': {
    name: '三国霸业',
    icon: '⚔️',
    description: '招募武将，攻城略地，一统三国天下！',
    legacyRoute: '/games/three-kingdoms-pixi',
    pixiComponent: true,
  },
  'clan-saga': {
    name: '氏族传说',
    icon: '⚔️',
    description: '统领氏族，征战四方，书写属于你的传奇！',
    legacyRoute: '/game/clan-saga',
  },
  'doomsday': {
    name: '末日求生',
    icon: '☢️',
    description: '核战之后，收集资源，建立避难所，重建文明！',
    legacyRoute: '/game/doomsday',
  },
  'dungeon-explore': {
    name: '地牢探索',
    icon: '🏰',
    description: '深入地下城，击败怪物，收集宝藏和装备！',
    legacyRoute: '/game/dungeon-explore',
  },
  'island-drift': {
    name: '荒岛漂流',
    icon: '🏝️',
    description: '流落荒岛，采集资源，建造庇护所，等待救援！',
    legacyRoute: '/game/island-drift',
  },
  'modern-city': {
    name: '现代都市',
    icon: '🏙️',
    description: '规划建设，发展经济，打造国际化现代都市！',
    legacyRoute: '/game/modern-city',
  },
  'space-drift': {
    name: '星际漂流',
    icon: '🚀',
    description: '驾驶飞船，开采小行星，探索无尽宇宙！',
    legacyRoute: '/game/space-drift',
  },
  'tribulation': {
    name: '天劫修仙',
    icon: '⚡',
    description: '渡过天劫，飞升仙界，成就无上大道！',
    legacyRoute: '/game/tribulation',
  },
  'wild-survival': {
    name: '荒野求生',
    icon: '🌲',
    description: '在原始荒野中生存，狩猎采集，对抗自然！',
    legacyRoute: '/game/wild-survival',
  },
  'age-of-empires': {
    name: '帝国时代',
    icon: '🏰',
    description: '从石器时代到帝国时代，发展文明，征服世界！',
    legacyRoute: '/game/age-of-empires',
  },
  'baldurs-gate': {
    name: '博德之门',
    icon: '⚔️',
    description: '探索地下城，招募英雄，挑战博德之门！',
    legacyRoute: '/game/baldurs-gate',
  },
  'egypt-myth': {
    name: '埃及神话',
    icon: '🐪',
    description: '召唤埃及众神，建造神庙，统治沙漠王国！',
    legacyRoute: '/game/egypt-myth',
  },
  'final-fantasy': {
    name: '最终幻想',
    icon: '💎',
    description: '集结勇者，探索幻想世界，击败最终Boss！',
    legacyRoute: '/game/final-fantasy',
  },
  'greek-gods': {
    name: '希腊众神',
    icon: '⚡',
    description: '信仰奥林匹斯众神，建设城邦，成就希腊霸业！',
    legacyRoute: '/game/greek-gods',
  },
  'heroes-might': {
    name: '英雄无敌',
    icon: '🏇',
    description: '招募英雄，建设城堡，征服魔法大陆！',
    legacyRoute: '/game/heroes-might',
  },
  'norse-valkyrie': {
    name: '北欧女武神',
    icon: '🛡️',
    description: '召唤女武神，征服九界，书写北欧传奇！',
    legacyRoute: '/game/norse-valkyrie',
  },
  'red-alert': {
    name: '红色警戒',
    icon: '🎖️',
    description: '建造基地，训练军队，赢得终极战争！',
    legacyRoute: '/game/red-alert',
  },
  'total-war': {
    name: '全面战争',
    icon: '🗡️',
    description: '统帅三军，运筹帷幄，成就战争霸业！',
    legacyRoute: '/game/total-war',
  },
  'yokai-night': {
    name: '百鬼夜行',
    icon: '👻',
    description: '收集妖怪，驱鬼除魔，探索平安京！',
    legacyRoute: '/game/yokai-night',
  },
};

export default function IdleGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const config = gameId ? IDLE_GAME_REGISTRY[gameId] : undefined;

  if (!config) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="mb-4 text-6xl">🤔</div>
          <h2 className="mb-4 font-game text-lg text-gp-neon">游戏未找到</h2>
          <button
            onClick={() => navigate('/idle')}
            className="rounded-xl bg-gp-accent px-6 py-3 text-white transition hover:bg-gp-accent/80"
          >
            返回放置游戏专区
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 标题区 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/idle')}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <div>
            <h1 className="font-game text-lg text-gp-gold">
              {config.icon} {config.name}
            </h1>
            <p className="text-sm text-gray-400">{config.description}</p>
          </div>
        </div>

        {/* 游戏区域 */}
        {config.pixiComponent && gameId === 'three-kingdoms' ? (
          <ThreeKingdomsPixiGame />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="text-5xl">{config.icon}</div>
            <p className="text-center text-sm text-gray-400">
              此游戏正在接入放置游戏专区，当前请通过原始入口游玩
            </p>
            <button
              onClick={() => navigate(config.legacyRoute)}
              className="rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-3 text-sm font-bold text-white shadow-lg shadow-gp-accent/30 transition hover:shadow-gp-accent/50"
            >
              🎮 开始游戏
            </button>
            <button
              onClick={() => navigate('/idle')}
              className="text-sm text-gray-500 hover:text-gp-neon transition-colors"
            >
              ← 返回放置游戏专区
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
