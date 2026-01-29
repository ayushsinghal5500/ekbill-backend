import bcrypt from 'bcrypt';
import { generateOTP,otpExpiresAt } from "../utils/otp.js";
import { validatePhone } from '../utils/phone.js';
import {findUserByPhone, createUser,setUserVerified} from "../models/userModel.js";
import { addOwnerAsStaff, assignOwnerRole } from "../models/staffModel.js";
import { findBusinessByOwner, createBusiness } from "../models/businessModel.js";
import {findAuthByPhone, upsertOTP, lockUser, ensureUserNotLocked, incrementFailedOTPAttempts, clearOTP, resetAfterUnlock} from "../models/authModel.js";
import {createSession} from "../models/sessionModel.js";
import { generateSessionToken } from '../utils/jwt.js';
const MAX_RESEND = 5;
const MAX_FAILED = 5;
const BLOCK_MIN = 10;

export const createSendOtpService = async (phone, country_code) => {
  const formatted = validatePhone(phone, country_code);
  if (!formatted) throw new Error('Invalid phone');

  let user = await findUserByPhone(phone, country_code);
  if (!user) user = await createUser({ phone, country_code });

  let auth = await findAuthByPhone(phone, country_code);

  if (auth) {
    await ensureUserNotLocked(auth);
    auth = await findAuthByPhone(phone, country_code);
  }

  if (auth?.resend_count >= MAX_RESEND) {
    const lockUntil = new Date(Date.now() + BLOCK_MIN * 60000);
    await lockUser(user.user_unique_code, lockUntil);
    throw new Error('OTP resend limit reached. User blocked');
  }

  const otp = generateOTP(true);
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = otpExpiresAt();

  await upsertOTP(user.user_unique_code, otpHash, expiresAt);
};

export const verifyOTPService = async (phone, country_code, otp) => {
  try {
    const auth = await findAuthByPhone(phone, country_code);
    if (!auth) throw new Error('Invalid OTP');

    await ensureUserNotLocked(auth);

    const now = new Date();
    const isMatch = await bcrypt.compare(otp, auth.otp_hash);

    if (!isMatch || !auth.otp_expires_at || auth.otp_expires_at < now) {
      await incrementFailedOTPAttempts(auth.user_unique_code);

      if (auth.failed_login_attempts + 1 >= MAX_FAILED) {
        const lockUntil = new Date(now.getTime() + BLOCK_MIN * 60000);
        await lockUser(auth.user_unique_code, lockUntil);
      }

      throw new Error('Invalid or expired OTP');
    }

    await clearOTP(auth.user_unique_code);
    await resetAfterUnlock(auth.user_unique_code);
    await setUserVerified(auth.user_unique_code);

    let business = await findBusinessByOwner(auth.user_unique_code);
    if (!business) {
      business = await createBusiness({
        user_unique_code: auth.user_unique_code,
        phone
      });
    }

    const staff = await addOwnerAsStaff(
      business.business_unique_code,
      auth.user_unique_code
    );
    await assignStaffRoleByName(staff.staff_unique_code, 'OWNER');

    // ✅ SINGLE SESSION TOKEN
    const session_token = generateSessionToken({
      user_unique_code: auth.user_unique_code,
      business_unique_code: business.business_unique_code
    });

    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await createSession(
      auth.user_unique_code,
      business.business_unique_code,
      session_token,
      expires_at
    );

    return {
      success: true,
      message: 'Login successful',
      data: {
        session_token,
        user_unique_code: auth.user_unique_code,
        business_unique_code: business.business_unique_code
      }
    };

  } catch (error) {
    throw new Error(error.message || 'OTP verification failed');
  }
};


export const addStaffService = async (phone, country_code, otp) => {
  try {
    const auth = await findAuthByPhone(phone, country_code);
    if (!auth) throw new Error('Invalid OTP');

    await ensureUserNotLocked(auth);

    const now = new Date();
    const isMatch = await bcrypt.compare(otp, auth.otp_hash);

    if (!isMatch || !auth.otp_expires_at || auth.otp_expires_at < now) {
      await incrementFailedOTPAttempts(auth.user_unique_code);

      if (auth.failed_login_attempts + 1 >= MAX_FAILED) {
        const lockUntil = new Date(now.getTime() + BLOCK_MIN * 60000);
        await lockUser(auth.user_unique_code, lockUntil);
      }

      throw new Error('Invalid or expired OTP');
    }

    await clearOTP(auth.user_unique_code);
    await resetAfterUnlock(auth.user_unique_code);
    await setUserVerified(auth.user_unique_code);

    let business = await findBusinessByOwner(auth.user_unique_code);
    if (!business) {
      business = await createBusiness({
        user_unique_code: auth.user_unique_code,
        phone
      });
    }

    const staff = await addOwnerAsStaff(
      business.business_unique_code,
      auth.user_unique_code
    );
    await assignStaffRoleByName(staff.staff_unique_code, 'OWNER');

    // ✅ SINGLE SESSION TOKEN
    const session_token = generateSessionToken({
      user_unique_code: auth.user_unique_code,
      business_unique_code: business.business_unique_code
    });

    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await createSession(
      auth.user_unique_code,
      business.business_unique_code,
      session_token,
      expires_at
    );

    return {
      success: true,
      message: 'Login successful',
      data: {
        session_token,
        user_unique_code: auth.user_unique_code,
        business_unique_code: business.business_unique_code
      }
    };

  } catch (error) {
    throw new Error(error.message || 'OTP verification failed');
  }
};