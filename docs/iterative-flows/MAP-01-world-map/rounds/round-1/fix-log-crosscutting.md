# Fix Log: Cross-Cutting P0 Issues (P0-V01, P0-V02, P0-V03)

> **Author**: crosscutting fix agent
> **Date**: 2026-05-05
> **Scope**: PLAN.md + FL-MAP-04, FL-MAP-06, FL-MAP-07, FL-MAP-08, FL-MAP-09, FL-MAP-15, FL-MAP-16

---

## Summary

This fix addresses three cross-cutting P0 issues identified in the R1-Step7 verification integrator report. All three issues are architectural gaps that span multiple flow documents.

| Issue | Description | Resolution |
|:------|:-----------|:----------|
| P0-V01 | AI Enemy System Undefined | Added AI system appendix to PLAN.md with inline references in 4 flows |
| P0-V02 | Core Data Structures Undefined | Added TypeScript interfaces appendix to PLAN.md |
| P0-V03 | Combat Power Formula Chain Incomplete | Added complete formula chain appendix to PLAN.md with inline references in 3 flows |

---

## P0-V01: AI Enemy System Undefined

### Problem
FL-MAP-04, FL-MAP-06, FL-MAP-08, FL-MAP-15 reference enemy forces, AI factions, enemy marches, but the AI enemy system was never defined. In a 100% client-side single-player game, all opposing forces must be locally simulated.

### Resolution
Created **PLAN.md Appendix A: AI Enemy System Definition** covering:

- **A.1 Architecture Principles**: Online AI (timer-driven during active play) + Offline AI (batch-calculated on next login)
- **A.2 AI Faction Definition**: 3 AI factions (Wei/Shu/Wu) with behavior types (expansion/defense/balanced)
- **A.3 AI Attack Behavior**: Configurable attack frequency (2-4 hours by difficulty), target selection logic, simplified conquest formula
- **A.4 AI Garrison Reinforcement**: Hourly garrison growth = base_rate x territory_level, with caps
- **A.5 AI Territory Defense**: Passive defense using existing garrison + defense coefficient
- **A.6 March Interception**: 5% trigger probability per march, interceptor force = AI garrison x 20%
- **A.7 Offline AI Activity**: Batch settlement on next login; AI captures neutral territories, reinforces garrisons; does NOT attack player territories while offline
- **A.8 Terminology Table**: Maps deprecated multiplayer terms to correct single-player equivalents

### Inline References Added

| Flow | Location | Reference Text |
|:-----|:---------|:--------------|
| FL-MAP-04 | Line ~133, March Interception State Machine | `> **AI Enemy System Definition**: see PLAN.md Appendix A` with interception probability and force details |
| FL-MAP-06 | Line ~281, Exception E06-04 | Extended V-011 AI definition note with link to PLAN.md Appendix A |
| FL-MAP-08 | Line ~180, Territory Abandon S4 | Added AI system reference to cooldown note |
| FL-MAP-15 | Line ~76, Login Detection S1 | Added reference to PLAN.md Appendix A.7 for offline AI activity |

---

## P0-V02: Core Data Structures Undefined

### Problem
Multiple flows reference data structures (MapConfig, TerritoryData, SiegeTask, etc.) but never define their TypeScript interfaces.

### Resolution
Created **PLAN.md Appendix B: Core Data Structures** with complete TypeScript interfaces:

| Interface | Fields | Referenced By |
|:----------|:-------|:-------------|
| `MapConfig` | mapWidth, mapHeight, territories, cities, roads, factions, palette | FL-MAP-01, FL-MAP-03 |
| `FactionData` | id, name, color, isPlayer, aiConfig | FL-MAP-04, FL-MAP-15 |
| `AIFactionConfig` | behaviorType, attackIntervalHours, attackPowerMultiplier | FL-MAP-04, FL-MAP-15 |
| `TerritoryData` | id, name, type, terrain, coordinates, owner, level, garrison, garrisonCap, garrisonGeneralId, production, occupiedAt | FL-MAP-06, FL-MAP-07, FL-MAP-08 |
| `ProductionData` | food, gold, troops, mandate, chargeProgress | FL-MAP-06, FL-MAP-14 |
| `CityData` (extends TerritoryData) | cityDefense, cityDefenseCap, wallLevel, structures | FL-MAP-09 |
| `CityStructure` | type, level | FL-MAP-09, FL-MAP-14 |
| `RoadSegment` | from, to, distance, terrainModifiers | FL-MAP-04, FL-MAP-09 |
| `SiegeTask` | id, targetId, strategy, forces, state, timestamps, marchPath, departureCityId | FL-MAP-09, FL-MAP-16 |
| `ForceData` | id, generalId, troops, status, combatPower, targetId | FL-MAP-09, FL-MAP-16 |
| `MapEvent` | id, type, territoryId, expiresAt, data, processed, generatedAt | FL-MAP-12, FL-MAP-15 |
| `TotalArmyPool` | cap, allocated, unallocated, replenishRate, garrisons | FL-MAP-08 |

---

## P0-V03: Combat Power Formula Chain Incomplete

### Problem
FL-MAP-07, FL-MAP-09, FL-MAP-16 reference combat power calculations but the complete formula chain was never fully defined inline. The chain breaks at the first link (general stats -> force power).

### Resolution
Created **PLAN.md Appendix C: Combat Power Formula Chain** with 6 complete formula definitions:

1. **C.1 Base Force Power**: `base_force_power = troops x 1.0 + general.attack x 10`
2. **C.2 Force Combat Power (with modifiers)**: `force_combat_power = base x strategy_modifier x terrain_modifier`
   - Strategy modifiers: Assault x1.5, Siege x0.8, Night Raid x1.2 (night only), Insider x2.0 (requires item)
   - Terrain modifiers: Plain x1.00, Mountain x0.90, Forest x0.95, Desert x0.92, Water x0.80, Pass x0.85, Snow x0.90
3. **C.3 Conquest Win Rate**: `clamp(5%, 95%, (attacker_power / defender_power x 0.5) + terrain_modifier_pct)`
4. **C.4 Siege Decay Per Tick**: `defense_decay = attacker_power x strategy_modifier / (wall_level x 5 + 100) x tick_interval`
5. **C.5 Force Preview (FL-MAP-16)**: `force_preview = troops x 1.0 + general.attack x 10` (initial, no strategy/terrain)
6. **C.6 Post-Battle Power Recalculation (FL-MAP-17)**: `post_battle_power = initial x (1 - casualty_rate) x (1 - injury_penalty)`

### Inline References Added

| Flow | Location | Change |
|:-----|:---------|:------|
| FL-MAP-07 | FL-MAP-07-02 Win Rate Formula | Added P0-V03 tag, PLAN.md Appendix C reference link, and complete terrain modifier table (7 terrain types with attack and win rate modifiers). Replaced "note: complete table see PRD" with link to PLAN.md Appendix C.2 |
| FL-MAP-09 | Stage P3 Force Combat Power | Added blockquote reference to PLAN.md C.1 and C.5 |
| FL-MAP-09 | Stage P8 City Defense Decay | Added blockquote reference to PLAN.md C.1, C.2, C.4 with inline strategy and terrain modifier values |
| FL-MAP-09 | Key Formula Index section | Added P0-V03 header reference to PLAN.md Appendix C |
| FL-MAP-16 | P0-02-R2 Force Total Combat Power | Added reference link to PLAN.md Appendix C (C.1 through C.6) |

---

## Files Modified

| File | Changes |
|:-----|:--------|
| `docs/iterative-flows/MAP-01-world-map/PLAN.md` | Added Appendix A (AI System), Appendix B (Data Structures), Appendix C (Formula Chain). Updated version to v1.1 |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-04-march-animation.md` | Added AI system reference in march interception section |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-06-territory-detail.md` | Extended AI reference in exception E06-04 |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-07-territory-conquest.md` | Added P0-V03 formula chain reference, replaced incomplete terrain table with complete 7-terrain table, added PLAN.md Appendix C links |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-08-garrison-management.md` | Added AI system reference in territory abandon cooldown |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-09-siege-warfare.md` | Added formula chain references in Stage P3, Stage P8, and Key Formula Index |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-15-offline-changes.md` | Added offline AI activity reference in login detection |
| `docs/iterative-flows/MAP-01-world-map/flows/FL-MAP-16-expedition-force.md` | Added formula chain reference in force total combat power section |

---

## Verification Checklist

- [x] PLAN.md Appendix A defines AI faction behavior, attack frequency, garrison reinforcement, territory defense, march interception, and offline activity
- [x] PLAN.md Appendix B provides TypeScript interfaces for all 8+ core data structures
- [x] PLAN.md Appendix C provides complete formula chain with 6 formula definitions
- [x] FL-MAP-04 references AI system for march interception
- [x] FL-MAP-06 references AI system for territory data expiration
- [x] FL-MAP-07 has inline complete terrain modifier table (7 types) and PLAN.md Appendix C reference
- [x] FL-MAP-08 references AI system in territory abandon flow
- [x] FL-MAP-09 has formula chain references in P3, P8, and formula index
- [x] FL-MAP-15 references AI system for offline activity detection
- [x] FL-MAP-16 has formula chain reference in force power section
- [x] All references use relative paths (../PLAN.md) for cross-document linking
- [x] No multiplayer language introduced (all AI references are explicitly client-side/local)

---

*Fix Log: Cross-Cutting P0 Issues | 2026-05-05 | P0-V01 + P0-V02 + P0-V03 resolved*
