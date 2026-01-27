import jwt from 'jsonwebtoken';
import pool from '../config/dbConnection.js';
import { generateSessionToken } from '../utils/jwt.js';

const TOKEN_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day

export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // ✅ YOUR ACTUAL TABLE STRUCTURE
    const result = await pool.query(
      `SELECT * FROM ekbill.business_sessions 
       WHERE refresh_token = $1 AND is_active = TRUE`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, message: 'Session inactive or invalid' });
    }

    const session = result.rows[0];
    const now = new Date();
    const expiresAt = session.refresh_expires_at
      ? new Date(session.refresh_expires_at)
      : null;

    // 🔄 Rotate token if expired or near expiry
    if (!expiresAt || expiresAt - now <= TOKEN_REFRESH_THRESHOLD_MS) {
      const newToken = generateSessionToken({
        user_unique_code: session.user_unique_code,
        business_unique_code: session.business_unique_code
      });

      const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await pool.query(
        `UPDATE ekbill.business_sessions
         SET refresh_token = $1,
             refresh_expires_at = $2,
             last_activity = CURRENT_TIMESTAMP
         WHERE business_session_unique_code = $3`,
        [newToken, newExpiry, session.business_session_unique_code]
      );

      res.setHeader('x-session-token', newToken);

      req.user = {
        user_unique_code: session.user_unique_code,
        business_unique_code: session.business_unique_code,
        session_token: newToken
      };
    } else {
      req.user = {
        user_unique_code: session.user_unique_code,
        business_unique_code: session.business_unique_code,
        session_token: token
      };
    }

    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Unauthorized', error: err.message });
  }
};
