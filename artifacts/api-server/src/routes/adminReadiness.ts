import { Router, type Request, type Response } from "express";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { calculateReadinessScore, getAllCasesReadiness } from "../services/readinessService";

const router = Router();

// ─── GET /admin/readiness ─────────────────────────────────────────────────────

router.get("/admin/readiness", requireStaffAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const summaries = await getAllCasesReadiness();
    res.json(summaries);
  } catch (err) {
    req.log.error({ err }, "Failed to compute readiness dashboard");
    res.status(500).json({ error: "Failed to compute readiness scores" });
  }
});

// ─── GET /admin/readiness/:caseSetupId ───────────────────────────────────────

router.get(
  "/admin/readiness/:caseSetupId",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const caseSetupId = parseInt(req.params.caseSetupId, 10);
    if (isNaN(caseSetupId)) {
      res.status(400).json({ error: "Invalid caseSetupId" });
      return;
    }
    try {
      const score = await calculateReadinessScore(caseSetupId);
      res.json({ caseSetupId, score });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("not found")) {
        res.status(404).json({ error: err.message });
        return;
      }
      req.log.error({ err, caseSetupId }, "Failed to compute readiness for case");
      res.status(500).json({ error: "Failed to compute readiness score" });
    }
  },
);

export default router;
