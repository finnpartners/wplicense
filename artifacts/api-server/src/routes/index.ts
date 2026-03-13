import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminDashboardRouter from "./admin-dashboard";
import adminClientsRouter from "./admin-clients";
import adminProductsRouter from "./admin-products";
import adminLicensesRouter from "./admin-licenses";
import publicRouter from "./public";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);

router.use(authRouter);

router.use(requireAuth);
router.use(adminDashboardRouter);

router.use((req, res, next) => {
  if (req.method === "GET") {
    next();
  } else {
    requireAdmin(req, res, next);
  }
});

router.use(adminClientsRouter);
router.use(adminProductsRouter);
router.use(adminLicensesRouter);

export default router;
