/**
 * 印度文明放置游戏 (Civ India) — 主引擎 v3.0
 *
 * 基于统一子系统架构，继承 IdleGameEngine 基类。
 * 使用子系统：BuildingSystem, PrestigeSystem, UnitSystem,
 * StageSystem, TechTreeSystem, FloatingTextSystem,
 * ParticleSystem, StatisticsTracker, UnlockChecker, InputHandler。
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { BuildingSystem } from '@/engines/idle/modules/BuildingSystem';
import { PrestigeSystem } from '@/engines/idle/modules/PrestigeSystem';
import { UnitSystem } from '@/engines/idle/modules/UnitSystem';
import { StageSystem } from '@/engines/idle/modules/StageSystem';
import { TechTreeSystem } from '@/engines/idle/modules/TechTreeSystem';
import { FloatingTextSystem } from '@/engines/idle/modules/FloatingTextSystem';
import { ParticleSystem } from '@/engines/idle/modules/ParticleSystem';
import { StatisticsTracker } from '@/engines/idle/modules/StatisticsTracker';
import { UnlockChecker } from '@/engines/idle/modules/UnlockChecker';
import { InputHandler } from '@/engines/idle/modules/InputHandler';
import {
  GAME_ID, GAME_TITLE, BUILDINGS, HEROES, DYNASTIES, INVENTIONS,
  PRESTIGE_CONFIG, COLOR_THEME, RARITY_COLORS, RESOURCES,
  INITIAL_RESOURCES, INITIALLY_UNLOCKED, CLICK_REWARD,
  type HeroDef,
} from './constants';
import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

type ActivePanel = 'none' | 'prestige' | 'tech' | 'heroes';

export interface CivIndiaSaveState {
  resources: Record<string, number>;
  buildings: Record<string, number>;
  heroes: Record<string, { level: number; exp: number }>;
  researchedTechs: string[];
  currentStage: string;
  prestigeState: { currency: number; count: number };
  gameStats: string;
  totalPlayTime: number;
}

// ═══════════════════════════════════════════════════════════════
// 引擎
// ═══════════════════════════════════════════════════════════════

export class CivIndiaEngine extends IdleGameEngine {
  protected _gameId = GAME_ID;

  // 子系统
  private bldg!: BuildingSystem<BuildingDef>;
  private prest!: PrestigeSystem;
  private units!: UnitSystem;
  private stages!: StageSystem<StageDef>;
  private techs!: TechTreeSystem<TechDef>;
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
    this.stages = new StageSystem<StageDef>(DYNASTIES, 'indus_valley');
    this.techs = new TechTreeSystem<TechDef>(INVENTIONS);
    this.ftSys = new FloatingTextSystem();
    this.ptSys = new ParticleSystem();
    this.stats = new StatisticsTracker(this.makeStatDefs());
    this.unlock = new UnlockChecker();
    this.input = new InputHandler({
      bindings: [
        { key: 't', action: 'custom', actionId: 'toggle_tech' },
        { key: 'T', action: 'custom', actionId: 'toggle_tech' },
        { key: 'h', action: 'custom', actionId: 'toggle_heroes' },
        { key: 'H', action: 'custom', actionId: 'toggle_heroes' },
      ],
    });
    this.bindInput();

    this.panel = 'none';
    this.selIdx = 0;
    this.scroll = 0;
    this.playTime = 0;
    this.psCache = {};
    this.emit('stateChange');
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

    // 子系统更新
    this.techs.update(dt);
    this.ftSys.update(dt);
    this.ptSys.update(dt);

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
      case 'heroes': this.drawHeroes(ctx, w, cy, ch); break;
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
        toggle_tech: 'tech',
        toggle_heroes: 'heroes',
      };
      const p = map[e.actionId as string || ''];
      if (p) this.toggle(p);
    });
  }

  // ─── 序列化 ─────────────────────────────────────────────

  public serialize(): CivIndiaSaveState {
    const heroSave: Record<string, { level: number; exp: number }> = {};
    for (const h of HEROES) {
      const s = this.units.getState(h.id);
      if (s?.unlocked) heroSave[h.id] = { level: s.level, exp: s.exp };
    }
    return {
      resources: { ...this.res },
      buildings: this.bldg.saveState(),
      heroes: heroSave,
      researchedTechs: (this.techs.saveState().researched as string[]) || [],
      currentStage: this.stages.getCurrentId(),
      prestigeState: { currency: this.prest.getState().currency, count: this.prest.getState().count },
      gameStats: this.stats.serialize(),
      totalPlayTime: this.playTime,
    };
  }

  public deserialize(d: CivIndiaSaveState): void {
    this.res = { ...d.resources };
    this.bldg.loadState(d.buildings);
    for (const [id, o] of Object.entries(d.heroes)) {
      this.units.loadState({ [id]: { defId: id, level: o.level, exp: o.exp, unlocked: true,
        currentEvolutionBranch: null, evolutionStartTime: null, equippedIds: [] } });
    }
    this.techs.loadState({ researched: d.researchedTechs, current: null, queue: [], totalInvestment: {} });
    this.stages.loadState({ currentStageId: d.currentStage });
    const ps = d.prestigeState;
    this.prest.loadState({ currency: ps.currency, count: ps.count });
    if (d.gameStats) this.stats.deserialize(d.gameStats);
    this.playTime = d.totalPlayTime || 0;
    this.emit('stateChange');
  }

  // ─── 业力转生 ───────────────────────────────────────────

  public doPrestige(): void {
    const total = (this.res.rice || 0) + (this.res.spice || 0) + (this.res.gem || 0) + (this.res.gold || 0);
    const preview = this.prest.getPreview(total);
    if (!preview.canPrestige) return;

    const result = this.prest.doPrestige(total);
    if (!result) return;

    const ret = PRESTIGE_CONFIG.retention;
    this.res.rice = (this.res.rice || 0) * ret;
    this.res.spice = (this.res.spice || 0) * ret;
    this.res.gem = (this.res.gem || 0) * ret;
    this.res.gold = (this.res.gold || 0) * ret;

    // 重置建筑和阶段
    this.bldg.reset(true);
    this.stages.loadState({ currentStageId: 'indus_valley' });

    this.stats.increment('totalKarma');
    this.ftSys.add('业力转生！轮回新生！', 0.5, 0.4, { style: { color: COLOR_THEME.accentGold, fontSize: 24 } });
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
    for (const t of INVENTIONS) {
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
      this.ftSys.add(`时代更替：${next.name}`, 0.5, 0.3, { style: { color: COLOR_THEME.accentGold, fontSize: 22 } });
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
    const rMap: Record<string, number> = { uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    return HEROES.map(h => ({
      id: h.id, name: h.name, description: h.title,
      rarity: rMap[h.rarity] ?? 0,
      baseStats: { administration: h.baseStats.administration, military: h.baseStats.military, culture: h.baseStats.culture },
      growthRates: { ...h.growthRates },
      evolutions: [],
      recruitCost: Object.entries(h.recruitCost).map(([materialId, quantity]) => ({ materialId, quantity })),
      maxLevel: 50, tags: [h.rarity], passiveSkillIds: [],
    }));
  }

  private makeStatDefs() {
    const ids = [
      'totalRice', 'totalSpice', 'totalGem', 'totalGold', 'totalKarma',
      'totalClicks', 'totalPrestiges', 'totalHeroesRecruited', 'totalTechsResearched', 'totalPlayTime',
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
      { id: 'heroes' as ActivePanel, label: '⚔️英雄' },
      { id: 'tech' as ActivePanel, label: '💡科技' },
      { id: 'prestige' as ActivePanel, label: '🕉️业力' },
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
    const total = (this.res.rice || 0) + (this.res.spice || 0) + (this.res.gem || 0) + (this.res.gold || 0);
    const pv = this.prest.getPreview(total);
    ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('🕉️ 业力转生', 18, sy + 22);
    ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '12px sans-serif';
    let y = sy + 44;
    const lines = [
      `业力: ${fmt(st.currency)} | 转生: ${st.count}次`,
      `当前倍率: ×${st.multiplier.toFixed(2)}`,
      `本次获得: ${pv.gain} 业力`,
      `新倍率: ×${pv.newMultiplier.toFixed(2)}`,
      `资源保留: ${(pv.retentionRate * 100).toFixed(0)}%`,
    ];
    for (const l of lines) { ctx.fillText(l, 18, y); y += 20; }
    if (pv.warning) { ctx.fillStyle = COLOR_THEME.textDim; ctx.fillText(pv.warning, 18, y); }
    y += 30;
    ctx.fillStyle = pv.canPrestige ? 'rgba(232,160,64,0.2)' : COLOR_THEME.panelBg;
    rr(ctx, w / 2 - 70, y, 140, 32, 6); ctx.fill();
    ctx.fillStyle = pv.canPrestige ? COLOR_THEME.accentGold : COLOR_THEME.textDim;
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pv.canPrestige ? '执行转生 (R)' : '资源不足', w / 2, y + 20);
    ctx.textAlign = 'left';
  }

  private drawTech(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 50, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(INVENTIONS.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= INVENTIONS.length) break;
      const t = INVENTIONS[idx], iy = sy + i * ih;
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

  private drawHeroes(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 65, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(HEROES.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= HEROES.length) break;
      const o = HEROES[idx], iy = sy + i * ih;
      const own = this.units.isUnlocked(o.id);
      const rc = RARITY_COLORS[o.rarity] || COLOR_THEME.textPrimary;
      ctx.fillStyle = COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = rc; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(o.name, 18, iy + 18);
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(`[${o.rarity}] ${o.title}`, 18, iy + 33);
      const s = o.baseStats;
      ctx.fillStyle = COLOR_THEME.textSecondary; ctx.font = '10px sans-serif';
      ctx.fillText(`政${s.administration} 军${s.military} 文${s.culture}`, 18, iy + 50);
      ctx.textAlign = 'right';
      if (!own) {
        const costStr = Object.entries(o.recruitCost).map(([k, v]) => `${v}${k === 'rice' ? '🍚' : '🌶️'}`).join(' ');
        const ok = this.canPay(o.recruitCost as unknown as Record<string, number>);
        ctx.fillStyle = ok ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
        ctx.font = '11px sans-serif';
        ctx.fillText(`招募: ${costStr}`, w - 18, iy + 30);
      } else {
        ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '11px sans-serif';
        ctx.fillText('✅ 已招募', w - 18, iy + 30);
      }
      ctx.textAlign = 'left';
    }
  }

  private drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('[Space]点击 [↑↓]选择 [Enter]购买 [R]业力 [T]科技 [H]英雄 [Esc]返回', w / 2, h - 12);
    ctx.textAlign = 'left';
  }

  // ─── 公共接口 ───────────────────────────────────────────

  public getResources(): Record<string, number> { return { ...this.res }; }
  public getActivePanel(): ActivePanel { return this.panel; }
  public getPrestigeState() { return this.prest.getState(); }
  public getStageInfo() { return this.stages.getCurrent(); }
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
