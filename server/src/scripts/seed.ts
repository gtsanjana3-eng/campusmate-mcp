import { parseEnv } from '../config/env.ts';
import { seedStore } from '../data/seed.ts';
import { createStore } from '../data/store.ts';

// Resets the database to the demo student (run before each demo: `npm run seed`).
const env = parseEnv();
const store = createStore(env.DATABASE_PATH);
seedStore(store);
store.close();
console.info(`Seeded demo data into ${env.DATABASE_PATH}`);
