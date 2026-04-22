import React from 'react';
import {
  TavernIcon,
  BeaconTowerIcon,
  MintIcon,
  ForgeIcon,
  TeahouseIcon,
  GranaryIcon,
} from './BuildingExtraIcons';

const FarmIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-farm-field" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a8a4a" />
        <stop offset="100%" stopColor="#3a6a2a" />
      </linearGradient>
      <linearGradient id="tk-farm-water" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#5a9a7a" />
        <stop offset="100%" stopColor="#4a8a6a" />
      </linearGradient>
    </defs>
    {/* 远处谷仓轮廓 */}
    <rect x="42" y="14" width="16" height="14" rx="1" fill="#8B6914" opacity="0.5" />
    <path d="M40,14 L50,6 L60,14 Z" fill="#6b5a14" opacity="0.5" />
    <rect x="48" y="22" width="5" height="6" rx="0.5" fill="#3a2a1a" opacity="0.4" />
    {/* 梯田 — 三层 */}
    <path d="M4,36 L60,36 L60,58 L4,58 Z" fill="url(#tk-farm-field)" stroke="#3a5a2a" strokeWidth="0.8" />
    <path d="M8,30 L56,30 L58,36 L6,36 Z" fill="#4a7a3a" stroke="#3a5a2a" strokeWidth="0.6" />
    <path d="M12,25 L52,25 L54,30 L10,30 Z" fill="#5a8a4a" stroke="#3a5a2a" strokeWidth="0.5" opacity="0.7" />
    {/* 田埂分隔线 */}
    <line x1="4" y1="43" x2="60" y2="43" stroke="#6a9a5a" strokeWidth="1" opacity="0.5" />
    <line x1="4" y1="50" x2="60" y2="50" stroke="#6a9a5a" strokeWidth="1" opacity="0.5" />
    <line x1="32" y1="36" x2="32" y2="58" stroke="#6a9a5a" strokeWidth="0.8" opacity="0.3" />
    {/* 水面反光 — 梯田 */}
    <ellipse cx="18" cy="40" rx="8" ry="1.2" fill="url(#tk-farm-water)" opacity="0.2" />
    <ellipse cx="44" cy="47" rx="10" ry="1" fill="url(#tk-farm-water)" opacity="0.15" />
    {/* 稻穗群 — 左侧 */}
    <line x1="14" y1="34" x2="14" y2="10" stroke="#6b8e5a" strokeWidth="1.5" />
    <ellipse cx="14" cy="8" rx="3" ry="5" fill="#8aaa5a" />
    <ellipse cx="10" cy="14" rx="2.5" ry="4" fill="#8aaa5a" transform="rotate(-25 10 14)" />
    <ellipse cx="18" cy="14" rx="2.5" ry="4" fill="#8aaa5a" transform="rotate(25 18 14)" />
    <ellipse cx="11" cy="21" rx="2" ry="3.5" fill="#6b8e5a" transform="rotate(-15 11 21)" />
    <ellipse cx="17" cy="21" rx="2" ry="3.5" fill="#6b8e5a" transform="rotate(15 17 21)" />
    {/* 稻穗群 — 中间 */}
    <line x1="34" y1="34" x2="34" y2="14" stroke="#6b8e5a" strokeWidth="1.3" />
    <ellipse cx="34" cy="12" rx="2.5" ry="4" fill="#8aaa5a" />
    <ellipse cx="31" cy="18" rx="2" ry="3" fill="#8aaa5a" transform="rotate(-20 31 18)" />
    <ellipse cx="37" cy="18" rx="2" ry="3" fill="#8aaa5a" transform="rotate(20 37 18)" />
    {/* 牛 — 中下方 */}
    <ellipse cx="26" cy="48" rx="7" ry="4" fill="#6a5a4a" />
    <circle cx="20" cy="46" r="3.5" fill="#6a5a4a" />
    {/* 牛角 */}
    <path d="M18,43 Q16,40 17.5,39" stroke="#b8a880" strokeWidth="1" fill="none" />
    <path d="M22,43 Q24,40 22.5,39" stroke="#b8a880" strokeWidth="1" fill="none" />
    {/* 牛腿 */}
    <line x1="22" y1="52" x2="21" y2="57" stroke="#6a5a4a" strokeWidth="1.2" />
    <line x1="28" y1="52" x2="27" y2="57" stroke="#6a5a4a" strokeWidth="1.2" />
    <line x1="30" y1="52" x2="31" y2="57" stroke="#6a5a4a" strokeWidth="1.2" />
    <line x1="24" y1="52" x2="23" y2="57" stroke="#6a5a4a" strokeWidth="1.2" />
    {/* 缰绳 */}
    <path d="M28,46 Q32,44 36,46" stroke="#8B6914" strokeWidth="0.8" fill="none" opacity="0.7" />
    {/* 农夫 — 右侧牵牛 */}
    <circle cx="38" cy="42" r="3" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    {/* 斗笠 */}
    <path d="M34,40 Q38,37 42,40" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    {/* 身体 */}
    <path d="M36,45 L35,54 L41,54 L40,45" fill="#5a7a4a" stroke="#3a5a2a" strokeWidth="0.5" />
    {/* 手臂牵绳 */}
    <line x1="36" y1="47" x2="32" y2="45" stroke="#d4b896" strokeWidth="1" />
    {/* 锄头 */}
    <line x1="42" y1="44" x2="46" y2="54" stroke="#6b4226" strokeWidth="1.5" />
    <path d="M44,42 L48,41 L47,45 Z" fill="#8a8a8a" stroke="#6a6a6a" strokeWidth="0.5" />
  </svg>
);

/** 商行 — 古代商铺招牌+柜台+铜钱串（金色系，64×64） */
const MarketIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-market-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#e8b84a" />
        <stop offset="100%" stopColor="#b8860b" />
      </linearGradient>
      <linearGradient id="tk-market-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B6914" />
        <stop offset="100%" stopColor="#6b5a14" />
      </linearGradient>
    </defs>
    {/* 集市牌楼 — 飞檐屋顶 */}
    <path d="M6,22 L32,8 L58,22 Z" fill="url(#tk-market-gold)" stroke="#8B6914" strokeWidth="1.2" />
    {/* 飞檐翘角 */}
    <path d="M3,22 Q6,18 10,22" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    <path d="M54,22 Q58,18 61,22" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    {/* 屋脊装饰 */}
    <circle cx="32" cy="8" r="2" fill="#d4a030" />
    {/* 牌楼立柱 */}
    <rect x="12" y="22" width="4" height="30" fill="url(#tk-market-wood)" stroke="#5a4a14" strokeWidth="0.8" />
    <rect x="48" y="22" width="4" height="30" fill="url(#tk-market-wood)" stroke="#5a4a14" strokeWidth="0.8" />
    {/* 牌楼横梁 */}
    <rect x="10" y="20" width="44" height="5" rx="1" fill="#d4a030" stroke="#8B6914" strokeWidth="0.8" />
    {/* 匾额 — 商行 */}
    <rect x="22" y="11" width="20" height="8" rx="1.5" fill="#3a2a1a" stroke="#d4a030" strokeWidth="1" />
    {/* 匾额留空 — 名称由卡片显示 */}
    {/* 柜台 */}
    <rect x="16" y="38" width="32" height="8" rx="1.5" fill="#b87333" stroke="#8B6914" strokeWidth="1" />
    <rect x="14" y="36" width="36" height="3" rx="1" fill="#d4a030" opacity="0.4" />
    {/* 货郎人物 — 柜台后 */}
    <circle cx="32" cy="32" r="4" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    {/* 斗笠 */}
    <path d="M26,30 Q32,26 38,30" fill="#b87333" stroke="#8B6914" strokeWidth="0.6" />
    {/* 身体 */}
    <path d="M29,36 L28,42 L36,42 L35,36" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.4" />
    {/* 柜台上的货物 */}
    <rect x="18" y="36" width="5" height="3" rx="1" fill="#d4a030" opacity="0.5" />
    <rect x="25" y="36" width="4" height="3" rx="1" fill="#4a7a3a" opacity="0.4" />
    <rect x="40" y="36" width="5" height="3" rx="1" fill="#c62828" opacity="0.3" />
    <circle cx="36" cy="37" r="2" fill="#b87333" opacity="0.4" />
    {/* 招幌 — 左侧 */}
    <line x1="8" y1="6" x2="8" y2="20" stroke="#6b4226" strokeWidth="1" />
    <rect x="5" y="8" width="6" height="12" rx="1" fill="#c62828" opacity="0.6" stroke="#8b1a1a" strokeWidth="0.4" />
    {/* 招幌留空 */}
    {/* 招幌 — 右侧 */}
    <line x1="56" y1="6" x2="56" y2="20" stroke="#6b4226" strokeWidth="1" />
    <rect x="53" y="8" width="6" height="12" rx="1" fill="#c62828" opacity="0.6" stroke="#8b1a1a" strokeWidth="0.4" />
    {/* 招幌留空 */}
    {/* 铜钱串 — 柜台前 */}
    <line x1="22" y1="48" x2="42" y2="48" stroke="#8B6914" strokeWidth="0.8" />
    <circle cx="26" cy="50" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="24.8" y="48.8" width="2.4" height="2.4" fill="#3a2a1a" rx="0.3" />
    <circle cx="32" cy="51" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="30.8" y="49.8" width="2.4" height="2.4" fill="#3a2a1a" rx="0.3" />
    <circle cx="38" cy="50" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="36.8" y="48.8" width="2.4" height="2.4" fill="#3a2a1a" rx="0.3" />
    {/* 地面 */}
    <path d="M4,58 Q32,55 60,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 军营 — 军帐+战旗+兵器架（红色系，64×64） */
const BarracksIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-barracks-tent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c62828" />
        <stop offset="100%" stopColor="#8b1a1a" />
      </linearGradient>
      <linearGradient id="tk-barracks-tent2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a82020" />
        <stop offset="100%" stopColor="#701515" />
      </linearGradient>
    </defs>
    {/* 主军帐 */}
    <path d="M10,54 L32,18 L54,54 Z" fill="url(#tk-barracks-tent)" stroke="#6b1010" strokeWidth="1.5" />
    {/* 帐篷纹理 */}
    <path d="M21,36 L32,18 L43,36" fill="none" stroke="#d4a030" strokeWidth="0.8" opacity="0.5" />
    <line x1="32" y1="18" x2="32" y2="54" stroke="#d4a030" strokeWidth="0.6" opacity="0.3" />
    {/* 帐篷门帘 */}
    <path d="M22,54 L22,42 Q32,36 42,42 L42,54" fill="#3a1a0a" stroke="#6b1010" strokeWidth="0.8" />
    {/* 帐顶装饰球 */}
    <circle cx="32" cy="16" r="2.5" fill="#d4a030" />
    {/* 副军帐 — 左后 */}
    <path d="M2,54 L14,32 L26,54 Z" fill="url(#tk-barracks-tent2)" stroke="#5a0e0e" strokeWidth="0.8" />
    <circle cx="14" cy="30.5" r="1.5" fill="#d4a030" opacity="0.7" />
    {/* 主战旗 — 右侧 */}
    <line x1="50" y1="2" x2="50" y2="44" stroke="#6b4226" strokeWidth="2.5" />
    <path d="M50,2 L62,6 L60,12 L62,18 L50,16 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.8" />
    {/* 战旗留空 */}
    <circle cx="50" cy="1.5" r="2" fill="#d4a030" />
    {/* 副战旗 — 左侧 */}
    <line x1="8" y1="8" x2="8" y2="36" stroke="#6b4226" strokeWidth="1.5" />
    <path d="M8,8 L18,11 L17,16 L18,21 L8,18 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.6" />
    {/* 战旗留空 */}
    <circle cx="8" cy="7" r="1.5" fill="#d4a030" />
    {/* 兵器架 — 帐篷前 */}
    <line x1="44" y1="32" x2="44" y2="54" stroke="#6b4226" strokeWidth="1.5" />
    <line x1="40" y1="32" x2="48" y2="32" stroke="#6b4226" strokeWidth="1.2" />
    {/* 架上长枪 */}
    <line x1="42" y1="20" x2="42" y2="32" stroke="#c0c0c0" strokeWidth="1.2" />
    <polygon points="42,18 43.5,20 40.5,20" fill="#c0c0c0" />
    <line x1="45" y1="22" x2="45" y2="32" stroke="#c0c0c0" strokeWidth="1.2" />
    <polygon points="45,20 46.5,22 43.5,22" fill="#c0c0c0" />
    {/* 大刀 */}
    <line x1="48" y1="26" x2="48" y2="32" stroke="#c0c0c0" strokeWidth="1" />
    <path d="M45.5,26 Q48,22 50.5,26" fill="#c0c0c0" opacity="0.6" />
    {/* 弓 */}
    <path d="M38,20 Q35,26 38,32" fill="none" stroke="#8b4513" strokeWidth="1" />
    <line x1="38" y1="20" x2="38" y2="32" stroke="#d4a030" strokeWidth="0.5" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 铁匠铺 — 铁砧+锤子+火花+炉火（橙色系，64×64） */
const SmithyIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-smithy-fire" cx="0.5" cy="0.8" r="0.5">
        <stop offset="0%" stopColor="#ff6600" />
        <stop offset="60%" stopColor="#e65100" />
        <stop offset="100%" stopColor="#bf360c" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tk-smithy-spark" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffeb3b" />
        <stop offset="50%" stopColor="#ff6600" />
        <stop offset="100%" stopColor="#bf360c" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* 简易棚屋 — 斜顶 */}
    <path d="M4,34 L32,14 L60,34 Z" fill="#6b4226" stroke="#4a2a16" strokeWidth="1.5" />
    <line x1="6" y1="34" x2="6" y2="58" stroke="#6b4226" strokeWidth="2" />
    <line x1="58" y1="34" x2="58" y2="58" stroke="#6b4226" strokeWidth="2" />
    {/* 棚顶茅草纹理 */}
    <line x1="14" y1="26" x2="50" y2="26" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
    <line x1="10" y1="30" x2="54" y2="30" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
    {/* 铁砧 */}
    <path d="M20,44 L44,44 L42,52 L22,52 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    <path d="M22,40 L42,40 L44,44 L20,44 Z" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="1" />
    <rect x="26" y="37" width="12" height="4" rx="1.5" fill="#7a7a7a" />
    {/* 铁砧底部 */}
    <rect x="22" y="52" width="20" height="3" rx="1" fill="#4a4a4a" />
    {/* 炉火 — 左侧 */}
    <path d="M8,46 Q8,32 14,26 Q12,34 18,30 Q15,38 20,36 L20,46 Z" fill="url(#tk-smithy-fire)" />
    <path d="M10,42 Q10,34 14,30 Q12,36 16,34 Q14,38 18,38 L18,42 Z" fill="#ff9800" opacity="0.7" />
    <path d="M12,38 Q12,34 14,32 Q13,36 15,35 L15,38 Z" fill="#ffeb3b" opacity="0.5" />
    {/* 火星飞溅 */}
    <circle cx="10" cy="22" r="1.5" fill="url(#tk-smithy-spark)" />
    <circle cx="14" cy="18" r="1" fill="#ff6600" opacity="0.7" />
    <circle cx="18" cy="20" r="0.8" fill="#ffaa00" opacity="0.5" />
    <circle cx="8" cy="26" r="0.7" fill="#ff4400" opacity="0.6" />
    <circle cx="22" cy="16" r="0.6" fill="#ffeb3b" opacity="0.4" />
    <circle cx="16" cy="14" r="0.5" fill="#ff6600" opacity="0.3" />
    {/* 锤子 */}
    <line x1="46" y1="14" x2="38" y2="36" stroke="#6b4226" strokeWidth="3" strokeLinecap="round" />
    <rect x="42" y="10" width="9" height="7" rx="1.5" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" transform="rotate(-20 46.5 13.5)" />
    {/* 被锻造的兵器 */}
    <path d="M28,34 L32,16 L36,34" fill="#8a8a8a" stroke="#6a6a6a" strokeWidth="0.6" opacity="0.7" />
    <polygon points="32,12 34,16 30,16" fill="#c0c0c0" opacity="0.7" />
    {/* 火花效果 — 右上 */}
    <path d="M36,18 L38,14" stroke="#ff6600" strokeWidth="0.8" opacity="0.6" />
    <path d="M34,16 L36,12" stroke="#ffaa00" strokeWidth="0.6" opacity="0.5" />
    <circle cx="40" cy="14" r="1" fill="#ff6600" opacity="0.4" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 太学 — 竹简卷轴+书案+孔子讲学剪影（蓝色系，64×64） */
const AcademyIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-academy-desk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6b4226" />
        <stop offset="100%" stopColor="#4a2a16" />
      </linearGradient>
      <linearGradient id="tk-academy-night" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a2a4a" />
        <stop offset="100%" stopColor="#0a1428" />
      </linearGradient>
    </defs>
    {/* 书案（高台） */}
    <rect x="6" y="42" width="52" height="6" rx="1.5" fill="url(#tk-academy-desk)" stroke="#3a1a0a" strokeWidth="1.2" />
    <rect x="10" y="48" width="3" height="10" fill="#4a2a16" />
    <rect x="51" y="48" width="3" height="10" fill="#4a2a16" />
    {/* 竹简 — 摊开在书案上 */}
    <rect x="10" y="28" width="28" height="14" rx="1.5" fill="#d4b896" stroke="#8B7355" strokeWidth="1.2" />
    {/* 竹简编绳 */}
    <line x1="10" y1="33" x2="38" y2="33" stroke="#d4a030" strokeWidth="0.8" opacity="0.6" />
    <line x1="10" y1="38" x2="38" y2="38" stroke="#d4a030" strokeWidth="0.8" opacity="0.6" />
    {/* 竹简文字 */}
    <text x="16" y="32" fontSize="4.5" fill="#3a2a1a" opacity="0.7">子曰</text>
    <text x="16" y="37" fontSize="4.5" fill="#3a2a1a" opacity="0.7">学而</text>
    <text x="16" y="42" fontSize="4.5" fill="#3a2a1a" opacity="0.7">时习</text>
    {/* 竹简卷轴端 */}
    <rect x="8" y="27" width="3" height="16" rx="1.5" fill="#b87333" />
    <rect x="37" y="27" width="3" height="16" rx="1.5" fill="#b87333" />
    {/* 成卷竹简 — 左上 */}
    <rect x="3" y="10" width="6" height="22" rx="3" fill="#d4b896" stroke="#8B7355" strokeWidth="0.8" />
    <line x1="4" y1="14" x2="8" y2="14" stroke="#d4a030" strokeWidth="0.4" />
    <line x1="4" y1="18" x2="8" y2="18" stroke="#d4a030" strokeWidth="0.4" />
    <line x1="4" y1="22" x2="8" y2="22" stroke="#d4a030" strokeWidth="0.4" />
    <line x1="4" y1="26" x2="8" y2="26" stroke="#d4a030" strokeWidth="0.4" />
    {/* 孔子讲学剪影 — 右上 */}
    <circle cx="50" cy="16" r="5" fill="#3a2a1a" opacity="0.35" />
    <path d="M45,22 L44,36 L56,36 L55,22" fill="#3a2a1a" opacity="0.25" />
    {/* 冠帽 */}
    <rect x="46" y="10" width="8" height="3" rx="1" fill="#3a2a1a" opacity="0.3" />
    {/* 手持竹简 */}
    <rect x="42" y="24" width="4" height="10" rx="1" fill="#d4b896" opacity="0.3" />
    {/* 油灯 — 右侧 */}
    <ellipse cx="52" cy="40" rx="4" ry="2" fill="#b87333" stroke="#8B6914" strokeWidth="0.8" />
    <rect x="50" y="34" width="3" height="6" rx="1" fill="#d4b896" />
    {/* 灯焰 */}
    <path d="M51.5,26 Q53,30 51.5,34 Q50,30 51.5,26 Z" fill="#ff9800" opacity="0.8" />
    <path d="M51.5,28 Q52.5,30 51.5,33 Q50.5,30 51.5,28 Z" fill="#ffeb3b" opacity="0.6" />
    {/* 灯光光晕 */}
    <circle cx="51.5" cy="28" r="8" fill="#ff9800" opacity="0.05" />
    {/* 毛笔 — 斜靠 */}
    <line x1="40" y1="12" x2="48" y2="38" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    <path d="M47,36 L48.5,42 L46.5,42 Z" fill="#1a1a1a" />
    {/* 墨迹点 */}
    <circle cx="48" cy="42" r="1.5" fill="#1a1a1a" opacity="0.3" />
  </svg>
);

/** 药庐 — 药柜+捣药罐+草药（青色系，64×64） */
const ClinicIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-clinic-cab" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6b4226" />
        <stop offset="100%" stopColor="#4a2a16" />
      </linearGradient>
    </defs>
    {/* 药柜 — 右侧背景 */}
    <rect x="38" y="10" width="22" height="38" rx="1.5" fill="url(#tk-clinic-cab)" stroke="#3a1a0a" strokeWidth="1" />
    {/* 药柜抽屉 */}
    <rect x="40" y="12" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="44" cy="15.5" r="0.8" fill="#d4a030" />
    <rect x="50" y="12" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="54" cy="15.5" r="0.8" fill="#d4a030" />
    <rect x="40" y="21" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="44" cy="24.5" r="0.8" fill="#d4a030" />
    <rect x="50" y="21" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="54" cy="24.5" r="0.8" fill="#d4a030" />
    <rect x="40" y="30" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="44" cy="33.5" r="0.8" fill="#d4a030" />
    <rect x="50" y="30" width="8" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="54" cy="33.5" r="0.8" fill="#d4a030" />
    <rect x="40" y="39" width="18" height="7" rx="0.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <circle cx="49" cy="42.5" r="0.8" fill="#d4a030" />
    {/* 药葫芦 — 左侧 */}
    <ellipse cx="22" cy="34" rx="10" ry="13" fill="#5a8a6a" stroke="#3a6a4a" strokeWidth="1.5" />
    <ellipse cx="22" cy="22" rx="6" ry="6" fill="#5a8a6a" stroke="#3a6a4a" strokeWidth="1.2" />
    {/* 葫芦腰 */}
    <path d="M15,26 Q22,22.5 29,26" stroke="#3a6a4a" strokeWidth="1.2" fill="none" />
    {/* 葫芦口 */}
    <rect x="19" y="13" width="6" height="4" rx="1.2" fill="#6b4226" />
    {/* 葫芦带子 */}
    <path d="M16,16 Q22,20 28,16" stroke="#d4a030" strokeWidth="0.8" fill="none" />
    {/* 葫芦十字标记 */}
    <line x1="22" y1="28" x2="22" y2="42" stroke="#d4a030" strokeWidth="1.5" opacity="0.6" />
    <line x1="15" y1="35" x2="29" y2="35" stroke="#d4a030" strokeWidth="1.5" opacity="0.6" />
    {/* 葫芦高光 */}
    <ellipse cx="18" cy="31" rx="2.5" ry="6" fill="white" opacity="0.08" />
    {/* 捣药罐 — 中下 */}
    <path d="M6,42 L6,56 Q6,60 10,60 L18,60 Q22,60 22,56 L22,42 Z" fill="#8a6a4a" stroke="#6b4a2a" strokeWidth="1.2" />
    <ellipse cx="14" cy="42" rx="8.5" ry="3" fill="#9a7a5a" stroke="#6b4a2a" stroke-width="0.8" />
    {/* 捣药杵 */}
    <line x1="14" y1="30" x2="14" y2="42" stroke="#6b4226" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="14" cy="29" r="2.5" fill="#6b4226" />
    {/* 草药 — 右上 */}
    <path d="M56,6 Q58,2 56,0" stroke="#4a7a3a" strokeWidth="1.5" fill="none" />
    <path d="M56,0 Q54,3 56,7" stroke="#4a7a3a" strokeWidth="1" fill="#5a8a4a" opacity="0.6" />
    <path d="M56,4 Q58,2 60,4" stroke="#4a7a3a" strokeWidth="1" fill="#5a8a4a" opacity="0.6" />
    <path d="M56,8 Q54,6 52,8" stroke="#4a7a3a" strokeWidth="0.8" fill="#5a8a4a" opacity="0.5" />
    {/* 草药叶 — 左上 */}
    <path d="M8,8 Q6,4 8,2" stroke="#4a7a3a" strokeWidth="1.2" fill="none" />
    <path d="M8,2 Q10,5 8,8" fill="#5a8a4a" opacity="0.5" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 城防 — 城墙+箭塔+烽火台（灰色系，64×64） */
const WallIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-wall-stone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6a6a6a" />
        <stop offset="100%" stopColor="#4a4a4a" />
      </linearGradient>
    </defs>
    {/* 城墙主体 */}
    <rect x="6" y="28" width="52" height="26" fill="url(#tk-wall-stone)" stroke="#3a3a3a" strokeWidth="1.5" />
    {/* 城垛（锯齿形） */}
    {[10, 20, 30, 40, 50].map((x, i) => (
      <rect key={i} x={x - 3} y="18" width="8" height="12" fill="url(#tk-wall-stone)" stroke="#3a3a3a" strokeWidth="0.8" />
    ))}
    {/* 城门 */}
    <path d="M24,54 L24,40 Q32,32 40,40 L40,54" fill="#2a1a0a" stroke="#1a0a00" strokeWidth="1.2" />
    {/* 城门钉 */}
    <circle cx="36" cy="46" r="1.2" fill="#b87333" />
    <circle cx="36" cy="50" r="1.2" fill="#b87333" />
    {/* 城楼 — 中间上方 */}
    <path d="M18,18 L32,8 L46,18 Z" fill="#8b2020" stroke="#6b1010" strokeWidth="1" />
    {/* 飞檐 */}
    <path d="M15,18 Q18,15 22,18" stroke="#d4a030" strokeWidth="1" fill="none" />
    <path d="M42,18 Q46,15 49,18" stroke="#d4a030" strokeWidth="1" fill="none" />
    {/* 城楼窗户 */}
    <rect x="26" y="10" width="3" height="4" rx="0.8" fill="#d4a030" opacity="0.4" />
    <rect x="34" y="10" width="3" height="4" rx="0.8" fill="#d4a030" opacity="0.4" />
    {/* 箭塔 — 左侧 */}
    <rect x="2" y="8" width="8" height="22" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1" />
    <path d="M0,8 L6,2 L12,8 Z" fill="#8b2020" stroke="#6b1010" strokeWidth="0.6" />
    {/* 箭塔射孔 */}
    <rect x="4" y="12" width="2.5" height="5" rx="0.5" fill="#1a1a1a" opacity="0.5" />
    <rect x="4" y="20" width="2.5" height="5" rx="0.5" fill="#1a1a1a" opacity="0.5" />
    {/* 烽火台 — 右侧 */}
    <rect x="54" y="2" width="8" height="18" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1" />
    <path d="M52,2 L58,0 L64,2 Z" fill="#8b2020" stroke="#6b1010" strokeWidth="0.6" />
    {/* 烽火台上的火焰 */}
    <path d="M58,1 Q59,3 58,5 Q57,3 58,1 Z" fill="#ff6600" opacity="0.8" />
    <path d="M58,2 Q58.5,3 58,4.5 Q57.5,3 58,2 Z" fill="#ff9800" opacity="0.5" />
    {/* 浓烟 */}
    <path d="M56,0 Q55,-2 57,-3" stroke="#8a7a60" strokeWidth="0.6" fill="none" opacity="0.4" />
    <path d="M60,0 Q61,-2 59,-3" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.3" />
    {/* 瞭望窗 */}
    <rect x="56" y="6" width="4" height="3" rx="0.5" fill="#d4a030" opacity="0.3" />
    {/* 石砖纹理 */}
    {[34, 42, 50].map(y => (
      <React.Fragment key={y}>
        <line x1="8" y1={y} x2="22" y2={y} stroke="#4a4a4a" strokeWidth="0.4" />
        <line x1="42" y1={y} x2="56" y2={y} stroke="#4a4a4a" strokeWidth="0.4" />
      </React.Fragment>
    ))}
    {/* 旗帜 — 城楼上 */}
    <line x1="32" y1="0" x2="32" y2="8" stroke="#6b4226" strokeWidth="1.2" />
    <path d="M32,0 L38,2 L32,4 Z" fill="#c62828" />
  </svg>
);

/** 招贤馆 — 旗帜+卷轴 (紫色) */
const BUILDING_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  farm: FarmIcon,
  market: MarketIcon,
  barracks: BarracksIcon,
  smithy: SmithyIcon,
  academy: AcademyIcon,
  clinic: ClinicIcon,
  wall: WallIcon,
  tavern: TavernIcon,
  beacon_tower: BeaconTowerIcon,
  mint: MintIcon,
  forge: ForgeIcon,
  teahouse: TeahouseIcon,
  granary: GranaryIcon,
};

/** 建筑图标组件 — 根据建筑 ID 渲染对应的 SVG */
export const BuildingIcon: React.FC<{ buildingId: string; size?: number }> = ({ buildingId, size = 40 }) => {
  const IconComponent = BUILDING_ICON_MAP[buildingId];
  if (IconComponent) {
    return <span data-testid={`building-icon-${buildingId}`}><IconComponent size={size} /></span>;
  }
  // 兜底：显示通用建筑图标
  return (
    <svg data-testid="building-icon-default" width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="24" height="22" rx="2" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <path d="M6,14 L20,4 L34,14" fill="none" stroke="#6b4226" strokeWidth="2" />
      <rect x="16" y="24" width="8" height="10" rx="1" fill="#3a2a1a" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 资源图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════
