// models/storeModel.js
import pool from "../config/dbConnection.js";

export const getPublicStoreLinkModel = async (business_unique_code) => {
  const res = await pool.query(
    `SELECT public_slug, is_active, is_accepting_orders
     FROM ekbill.public_stores
     WHERE business_unique_code=$1`,
    [business_unique_code]
  );

  if (!res.rows.length) return null;

  const row = res.rows[0];

  return {
    public_slug: row.public_slug,
    store_live: row.is_active,
    is_accepting_orders: row.is_accepting_orders,
    public_url: `${process.env.PUBLIC_STORE_BASE_URL}/${row.public_slug}`
  };
};
