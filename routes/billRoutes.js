import express from "express";
import {createbillController,getBillsListController,getBillDetailsController} from '../controller/billController.js';
import {authenticateJWT} from "../middleware/authMiddleware.js";


const router=express.Router();
router.use(authenticateJWT);

router.post('/create',createbillController);
router.get('/list',getBillsListController);
router.get('/details/:bill_unique_code',getBillDetailsController);

export default router;