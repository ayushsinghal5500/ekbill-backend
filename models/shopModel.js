import pool from '../config/dbConnection.js';
import { generateUniqueCode } from '../utils/codeGenerator.js';

// ============ SHOP QUERIES ============

export const createShop = async ({ owner_unique_code, shop_name, shop_type = null, shop_category = null }) => {
  const shop_unique_code = generateUniqueCode({ table: 'SHP' });
  const res = await pool.query(
    `INSERT INTO ekbill.shops (shop_unique_code, owner_unique_code, shop_name, shop_type, shop_category)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [shop_unique_code, owner_unique_code, shop_name, shop_type, shop_category]
  );
  return res.rows[0];
};

export const findShopByCode = async (shop_unique_code) => {
  const res = await pool.query(
    `SELECT * FROM ekbill.shops WHERE shop_unique_code = $1`,
    [shop_unique_code]
  );
  return res.rows[0];
};

export const findShopsByOwner = async (owner_unique_code) => {
  const res = await pool.query(
    `SELECT * FROM ekbill.shops WHERE owner_unique_code = $1 AND status = 'active' ORDER BY created_at DESC`,
    [owner_unique_code]
  );
  return res.rows;
};

export const updateShop = async (shop_unique_code, { shop_name, shop_type, shop_category, status }) => {
  const res = await pool.query(
    `UPDATE ekbill.shops 
     SET shop_name = COALESCE($2, shop_name),
         shop_type = COALESCE($3, shop_type),
         shop_category = COALESCE($4, shop_category),
         status = COALESCE($5, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE shop_unique_code = $1
     RETURNING *`,
    [shop_unique_code, shop_name, shop_type, shop_category, status]
  );
  return res.rows[0];
};

export const deleteShop = async (shop_unique_code) => {
  const res = await pool.query(
    `UPDATE ekbill.shops SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE shop_unique_code = $1 RETURNING *`,
    [shop_unique_code]
  );
  return res.rows[0];
};

// Get shop with owner details
export const getShopWithOwner = async (shop_unique_code) => {
  const res = await pool.query(
    `SELECT s.*, u.name as owner_name, u.phone as owner_phone, u.email as owner_email
     FROM ekbill.shops s
     LEFT JOIN ekbill.users u ON s.owner_unique_code = u.user_unique_code
     WHERE s.shop_unique_code = $1`,
    [shop_unique_code]
  );
  return res.rows[0];
};
