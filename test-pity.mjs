import { HeroRecruitSystem } from './src/games/three-kingdoms/engine/hero/HeroRecruitSystem.ts';
import { HeroSystem } from './src/games/three-kingdoms/engine/hero/HeroSystem.ts';
import { Quality, QUALITY_ORDER } from './src/games/three-kingdoms/engine/hero/hero.types.ts';
import { RECRUIT_PITY } from './src/games/three-kingdoms/engine/hero/hero-recruit-config.ts';

const heroSystem = new HeroSystem();
const recruit = new HeroRecruitSystem();
recruit.setRecruitDeps({
  heroSystem,
  spendResource: () => true,
  canAffordResource: () => true,
});

console.log('hardPityMinQuality:', RECRUIT_PITY.normal.hardPityMinQuality);
console.log('hardPityThreshold:', RECRUIT_PITY.normal.hardPityThreshold);

recruit.setRng(() => 0.97);
const result = recruit.recruitSingle('normal');
console.log('quality:', result.results[0].quality);
console.log('pity:', JSON.stringify(recruit.getGachaState()));
