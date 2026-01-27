import express from "express";
import { addBusinessController, getBusinessByUserController } from "../controller/businessController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js"; 
const router = express.Router();

router.post("/add", authenticateJWT, addBusinessController);
router.get("/", authenticateJWT, getBusinessByUserController);

export default router;