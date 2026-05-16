import {
  db,
  visaCriteriaTable,
  VISA_CRITERIA_SEED,
  lessonDefinitionsTable,
  LESSON_DEFINITIONS_SEED,
  casePetitionSetupTable,
  profilesTable,
  clientUserProductsTable,
} from "@workspace/db";
import { sql, eq, and, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";

const PRODUCT_ACCESS_MAP: Record<string, { level: string; products: string[] }> = {
  evidence_engine: { level: "evidence_vault", products: ["evidence_engine"] },
  elite_blueprint: { level: "elite_blueprint", products: ["elite_blueprint"] },
  both: { level: "elite_blueprint", products: ["evidence_engine", "elite_blueprint"] },
};

async function fixOrphanedCaseAccess(): Promise<void> {
  try {
    const orphaned = await db
      .select({
        profileId: casePetitionSetupTable.profileId,
        product: casePetitionSetupTable.product,
        email: profilesTable.email,
      })
      .from(casePetitionSetupTable)
      .innerJoin(profilesTable, eq(profilesTable.id, casePetitionSetupTable.profileId))
      .where(
        and(
          eq(profilesTable.accessLevel, "free"),
          isNotNull(casePetitionSetupTable.product),
        ),
      );

    if (orphaned.length === 0) {
      logger.info("[seed] fixOrphanedCaseAccess — no orphaned profiles found");
      return;
    }

    for (const row of orphaned) {
      const grant = PRODUCT_ACCESS_MAP[row.product ?? ""];
      if (!grant) continue;

      await db
        .update(profilesTable)
        .set({ accessLevel: grant.level })
        .where(eq(profilesTable.id, row.profileId));

      for (const prod of grant.products) {
        await db
          .insert(clientUserProductsTable)
          .values({
            profileId: row.profileId,
            clientEmail: row.email,
            product: prod,
            status: "active",
            offlinePayment: true,
            grantNotes: "Back-filled at startup: case had product but profile was still free",
          })
          .onConflictDoNothing();
      }

      logger.info(
        { profileId: row.profileId, email: row.email, product: row.product, accessLevel: grant.level },
        "[seed] fixOrphanedCaseAccess — access granted",
      );
    }
  } catch (err) {
    logger.error({ err }, "[seed] fixOrphanedCaseAccess failed");
  }
}

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

  await fixOrphanedCaseAccess();
}
