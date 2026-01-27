import express from "express";
import { createSendOtpController,verifyOtpController,refreshTokenController} from "../controller/authController.js";

const router = express.Router();

router.post("/business/send-otp", createSendOtpController);
router.post ("/business/resend-otp", createSendOtpController);
router.post ("/business/verify-otp", verifyOtpController);
router.post("/auth/refresh-token", refreshTokenController);

export default router;