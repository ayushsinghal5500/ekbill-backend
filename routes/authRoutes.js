import express from "express";
import { createSendOtpController,verifyOtpController,refreshTokenController,addStaffController} from "../controller/authController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js"; 

const router = express.Router();

router.post("/business/send-otp", createSendOtpController);
router.post ("/business/resend-otp", createSendOtpController);
//router.post("/staff/add", authenticateJWT,addStaffController);
router.post ("/business/verify-otp", verifyOtpController);
router.post("/auth/refresh-token", refreshTokenController);


export default router;