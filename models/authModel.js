import pool from '../config/dbConnection.js';

export const ensureUserNotLocked = async (auth) => {
  const now = new Date();
  if (!auth.is_locked) return;
  if (auth.locked_until && auth.locked_until <= now) {
    await resetAfterUnlock(auth.user_unique_code);
    return;
  }
  throw new Error(auth.locked_until ? `User blocked until ${auth.locked_until}` : 'User temporarily blocked');
};

export const upsertOTP = async (user_unique_code, otpHash, expiresAt) => {
  await pool.query(`
    INSERT INTO ekbill.user_auth (user_unique_code, otp_hash, otp_expires_at, resend_count)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (user_unique_code)
    DO UPDATE SET otp_hash=$2, otp_expires_at=$3, resend_count=user_auth.resend_count+1, last_otp_request_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
  `, [user_unique_code, otpHash, expiresAt]);
};

export const findAuthByPhone = async (phone, country_code) => {
  const res = await pool.query(`
    SELECT ua.*, u.user_unique_code AS user_unique_code
    FROM ekbill.user_auth ua
    JOIN ekbill.users u ON u.user_unique_code=ua.user_unique_code
    WHERE u.phone=$1 AND u.country_code=$2
  `, [phone, country_code]);
  return res.rows[0];
};

export const incrementFailedOTPAttempts = async (user_unique_code) => {
  await pool.query(`UPDATE ekbill.user_auth SET failed_login_attempts=failed_login_attempts+1,last_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_unique_code=$1`, [user_unique_code]);
};

export const lockUser = async (user_unique_code, lockUntil) => {
  await pool.query(`UPDATE ekbill.user_auth SET is_locked=true,locked_until=$2,updated_at=CURRENT_TIMESTAMP WHERE user_unique_code=$1`, [user_unique_code, lockUntil]);
};

export const clearOTP = async (user_unique_code) => {
  await pool.query(`UPDATE ekbill.user_auth SET otp_hash=NULL,otp_expires_at=NULL,resend_count=0,last_otp_request_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_unique_code=$1`, [user_unique_code]);
};

export const resetAfterUnlock = async (user_unique_code) => {
  await pool.query(`UPDATE ekbill.user_auth SET is_locked=false,locked_until=NULL,failed_login_attempts=0,resend_count=0,otp_hash=NULL,otp_expires_at=NULL,last_attempt_at=NULL,last_otp_request_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_unique_code=$1`, [user_unique_code]);
};
