/**
 * ThreeKingdomsSVGIcons — 三国霸业古风 SVG 图标组件
 *
 * 为建筑和资源提供古风风格的内联 SVG 图标。
 * 使用古风色彩体系：深棕/暗金/青铜/朱红/翠绿
 *
 * 建筑图标 (64×64 viewBox，可缩放)：
 * - 屯田(farm)           → 稻田梯田+农夫牵牛+谷仓轮廓 (绿色)
 * - 商行(market)         → 古代商铺招牌+柜台+铜钱串 (金色)
 * - 军营(barracks)       → 军帐+战旗+兵器架 (红色)
 * - 铁匠铺(smithy)       → 铁砧+锤子+火花+炉火 (灰色)
 * - 太学(academy)        → 竹简卷轴+书案+孔子讲学剪影 (蓝色)
 * - 药庐(clinic)         → 药柜+捣药罐+草药 (青色)
 * - 城防(wall)           → 城墙+箭塔+烽火台 (深灰)
 * - 招贤馆(tavern)       → 旗帜+卷轴 (紫色)
 * - 烽火台(beacon_tower) → 高塔+火焰+浓烟 (橙红)
 * - 钱庄(mint)           → 金库大门+铜钱堆+算盘 (金色)
 * - 锻兵坊(forge)        → 铁砧+锤子+火花+炉火 (深红橙)
 * - 茶馆(teahouse)       → 两层楼阁+茶幌子+茶壶 (翠绿)
 * - 粮仓(granary)        → 圆顶仓廪+粮袋堆+斗量 (棕黄)
 *
 * 资源图标 (20x20)：
 * - 粮草(grain)   → 稻穗 (金色)
 * - 铜钱(gold)    → 铜钱 (古铜)
 * - 兵力(troops)  → 兵符 (朱红)
 * - 天命(destiny) → 玉玺 (翠绿)
 *
 * @module components/idle/ThreeKingdomsSVGIcons
 */

import React from 'react';

// ═══════════════════════════════════════════════════════════════
// 建筑图标 SVG 组件 (40×40)
// ═══════════════════════════════════════════════════════════════

/** 屯田 — 稻田梯田+农夫牵牛+远处谷仓轮廓（绿色系，64×64） */
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
    <text x="32" y="18" textAnchor="middle" fontSize="6" fill="#d4a030" fontFamily="serif" fontWeight="bold">商行</text>
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
    <text x="8" y="17" textAnchor="middle" fontSize="5" fill="#d4a030" fontFamily="serif">買</text>
    {/* 招幌 — 右侧 */}
    <line x1="56" y1="6" x2="56" y2="20" stroke="#6b4226" strokeWidth="1" />
    <rect x="53" y="8" width="6" height="12" rx="1" fill="#c62828" opacity="0.6" stroke="#8b1a1a" strokeWidth="0.4" />
    <text x="56" y="17" textAnchor="middle" fontSize="5" fill="#d4a030" fontFamily="serif">賣</text>
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
    <text x="56" y="12" textAnchor="middle" fontSize="7" fill="#d4a030" fontFamily="serif" fontWeight="bold">軍</text>
    <circle cx="50" cy="1.5" r="2" fill="#d4a030" />
    {/* 副战旗 — 左侧 */}
    <line x1="8" y1="8" x2="8" y2="36" stroke="#6b4226" strokeWidth="1.5" />
    <path d="M8,8 L18,11 L17,16 L18,21 L8,18 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.6" />
    <text x="13" y="16" textAnchor="middle" fontSize="5" fill="#d4a030" fontFamily="serif" fontWeight="bold">漢</text>
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
const TavernIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    {/* 旗杆 */}
    <line x1="10" y1="4" x2="10" y2="36" stroke="#6b4226" strokeWidth="2" />
    {/* 旗帜 */}
    <path d="M10,6 L28,8 L26,16 L28,24 L10,22 Z" fill="#6a3d7a" stroke="#8a5d9a" strokeWidth="0.8" />
    {/* 旗帜上的贤字 */}
    <text x="18" y="17" textAnchor="middle" fontSize="8" fill="#d4a030" fontFamily="serif" fontWeight="bold">賢</text>
    {/* 旗帜顶部装饰 */}
    <circle cx="10" cy="4" r="2" fill="#d4a030" />
    {/* 卷轴 */}
    <rect x="22" y="28" width="14" height="8" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.8" />
    <rect x="21" y="27" width="2" height="10" rx="1" fill="#b87333" />
    <rect x="35" y="27" width="2" height="10" rx="1" fill="#b87333" />
    {/* 卷轴文字 */}
    <line x1="24" y1="31" x2="34" y2="31" stroke="#3a2a1a" strokeWidth="0.5" opacity="0.5" />
    <line x1="24" y1="33" x2="32" y2="33" stroke="#3a2a1a" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 烽火台 — 高塔+火焰+浓烟（橙红色系，64×64） */
const BeaconTowerIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-beacon-fire" cx="0.5" cy="0.7" r="0.5">
        <stop offset="0%" stopColor="#ffeb3b" />
        <stop offset="40%" stopColor="#ff6600" />
        <stop offset="100%" stopColor="#bf360c" stopOpacity="0.3" />
      </radialGradient>
      <linearGradient id="tk-beacon-stone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a7a7a" />
        <stop offset="100%" stopColor="#4a4a4a" />
      </linearGradient>
    </defs>
    {/* 石基 */}
    <rect x="12" y="52" width="40" height="8" rx="1.5" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    <line x1="16" y1="55" x2="48" y2="55" stroke="#4a4a4a" strokeWidth="0.5" />
    {/* 梯形塔身 */}
    <path d="M18,52 L22,18 L42,18 L46,52 Z" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="1.5" />
    {/* 塔身石砖纹理 */}
    <line x1="20" y1="28" x2="44" y2="28" stroke="#5a5a5a" strokeWidth="0.6" />
    <line x1="21" y1="38" x2="43" y2="38" stroke="#5a5a5a" strokeWidth="0.6" />
    <line x1="32" y1="18" x2="32" y2="52" stroke="#5a5a5a" strokeWidth="0.5" />
    {/* 塔身横纹 */}
    <line x1="19" y1="33" x2="44" y2="33" stroke="#5a5a5a" strokeWidth="0.3" opacity="0.5" />
    <line x1="20" y1="43" x2="45" y2="43" stroke="#5a5a5a" strokeWidth="0.3" opacity="0.5" />
    {/* 塔顶平台 */}
    <rect x="18" y="15" width="28" height="4" rx="1" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="1" />
    {/* 垛口 */}
    <rect x="18" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="27" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="36" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    <rect x="45" y="10" width="5" height="6" fill="url(#tk-beacon-stone)" stroke="#3a3a3a" strokeWidth="0.6" />
    {/* 火焰 — 顶部 */}
    <path d="M32,2 Q38,6 36,12 Q34,9 32,11 Q30,9 28,12 Q26,6 32,2 Z" fill="url(#tk-beacon-fire)" />
    <path d="M32,4 Q35,7 34,11 Q33,9 32,10 Q31,9 30,11 Q29,7 32,4 Z" fill="#ff9800" opacity="0.8" />
    <path d="M32,6 Q33,8 32.5,10 Q32,9 31.5,10 Q31,8 32,6 Z" fill="#ffeb3b" opacity="0.7" />
    {/* 火星 */}
    <circle cx="26" cy="4" r="1" fill="#ff6600" opacity="0.6" />
    <circle cx="38" cy="6" r="0.8" fill="#ff9800" opacity="0.5" />
    <circle cx="32" cy="0" r="0.6" fill="#ffaa00" opacity="0.4" />
    <circle cx="24" cy="8" r="0.5" fill="#ff4400" opacity="0.4" />
    <circle cx="40" cy="3" r="0.7" fill="#ffeb3b" opacity="0.3" />
    {/* 塔门 */}
    <path d="M26,52 L26,42 Q32,37 38,42 L38,52" fill="#2a1a0a" stroke="#1a0a00" strokeWidth="0.8" />
    {/* 浓烟 */}
    <path d="M28,9 Q26,4 29,1" stroke="#8a7a60" strokeWidth="0.8" fill="none" opacity="0.4" />
    <path d="M36,8 Q38,3 35,0" stroke="#8a7a60" strokeWidth="0.6" fill="none" opacity="0.3" />
    <path d="M32,7 Q30,2 33,-1" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.25" />
    {/* 台阶 */}
    <rect x="24" y="52" width="16" height="3" rx="0.5" fill="#6b5a14" stroke="#5a4a14" strokeWidth="0.5" />
  </svg>
);

/** 钱庄 — 金库大门+铜钱堆+算盘（金色系，64×64） */
const MintIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-mint-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e8b84a" />
        <stop offset="100%" stopColor="#b8860b" />
      </linearGradient>
    </defs>
    {/* 建筑主体 */}
    <rect x="10" y="24" width="44" height="28" rx="1.5" fill="#8B6914" stroke="#6b5a14" strokeWidth="1.5" />
    {/* 飞檐屋顶 */}
    <path d="M4,26 L32,10 L60,26 Z" fill="url(#tk-mint-gold)" stroke="#8B6914" strokeWidth="1.2" />
    {/* 飞檐翘角 */}
    <path d="M0,26 Q4,21 8,26" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    <path d="M56,26 Q60,21 64,26" stroke="#d4a030" strokeWidth="1.5" fill="none" />
    {/* 屋脊装饰 */}
    <circle cx="32" cy="10" r="2.5" fill="#d4a030" />
    {/* 屋顶铜钱装饰 — 左右 */}
    <circle cx="20" cy="17" r="4" fill="#b87333" stroke="#8B6914" strokeWidth="0.8" />
    <rect x="18.5" y="15.5" width="3" height="3" fill="#6b5a14" rx="0.3" />
    <circle cx="44" cy="17" r="4" fill="#b87333" stroke="#8B6914" strokeWidth="0.8" />
    <rect x="42.5" y="15.5" width="3" height="3" fill="#6b5a14" rx="0.3" />
    {/* 大门 */}
    <path d="M22,52 L22,34 Q32,27 42,34 L42,52" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="1.2" />
    {/* 门钉 */}
    <circle cx="29" cy="40" r="1.2" fill="#d4a030" />
    <circle cx="35" cy="40" r="1.2" fill="#d4a030" />
    <circle cx="29" cy="46" r="1.2" fill="#d4a030" />
    <circle cx="35" cy="46" r="1.2" fill="#d4a030" />
    {/* 门环 */}
    <circle cx="28" cy="43" r="1.5" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    <circle cx="36" cy="43" r="1.5" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    {/* 匾额 — 钱庄 */}
    <rect x="22" y="26" width="20" height="6" rx="1" fill="#3a2a1a" stroke="#d4a030" strokeWidth="0.8" />
    <text x="32" y="31" textAnchor="middle" fontSize="5" fill="#d4a030" fontFamily="serif" fontWeight="bold">錢莊</text>
    {/* 窗户 */}
    <rect x="12" y="34" width="6" height="6" rx="1" fill="#d4a030" opacity="0.3" />
    <line x1="15" y1="34" x2="15" y2="40" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="46" y="34" width="6" height="6" rx="1" fill="#d4a030" opacity="0.3" />
    <line x1="49" y1="34" x2="49" y2="40" stroke="#8B6914" strokeWidth="0.5" />
    {/* 算盘 — 门前左侧 */}
    <rect x="6" y="44" width="12" height="8" rx="1" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.6" />
    <line x1="6" y1="47" x2="18" y2="47" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="6" y1="50" x2="18" y2="50" stroke="#d4a030" strokeWidth="0.5" />
    {/* 算盘珠子 */}
    <circle cx="9" cy="46" r="1" fill="#b87333" />
    <circle cx="12" cy="46" r="1" fill="#b87333" />
    <circle cx="15" cy="46" r="1" fill="#b87333" />
    <circle cx="8" cy="49" r="1" fill="#b87333" />
    <circle cx="11" cy="49" r="1" fill="#b87333" />
    <circle cx="14" cy="49" r="1" fill="#b87333" />
    <circle cx="17" cy="49" r="1" fill="#b87333" />
    {/* 铜钱堆 — 门前右侧 */}
    <circle cx="52" cy="50" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="50.8" y="48.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    <circle cx="56" cy="52" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="54.8" y="50.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    <circle cx="54" cy="48" r="3" fill="#b87333" stroke="#8B6914" strokeWidth="0.5" />
    <rect x="52.8" y="46.8" width="2.4" height="2.4" fill="#6b5a14" rx="0.2" />
    {/* 台阶 */}
    <rect x="18" y="52" width="28" height="3" rx="0.8" fill="#6b5a14" stroke="#5a4a14" strokeWidth="0.6" />
  </svg>
);

/** 锻兵坊 — 铁砧+锤子+火花+炉火（深红橙色系，64×64） */
const ForgeIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-forge-spark" cx="0.5" cy="0.5" r="0.5">
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
    <path d="M22,44 L42,44 L40,52 L24,52 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="1.2" />
    <path d="M24,40 L40,40 L42,44 L22,44 Z" fill="#6a6a6a" stroke="#4a4a4a" strokeWidth="1" />
    <rect x="27" y="37" width="10" height="4" rx="1.2" fill="#7a7a7a" />
    {/* 被锻造的兵器 */}
    <path d="M30,36 L32,18 L34,36" fill="#8a8a8a" stroke="#6a6a6a" strokeWidth="0.6" opacity="0.7" />
    <polygon points="32,14 34,18 30,18" fill="#c0c0c0" opacity="0.7" />
    {/* 锤子 */}
    <line x1="44" y1="16" x2="38" y2="36" stroke="#6b4226" strokeWidth="3" strokeLinecap="round" />
    <rect x="40" y="12" width="8" height="7" rx="1.5" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" transform="rotate(-15 44 15.5)" />
    {/* 火花效果 */}
    <circle cx="18" cy="30" r="2" fill="url(#tk-forge-spark)" />
    <circle cx="14" cy="24" r="1.2" fill="#ff6600" opacity="0.7" />
    <circle cx="20" cy="20" r="1" fill="#ffaa00" opacity="0.5" />
    <circle cx="12" cy="28" r="0.8" fill="#ff4400" opacity="0.6" />
    <circle cx="24" cy="18" r="0.7" fill="#ffeb3b" opacity="0.4" />
    <circle cx="16" cy="16" r="0.6" fill="#ff6600" opacity="0.3" />
    {/* 炉火 — 左侧 */}
    <path d="M8,46 Q8,36 12,30 Q10,38 16,34 Q14,40 18,38 L18,46 Z" fill="#ff6600" opacity="0.6" />
    <path d="M10,42 Q10,36 12,32 Q11,38 14,36 Q12,40 14,40 L14,42 Z" fill="#ff9800" opacity="0.5" />
    <path d="M11,38 Q11,35 12,33 Q12,37 13,36 L13,38 Z" fill="#ffeb3b" opacity="0.4" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 茶馆 — 两层楼阁+茶幌子+茶壶（翠绿色系，64×64） */
const TeahouseIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-tea-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a8a4a" />
        <stop offset="100%" stopColor="#3a6a3a" />
      </linearGradient>
    </defs>
    {/* 二层楼阁主体 */}
    <rect x="12" y="20" width="36" height="16" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="1.2" />
    {/* 二层飞檐屋顶 */}
    <path d="M6,22 L30,8 L54,22 Z" fill="url(#tk-tea-roof)" stroke="#2e5d2e" strokeWidth="1.2" />
    {/* 飞檐翘角 */}
    <path d="M3,22 Q6,18 10,22" stroke="#5a8a4a" strokeWidth="1.2" fill="none" />
    <path d="M50,22 Q54,18 57,22" stroke="#5a8a4a" strokeWidth="1.2" fill="none" />
    {/* 二层窗户 */}
    <rect x="18" y="23" width="6" height="6" rx="1" fill="#3a6a3a" opacity="0.4" />
    <line x1="21" y1="23" x2="21" y2="29" stroke="#2e5d2e" strokeWidth="0.4" />
    <rect x="36" y="23" width="6" height="6" rx="1" fill="#3a6a3a" opacity="0.4" />
    <line x1="39" y1="23" x2="39" y2="29" stroke="#2e5d2e" strokeWidth="0.4" />
    {/* 二层匾额 */}
    <rect x="22" y="14" width="16" height="6" rx="1" fill="#3a2a1a" stroke="#d4a030" strokeWidth="0.6" />
    <text x="30" y="19" textAnchor="middle" fontSize="4.5" fill="#d4a030" fontFamily="serif" fontWeight="bold">茶館</text>
    {/* 一层主体 */}
    <rect x="10" y="36" width="40" height="16" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="1.2" />
    {/* 一层屋顶/挑檐 */}
    <path d="M6,38 L30,30 L54,38 Z" fill="url(#tk-tea-roof)" stroke="#2e5d2e" strokeWidth="0.8" opacity="0.7" />
    {/* 一层大门 */}
    <path d="M22,52 L22,42 Q30,37 38,42 L38,52" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="0.8" />
    {/* 茶幌子 — 右侧悬挂 */}
    <line x1="52" y1="14" x2="52" y2="32" stroke="#6b4226" strokeWidth="1.2" />
    <rect x="49" y="16" width="7" height="14" rx="1" fill="#5a8a4a" stroke="#3a6a3a" strokeWidth="0.6" />
    <text x="52.5" y="26" textAnchor="middle" fontSize="5.5" fill="#d4a030" fontFamily="serif" fontWeight="bold">茶</text>
    {/* 茶幌子 — 左侧 */}
    <line x1="8" y1="18" x2="8" y2="32" stroke="#6b4226" strokeWidth="1" />
    <rect x="5" y="20" width="6" height="10" rx="0.8" fill="#5a8a4a" stroke="#3a6a3a" strokeWidth="0.5" />
    <text x="8" y="28" textAnchor="middle" fontSize="4.5" fill="#d4a030" fontFamily="serif" fontWeight="bold">茗</text>
    {/* 茶壶 — 左下 */}
    <ellipse cx="16" cy="50" rx="5" ry="3" fill="#8a6a4a" stroke="#6b4a2a" strokeWidth="0.8" />
    <path d="M16,46 L16,43" stroke="#6b4a2a" strokeWidth="1" />
    <ellipse cx="16" cy="43" rx="2.5" ry="1.2" fill="#6b4a2a" />
    {/* 壶嘴 */}
    <path d="M21,48 Q24,46 24,44" stroke="#6b4a2a" strokeWidth="1" fill="none" />
    {/* 壶把 */}
    <path d="M11,47 Q8,47 8,50 Q8,53 11,53" stroke="#6b4a2a" strokeWidth="1" fill="none" />
    {/* 蒸汽 */}
    <path d="M14,41 Q13,38 15,36" stroke="#8a7a60" strokeWidth="0.6" fill="none" opacity="0.5" />
    <path d="M17,40 Q18,37 16,35" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.4" />
    {/* 茶碗 — 右下 */}
    <path d="M42,46 L50,46 L49,52 L43,52 Z" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    <ellipse cx="46" cy="46" rx="4.5" ry="1.5" fill="#c4a886" stroke="#8B7355" strokeWidth="0.4" />
    {/* 蒸汽 — 茶碗 */}
    <path d="M44,44 Q43,41 45,39" stroke="#8a7a60" strokeWidth="0.5" fill="none" opacity="0.5" />
    <path d="M48,43 Q49,40 47,38" stroke="#8a7a60" strokeWidth="0.4" fill="none" opacity="0.4" />
    {/* 地面 */}
    <path d="M2,58 Q32,55 62,58" stroke="#5a4a2a" strokeWidth="0.8" fill="none" opacity="0.4" />
  </svg>
);

/** 粮仓 — 圆顶仓廪+粮袋堆+斗量（棕黄色系） */
const GranaryIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-granary-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c49a28" />
        <stop offset="100%" stopColor="#8B6914" />
      </linearGradient>
    </defs>
    {/* 圆顶仓廪主体 */}
    <rect x="8" y="16" width="20" height="16" rx="1" fill="url(#tk-granary-body)" stroke="#6b5a14" strokeWidth="1" />
    {/* 圆顶 */}
    <path d="M6,18 L18,6 L30,18 Z" fill="#b8860b" stroke="#8B6914" strokeWidth="0.8" />
    {/* 飞檐 */}
    <path d="M4,18 Q6,15 9,18" stroke="#d4a030" strokeWidth="0.6" fill="none" />
    <path d="M27,18 Q30,15 32,18" stroke="#d4a030" strokeWidth="0.6" fill="none" />
    {/* 仓门 */}
    <rect x="14" y="24" width="8" height="8" rx="0.5" fill="#3a2a1a" stroke="#6b5a14" strokeWidth="0.6" />
    <line x1="18" y1="24" x2="18" y2="32" stroke="#6b5a14" strokeWidth="0.4" />
    <circle cx="17" cy="28" r="0.6" fill="#d4a030" />
    <circle cx="19" cy="28" r="0.6" fill="#d4a030" />
    {/* 仓廪横纹 */}
    <line x1="8" y1="20" x2="28" y2="20" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    <line x1="8" y1="24" x2="14" y2="24" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    <line x1="22" y1="24" x2="28" y2="24" stroke="#a08a65" strokeWidth="0.4" opacity="0.5" />
    {/* 仓顶装饰 */}
    <circle cx="18" cy="7" r="1.5" fill="#d4a030" />
    {/* 粮袋堆 — 右侧 */}
    <path d="M30,34 Q30,28 33,26 Q36,28 36,34 Z" fill="#d4b896" stroke="#8B7355" strokeWidth="0.6" />
    <line x1="33" y1="27" x2="33" y2="34" stroke="#8B7355" strokeWidth="0.3" />
    <path d="M32,34 Q32,30 34,28.5 Q36,30 36,34 Z" fill="#c49a28" opacity="0.4" />
    {/* 小粮袋 — 右下 */}
    <rect x="28" y="30" width="4" height="4" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.4" />
    <line x1="28" y1="32" x2="32" y2="32" stroke="#8B7355" strokeWidth="0.3" />
    {/* 斗量 — 左下 */}
    <path d="M4,30 L8,28 L12,30 L10,36 L6,36 Z" fill="#8B6914" stroke="#6b5a14" strokeWidth="0.5" />
    <line x1="4" y1="30" x2="12" y2="30" stroke="#6b5a14" strokeWidth="0.4" />
    {/* 斗内粮食 */}
    <ellipse cx="8" cy="30" rx="3" ry="1" fill="#d4a030" opacity="0.6" />
    {/* 麦穗装饰 — 仓顶 */}
    <line x1="12" y1="8" x2="12" y2="4" stroke="#6b8e5a" strokeWidth="0.8" />
    <ellipse cx="12" cy="3.5" rx="1.2" ry="2" fill="#8aaa5a" />
    <line x1="24" y1="8" x2="24" y2="5" stroke="#6b8e5a" strokeWidth="0.8" />
    <ellipse cx="24" cy="4.5" rx="1" ry="1.8" fill="#8aaa5a" />
    {/* 地面 */}
    <path d="M2,36 Q20,34 38,36" stroke="#5a4a2a" strokeWidth="0.6" fill="none" opacity="0.4" />
  </svg>
);

/** 建筑图标映射 — 根据建筑 ID 返回对应的 SVG 组件 */
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
    return <IconComponent size={size} />;
  }
  // 兜底：显示通用建筑图标
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="24" height="22" rx="2" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <path d="M6,14 L20,4 L34,14" fill="none" stroke="#6b4226" strokeWidth="2" />
      <rect x="16" y="24" width="8" height="10" rx="1" fill="#3a2a1a" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 资源图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════

/** 粮草 — 麦穗形状（金黄色，3-5穗粒）+ 底部捆扎 */
const GrainResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-grain-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f0c040" />
        <stop offset="100%" stopColor="#c49a28" />
      </linearGradient>
    </defs>
    {/* 麦穗茎 */}
    <line x1="10" y1="18" x2="10" y2="3" stroke="#8a7a3a" strokeWidth="1" />
    {/* 顶部穗粒 */}
    <ellipse cx="10" cy="2.5" rx="1.8" ry="2.2" fill="url(#tk-grain-gold)" />
    {/* 第二层穗粒（左右） */}
    <ellipse cx="8" cy="5" rx="1.6" ry="2" fill="url(#tk-grain-gold)" transform="rotate(-25 8 5)" />
    <ellipse cx="12" cy="5" rx="1.6" ry="2" fill="url(#tk-grain-gold)" transform="rotate(25 12 5)" />
    {/* 第三层穗粒 */}
    <ellipse cx="7.5" cy="8.5" rx="1.4" ry="1.8" fill="#d4a030" transform="rotate(-20 7.5 8.5)" />
    <ellipse cx="12.5" cy="8.5" rx="1.4" ry="1.8" fill="#d4a030" transform="rotate(20 12.5 8.5)" />
    {/* 第四层穗粒 */}
    <ellipse cx="8" cy="12" rx="1.2" ry="1.5" fill="#b8943e" transform="rotate(-15 8 12)" />
    <ellipse cx="12" cy="12" rx="1.2" ry="1.5" fill="#b8943e" transform="rotate(15 12 12)" />
    {/* 底部捆扎 */}
    <path d="M7,14 Q10,13 13,14" stroke="#8a6a2a" strokeWidth="1" fill="none" />
    <path d="M7,15 Q10,14 13,15" stroke="#8a6a2a" strokeWidth="0.8" fill="none" />
    {/* 芒刺 */}
    <line x1="10" y1="0.5" x2="10" y2="0" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="7" y1="4" x2="6" y2="3" stroke="#d4a030" strokeWidth="0.4" />
    <line x1="13" y1="4" x2="14" y2="3" stroke="#d4a030" strokeWidth="0.4" />
  </svg>
);

/** 铁 — 铁锭形状（深灰色，带金属光泽渐变） */
const IronResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-iron-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8a8a8a" />
        <stop offset="30%" stopColor="#6a6a6a" />
        <stop offset="60%" stopColor="#9a9a9a" />
        <stop offset="100%" stopColor="#5a5a5a" />
      </linearGradient>
    </defs>
    {/* 铁锭主体 — 梯形 */}
    <path d="M3,14 L5,6 L15,6 L17,14 Z" fill="url(#tk-iron-metal)" stroke="#4a4a4a" strokeWidth="0.8" />
    {/* 铁锭顶部面 */}
    <path d="M5,6 L6,4 L14,4 L15,6 Z" fill="#7a7a7a" stroke="#4a4a4a" strokeWidth="0.5" />
    {/* 金属高光 */}
    <path d="M7,7 L13,7 L12,8 L8,8 Z" fill="white" opacity="0.2" />
    {/* 铁锭底部阴影 */}
    <path d="M3,14 L17,14 L16,16 L4,16 Z" fill="#3a3a3a" stroke="#2a2a2a" strokeWidth="0.5" />
    {/* 矿石纹理斑点 */}
    <circle cx="8" cy="10" r="0.6" fill="#5a5a5a" opacity="0.6" />
    <circle cx="12" cy="11" r="0.5" fill="#5a5a5a" opacity="0.5" />
    <circle cx="10" cy="9" r="0.4" fill="#7a7a7a" opacity="0.4" />
  </svg>
);

/** 木材 — 原木形状（棕色，带年轮纹理） */
const WoodResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tk-wood-bark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B6914" />
        <stop offset="100%" stopColor="#5a3a0a" />
      </linearGradient>
    </defs>
    {/* 原木主体 */}
    <rect x="3" y="7" width="14" height="8" rx="3" fill="url(#tk-wood-bark)" stroke="#3a2a0a" strokeWidth="0.8" />
    {/* 树皮纹理 */}
    <line x1="6" y1="8" x2="6" y2="14" stroke="#4a3a1a" strokeWidth="0.4" opacity="0.5" />
    <line x1="10" y1="7.5" x2="10" y2="14.5" stroke="#4a3a1a" strokeWidth="0.3" opacity="0.4" />
    <line x1="14" y1="8" x2="14" y2="14" stroke="#4a3a1a" strokeWidth="0.4" opacity="0.5" />
    {/* 左端年轮截面 */}
    <ellipse cx="3.5" cy="11" rx="2" ry="4" fill="#b8943e" stroke="#8B6914" strokeWidth="0.6" />
    <ellipse cx="3.5" cy="11" rx="1.2" ry="2.5" fill="none" stroke="#8B6914" strokeWidth="0.4" opacity="0.6" />
    <ellipse cx="3.5" cy="11" rx="0.5" ry="1" fill="#8B6914" opacity="0.5" />
    {/* 右端年轮截面 */}
    <ellipse cx="16.5" cy="11" rx="2" ry="4" fill="#b8943e" stroke="#8B6914" strokeWidth="0.6" />
    <ellipse cx="16.5" cy="11" rx="1.2" ry="2.5" fill="none" stroke="#8B6914" strokeWidth="0.4" opacity="0.6" />
    <ellipse cx="16.5" cy="11" rx="0.5" ry="1" fill="#8B6914" opacity="0.5" />
    {/* 木纹高光 */}
    <path d="M5,9 Q10,8 15,9" stroke="#c49a28" strokeWidth="0.3" fill="none" opacity="0.4" />
  </svg>
);

/** 铜钱 — 方孔圆钱（古铜色，中间方孔，边缘纹路） */
const GoldResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-coin-patina" cx="0.4" cy="0.35" r="0.6">
        <stop offset="0%" stopColor="#d4a030" />
        <stop offset="50%" stopColor="#b87333" />
        <stop offset="100%" stopColor="#8B6914" />
      </radialGradient>
    </defs>
    {/* 外圆 */}
    <circle cx="10" cy="10" r="8.5" fill="url(#tk-coin-patina)" stroke="#6b5a14" strokeWidth="0.8" />
    {/* 外缘纹路 — 短线装饰 */}
    <circle cx="10" cy="10" r="7.5" fill="none" stroke="#d4a030" strokeWidth="0.4" opacity="0.6" />
    {/* 边缘锯齿纹 */}
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
      const rad = (angle * Math.PI) / 180;
      const x1 = 10 + Math.cos(rad) * 7.8;
      const y1 = 10 + Math.sin(rad) * 7.8;
      const x2 = 10 + Math.cos(rad) * 8.3;
      const y2 = 10 + Math.sin(rad) * 8.3;
      return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b5a14" strokeWidth="0.4" />;
    })}
    {/* 内圈 */}
    <circle cx="10" cy="10" r="5.5" fill="none" stroke="#d4a030" strokeWidth="0.6" />
    {/* 方孔 */}
    <rect x="8" y="8" width="4" height="4" fill="#2a1a0a" stroke="#6b5a14" strokeWidth="0.4" rx="0.3" />
    {/* 方孔内高光 */}
    <rect x="8.5" y="8.5" width="1" height="1" fill="#d4a030" opacity="0.15" />
    {/* 古钱铭文位置（上下左右四字位） */}
    <text x="10" y="6" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">開</text>
    <text x="10" y="16" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">元</text>
    <text x="5.5" y="11" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">通</text>
    <text x="14.5" y="11" textAnchor="middle" fontSize="2.5" fill="#d4a030" fontFamily="serif" opacity="0.7">宝</text>
    {/* 铜锈斑点 */}
    <circle cx="6" cy="6" r="0.8" fill="#4a8a3a" opacity="0.2" />
    <circle cx="14" cy="14" r="0.6" fill="#4a8a3a" opacity="0.15" />
  </svg>
);

/** 兵力 — 盾牌+剑形状（朱红） */
const TroopsResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 盾牌 */}
    <path d="M5,4 L5,12 Q5,17 9,18 L9,18 Q9,17 9,18 Q13,17 13,12 L13,4 Z" fill="#8b2020" stroke="#c62828" strokeWidth="0.8" />
    {/* 盾牌内框 */}
    <path d="M6,5 L6,11.5 Q6,15.5 9,16.5 Q12,15.5 12,11.5 L12,5 Z" fill="#a83232" opacity="0.5" />
    {/* 盾牌纹饰 — 横竖线 */}
    <line x1="9" y1="6" x2="9" y2="15" stroke="#d4a030" strokeWidth="0.5" opacity="0.6" />
    <line x1="6.5" y1="10" x2="11.5" y2="10" stroke="#d4a030" strokeWidth="0.5" opacity="0.6" />
    {/* 剑 */}
    <line x1="14" y1="3" x2="18" y2="17" stroke="#c0c0c0" strokeWidth="1.2" strokeLinecap="round" />
    {/* 剑柄横档 */}
    <line x1="13" y1="13" x2="17" y2="12" stroke="#8B7355" strokeWidth="1" strokeLinecap="round" />
    {/* 剑尖 */}
    <polygon points="14,2 14.5,3 13.5,3" fill="#e0e0e0" />
    {/* 剑首 */}
    <circle cx="17.5" cy="16" r="0.8" fill="#d4a030" />
  </svg>
);

/** 民心 — 灯笼形状（新增资源类型） */
const MoraleResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tk-lantern-glow" cx="0.5" cy="0.4" r="0.5">
        <stop offset="0%" stopColor="#ff6b35" />
        <stop offset="100%" stopColor="#c62828" />
      </radialGradient>
    </defs>
    {/* 灯笼挂绳 */}
    <line x1="10" y1="2" x2="10" y2="5" stroke="#8B6914" strokeWidth="0.6" />
    {/* 灯笼顶部 */}
    <rect x="7.5" y="4.5" width="5" height="1.5" rx="0.5" fill="#c62828" stroke="#8b2020" strokeWidth="0.4" />
    {/* 灯笼主体 */}
    <ellipse cx="10" cy="11" rx="5" ry="6" fill="url(#tk-lantern-glow)" stroke="#8b2020" strokeWidth="0.6" />
    {/* 灯笼横纹 */}
    <ellipse cx="10" cy="9" rx="4.5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    <ellipse cx="10" cy="11" rx="5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    <ellipse cx="10" cy="13" rx="4.5" ry="0.5" fill="none" stroke="#d4a030" strokeWidth="0.3" opacity="0.5" />
    {/* 灯笼底部 */}
    <rect x="7.5" y="16.5" width="5" height="1.5" rx="0.5" fill="#c62828" stroke="#8b2020" strokeWidth="0.4" />
    {/* 灯笼穗子 */}
    <line x1="9" y1="18" x2="8.5" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="10" y1="18" x2="10" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="11" y1="18" x2="11.5" y2="19.5" stroke="#d4a030" strokeWidth="0.5" />
    {/* 灯笼内光 */}
    <ellipse cx="10" cy="10" rx="2" ry="3" fill="#ff8c00" opacity="0.25" />
    {/* 福字 */}
    <text x="10" y="12.5" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif" fontWeight="bold" opacity="0.8">福</text>
  </svg>
);

/** 天命 — 玉玺 (翠绿) */
const DestinyResourceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 玉玺底部 */}
    <rect x="4" y="10" width="12" height="7" rx="1" fill="#4a8a5a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺把手 */}
    <rect x="7" y="4" width="6" height="7" rx="2" fill="#5a9a6a" stroke="#3a6a4a" strokeWidth="0.8" />
    {/* 玉玺印文 */}
    <text x="10" y="15" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif" fontWeight="bold">命</text>
    {/* 高光 */}
    <rect x="8" y="5" width="1.5" height="4" rx="0.5" fill="white" opacity="0.15" />
  </svg>
);

/** 资源图标映射 */
const RESOURCE_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  grain: GrainResourceIcon,
  gold: GoldResourceIcon,
  iron: IronResourceIcon,
  wood: WoodResourceIcon,
  troops: TroopsResourceIcon,
  destiny: DestinyResourceIcon,
  morale: MoraleResourceIcon,
};

/** 资源图标组件 — 根据资源 ID 渲染对应的 SVG */
export const ResourceIcon: React.FC<{ resourceId: string; size?: number }> = ({ resourceId, size = 20 }) => {
  const IconComponent = RESOURCE_ICON_MAP[resourceId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：显示通用资源图标
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" fill="#8B7355" stroke="#6b5a3a" strokeWidth="1" />
      <text x="10" y="13" textAnchor="middle" fontSize="8" fill="#d4a030">?</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 科技树图标 SVG 组件 (28×28)
// ═══════════════════════════════════════════════════════════════

/** 军事科技 — 剑 (红色系) — 兵法入门 mil_1 */
const TechSwordIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 剑身 */}
    <path d="M14,3 L16,12 L14,25 L12,12 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.8" />
    <path d="M14,5 L15,12 L14,22 L13,12 Z" fill="#e53935" opacity="0.6" />
    {/* 剑柄横档 */}
    <rect x="9" y="11" width="10" height="2.5" rx="1" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
    {/* 剑柄 */}
    <rect x="12.5" y="13" width="3" height="6" rx="1" fill="#6b4226" stroke="#4a2a16" strokeWidth="0.5" />
    {/* 剑首 */}
    <circle cx="14" cy="20" r="2" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
  </svg>
);

/** 军事科技 — 盾 (红色系) — 阵法精通 mil_2 */
const TechShieldIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 盾牌外形 */}
    <path d="M14,3 L24,7 L24,16 Q24,22 14,26 Q4,22 4,16 L4,7 Z" fill="#a83232" stroke="#8b1a1a" strokeWidth="1" />
    {/* 盾牌内框 */}
    <path d="M14,6 L21,9 L21,15 Q21,20 14,23 Q7,20 7,15 L7,9 Z" fill="none" stroke="#d4a030" strokeWidth="0.8" />
    {/* 盾牌纹章 — 虎 */}
    <text x="14" y="17" textAnchor="middle" fontSize="8" fill="#d4a030" fontFamily="serif" fontWeight="bold">虎</text>
    {/* 高光 */}
    <path d="M10,8 L12,8 L10,14 Z" fill="white" opacity="0.12" />
  </svg>
);

/** 军事科技 — 弓箭 (红色系) — 神兵利器 mil_3 */
const TechBowIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 弓身 */}
    <path d="M8,4 Q4,14 8,24" fill="none" stroke="#8b4513" strokeWidth="2" strokeLinecap="round" />
    {/* 弓弦 */}
    <line x1="8" y1="4" x2="8" y2="24" stroke="#d4a030" strokeWidth="0.8" />
    {/* 箭身 */}
    <line x1="6" y1="14" x2="24" y2="14" stroke="#6b4226" strokeWidth="1.5" />
    {/* 箭头 */}
    <polygon points="24,14 20,11 20,17" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.5" />
    {/* 箭羽 */}
    <path d="M8,12 L6,14 L8,16" fill="#a83232" stroke="#8b1a1a" strokeWidth="0.5" />
  </svg>
);

/** 军事科技 — 战旗 (红色系) — 百战百胜 mil_4 */
const TechBannerIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 旗杆 */}
    <line x1="7" y1="3" x2="7" y2="26" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 旗面 */}
    <path d="M8,4 L24,6 L22,14 L8,12 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.8" />
    {/* 旗面纹章 */}
    <text x="15" y="10" textAnchor="middle" fontSize="6" fill="#d4a030" fontFamily="serif" fontWeight="bold">勝</text>
    {/* 旗杆顶部装饰 */}
    <circle cx="7" cy="3" r="1.5" fill="#d4a030" />
    {/* 旗面飘动效果 */}
    <path d="M8,12 Q14,14 22,14" fill="none" stroke="#e53935" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 经济科技 — 锄头 (绿色系) — 农耕改良 eco_1 */
const TechHoeIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 锄柄 */}
    <line x1="14" y1="8" x2="6" y2="24" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 锄头铁刃 */}
    <path d="M8,6 L20,4 L22,8 L18,10 Q14,8 8,10 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 锄刃高光 */}
    <path d="M10,6 L18,5 L19,7" fill="none" stroke="#6aaa5a" strokeWidth="0.5" opacity="0.6" />
    {/* 泥土碎屑 */}
    <circle cx="20" cy="10" r="1" fill="#8B7355" opacity="0.5" />
    <circle cx="22" cy="8" r="0.8" fill="#8B7355" opacity="0.4" />
  </svg>
);

/** 经济科技 — 钱币 (绿色系) — 商贸繁荣 eco_2 */
const TechCoinIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 外圆 */}
    <circle cx="14" cy="14" r="11" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="1" />
    {/* 内圆 */}
    <circle cx="14" cy="14" r="8.5" fill="none" stroke="#6aaa5a" strokeWidth="0.8" />
    {/* 方孔 */}
    <rect x="11" y="11" width="6" height="6" fill="#2a4a2a" rx="0.5" />
    {/* 铭文 */}
    <text x="14" y="10" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif">商</text>
    <text x="14" y="21" textAnchor="middle" fontSize="4" fill="#d4a030" fontFamily="serif">通</text>
    {/* 高光 */}
    <path d="M8,8 Q10,6 14,6" fill="none" stroke="white" strokeWidth="0.8" opacity="0.15" />
  </svg>
);

/** 经济科技 — 粮仓 (绿色系) — 治国安邦 eco_3 */
const TechGranaryIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 粮仓屋顶 */}
    <path d="M4,12 L14,4 L24,12 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 粮仓主体 */}
    <rect x="6" y="12" width="16" height="11" rx="1" fill="#5a8a4a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 仓门 */}
    <rect x="11" y="16" width="6" height="7" rx="0.5" fill="#3a5a2a" />
    <line x1="14" y1="16" x2="14" y2="23" stroke="#2e5d2e" strokeWidth="0.5" />
    {/* 麦穗装饰 */}
    <ellipse cx="8" cy="9" rx="1.5" ry="2.5" fill="#8aaa5a" transform="rotate(-20 8 9)" />
    <ellipse cx="20" cy="9" rx="1.5" ry="2.5" fill="#8aaa5a" transform="rotate(20 20 9)" />
    {/* 装饰横纹 */}
    <line x1="6" y1="15" x2="22" y2="15" stroke="#6aaa5a" strokeWidth="0.5" opacity="0.5" />
  </svg>
);

/** 经济科技 — 皇冠 (绿色系) — 富国强兵 eco_4 */
const TechCrownIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 皇冠主体 */}
    <path d="M4,18 L6,8 L10,14 L14,6 L18,14 L22,8 L24,18 Z" fill="#4a7a3a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 皇冠底部 */}
    <rect x="4" y="18" width="20" height="5" rx="1" fill="#5a8a4a" stroke="#2e5d2e" strokeWidth="0.8" />
    {/* 宝石 */}
    <circle cx="10" cy="13" r="1.2" fill="#d4a030" />
    <circle cx="14" cy="8" r="1.5" fill="#d4a030" />
    <circle cx="18" cy="13" r="1.2" fill="#d4a030" />
    {/* 底部纹饰 */}
    <line x1="6" y1="20" x2="22" y2="20" stroke="#6aaa5a" strokeWidth="0.5" />
  </svg>
);

/** 文化科技 — 竹简 (蓝色系) — 招贤纳士 cul_1 */
const TechBambooSlipIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 竹简条 */}
    {[5, 8, 11, 14, 17, 20, 23].map((x, i) => (
      <rect key={i} x={x} y="4" width="2.2" height="20" rx="0.5" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.4" />
    ))}
    {/* 编绳 */}
    <line x1="4" y1="9" x2="25" y2="9" stroke="#d4a030" strokeWidth="0.8" />
    <line x1="4" y1="19" x2="25" y2="19" stroke="#d4a030" strokeWidth="0.8" />
    {/* 文字 */}
    <text x="14" y="15" textAnchor="middle" fontSize="5" fill="#a0c4e8" fontFamily="serif">賢</text>
  </svg>
);

/** 文化科技 — 书卷 (蓝色系) — 礼贤下士 cul_2 */
const TechScrollIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 书卷主体 */}
    <rect x="6" y="6" width="16" height="16" rx="2" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.8" />
    {/* 书卷卷角 */}
    <path d="M18,6 Q22,6 22,10 L18,10 Z" fill="#5a7fb5" stroke="#2e4a7a" strokeWidth="0.5" />
    {/* 文字行 */}
    <line x1="9" y1="10" x2="19" y2="10" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="13" x2="17" y2="13" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="16" x2="18" y2="16" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    <line x1="9" y1="19" x2="15" y2="19" stroke="#a0c4e8" strokeWidth="0.6" opacity="0.6" />
    {/* 印章 */}
    <circle cx="18" cy="18" r="2" fill="none" stroke="#c62828" strokeWidth="0.6" opacity="0.7" />
  </svg>
);

/** 文化科技 — 笔墨 (蓝色系) — 王道仁政 cul_3 */
const TechBrushInkIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 毛笔笔杆 */}
    <line x1="18" y1="3" x2="10" y2="19" stroke="#6b4226" strokeWidth="2" strokeLinecap="round" />
    {/* 毛笔笔毫 */}
    <path d="M10,19 Q8,22 10,25 Q12,22 10,19" fill="#2a2a2a" stroke="#1a1a1a" strokeWidth="0.3" />
    {/* 墨迹 */}
    <ellipse cx="10" cy="24" rx="2" ry="1" fill="#1a1a1a" opacity="0.3" />
    {/* 砚台 */}
    <ellipse cx="18" cy="22" rx="6" ry="3.5" fill="#4a4a4a" stroke="#2a2a2a" strokeWidth="0.6" />
    <ellipse cx="18" cy="21" rx="4" ry="2" fill="#1a1a1a" opacity="0.6" />
    {/* 装饰 — 墨滴 */}
    <circle cx="13" cy="16" r="0.8" fill="#4a6fa5" opacity="0.5" />
  </svg>
);

/** 文化科技 — 星辉 (蓝色系) — 天下归心 cul_4 */
const TechStarIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 外圈光晕 */}
    <circle cx="14" cy="14" r="11" fill="none" stroke="#4a6fa5" strokeWidth="0.5" opacity="0.3" />
    <circle cx="14" cy="14" r="8" fill="none" stroke="#5a7fb5" strokeWidth="0.3" opacity="0.2" />
    {/* 五角星 */}
    <polygon
      points="14,4 16.5,10.5 23,11 18,15.5 19.5,22 14,18.5 8.5,22 10,15.5 5,11 11.5,10.5"
      fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.6"
    />
    {/* 中心光点 */}
    <circle cx="14" cy="13" r="2" fill="#a0c4e8" opacity="0.5" />
    {/* 装饰小星 */}
    <circle cx="6" cy="6" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="22" cy="6" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="6" cy="22" r="0.8" fill="#5a7fb5" opacity="0.5" />
    <circle cx="22" cy="22" r="0.8" fill="#5a7fb5" opacity="0.5" />
  </svg>
);

/** 科技图标映射 — 根据 tech id 查找对应图标 */
const TECH_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  mil_1: TechSwordIcon,
  mil_2: TechShieldIcon,
  mil_3: TechBowIcon,
  mil_4: TechBannerIcon,
  eco_1: TechHoeIcon,
  eco_2: TechCoinIcon,
  eco_3: TechGranaryIcon,
  eco_4: TechCrownIcon,
  cul_1: TechBambooSlipIcon,
  cul_2: TechScrollIcon,
  cul_3: TechBrushInkIcon,
  cul_4: TechStarIcon,
};

/** 科技树图标组件 — 根据科技 ID 渲染对应的古风 SVG 图标 */
export const TechIcon: React.FC<{ techId: string; size?: number }> = ({ techId, size = 28 }) => {
  const IconComponent = TECH_ICON_MAP[techId];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：通用科技图标
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="10" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.8" />
      <text x="14" y="17" textAnchor="middle" fontSize="10" fill="#d4a030" fontFamily="serif">?</text>
    </svg>
  );
};

/** 锁定状态图标 — 古风铜锁 (替代通用 🔒) */
export const TechLockedIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    {/* 锁体 */}
    <rect x="7" y="13" width="14" height="11" rx="2" fill="#5a4a3a" stroke="#3a2a1a" strokeWidth="0.8" />
    {/* 锁环 */}
    <path d="M10,13 L10,9 Q10,5 14,5 Q18,5 18,9 L18,13" fill="none" stroke="#8B7355" strokeWidth="1.5" strokeLinecap="round" />
    {/* 锁孔 */}
    <circle cx="14" cy="18" r="2" fill="#2a1a0a" />
    <rect x="13" y="18" width="2" height="3" fill="#2a1a0a" />
    {/* 铜锈质感 */}
    <path d="M9,15 L19,15" stroke="#6b5a3a" strokeWidth="0.4" opacity="0.5" />
  </svg>
);

/** 研究中旋转动画图标 */
export const TechResearchingIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" className="tk-tech-research-spin">
    {/* 外环 */}
    <circle cx="14" cy="14" r="11" fill="none" stroke="#d4a030" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
    {/* 内环 */}
    <circle cx="14" cy="14" r="7" fill="none" stroke="#d4a030" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.4" />
    {/* 中心点 */}
    <circle cx="14" cy="14" r="2.5" fill="#d4a030" opacity="0.8" />
    {/* 火花 */}
    <circle cx="14" cy="3" r="1" fill="#ff8c00" opacity="0.7" />
    <circle cx="25" cy="14" r="1" fill="#ff8c00" opacity="0.5" />
    <circle cx="14" cy="25" r="1" fill="#ff8c00" opacity="0.3" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════
// 武将技能图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════

/** 火焰图标 — 火计/火攻等火系技能 */
const SkillFireIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M10,4 Q13,7 13,10 Q13,13 10,16 Q7,13 7,10 Q7,7 10,4 Z" fill="#e65100" stroke="#bf360c" strokeWidth="0.5" />
    <path d="M10,6 Q12,8 12,10 Q12,12 10,14 Q8,12 8,10 Q8,8 10,6 Z" fill="#ff9800" opacity="0.8" />
    <path d="M10,9 Q11,10 11,11 Q11,12 10,13 Q9,12 9,11 Q9,10 10,9 Z" fill="#ffeb3b" opacity="0.7" />
  </svg>
);

/** 剑图标 — 武圣/猛进等攻击技能 */
const SkillSwordIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <line x1="5" y1="5" x2="13" y2="13" stroke="#c0c0c0" strokeWidth="1.8" strokeLinecap="round" />
    <polygon points="5,3.5 5.8,5 4.2,5" fill="#e0e0e0" />
    <line x1="3" y1="11" x2="8" y2="6" stroke="#8B7355" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="5.5" cy="5.5" r="0.8" fill="#d4a030" />
    <path d="M12,13 L15,16" stroke="#6b4226" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** 盾牌图标 — 八阵图/坚守等防御技能 */
const SkillShieldIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 防御类 — 蓝色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(30,136,229,0.1)" stroke="rgba(30,136,229,0.3)" strokeWidth="0.5" />
    <path d="M10,3 L16,5.5 L16,10.5 Q16,15 10,17 Q4,15 4,10.5 L4,5.5 Z" fill="#4a6fa5" stroke="#2e4a7a" strokeWidth="0.6" />
    <path d="M10,5 L14,6.5 L14,9.5 Q14,13 10,15 Q6,13 6,9.5 L6,6.5 Z" fill="none" stroke="#a0c4e8" strokeWidth="0.4" />
    <text x="10" y="12" textAnchor="middle" fontSize="4.5" fill="#d4a030" fontFamily="serif" fontWeight="bold">守</text>
  </svg>
);

/** 书卷图标 — 鬼谋/策略等智力技能 */
const SkillScrollIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <rect x="5" y="5" width="10" height="10" rx="1" fill="#d4b896" stroke="#8B7355" strokeWidth="0.5" />
    <rect x="4" y="4" width="1.5" height="12" rx="0.5" fill="#b87333" />
    <rect x="14.5" y="4" width="1.5" height="12" rx="0.5" fill="#b87333" />
    <line x1="6.5" y1="8" x2="13.5" y2="8" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
    <line x1="6.5" y1="10" x2="12.5" y2="10" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
    <line x1="6.5" y1="12" x2="10.5" y2="12" stroke="#5a4a3a" strokeWidth="0.35" opacity="0.5" />
  </svg>
);

/** 治愈图标 — 仁德/治疗等恢复技能 */
const SkillHealIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 辅助类 — 绿色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(67,160,71,0.1)" stroke="rgba(67,160,71,0.3)" strokeWidth="0.5" />
    <line x1="10" y1="5" x2="10" y2="15" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" />
    <line x1="5" y1="10" x2="15" y2="10" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" />
    <circle cx="10" cy="10" r="2" fill="#81c784" opacity="0.5" />
  </svg>
);

/** 怒吼图标 — 怒吼/号令等范围减益技能 */
const SkillRoarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M8,5 Q10,4 12,5 L13,8 Q13,11 10,13 Q7,11 7,8 Z" fill="#c62828" stroke="#8b1a1a" strokeWidth="0.5" />
    <path d="M8,8 Q10,6 12,8" fill="none" stroke="#1a1a1a" strokeWidth="0.7" />
    <ellipse cx="8.5" cy="7" rx="0.7" ry="0.5" fill="#1a1a1a" />
    <ellipse cx="11.5" cy="7" rx="0.7" ry="0.5" fill="#1a1a1a" />
    <path d="M4,7 Q3,9 4,11" fill="none" stroke="#ff9800" strokeWidth="0.7" opacity="0.6" />
    <path d="M16,7 Q17,9 16,11" fill="none" stroke="#ff9800" strokeWidth="0.7" opacity="0.6" />
    <path d="M3,5.5 Q1,9 3,12.5" fill="none" stroke="#ff9800" strokeWidth="0.5" opacity="0.4" />
    <path d="M17,5.5 Q19,9 17,12.5" fill="none" stroke="#ff9800" strokeWidth="0.5" opacity="0.4" />
  </svg>
);

/** 突进图标 — 单骑/飞将等冲锋技能 */
const SkillChargeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <polygon points="15,10 10,6 10,8 4,8 4,12 10,12 10,14" fill="#d4a030" stroke="#8B6914" strokeWidth="0.5" />
    <line x1="3" y1="7" x2="3" y2="13" stroke="#c62828" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="1.5" y1="8" x2="1.5" y2="12" stroke="#c62828" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
  </svg>
);

/** 魅惑图标 — 倾国/离间等控制技能 */
const SkillCharmIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <path d="M10,4 Q14,4 15,8 Q16,12 10,16 Q4,12 5,8 Q6,4 10,4 Z" fill="#e91e63" stroke="#880e4f" strokeWidth="0.5" opacity="0.8" />
    <path d="M10,6 Q13,6 13.5,8.5 Q13.5,11 10,13.5 Q6.5,11 6.5,8.5 Q7,6 10,6 Z" fill="#f48fb1" opacity="0.5" />
    <circle cx="8.5" cy="9" r="0.8" fill="#1a1a1a" />
    <circle cx="11.5" cy="9" r="0.8" fill="#1a1a1a" />
    <path d="M8.5,11.5 Q10,13 11.5,11.5" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
    <path d="M14,4 L15.5,2.5" stroke="#e91e63" strokeWidth="0.5" opacity="0.5" />
    <path d="M15,5.5 L16.5,4.5" stroke="#e91e63" strokeWidth="0.5" opacity="0.4" />
  </svg>
);

/** 蓄力图标 — 隐忍/坚韧等蓄力技能 */
const SkillChargeUpIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 策略类 — 紫色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(123,31,162,0.1)" stroke="rgba(123,31,162,0.25)" strokeWidth="0.5" />
    <circle cx="10" cy="10" r="6" fill="none" stroke="#7e57c2" strokeWidth="0.8" />
    <circle cx="10" cy="10" r="3.5" fill="none" stroke="#b388ff" strokeWidth="0.6" />
    <circle cx="10" cy="10" r="1.2" fill="#d4a030" />
    <path d="M10,4 L10,5.5" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M10,14.5 L10,16" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M4,10 L5.5,10" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M14.5,10 L16,10" stroke="#d4a030" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

/** 远程图标 — 烈弓等远程攻击技能 */
const SkillBowIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 攻击类 — 红色六边形背景 */}
    <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="rgba(229,57,53,0.12)" stroke="rgba(229,57,53,0.3)" strokeWidth="0.5" />
    <path d="M7,4 Q3,10 7,16" fill="none" stroke="#8b4513" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="7" y1="4" x2="7" y2="16" stroke="#d4a030" strokeWidth="0.5" />
    <line x1="6" y1="10" x2="16" y2="10" stroke="#6b4226" strokeWidth="1" />
    <polygon points="16,10 14,8.5 14,11.5" fill="#c62828" />
    <path d="M8,8.5 L6.5,10 L8,11.5" fill="#a83232" opacity="0.7" />
  </svg>
);

/** 激励图标 — 激励/平衡等增益技能 */
const SkillBuffIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    {/* 辅助类 — 绿色圆形背景 */}
    <circle cx="10" cy="10" r="9" fill="rgba(67,160,71,0.1)" stroke="rgba(67,160,71,0.3)" strokeWidth="0.5" />
    <polygon points="10,3 11.5,7 16,7 12.5,10.5 13.5,15 10,12.5 6.5,15 7.5,10.5 4,7 8.5,7" fill="#d4a030" stroke="#8B6914" strokeWidth="0.4" />
    <polygon points="10,5.5 11,8 13.5,8 11.5,10 12,12.5 10,11 8,12.5 8.5,10 6.5,8 9,8" fill="#ffeb3b" opacity="0.5" />
  </svg>
);

/** 吸血图标 — 奸雄等吸血技能 */
const SkillDrainIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,2 Q16,4 16,10 Q16,16 10,18 Q4,16 4,10 Q4,4 10,2 Z" fill="#b71c1c" stroke="#7f0000" strokeWidth="0.6" />
    <path d="M10,4 Q14,6 14,10 Q14,14 10,16 Q6,14 6,10 Q6,6 10,4 Z" fill="#e53935" opacity="0.5" />
    <path d="M8,8 L10,5 L12,8 L10,11 Z" fill="#ffeb3b" opacity="0.7" />
    <line x1="10" y1="11" x2="10" y2="14" stroke="#ffeb3b" strokeWidth="0.8" opacity="0.5" />
  </svg>
);

/** 技能图标映射 — 根据技能类型 key 返回对应 SVG */
const SKILL_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  fire: SkillFireIcon,
  sword: SkillSwordIcon,
  shield: SkillShieldIcon,
  scroll: SkillScrollIcon,
  heal: SkillHealIcon,
  roar: SkillRoarIcon,
  charge: SkillChargeIcon,
  charm: SkillCharmIcon,
  chargeup: SkillChargeUpIcon,
  bow: SkillBowIcon,
  buff: SkillBuffIcon,
  drain: SkillDrainIcon,
};

/** 技能图标组件 — 根据技能类型 key 渲染对应的 SVG */
export const SkillIcon: React.FC<{ skillType: string; size?: number }> = ({ skillType, size = 20 }) => {
  const IconComponent = SKILL_ICON_MAP[skillType];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // 兜底：通用技能图标
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" fill="#d4a030" opacity="0.3" />
      <text x="10" y="13" textAnchor="middle" fontSize="8" fill="#d4a030">✦</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 装备槽位图标 SVG 组件 (20×20)
// ═══════════════════════════════════════════════════════════════

/** 武器槽图标 */
const EquipWeaponIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="4" x2="13" y2="13" stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round" />
    <polygon points="4,2.5 4.8,4 3.2,4" fill="#e0e0e0" />
    <line x1="2" y1="10" x2="7" y2="5" stroke="#8B7355" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="4" cy="4" r="0.8" fill="#d4a030" />
  </svg>
);

/** 防具槽图标 */
const EquipArmorIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,2 L17,5 L17,11 Q17,16 10,18 Q3,16 3,11 L3,5 Z" fill="#5a5a5a" stroke="#3a3a3a" strokeWidth="0.8" />
    <path d="M10,4 L15,6 L15,10 Q15,14 10,16 Q5,14 5,10 L5,6 Z" fill="none" stroke="#8a8a8a" strokeWidth="0.5" />
    <line x1="10" y1="6" x2="10" y2="14" stroke="#8a8a8a" strokeWidth="0.4" opacity="0.5" />
    <line x1="6" y1="9" x2="14" y2="9" stroke="#8a8a8a" strokeWidth="0.4" opacity="0.5" />
  </svg>
);

/** 坐骑槽图标 */
const EquipMountIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,14 L6,8 L8,6 L10,7 L12,6 L14,8 L16,14" fill="none" stroke="#8b4513" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="14" x2="5" y2="17" stroke="#8b4513" strokeWidth="1" strokeLinecap="round" />
    <line x1="14" y1="14" x2="15" y2="17" stroke="#8b4513" strokeWidth="1" strokeLinecap="round" />
    <circle cx="14" cy="6" r="1.5" fill="#8b4513" />
    <path d="M4,10 Q2,8 4,7" fill="none" stroke="#6b8e5a" strokeWidth="0.8" opacity="0.6" />
  </svg>
);

/** 装备槽图标映射 */
const EQUIP_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  weapon: EquipWeaponIcon,
  armor: EquipArmorIcon,
  mount: EquipMountIcon,
};

/** 装备槽图标组件 */
export const EquipSlotIcon: React.FC<{ slotType: string; size?: number }> = ({ slotType, size = 20 }) => {
  const IconComponent = EQUIP_ICON_MAP[slotType];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="#8B7355" strokeWidth="0.8" strokeDasharray="2 2" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// 建筑升级进度条组件
// ═══════════════════════════════════════════════════════════════

/**
 * BuildingProgressBar — 建筑升级进度条（竹简卷轴样式）
 *
 * 显示当前等级 → 下一等级的进度。
 * 使用竹简卷轴古风样式，进度条用竹节纹理。
 * 颜色随进度变化：红(0-30%) → 黄(30-70%) → 绿(70-100%)
 */
export const BuildingProgressBar: React.FC<{
  currentLevel: number;
  progress: number; // 0~1
  width?: number;
  height?: number;
}> = ({ currentLevel, progress, width = 110, height = 4 }) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pct = Math.floor(clampedProgress * 100);

  // 进度条颜色
  let barColor = '#a85241'; // 红
  if (pct >= 70) barColor = '#4a7a3a'; // 绿
  else if (pct >= 30) barColor = '#d4a030'; // 黄

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* 竹简卷轴进度条 */}
      <div style={{
        width: '100%', height,
        borderRadius: Math.floor(height / 2),
        background: 'rgba(139,115,85,0.15)',
        overflow: 'hidden',
        border: '0.5px solid rgba(139,115,85,0.2)',
        position: 'relative',
      }}>
        {/* 竹节纹理背景 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(139,115,85,0.08) 8px, rgba(139,115,85,0.08) 9px)',
        }} />
        {/* 进度填充 */}
        <div style={{
          width: `${pct}%`, height: '100%',
          borderRadius: Math.floor(height / 2),
          background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
          transition: 'width 0.5s ease',
          position: 'relative',
        }}>
          {/* 竹节高光 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
            borderRadius: Math.floor(height / 2),
          }} />
        </div>
      </div>
      {/* 等级标签 */}
      <div style={{
        fontSize: 8, color: '#8a7a60',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Lv.{currentLevel}</span>
        <span>Lv.{currentLevel + 1}</span>
      </div>
    </div>
  );
};
