import express from "express";
import {updateCustomerController,getMinimalCustomerListController,createCustomerController, deleteCustomerController, updateCollectionReminderController, addCustomerLedgerEntryController,getCustomerDetailController} from "../controller/customerController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authenticateJWT);


router.post("/create", createCustomerController);
router.put("/update/:customer_unique_code", updateCustomerController);
router.post("/ledger/add", authenticateJWT, addCustomerLedgerEntryController);
router.put("/collectionReminder/:customer_unique_code", updateCollectionReminderController);
router.get("/list", getMinimalCustomerListController);
router.get("/details/:customer_unique_code", getCustomerDetailController)
router.delete("/:customer_unique_code", deleteCustomerController);


export default router;