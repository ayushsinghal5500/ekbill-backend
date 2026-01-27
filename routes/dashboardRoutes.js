import express from "express";
import { getDashboard,getAllNotifications } from "../controller/dashboardController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateJWT);
router.get("/", getDashboard);
router.get("/notifications", getAllNotifications);

export default router;
