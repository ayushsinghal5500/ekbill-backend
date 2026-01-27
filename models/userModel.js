import pool from '../config/dbConnection.js';
import {generateUniqueCode } from '../utils/codeGenerator.js';

// Function to create a new user
export const findUserByPhone = async (phone, country_code) => {
  const res = await pool.query(
    `SELECT * FROM ekbill.users WHERE phone=$1 AND country_code=$2`,
    [phone, country_code]
  );
  return res.rows[0];
};

export const createUser = async ({ phone, country_code }) => {
  const unique_code =  generateUniqueCode({ table: 'USR' });
  const res = await pool.query(
    `INSERT INTO ekbill.users (user_unique_code, phone, country_code) 
     VALUES ($1,$2,$3) RETURNING *`,
    [unique_code, phone, country_code]
  );
  return res.rows[0];
};

export const setUserVerified = async (user_unique_code) => {
  await pool.query(
    `UPDATE ekbill.users SET is_verified=true, updated_at=CURRENT_TIMESTAMP WHERE user_unique_code=$1`,
    [user_unique_code]
  );
};
