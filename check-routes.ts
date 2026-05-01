import { GameEventSimulator } from './src/games/three-kingdoms/test-utils/GameEventSimulator';
const sim = new GameEventSimulator();
sim.init();
const exp = sim.engine.getExpeditionSystem();
const routes = exp.getAllRoutes();
routes.forEach(r => console.log(r.id, r.name, 'unlocked:', r.unlocked));
