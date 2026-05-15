import {
  db,
  visaCriteriaTable,
  VISA_CRITERIA_SEED,
  lessonDefinitionsTable,
  LESSON_DEFINITIONS_SEED,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function seedReferenceData(): Promise<void> {
  try {
    const [vcRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visaCriteriaTable);
    if ((vcRow?.count ?? 0) === 0) {
      await db
        .insert(visaCriteriaTable)
        .values(VISA_CRITERIA_SEED)
        .onConflictDoNothing();
      logger.info(
        { rows: VISA_CRITERIA_SEED.length },
        "[seed] visa_criteria inserted",
      );
    } else {
      logger.info(
        { rows: vcRow?.count },
        "[seed] visa_criteria already populated — skip",
      );
    }
  } catch (err) {
    logger.error({ err }, "[seed] visa_criteria seed failed");
  }

  try {
    const [ldRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonDefinitionsTable);
    if ((ldRow?.count ?? 0) === 0) {
      await db
        .insert(lessonDefinitionsTable)
        .values(LESSON_DEFINITIONS_SEED)
        .onConflictDoNothing();
      logger.info(
        { rows: LESSON_DEFINITIONS_SEED.length },
        "[seed] lesson_definitions inserted",
      );
    } else {
      logger.info(
        { rows: ldRow?.count },
        "[seed] lesson_definitions already populated — skip",
      );
    }
  } catch (err) {
    logger.error({ err }, "[seed] lesson_definitions seed failed");
  }
}
