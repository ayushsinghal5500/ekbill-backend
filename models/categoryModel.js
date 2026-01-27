import pool from '../config/dbConnection.js';
import {generateUniqueCode} from '../utils/codeGenerator.js';

export const createCategory = async ({category_name, business_unique_code,user_unique_code}) => {
  const category_unique_code = generateUniqueCode('CAT');
  const res = await pool.query(
    `INSERT INTO ekbill.categories (category_unique_code, category_name, business_unique_code, created_by,created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [category_unique_code, category_name, business_unique_code, user_unique_code]
  );
  return res.rows[0];
};

export const getCategoriesByBusiness = async (business_unique_code) => {
  const res = await pool.query(
    `SELECT category_unique_code, category_name  FROM ekbill.categories WHERE business_unique_code=$1 AND is_active=true ORDER BY category_name ASC`,
    [business_unique_code]
  );
  return res.rows;
};

export const deleteCategory = async (category_unique_code, business_unique_code) => {
  const res = await pool.query(
    `DELETE FROM ekbill.categories WHERE category_unique_code=$1 AND business_unique_code=$2 RETURNING *`,
    [category_unique_code, business_unique_code]
  );
  return res.rows[0];
};