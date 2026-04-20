/**
 * 联盟系统 — 核心类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 覆盖：联盟创建/加入、成员管理(三级权限)、频道公告、等级福利、
 *       联盟Boss、联盟任务、联盟商店、联盟排行榜
 *
 * @module core/alliance/alliance.types
 */

// ─────────────────────────────────────────────
// 1. 联盟基础
// ─────────────────────────────────────────────

/** 联盟成员角色（三级权限） */
export enum AllianceRole {
  /** 盟主 — 全部权限 */
  LEADER = 'LEADER',
  /** 军师 — 审批+公告+踢人 */
  ADVISOR = 'ADVISOR',
  /** 成员 — 基础权限 */
  MEMBER = 'MEMBER',
}

/** 联盟成员数据 */
export interface AllianceMember {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 角色 */
  role: AllianceRole;
  /** 战力 */
  power: number;
  /** 加入时间（时间戳） */
  joinTime: number;
  /** 今日贡献值 */
  dailyContribution: number;
  /** 累计贡献值 */
  totalContribution: number;
  /** 今日Boss挑战次数 */
  dailyBossChallenges: number;
}

/** 联盟申请状态 */
export enum ApplicationStatus {
  /** 待审批 */
  PENDING = 'PENDING',
  /** 已批准 */
  APPROVED = 'APPROVED',
  /** 已拒绝 */
  REJECTED = 'REJECTED',
}

/** 联盟申请 */
export interface AllianceApplication {
  /** 申请ID */
  id: string;
  /** 联盟ID */
  allianceId: string;
  /** 申请人ID */
  playerId: string;
  /** 申请人名称 */
  playerName: string;
  /** 申请人战力 */
  power: number;
  /** 申请时间 */
  timestamp: number;
  /** 状态 */
  status: ApplicationStatus;
}

/** 联盟公告 */
export interface AllianceAnnouncement {
  /** 公告ID */
  id: string;
  /** 发布者ID */
  authorId: string;
  /** 发布者名称 */
  authorName: string;
  /** 内容 */
  content: string;
  /** 是否置顶 */
  pinned: boolean;
  /** 发布时间 */
  timestamp: number;
}

/** 联盟频道消息 */
export interface AllianceMessage {
  /** 消息ID */
  id: string;
  /** 发送者ID */
  senderId: string;
  /** 发送者名称 */
  senderName: string;
  /** 内容 */
  content: string;
  /** 发送时间 */
  timestamp: number;
}

/** 联盟等级配置 */
export interface AllianceLevelConfig {
  /** 等级 */
  level: number;
  /** 所需经验 */
  requiredExp: number;
  /** 成员上限 */
  maxMembers: number;
  /** 资源产出加成(%) */
  resourceBonus: number;
  /** 远征收益加成(%) */
  expeditionBonus: number;
}

/** 联盟数据 */
export interface AllianceData {
  /** 联盟ID */
  id: string;
  /** 联盟名称 */
  name: string;
  /** 联盟宣言 */
  declaration: string;
  /** 盟主ID */
  leaderId: string;
  /** 联盟等级 */
  level: number;
  /** 联盟经验 */
  experience: number;
  /** 成员列表 */
  members: Record<string, AllianceMember>;
  /** 待审批申请 */
  applications: AllianceApplication[];
  /** 公告列表（最多3条置顶） */
  announcements: AllianceAnnouncement[];
  /** 频道消息 */
  messages: AllianceMessage[];
  /** 创建时间 */
  createTime: number;
  /** 今日Boss是否已击杀 */
  bossKilledToday: boolean;
  /** 上次Boss刷新时间 */
  lastBossRefreshTime: number;
  /** 今日联盟任务完成数 */
  dailyTaskCompleted: number;
  /** 上次每日重置时间 */
  lastDailyReset: number;
}

/** 联盟创建配置 */
export interface AllianceCreateConfig {
  /** 创建消耗元宝 */
  createCostGold: number; // 500
  /** 联盟名称最小长度 */
  nameMinLength: number; // 2
  /** 联盟名称最大长度 */
  nameMaxLength: number; // 8
  /** 最大置顶公告数 */
  maxPinnedAnnouncements: number; // 3
  /** 频道消息保留数量 */
  maxMessages: number; // 100
}

// ─────────────────────────────────────────────
// 2. 联盟Boss
// ─────────────────────────────────────────────

/** Boss状态 */
export enum BossStatus {
  /** 存活 */
  ALIVE = 'ALIVE',
  /** 已击杀 */
  KILLED = 'KILLED',
}

/** 联盟Boss数据 */
export interface AllianceBoss {
  /** Boss实例ID */
  id: string;
  /** Boss名称 */
  name: string;
  /** 等级（随联盟等级递增） */
  level: number;
  /** 最大生命值 */
  maxHp: number;
  /** 当前生命值 */
  currentHp: number;
  /** 状态 */
  status: BossStatus;
  /** 伤害记录 playerId → damage */
  damageRecords: Record<string, number>;
  /** 每日每人挑战上限 */
  dailyChallengeLimit: number;
  /** 刷新时间 */
  refreshTime: number;
}

/** Boss挑战结果 */
export interface BossChallengeResult {
  /** 造成伤害 */
  damage: number;
  /** 是否击杀 */
  isKillingBlow: boolean;
  /** 个人获得公会币 */
  guildCoinReward: number;
  /** 击杀全员奖励 */
  killReward: {
    guildCoin: number;
    destinyPoint: number;
  } | null;
}

/** Boss伤害排行条目 */
export interface BossDamageEntry {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 造成伤害 */
  damage: number;
  /** 伤害占比(%) */
  damagePercent: number;
  /** 排名 */
  rank: number;
}

/** Boss配置 */
export interface AllianceBossConfig {
  /** 每人每日挑战次数 */
  dailyChallengeLimit: number; // 3
  /** 击杀全员公会币奖励 */
  killGuildCoinReward: number; // 30
  /** 击杀全员天命奖励 */
  killDestinyReward: number; // 20
  /** 参与奖公会币 */
  participationGuildCoin: number; // 5
  /** Boss基础HP */
  baseHp: number; // 100000
  /** 每级HP增长系数 */
  hpPerLevel: number; // 50000
}

// ─────────────────────────────────────────────
// 3. 联盟任务
// ─────────────────────────────────────────────

/** 联盟任务类型 */
export enum AllianceTaskType {
  /** 全员共享进度 */
  SHARED = 'SHARED',
  /** 个人贡献 */
  PERSONAL = 'PERSONAL',
}

/** 联盟任务状态 */
export enum AllianceTaskStatus {
  /** 进行中 */
  ACTIVE = 'ACTIVE',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 已领取奖励 */
  CLAIMED = 'CLAIMED',
}

/** 联盟任务定义 */
export interface AllianceTaskDef {
  /** 任务ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  taskType: AllianceTaskType;
  /** 目标数量 */
  targetCount: number;
  /** 奖励：联盟经验 */
  allianceExpReward: number;
  /** 奖励：个人公会币 */
  guildCoinReward: number;
}

/** 联盟任务实例 */
export interface AllianceTaskInstance {
  /** 任务定义ID */
  defId: string;
  /** 当前进度 */
  currentProgress: number;
  /** 状态 */
  status: AllianceTaskStatus;
  /** 已领取奖励的玩家集合 */
  claimedPlayers: Set<string>;
}

/** 联盟任务配置 */
export interface AllianceTaskConfig {
  /** 每日任务数量 */
  dailyTaskCount: number; // 3
  /** 每日重置时间（小时） */
  resetHour: number; // 0
}

// ─────────────────────────────────────────────
// 4. 联盟商店
// ─────────────────────────────────────────────

/** 联盟商店商品 */
export interface AllianceShopItem {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品类型 */
  type: 'recruit_order' | 'equip_box' | 'speed_item' | 'hero_fragment';
  /** 公会币价格 */
  guildCoinCost: number;
  /** 每周限购数量（0=不限） */
  weeklyLimit: number;
  /** 已购数量 */
  purchased: number;
  /** 解锁所需联盟等级 */
  requiredAllianceLevel: number;
}

/** 联盟商店配置 */
export interface AllianceShopConfig {
  /** 商品列表 */
  items: AllianceShopItem[];
}

// ─────────────────────────────────────────────
// 5. 联盟排行榜
// ─────────────────────────────────────────────

/** 联盟排行类型 */
export enum AllianceRankType {
  /** 公会战力榜 */
  POWER = 'POWER',
  /** 公会Boss伤害榜 */
  BOSS_DAMAGE = 'BOSS_DAMAGE',
}

/** 联盟排行条目 */
export interface AllianceRankEntry {
  /** 联盟ID */
  allianceId: string;
  /** 联盟名称 */
  allianceName: string;
  /** 分数 */
  score: number;
  /** 排名 */
  rank: number;
}

// ─────────────────────────────────────────────
// 6. 联盟系统状态
// ─────────────────────────────────────────────

/** 联盟系统玩家状态 */
export interface AlliancePlayerState {
  /** 当前所在联盟ID（空=未加入） */
  allianceId: string;
  /** 公会币余额 */
  guildCoins: number;
  /** 今日Boss挑战次数 */
  dailyBossChallenges: number;
  /** 今日个人贡献 */
  dailyContribution: number;
  /** 上次每日重置 */
  lastDailyReset: number;
  /** 上次补签次数(本周) */
  weeklyRetroactiveCount: number;
  /** 上次补签重置时间 */
  lastRetroactiveReset: number;
}

/** 联盟系统存档 */
export interface AllianceSaveData {
  /** 存档版本 */
  version: number;
  /** 玩家状态 */
  playerState: AlliancePlayerState;
  /** 联盟数据（如果玩家在联盟中） */
  allianceData: AllianceData | null;
}
