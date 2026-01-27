import pool from '../config/dbConnection.js';
import { generateUniqueCode } from '../utils/codeGenerator.js';

export const createSession = async (user_unique_code,business_unique_code,session_token,expires_at) => {
  const business_session_unique_code = generateUniqueCode({ table: 'BSES' });

  await pool.query(
    `INSERT INTO ekbill.business_sessions
     (business_session_unique_code, refresh_token, refresh_expires_at, user_unique_code,
      business_unique_code, is_active, last_activity)
     VALUES ($1,$2,$3,$4,$5,TRUE,CURRENT_TIMESTAMP)`,
    [
      business_session_unique_code,
      session_token,
      expires_at,
      user_unique_code,
      business_unique_code
    ]
  );
};
