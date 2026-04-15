/**
 * 三国霸业 — 放置游戏引擎 v3.0
 *
 * 基于统一子系统架构，继承 IdleGameEngine 基类。
 * 使用 13 个可复用子系统模块：BuildingSystem, PrestigeSystem, UnitSystem,
 * StageSystem, BattleSystem, TechTreeSystem, TerritorySystem,
 * FloatingTextSystem, ParticleSystem, StatisticsTracker, UnlockChecker, InputHandler。
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { BuildingSystem } from '@/engines/idle/modules/BuildingSystem';
import { PrestigeSystem } from '@/engines/idle/modules/PrestigeSystem';
import { UnitSystem, UnitRarity } from '@/engines/idle/modules/UnitSystem';
import { StageSystem } from '@/engines/idle/modules/StageSystem';
import { BattleSystem } from '@/engines/idle/modules/BattleSystem';
import { TechTreeSystem } from '@/engines/idle/modules/TechTreeSystem';
import { TerritorySystem } from '@/engines/idle/modules/TerritorySystem';
import { FloatingTextSystem } from '@/engines/idle/modules/FloatingTextSystem';
import { ParticleSystem } from '@/engines/idle/modules/ParticleSystem';
import { StatisticsTracker } from '@/engines/idle/modules/StatisticsTracker';
import { UnlockChecker } from '@/engines/idle/modules/UnlockChecker';
import { InputHandler } from '@/engines/idle/modules/InputHandler';
import {
  GAME_ID, GAME_TITLE, BUILDINGS, GENERALS, TERRITORIES, TECHS, BATTLES,
  STAGES, PRESTIGE_CONFIG, COLOR_THEME, RARITY_COLORS, RESOURCES,
  INITIAL_RESOURCES, INITIALLY_UNLOCKED, CLICK_REWARD, FREE_STARTER_HERO,
  type BuildingDef, type GeneralDef, type TerritoryDef, type TechDef,
  type BattleDef, type StageDef,
} from './constants';

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

type ActivePanel = 'none' | 'prestige' | 'tech' | 'territory' | 'battle' | 'generals';

export interface ThreeKingdomsSaveState {
  resources: Record<string, number>;
  buildings: Record<string, number>;
  generals: Record<string, { level: number; exp: number }>;
  conqueredTerritories: string[];
  completedBattles: string[];
  researchedTechs: string[];
  currentStage: string;
  prestigeState: { currency: number; count: number };
  gameStats: string;
  totalPlayTime: number;
}

// ═══════════════════════════════════════════════════════════════
// 引擎
// ═══════════════════════════════════════════════════════════════

export class ThreeKingdomsEngine extends IdleGameEngine {
  protected _gameId = GAME_ID;

  // 子系统
  private bldg!: BuildingSystem<BuildingDef>;
  private prest!: PrestigeSystem;
  private units!: UnitSystem;
  private stages!: StageSystem<StageDef>;
  private battles!: BattleSystem<BattleDef>;
  private techs!: TechTreeSystem<TechDef>;
  private terr!: TerritorySystem<TerritoryDef>;
  private ftSys!: FloatingTextSystem;
  private ptSys!: ParticleSystem;
  private stats!: StatisticsTracker;
  private unlock!: UnlockChecker;
  private input!: InputHandler;

  // 状态
  private res: Record<string, number> = {};
  private psCache: Record<string, number> = {};
  private panel: ActivePanel = 'none';
  private selIdx = 0;
  private scroll = 0;
  private playTime = 0;

  // ─── 生命周期 ───────────────────────────────────────────

  protected onInit(): void {
    super.onInit();
    this.res = { ...INITIAL_RESOURCES };

    this.bldg = new BuildingSystem<BuildingDef>({ initiallyUnlocked: INITIALLY_UNLOCKED });
    this.bldg.register(BUILDINGS);

    this.prest = new PrestigeSystem(PRESTIGE_CONFIG);
    this.units = new UnitSystem(this.toUnitDefs());
    this.stages = new StageSystem<StageDef>(STAGES, 'yellow_turban');
    this.battles = new BattleSystem<BattleDef>(BATTLES);
    this.techs = new TechTreeSystem<TechDef>(TECHS);
    this.terr = new TerritorySystem<TerritoryDef>(TERRITORIES);
    this.ftSys = new FloatingTextSystem();
    this.ptSys = new ParticleSystem();
    this.stats = new StatisticsTracker(this.makeStatDefs());
    this.unlock = new UnlockChecker();
    this.input = new InputHandler({
      bindings: [
        { key: 't', action: 'custom', actionId: 'toggle_tech' },
        { key: 'T', action: 'custom', actionId: 'toggle_tech' },
        { key: 'm', action: 'custom', actionId: 'toggle_territory' },
        { key: 'M', action: 'custom', actionId: 'toggle_territory' },
        { key: 'b', action: 'custom', actionId: 'toggle_battle' },
        { key: 'B', action: 'custom', actionId: 'toggle_battle' },
        { key: 'u', action: 'custom', actionId: 'toggle_generals' },
        { key: 'U', action: 'custom', actionId: 'toggle_generals' },
      ],
    });
    this.bindInput();

    this.panel = 'none';
    this.selIdx = 0;
    this.scroll = 0;
    this.playTime = 0;
    this.psCache = {};

    // ── 新手福利：免费赠送一个 uncommon 武将 ──
    this.grantFreeStarterGeneral();

    this.emit('stateChange');
  }

  /**
   * 新手福利：赠送 FREE_STARTER_HERO 指定的 uncommon 武将（免费抽卡）。
   * 不消耗任何资源，直接解锁招募。
   */
  private grantFreeStarterGeneral(): void {
    const chosen = GENERALS.find(g => g.id === FREE_STARTER_HERO);
    if (!chosen) return;
    const result = this.units.unlock(chosen.id);
    if (result.ok) {
      this.stats.increment('totalGeneralsRecruited');
      this.ftSys.add(`🎉 免费武将：${chosen.name}！`, 0.5, 0.3, {
        style: { color: '#4caf50', fontSize: 20 },
      });
    }
  }

  /** 获取免费赠送的初始武将名称（供 UI 引导使用） */
  public getStarterGeneralName(): string | null {
    const chosen = GENERALS.find(g => g.id === FREE_STARTER_HERO);
    if (!chosen) return null;
    return this.units.isUnlocked(chosen.id) ? chosen.name : null;
  }

  // ─── 更新 ───────────────────────────────────────────────

  protected onUpdate(dt: number): void {
    const sec = dt / 1000;
    this.playTime += sec;

    // 全局倍率
    const sMult = this.stages.getMultiplier('production');
    const pMult = this.prest.getMultiplier();
    const tMult = this.techMult();
    const gMult = sMult * pMult * tMult;

    // 建筑产出
    const prod = this.bldg.getTotalProduction();
    this.psCache = {};
    for (const [r, rate] of Object.entries(prod)) {
      if (rate > 0) {
        const adj = rate * gMult;
        this.psCache[r] = adj;
        this.giveRes(r, adj * sec);
      }
    }

    // 领土收益
    const inc = this.terr.getIncomePerSecond();
    for (const [r, amt] of Object.entries(inc)) {
      if (amt > 0) this.giveRes(r, amt * sec);
    }

    // 子系统更新
    this.battles.update(dt);
    this.techs.update(dt);
    this.terr.update(dt);
    this.ftSys.update(dt);
    this.ptSys.update(dt);

    // 战斗结算
    const bState = this.battles.getCurrentState();
    if (bState.currentWave && bState.aliveEnemies.length === 0) {
      this.onWaveClear();
    }

    // 阶段检查
    this.checkStage();
    this.checkUnlocks();
  }

  // ─── 渲染 ───────────────────────────────────────────────

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBg(ctx, w, h);
    this.drawHeader(ctx, w);
    this.drawResBar(ctx, w);

    const cy = 100, ch = h - 145;
    switch (this.panel) {
      case 'none': this.drawBuildings(ctx, w, cy, ch); break;
      case 'prestige': this.drawPrestige(ctx, w, cy, ch); break;
      case 'tech': this.drawTech(ctx, w, cy, ch); break;
      case 'territory': this.drawTerritory(ctx, w, cy, ch); break;
      case 'battle': this.drawBattle(ctx, w, cy, ch); break;
      case 'generals': this.drawGenerals(ctx, w, cy, ch); break;
    }

    this.drawFooter(ctx, w, h);
    this.ftSys.render(ctx);
    this.ptSys.render(ctx);
  }

  // ─── 输入 ───────────────────────────────────────────────

  public handleKeyDown(key: string): void {
    this.input.handleKeyDown(key);
  }

  private bindInput(): void {
    this.input.on('click', () => this.doClick());
    this.input.on('select_down', () => {
      const n = this.bldg.getUnlockedBuildings().length;
      this.selIdx = Math.min(this.selIdx + 1, n - 1);
    });
    this.input.on('select_up', () => {
      this.selIdx = Math.max(this.selIdx - 1, 0);
    });
    this.input.on('confirm', () => this.buyBuilding());
    this.input.on('prestige', () => this.toggle('prestige'));
    this.input.on('cancel', () => { this.panel = 'none'; });
    this.input.on('custom', (e) => {
      const map: Record<string, ActivePanel> = {
        toggle_tech: 'tech', toggle_territory: 'territory',
        toggle_battle: 'battle', toggle_generals: 'generals',
      };
      const p = map[e.actionId || ''];
      if (p) this.toggle(p);
    });
  }

  // ─── 序列化 ─────────────────────────────────────────────

  public serialize(): ThreeKingdomsSaveState {
    const gens: Record<string, { level: number; exp: number }> = {};
    for (const g of GENERALS) {
      const s = this.units.getState(g.id);
      if (s?.unlocked) gens[g.id] = { level: s.level, exp: s.exp };
    }
    return {
      resources: { ...this.res },
      buildings: this.bldg.saveState(),
      generals: gens,
      conqueredTerritories: this.terr.getConqueredIds(),
      completedBattles: [], // derived from battle state
      researchedTechs: (this.techs.saveState().researched as string[]) || [],
      currentStage: this.stages.getCurrentId(),
      prestigeState: { currency: this.prest.getState().currency, count: this.prest.getState().count },
      gameStats: this.stats.serialize(),
      totalPlayTime: this.playTime,
    };
  }

  public deserialize(d: ThreeKingdomsSaveState): void {
    this.res = { ...d.resources };
    this.bldg.loadState(d.buildings);
    for (const [id, g] of Object.entries(d.generals)) {
      this.units.loadState({ [id]: { defId: id, level: g.level, exp: g.exp, unlocked: true,
        currentEvolutionBranch: null, evolutionStartTime: null, equippedIds: [] } });
    }
    for (const tId of d.conqueredTerritories) this.terr.conquer(tId);
    this.techs.loadState({ researched: d.researchedTechs, current: null, queue: [], totalInvestment: {} });
    this.stages.loadState({ currentStageId: d.currentStage });
    const ps = d.prestigeState;
    this.prest.loadState({ currency: ps.currency, count: ps.count });
    if (d.gameStats) this.stats.deserialize(d.gameStats);
    this.playTime = d.totalPlayTime || 0;
    this.emit('stateChange');
  }

  // ─── 声望转生 ───────────────────────────────────────────

  public doPrestige(): void {
    const total = (this.res.grain || 0) + (this.res.gold || 0) + (this.res.troops || 0);
    const preview = this.prest.getPreview(total);
    if (!preview.canPrestige) return;

    const result = this.prest.doPrestige(total);
    if (!result) return;

    const ret = PRESTIGE_CONFIG.retention;
    this.res.grain = (this.res.grain || 0) * ret;
    this.res.gold = (this.res.gold || 0) * ret;
    this.res.troops = (this.res.troops || 0) * ret;

    // 重置建筑和阶段
    this.bldg.reset(true); // keep unlocked, reset levels
    this.stages.loadState({ currentStageId: 'yellow_turban' });
    // 保留：武将、声望、领土、科技

    this.stats.increment('totalPrestiges');
    this.ftSys.add('声望转生！天命加持！', 0.5, 0.4, { style: { color: COLOR_THEME.accentGold, fontSize: 24 } });
    this.emit('stateChange');
  }

  // ═══════════════════════════════════════════════════════════
  // 核心操作
  // ═══════════════════════════════════════════════════════════

  private doClick(): void {
    if (this._status !== 'playing') return;
    for (const [r, a] of Object.entries(CLICK_REWARD)) this.giveRes(r, a);
    for (const [r, rate] of Object.entries(this.psCache)) {
      if (rate > 0) this.giveRes(r, rate * 0.1);
    }
    this.stats.increment('totalClicks');
    this.emit('stateChange');
  }

  private buyBuilding(): void {
    const bs = this.bldg.getUnlockedBuildings();
    if (this.selIdx >= bs.length) return;
    const b = bs[this.selIdx];
    const cost = this.bldg.getCost(b.id);
    if (!this.canPay(cost)) return;
    this.pay(cost);
    this.bldg.purchase(b.id, (id, a) => this.has(id, a), () => {});
    this.ftSys.add(`+1 ${b.name}`, 0.5, 0.5, { style: { color: COLOR_THEME.accentGreen, fontSize: 14 } });
    this.emit('stateChange');
  }

  private onWaveClear(): void {
    const rewards = this.battles.settleWave();
    for (const [r, a] of Object.entries(rewards.rewards)) this.giveRes(r, a);
    this.stats.increment('totalBattlesWon');
    this.ftSys.add('战斗胜利！', 0.5, 0.5, { style: { color: COLOR_THEME.accentGreen, fontSize: 18 } });
  }

  // ═══════════════════════════════════════════════════════════
  // 资源
  // ═══════════════════════════════════════════════════════════

  private giveRes(id: string, amt: number): void {
    this.res[id] = Math.max(0, (this.res[id] || 0) + amt);
    if (amt > 0) {
      const k = `total${id[0].toUpperCase()}${id.slice(1)}`;
      this.stats.increment(k, amt);
    }
  }
  private canPay(cost: Record<string, number>): boolean {
    return Object.entries(cost).every(([id, a]) => (this.res[id] || 0) >= a);
  }
  private pay(cost: Record<string, number>): void {
    for (const [id, a] of Object.entries(cost)) this.res[id] = Math.max(0, (this.res[id] || 0) - a);
  }
  private has(id: string, a: number): boolean { return (this.res[id] || 0) >= a; }

  // ═══════════════════════════════════════════════════════════
  // 辅助
  // ═══════════════════════════════════════════════════════════

  private techMult(): number {
    let m = 1;
    for (const t of TECHS) {
      if (this.techs.isResearched(t.id)) {
        for (const e of t.effects) {
          if (e.type === 'multiplier' && (e.target === 'all_resources' || e.target === 'all')) m *= e.value;
        }
      }
    }
    return m;
  }

  private checkStage(): void {
    const next = this.stages.getNextStage();
    if (!next) return;
    const can = Object.entries(next.requiredResources).every(([id, a]) => (this.res[id] || 0) >= a);
    if (can) {
      this.stages.advance(this.res, (_type: string, targetId: string) => this.res[targetId] || 0);
      this.ftSys.add(`阶段解锁：${next.name}`, 0.5, 0.3, { style: { color: COLOR_THEME.accentGold, fontSize: 22 } });
    }
  }

  private checkUnlocks(): void {
    for (const b of BUILDINGS) {
      if (this.bldg.isUnlocked(b.id) || !b.requires?.length) continue;
      if (b.requires.every(r => this.bldg.getLevel(r) > 0)) this.bldg.forceUnlock(b.id);
    }
  }

  private toggle(p: ActivePanel): void {
    this.panel = this.panel === p ? 'none' : p;
    this.scroll = 0;
  }

  private toUnitDefs() {
    const rMap: Record<string, number> = { uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    return GENERALS.map(g => ({
      id: g.id, name: g.name, description: g.evolution,
      rarity: rMap[g.rarity] ?? 0,
      baseStats: { ...g.baseStats }, growthRates: { ...g.growthRates },
      evolutions: [],
      recruitCost: Object.entries(g.recruitCost).map(([materialId, quantity]) => ({ materialId, quantity })),
      maxLevel: 50, tags: [g.faction, g.rarity], passiveSkillIds: [],
    }));
  }

  private makeStatDefs() {
    const ids = [
      'totalGrain', 'totalGold', 'totalTroops', 'totalDestiny',
      'totalClicks', 'totalBattlesWon', 'totalTerritoriesConquered',
      'totalPrestiges', 'totalGeneralsRecruited', 'totalTechsResearched', 'totalPlayTime',
    ];
    return ids.map(id => ({
      id, displayName: id, category: 'game',
      valueType: 'number' as const, aggregation: 'sum' as const,
      initialValue: 0, linkedAchievementIds: [], persistent: true,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  private drawBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, COLOR_THEME.bgGradient1);
    g.addColorStop(1, COLOR_THEME.bgGradient2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawHeader(ctx: CanvasRenderingContext2D, w: number): void {
    const stage = this.stages.getCurrent();
    ctx.fillStyle = COLOR_THEME.accentGold;
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(GAME_TITLE, w / 2, 22);
    ctx.textAlign = 'left';
    if (stage) {
      ctx.fillStyle = stage.themeColor || COLOR_THEME.textSecondary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${stage.iconAsset} ${stage.name} — ${stage.description}`, 10, 42);
    }
    // 面板标签
    const tabs = [
      { id: 'none' as ActivePanel, label: '🏗️建筑' },
      { id: 'generals' as ActivePanel, label: '⚔️武将' },
      { id: 'territory' as ActivePanel, label: '🗺️领土' },
      { id: 'tech' as ActivePanel, label: '📜科技' },
      { id: 'battle' as ActivePanel, label: '🔥战斗' },
      { id: 'prestige' as ActivePanel, label: '👑声望' },
    ];
    const tw = (w - 20) / tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const active = this.panel === tabs[i].id;
      ctx.fillStyle = active ? COLOR_THEME.selectedBg : COLOR_THEME.panelBg;
      rr(ctx, 10 + i * tw, 50, tw - 2, 28, 4); ctx.fill();
      if (active) { ctx.strokeStyle = COLOR_THEME.selectedBorder; ctx.lineWidth = 1; rr(ctx, 10 + i * tw, 50, tw - 2, 28, 4); ctx.stroke(); }
      ctx.fillStyle = active ? COLOR_THEME.accentGold : COLOR_THEME.textSecondary;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tabs[i].label, 10 + i * tw + (tw - 2) / 2, 68);
      ctx.textAlign = 'left';
    }
  }

  private drawResBar(ctx: CanvasRenderingContext2D, w: number): void {
    const y = 88;
    ctx.fillStyle = COLOR_THEME.panelBg;
    rr(ctx, 5, y - 10, w - 10, 18, 3); ctx.fill();
    const cw = (w - 10) / RESOURCES.length;
    for (let i = 0; i < RESOURCES.length; i++) {
      const r = RESOURCES[i];
      const v = fmt(this.res[r.id] || 0);
      const ps = this.psCache[r.id];
      const psT = ps > 0 ? `+${fmt(ps)}/s` : '';
      ctx.fillStyle = COLOR_THEME.textPrimary;
      ctx.font = '11px sans-serif';
      ctx.fillText(`${r.icon}${v}`, 10 + i * cw, y);
      if (psT) { ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '9px sans-serif'; ctx.fillText(psT, 10 + i * cw, y + 10); }
    }
  }

  private drawBuildings(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const bs = this.bldg.getUnlockedBuildings();
    const ih = 55, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(bs.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= bs.length) break;
      const d = bs[idx], lv = this.bldg.getLevel(d.id), cost = this.bldg.getCost(d.id);
      const ok = this.canPay(cost), sel = idx === this.selIdx, iy = sy + i * ih;
      ctx.fillStyle = sel ? COLOR_THEME.selectedBg : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      if (sel) { ctx.strokeStyle = COLOR_THEME.selectedBorder; ctx.lineWidth = 1; rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.stroke(); }
      ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '13px sans-serif';
      ctx.fillText(`${d.icon} ${d.name} Lv.${lv}`, 18, iy + 18);
      const pr = lv > 0 ? (this.psCache[d.productionResource] || 0) : 0;
      ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '10px sans-serif';
      ctx.fillText(`产出: ${fmt(pr)}/s`, 18, iy + 35);
      const cs = Object.entries(cost).map(([, c]) => fmt(c)).join('+');
      ctx.fillStyle = ok ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
      ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`升级: ${cs}`, w - 18, iy + 26);
      ctx.textAlign = 'left';
    }
  }

  private drawPrestige(ctx: CanvasRenderingContext2D, w: number, sy: number, _h: number): void {
    const st = this.prest.getState();
    const total = (this.res.grain || 0) + (this.res.gold || 0) + (this.res.troops || 0);
    const pv = this.prest.getPreview(total);
    ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('👑 声望转生', 18, sy + 22);
    ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '12px sans-serif';
    let y = sy + 44;
    const lines = [
      `天命: ${fmt(st.currency)} | 转生: ${st.count}次`,
      `当前倍率: ×${st.multiplier.toFixed(2)}`,
      `本次获得: ${pv.gain} 天命`,
      `新倍率: ×${pv.newMultiplier.toFixed(2)}`,
      `资源保留: ${(pv.retentionRate * 100).toFixed(0)}%`,
    ];
    for (const l of lines) { ctx.fillText(l, 18, y); y += 20; }
    if (pv.warning) { ctx.fillStyle = COLOR_THEME.textDim; ctx.fillText(pv.warning, 18, y); }
    y += 30;
    ctx.fillStyle = pv.canPrestige ? 'rgba(255,215,0,0.2)' : COLOR_THEME.panelBg;
    rr(ctx, w / 2 - 70, y, 140, 32, 6); ctx.fill();
    ctx.fillStyle = pv.canPrestige ? COLOR_THEME.accentGold : COLOR_THEME.textDim;
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pv.canPrestige ? '执行转生 (R)' : '资源不足', w / 2, y + 20);
    ctx.textAlign = 'left';
  }

  private drawTech(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 50, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(TECHS.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= TECHS.length) break;
      const t = TECHS[idx], iy = sy + i * ih;
      const done = this.techs.isResearched(t.id);
      const cur = this.techs.getCurrentResearch();
      const active = cur?.techId === t.id;
      const can = !done && !active && this.techs.canResearch(t.id, this.res);
      ctx.fillStyle = done ? 'rgba(76,175,80,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = done ? COLOR_THEME.accentGreen : COLOR_THEME.textPrimary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${done ? '✅' : t.icon} ${t.name} (T${t.tier})`, 18, iy + 18);
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(t.description, 18, iy + 34);
      if (active && cur) {
        ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`${(cur.progress * 100).toFixed(0)}%`, w - 18, iy + 24);
      } else if (!done) {
        const cs = Object.values(t.cost).map(c => fmt(c)).join('+');
        ctx.fillStyle = can ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
        ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(cs, w - 18, iy + 24);
      }
      ctx.textAlign = 'left';
    }
  }

  private drawTerritory(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 48, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(TERRITORIES.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= TERRITORIES.length) break;
      const t = TERRITORIES[idx], iy = sy + i * ih;
      const own = this.terr.isConquered(t.id);
      ctx.fillStyle = own ? 'rgba(76,175,80,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = own ? COLOR_THEME.accentGreen : COLOR_THEME.textPrimary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${own ? '✅' : '🔒'} ${t.name} (${t.type})`, 18, iy + 18);
      const rs = Object.entries(t.rewards).map(([, a]) => `${a}/s`).join(' ');
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(`收益: ${rs} | 需兵力: ${fmt(t.powerRequired)}`, 18, iy + 34);
    }
  }

  private drawBattle(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const stage = this.stages.getCurrent();
    if (stage) {
      ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${stage.iconAsset} ${stage.name}`, 18, sy + 18);
    }
    const sbs = BATTLES.filter(b => b.stageId === (stage?.id || 'yellow_turban'));
    const ih = 60, by = sy + 30;
    for (let i = 0; i < sbs.length; i++) {
      const b = sbs[i], iy = by + i * ih;
      if (iy + ih > sy + h) break;
      const bs = this.battles.getCurrentState();
      const active = bs.currentWave === b.id;
      ctx.fillStyle = active ? 'rgba(255,215,0,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      const e = b.enemies[0];
      ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '12px sans-serif';
      ctx.fillText(`第${b.wave}波: ${e?.name || '?'}${e?.isBoss ? ' 👑' : ''}`, 18, iy + 18);
      if (active) {
        const hp = bs.aliveEnemies[0]?.currentHp || 0;
        const mhp = e?.hp || 1;
        this.drawBar(ctx, 18, iy + 30, w - 50, 10, hp / mhp);
      } else {
        const rs = Object.entries(b.rewards).map(([r, a]) => `${a}${r}`).join(' ');
        ctx.fillStyle = COLOR_THEME.textSecondary; ctx.font = '10px sans-serif';
        ctx.fillText(`奖励: ${rs}`, 18, iy + 40);
      }
    }
  }

  private drawGenerals(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 65, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(GENERALS.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= GENERALS.length) break;
      const g = GENERALS[idx], iy = sy + i * ih;
      const own = this.units.isUnlocked(g.id);
      const rc = RARITY_COLORS[g.rarity] || COLOR_THEME.textPrimary;
      ctx.fillStyle = COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = rc; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(g.name, 18, iy + 18);
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(`[${g.rarity}] ${g.faction.toUpperCase()}`, 18, iy + 33);
      const s = g.baseStats;
      ctx.fillStyle = COLOR_THEME.textSecondary; ctx.font = '10px sans-serif';
      ctx.fillText(`攻${s.attack} 防${s.defense} 智${s.intelligence} 统${s.command}`, 18, iy + 50);
      ctx.textAlign = 'right';
      if (!own) {
        const ok = this.canPay(g.recruitCost);
        ctx.fillStyle = ok ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
        ctx.font = '11px sans-serif';
        ctx.fillText(`招募: ${g.recruitCost.gold}💰`, w - 18, iy + 30);
      } else {
        ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '11px sans-serif';
        ctx.fillText('✅ 已招募', w - 18, iy + 30);
      }
      ctx.textAlign = 'left';
    }
  }

  private drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('[Space]点击 [↑↓]选择 [Enter]购买 [R]声望 [T]科技 [M]领土 [B]战斗 [U]武将 [Esc]返回', w / 2, h - 12);
    ctx.textAlign = 'left';
  }

  private drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.fillStyle = COLOR_THEME.unaffordable; rr(ctx, x, y, w, h, 3); ctx.fill();
    const fw = Math.max(0, w * Math.min(1, r));
    if (fw > 0) { ctx.fillStyle = COLOR_THEME.accentGold; rr(ctx, x, y, fw, h, 3); ctx.fill(); }
  }

  // ─── 公共接口 ───────────────────────────────────────────

  public getResources(): Record<string, number> { return { ...this.res }; }
  public getActivePanel(): ActivePanel { return this.panel; }
  public getPrestigeState() { return this.prest.getState(); }
  public getStageInfo() { return this.stages.getCurrent(); }

  // ═══════════════════════════════════════════════════════════
  // 核心玩法公共 API
  // ═══════════════════════════════════════════════════════════

  /**
   * 招募武将
   *
   * 检查武将是否已招募、资源是否足够，扣除招募费用并解锁武将。
   *
   * @param id - 武将 ID（如 'liubei', 'guanyu'）
   * @returns 是否招募成功
   */
  public recruitGeneral(id: string): boolean {
    // 查找武将定义
    const def = GENERALS.find(g => g.id === id);
    if (!def) return false;

    // 检查是否已招募
    if (this.units.isUnlocked(id)) return false;

    // 检查招募费用是否足够
    const cost = def.recruitCost;
    if (!this.canPay(cost)) return false;

    // 扣除招募费用
    this.pay(cost);

    // 解锁武将
    const result = this.units.unlock(id);
    if (!result.ok) return false;

    this.stats.increment('totalGeneralsRecruited');
    this.emit('generalRecruited', { generalId: id, name: def.name });
    this.emit('stateChange');
    return true;
  }

  /**
   * 征服领土
   *
   * 检查领土是否已征服、是否与已征服领土相邻、兵力是否足够。
   * 消耗兵力后征服领土，获得奖励。
   *
   * @param id - 领土 ID（如 'chengdu', 'luoyang'）
   * @returns 是否征服成功
   */
  public conquerTerritory(id: string): boolean {
    // 查找领土定义
    const def = TERRITORIES.find(t => t.id === id);
    if (!def) return false;

    // 检查是否已征服
    if (this.terr.isConquered(id)) return false;

    // 检查是否与已征服领土相邻（首块领土或已有相邻领土）
    if (!this.terr.canAttack(id) && this.terr.getConqueredIds().length > 0) return false;

    // 检查兵力是否足够
    const troopsNeeded = def.powerRequired;
    if ((this.res.troops || 0) < troopsNeeded) return false;

    // 消耗兵力
    this.res.troops = Math.max(0, (this.res.troops || 0) - troopsNeeded);

    // 征服领土
    const result = this.terr.conquer(id);

    // 发放征服奖励
    for (const [r, a] of Object.entries(result.rewards)) this.giveRes(r, a);
    for (const [r, a] of Object.entries(result.bonus)) this.giveRes(r, a);

    this.stats.increment('totalTerritoriesConquered');
    this.emit('territoryConquered', { territoryId: id, name: def.name });
    this.emit('stateChange');
    return true;
  }

  /**
   * 研究科技
   *
   * 检查科技是否已研究、前置科技是否完成、资源是否足够。
   * 扣除研究费用并启动研究流程。
   *
   * @param id - 科技 ID（如 'mil_1', 'eco_2'）
   * @returns 是否成功开始研究
   */
  public researchTech(id: string): boolean {
    // 查找科技定义
    const def = TECHS.find(t => t.id === id);
    if (!def) return false;

    // 检查是否已研究
    if (this.techs.isResearched(id)) return false;

    // 检查前置科技是否完成
    if (!def.requires.every(r => this.techs.isResearched(r))) return false;

    // 检查资源是否足够
    if (!this.canPay(def.cost)) return false;

    // 扣除资源并启动研究
    this.pay(def.cost);
    const ok = this.techs.research(id, this.res);
    if (!ok) return false;

    this.stats.increment('totalTechsResearched');
    this.emit('techResearched', { techId: id, name: def.name });
    this.emit('stateChange');
    return true;
  }

  /**
   * 开始战斗
   *
   * 检查战斗是否已解锁（属于当前阶段）、是否已完成，
   * 以及是否有已招募武将参与。
   *
   * @param battleId - 战斗波次 ID（如 'yellow_1', 'chibi_3'）
   * @returns 是否成功开始战斗
   */
  public startBattle(battleId: string): boolean {
    // 查找战斗定义
    const def = BATTLES.find(b => b.id === battleId);
    if (!def) return false;

    // 检查战斗是否属于当前阶段（是否已解锁）
    const currentStage = this.stages.getCurrent();
    if (!currentStage || def.stageId !== currentStage.id) return false;

    // 检查是否有已招募武将
    const hasGeneral = GENERALS.some(g => this.units.isUnlocked(g.id));
    if (!hasGeneral) return false;

    // 初始化战斗状态
    const ok = this.battles.startWave(battleId);
    if (!ok) return false;

    this.emit('battleStarted', { battleId, stageId: def.stageId, wave: def.wave });
    this.emit('stateChange');
    return true;
  }

  /**
   * 通过 ID 购买建筑
   *
   * 根据建筑 ID 找到建筑，检查是否已解锁、资源是否足够，
   * 执行购买并升级建筑等级。
   *
   * @param id - 建筑 ID（如 'farm', 'market', 'barracks'）
   * @returns 是否购买成功
   */
  public buyBuildingById(id: string): boolean {
    // 检查建筑是否已注册
    if (!this.bldg.isUnlocked(id)) return false;

    // 检查资源是否足够
    const cost = this.bldg.getCost(id);
    if (!this.canPay(cost)) return false;

    // 执行购买
    const ok = this.bldg.purchase(id, (rId, amt) => this.has(rId, amt), () => {});
    if (!ok) return false;

    // 手动扣除资源（purchase 的 spendResource 回调为空，由 pay 统一处理）
    this.pay(cost);

    const def = BUILDINGS.find(b => b.id === id);
    this.emit('buildingPurchased', { buildingId: id, name: def?.name || id });
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级建筑
   *
   * 检查建筑当前等级、资源是否足够，执行升级操作。
   * 本质上与 buyBuildingById 相同（每次购买即升一级），
   * 但提供语义化的升级接口。
   *
   * @param id - 建筑 ID
   * @returns 是否升级成功
   */
  public upgradeBuilding(id: string): boolean {
    // 检查建筑是否已解锁且已拥有（等级 >= 1 才能升级）
    if (!this.bldg.isUnlocked(id)) return false;
    if (this.bldg.getLevel(id) < 1) return false;

    // 检查资源是否足够
    const cost = this.bldg.getCost(id);
    if (!this.canPay(cost)) return false;

    // 执行升级
    const ok = this.bldg.purchase(id, (rId, amt) => this.has(rId, amt), () => {});
    if (!ok) return false;

    // 扣除资源
    this.pay(cost);

    const newLevel = this.bldg.getLevel(id);
    const def = BUILDINGS.find(b => b.id === id);
    this.emit('buildingUpgraded', { buildingId: id, name: def?.name || id, level: newLevel });
    this.emit('stateChange');
    return true;
  }

  // ─── 公共 getter 方法 ───────────────────────────────────

  /** 获取指定建筑的当前等级 */
  public getBuildingLevel(id: string): number {
    return this.bldg.getLevel(id);
  }

  /** 检查指定武将是否已招募 */
  public isGeneralRecruited(id: string): boolean {
    return this.units.isUnlocked(id);
  }

  /** 检查指定科技是否已研究完成 */
  public isTechResearched(id: string): boolean {
    return this.techs.isResearched(id);
  }

  /** 检查指定领土是否已征服 */
  public isTerritoryConquered(id: string): boolean {
    return this.terr.isConquered(id);
  }

  /** 获取指定类型资源的当前数量 */
  public getResourceAmount(type: string): number {
    return this.res[type] || 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}
