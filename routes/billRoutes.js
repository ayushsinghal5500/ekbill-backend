import express from "express";
import {createbillController} from '../controller/billController.js';
import {authenticateJWT} from "../middleware/authMiddleware.js";


const router=express.Router();
router.use(authenticateJWT);

router.post('/create',createbillController);

export default router;