import express from 'express';
import {overviewReportsController, salesReportsController, dailyReportsController, customerReportsController} from "../controller/reportController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authenticateJWT);
router.get("/overview", overviewReportsController);
router.get("/sales", salesReportsController);
router.get("/daily",dailyReportsController);
router.get("/customer", customerReportsController);
router.use (authenticateJWT);

export default router;