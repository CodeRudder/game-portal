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

// ── 导出类型 ──
export interface DamageFloat { id: number; unitId: string; value: number; isCritical: boolean; isHeal: boolean; }
export interface LogEntry { id: number; html: string; type: 'ally' | 'enemy' | 'critical' | 'turn' | 'system'; }
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
  speed: 1 | 2;
  toggleSpeed: () => void;
  skip: () => void;
}

// ── 常量 ──
const BASE_TURN_DELAY = 800;
const ACTION_DELAY = 300;
const END_DELAY = 1200;

// ── 辅助函数 ──
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildActionLog(action: BattleAction): { html: string; type: LogEntry['type'] } {
  if (!action.skill) return { html: `<span class="tk-bs-log-actor">${action.actorName}</span> 被控制，无法行动`, type: 'system' };
  let totalDmg = 0; let hasCrit = false;
  for (const [, dmg] of Object.entries(action.damageResults)) { totalDmg += dmg.damage; if (dmg.isCritical) hasCrit = true; }
  const side = action.actorSide === 'ally' ? 'ally' : 'enemy';
  const critTag = hasCrit ? ' <span class="tk-bs-log-crit">暴击!</span>' : '';
  const aoeTag = action.targetIds.length > 1 ? ` (×${action.targetIds.length})` : '';
  return {
    html: `<span class="tk-bs-log-actor">${action.actorName}</span> 使用 <span class="tk-bs-log-skill">${action.skill.name}</span>${aoeTag} 造成 <span class="tk-bs-log-damage">${totalDmg.toLocaleString()}</span> 伤害${critTag}`,
    type: hasCrit ? 'critical' : side,
  };
}

// ── useBattleAnimation Hook ──

/** 战斗动画控制 Hook：管理回放循环、伤害飘字、受击动画、播报日志 */
export function useBattleAnimation(
  battleEngine: IBattleEngine,
  allyTeam: { units: BattleUnit[] },
  enemyTeam: { units: BattleUnit[] },
  onBattleEnd: (result: BattleResult) => void,
): BattleAnimationState {
  const [speed, setSpeed] = useState<1 | 2>(1);
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

  // 跟踪已死亡的单位（避免重复触发死亡动画）
  const deadUnitsRef = useRef<Set<string>>(new Set());

  const addLog = useCallback((html: string, type: LogEntry['type']) => {
    const id = ++logIdRef.current;
    setLogs((prev) => [...prev.slice(-50), { id, html, type }]);
  }, []);

  const addDamageFloat = useCallback((unitId: string, value: number, isCritical: boolean, isHeal: boolean) => {
    const id = ++floatIdRef.current;
    setDamageFloats((prev) => [...prev, { id, unitId, value, isCritical, isHeal }]);
    setTimeout(() => setDamageFloats((prev) => prev.filter((f) => f.id !== id)), 1000);
  }, []);

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
      addLog('⚔️ 战斗开始！', 'system');

      while (cur.phase === BattlePhase.IN_PROGRESS && cur.currentTurn <= cur.maxTurns && !cancelledRef.current) {
        addLog(`── 第 ${cur.currentTurn} 回合 ──`, 'turn');
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
          addLog(logInfo.html, logInfo.type);

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
          setTimeout(() => setHitUnitIds(new Set()), 400);

          // 暴击屏幕震动
          if (hasCrit) {
            setCritShake(true);
            setTimeout(() => setCritShake(false), 450);
          }

          // 死亡动画
          if (newDeadIds.length > 0) {
            setDyingUnitIds(new Set(newDeadIds));
            setTimeout(() => setDyingUnitIds(new Set()), 900);
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
      if (result.outcome === BattleOutcome.VICTORY) addLog(`🏆 战斗胜利！${starStr}`, 'system');
      else if (result.outcome === BattleOutcome.DEFEAT) addLog('💀 战斗失败...', 'system');
      else addLog('⚖️ 战斗平局', 'system');

      await sleep(skipRef.current ? 300 : END_DELAY);
      if (!cancelledRef.current) onBattleEnd(result);
    };

    playBattle();
    return () => { cancelledRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    battleState, battleResult, isFinished, actingUnitId, actingUnitSide,
    hitUnitIds, dyingUnitIds, skillActiveUnitId, critShake, damageFloats,
    logs, logAreaRef, speed, toggleSpeed: useCallback(() => setSpeed((p) => (p === 1 ? 2 : 1)), []),
    skip: useCallback(() => { skipRef.current = true; }, []),
  };
}
