import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminDashboardRouter from "./admin-dashboard";
import adminClientsRouter from "./admin-clients";
import adminProductsRouter from "./admin-products";
import adminLicensesRouter from "./admin-licenses";
import adminSettingsRouter from "./admin-settings";
import publicRouter from "./public";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(publicRouter);

router.use(requireAuth);
router.use(adminDashboardRouter);
router.use(adminClientsRouter);
router.use(adminProductsRouter);
router.use(adminLicensesRouter);
router.use(adminSettingsRouter);

export default router;
