// models/storePublicModel.js
import pool from "../config/dbConnection.js";

export const getPublicCatalogModel = async (
  slug,
  page = 1,
  limit = 12,
  category = "ALL",
  search = ""
) => {
  const offset = (page - 1) * limit;

  // 🔹 Store lookup
  const storeRes = await pool.query(
    `SELECT business_unique_code, store_name
     FROM ekbill.public_stores
     WHERE public_slug=$1 AND is_active=true`,
    [slug]
  );
  if (!storeRes.rows.length) return null;

  const { business_unique_code, store_name } = storeRes.rows[0];

  // 🔹 Categories (light)
  const cats = await pool.query(
    `SELECT category_unique_code, category_name
     FROM ekbill.categories
     WHERE business_unique_code=$1 AND is_active=true
     ORDER BY category_name`,
    [business_unique_code]
  );

  // 🔹 Filters
  let where = `WHERE p.business_unique_code=$1 AND p.is_active=true`;
  const values = [business_unique_code];
  let i = 2;

  if (category !== "ALL") {
    where += ` AND p.category_unique_code=$${i++}`;
    values.push(category);
  }

  if (search) {
    where += ` AND LOWER(p.product_name) LIKE LOWER($${i++})`;
    values.push(`%${search}%`);
  }

  values.push(limit, offset);

  // 🔹 Products (paginated)
  const products = await pool.query(
    `SELECT p.product_unique_code, p.product_name,
            c.category_name, pm.image_url,
            pp.selling_price, pp.gst_rate AS gst_percentage,
            pp.price_includes_tax AS is_gst_inclusive
     FROM ekbill.products p
     LEFT JOIN ekbill.categories c ON c.category_unique_code=p.category_unique_code
     LEFT JOIN ekbill.product_pricing pp ON pp.product_unique_code=p.product_unique_code
     LEFT JOIN ekbill.product_media pm ON pm.product_unique_code=p.product_unique_code
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    values
  );

  return {
    store_name,
    categories: [{ category_unique_code: "ALL", category_name: "All" }, ...cats.rows],
    products: products.rows,
    pagination: {
      page,
      limit,
      has_more: products.rows.length === limit
    }
  };
};
