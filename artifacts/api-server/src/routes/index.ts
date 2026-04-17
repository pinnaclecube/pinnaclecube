import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import criteriaRouter from "./criteria";
import evidenceRouter from "./evidence";
import blueprintRouter from "./blueprint";
import applyBlueprintRouter from "./applyBlueprint";
import adminBlueprintRouter from "./adminBlueprint";
import petitionAdminRouter from "./petitionAdmin";
import petitionClientRouter from "./petitionClient";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";
import lessonsRouter from "./lessons";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(criteriaRouter);
router.use(evidenceRouter);
router.use(blueprintRouter);
router.use(applyBlueprintRouter);
router.use(adminBlueprintRouter);
router.use(petitionAdminRouter);
router.use(petitionClientRouter);
router.use(coursesRouter);
router.use(dashboardRouter);
router.use(lessonsRouter);

export default router;
