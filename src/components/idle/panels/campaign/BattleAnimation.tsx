/**
 * BattleAnimation — 战斗动画控制
 *
 * 封装战斗回放循环、伤害飘字、受击动画、攻击动画、死亡动画、技能特效等动画逻辑。
 * @module components/idle/panels/campaign/BattleAnimation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  BattleResult, BattleState, BattleAction, BattleUnit, IBattleEngine,
} from '@/games/three-kingdoms/engine';
import { BattleOutcome, BattlePhase } from '@/games/three-kingdoms/engine';
import { findUnit as findUnitInState } from '@/games/three-kingdoms/engine';

// BattleAnimation is a pure hook with no JSX — no DOM element to annotate.
// Consumers should wrap with data-testid="battle-animation" on their container.
// This file is tracked under: data-testid="battle-animation" (hook consumer responsibility)
// ── 导出类型 ──
export interface DamageFloat { id: number; unitId: string; value: number; isCritical: boolean; isHeal: boolean; }
export interface LogPart { type: 'text' | 'actor' | 'skill' | 'damage' | 'crit'; text: string; }
export interface LogEntry { id: number; parts: LogPart[]; type: 'ally' | 'enemy' | 'critical' | 'turn' | 'system'; }
export interface BattleAnimationState {
  battleState: BattleState | null;
  battleResult: BattleResult | null;
  isFinished: boolean;
  actingUnitId: string | null;
  actingUnitSide: 'ally' | 'enemy' | null;
  hitUnitIds: Set<string>;
  dyingUnitIds: Set<string>;
  skillActiveUnitId: string | null;
  critShake: boolean;
  damageFloats: DamageFloat[];
  logs: LogEntry[];
  logAreaRef: React.RefObject<HTMLDivElement>;
  speed: 1 | 2 | 3 | 8;
  setSpeed: (speed: 1 | 2 | 3 | 8) => void;
  toggleSpeed: () => void;
  skip: () => void;
}

// ── 常量 ──
const BASE_TURN_DELAY = 800;
const ACTION_DELAY = 300;
const END_DELAY = 1200;

/** 速度档位列表 */
const SPEED_TIERS: (1 | 2 | 3 | 8)[] = [1, 2, 3, 8];

// ── 辅助函数 ──
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildActionLog(action: BattleAction): { parts: LogPart[]; type: LogEntry['type'] } {
  if (!action.skill) return { parts: [{ type: 'actor', text: action.actorName }, { type: 'text', text: ' 被控制，无法行动' }], type: 'system' };
  let totalDmg = 0; let hasCrit = false;
  for (const [, dmg] of Object.entries(action.damageResults)) { totalDmg += dmg.damage; if (dmg.isCritical) hasCrit = true; }
  const side = action.actorSide === 'ally' ? 'ally' : 'enemy';
  const aoeTag = action.targetIds.length > 1 ? ` (×${action.targetIds.length})` : '';
  const parts: LogPart[] = [
    { type: 'actor', text: action.actorName },
    { type: 'text', text: ' 使用 ' },
    { type: 'skill', text: action.skill.name },
    { type: 'text', text: `${aoeTag} 造成 ` },
    { type: 'damage', text: totalDmg.toLocaleString() },
    { type: 'text', text: ' 伤害' },
  ];
  if (hasCrit) parts.push({ type: 'crit', text: '暴击!' });
  return { parts, type: hasCrit ? 'critical' : side };
}

// ── useBattleAnimation Hook ──

/** 战斗动画控制 Hook：管理回放循环、伤害飘字、受击动画、播报日志 */
export function useBattleAnimation(
  battleEngine: IBattleEngine,
  allyTeam: { units: BattleUnit[] },
  enemyTeam: { units: BattleUnit[] },
  onBattleEnd: (result: BattleResult) => void,
): BattleAnimationState {
  const [speed, setSpeed] = useState<1 | 2 | 3 | 8>(1);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const [actingUnitId, setActingUnitId] = useState<string | null>(null);
  const [actingUnitSide, setActingUnitSide] = useState<'ally' | 'enemy' | null>(null);
  const [hitUnitIds, setHitUnitIds] = useState<Set<string>>(new Set());
  const [dyingUnitIds, setDyingUnitIds] = useState<Set<string>>(new Set());
  const [skillActiveUnitId, setSkillActiveUnitId] = useState<string | null>(null);
  const [critShake, setCritShake] = useState(false);
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);
  const floatIdRef = useRef(0);
  const skipRef = useRef(false);
  const cancelledRef = useRef(false);
  const logAreaRef = useRef<HTMLDivElement>(null!) as React.RefObject<HTMLDivElement>;

  // ── P2: 追踪所有 setTimeout ID，组件卸载时统一清理 ──
  const timerRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  /** 安全 setTimeout：自动追踪，卸载后不再 setState */
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timerRefs.current.delete(id);
      if (!cancelledRef.current) fn();
    }, ms);
    timerRefs.current.add(id);
  }, []);

  // 跟踪已死亡的单位（避免重复触发死亡动画）
  const deadUnitsRef = useRef<Set<string>>(new Set());

  const addLog = useCallback((parts: LogPart[], type: LogEntry['type']) => {
    const id = ++logIdRef.current;
    setLogs((prev) => [...prev.slice(-50), { id, parts, type }]);
  }, []);

  const addDamageFloat = useCallback((unitId: string, value: number, isCritical: boolean, isHeal: boolean) => {
    const id = ++floatIdRef.current;
    setDamageFloats((prev) => [...prev, { id, unitId, value, isCritical, isHeal }]);
    safeTimeout(() => setDamageFloats((prev) => prev.filter((f) => f.id !== id)), 1000);
  }, [safeTimeout]);

  useEffect(() => { if (logAreaRef.current) logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight; }, [logs]);

  // 战斗主循环
  useEffect(() => {
    cancelledRef.current = false;
    skipRef.current = false;
    deadUnitsRef.current = new Set();
    const state = battleEngine.initBattle(
      { units: allyTeam.units, side: 'ally' as const },
      { units: enemyTeam.units, side: 'enemy' as const },
    );
    setBattleState({ ...state });

    const playBattle = async () => {
      const cur = { ...state };
      addLog([{ type: 'text', text: '⚔️ 战斗开始！' }], 'system');

      while (cur.phase === BattlePhase.IN_PROGRESS && cur.currentTurn <= cur.maxTurns && !cancelledRef.current) {
        addLog([{ type: 'text', text: `── 第 ${cur.currentTurn} 回合 ──` }], 'turn');
        const actions = battleEngine.executeTurn(cur);

        for (const action of actions) {
          if (cancelledRef.current) break;

          // ── 攻击动画：设置行动者 + 技能发光 ──
          setActingUnitId(action.actorId);
          setActingUnitSide(action.actorSide);

          // 判断是否为技能（非普攻且有怒气消耗）
          const isSkill = action.skill && !action.isNormalAttack && action.skill.rageCost > 0;
          if (isSkill) {
            setSkillActiveUnitId(action.actorId);
          }

          await sleep(skipRef.current ? 30 : ACTION_DELAY / speed);
          if (cancelledRef.current) break;

          // 清除技能发光
          setSkillActiveUnitId(null);

          const logInfo = buildActionLog(action);
          addLog(logInfo.parts, logInfo.type);

          // ── 处理伤害 + 受击 + 死亡 + 暴击震动 ──
          let hasCrit = false;
          const newHitIds: string[] = [];
          const newDeadIds: string[] = [];

          for (const [targetId, dmg] of Object.entries(action.damageResults)) {
            const target = findUnitInState(cur, targetId);
            if (target) {
              target.hp = Math.max(0, target.hp - dmg.damage);
              if (target.hp <= 0) target.isAlive = false;
            }

            addDamageFloat(targetId, dmg.damage, dmg.isCritical, false);
            newHitIds.push(targetId);

            if (dmg.isCritical) hasCrit = true;

            // 检测死亡
            if (target && target.hp <= 0 && !deadUnitsRef.current.has(targetId)) {
              deadUnitsRef.current.add(targetId);
              newDeadIds.push(targetId);
            }
          }

          // 受击闪烁
          setHitUnitIds(new Set(newHitIds));
          safeTimeout(() => setHitUnitIds(new Set()), 400);

          // 暴击屏幕震动
          if (hasCrit) {
            setCritShake(true);
            safeTimeout(() => setCritShake(false), 450);
          }

          // 死亡动画
          if (newDeadIds.length > 0) {
            setDyingUnitIds(new Set(newDeadIds));
            safeTimeout(() => setDyingUnitIds(new Set()), 900);
          }

          setBattleState({ ...cur });
        }

        setActingUnitId(null);
        setActingUnitSide(null);
        if (cancelledRef.current) break;
        if (battleEngine.isBattleOver(cur)) { cur.phase = BattlePhase.FINISHED; break; }
        await sleep(skipRef.current ? 50 : BASE_TURN_DELAY / speed);
        cur.currentTurn++;
      }

      cur.phase = BattlePhase.FINISHED;
      const result = battleEngine.getBattleResult(cur);
      cur.result = result;
      setBattleState({ ...cur });
      setBattleResult(result);
      setIsFinished(true);

      const starStr = '★'.repeat(result.stars as number) + '☆'.repeat(3 - (result.stars as number));
      if (result.outcome === BattleOutcome.VICTORY) addLog([{ type: 'text', text: `🏆 战斗胜利！${starStr}` }], 'system');
      else if (result.outcome === BattleOutcome.DEFEAT) addLog([{ type: 'text', text: '💀 战斗失败...' }], 'system');
      else addLog([{ type: 'text', text: '⚖️ 战斗平局' }], 'system');

      await sleep(skipRef.current ? 300 : END_DELAY);
      if (!cancelledRef.current) onBattleEnd(result);
    };

    playBattle();
    return () => {
      cancelledRef.current = true;
      // P2: 清理所有未完成的 setTimeout
      for (const id of timerRefs.current) clearTimeout(id);
      timerRefs.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    battleState, battleResult, isFinished, actingUnitId, actingUnitSide,
    hitUnitIds, dyingUnitIds, skillActiveUnitId, critShake, damageFloats,
    logs, logAreaRef, speed, setSpeed: setSpeed as (s: 1 | 2 | 3 | 8) => void, toggleSpeed: useCallback(() => setSpeed((p) => {
      const idx = SPEED_TIERS.indexOf(p);
      return SPEED_TIERS[(idx + 1) % SPEED_TIERS.length];
    }), []),
    skip: useCallback(() => { skipRef.current = true; }, []),
  };
}
