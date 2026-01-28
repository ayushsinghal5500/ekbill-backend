// routes/storeRoutes.js
import express from "express";
import { getPublicStoreLink } from "../controller/storeController.js";
import { getPublicCatalog } from "../controller/storePublicController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

/* Owner */
router.get("/public-link", authenticateJWT, getPublicStoreLink);

/* Public catalog */
router.get("/catalog/:slug", getPublicCatalog);

export default router;
