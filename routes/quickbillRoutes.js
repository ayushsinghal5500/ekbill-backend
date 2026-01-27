import express from "express";
import {createQuickBill,getQuickBillsList,getQuickBillDetails} from "../controller/quickbillController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateJWT);

router.post("/",createQuickBill);
router.get("/list",getQuickBillsList);
router.get("/:quick_bill_unique_code",getQuickBillDetails);

export default router;