import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { visaCriteriaTable, VISA_CRITERIA_SEED } from "./schema/visa_criteria.js";
import { lessonDefinitionsTable, LESSON_DEFINITIONS_SEED } from "./schema/lesson_definitions.js";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const db = drizzle(client);

console.log("Seeding visa_criteria...");
await db
  .insert(visaCriteriaTable)
  .values(VISA_CRITERIA_SEED)
  .onConflictDoNothing();
console.log(`  inserted ${VISA_CRITERIA_SEED.length} rows`);

console.log("Seeding lesson_definitions...");
await db
  .insert(lessonDefinitionsTable)
  .values(LESSON_DEFINITIONS_SEED)
  .onConflictDoNothing();
console.log(`  inserted ${LESSON_DEFINITIONS_SEED.length} rows`);

await client.end();
console.log("Done.");
