import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import criteriaRouter from "./criteria";
import evidenceRouter from "./evidence";
import blueprintRouter from "./blueprint";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(criteriaRouter);
router.use(evidenceRouter);
router.use(blueprintRouter);
router.use(coursesRouter);
router.use(dashboardRouter);

export default router;
