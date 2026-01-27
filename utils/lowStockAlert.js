import pool from "../config/dbConnection.js";
import { createNotification } from "../models/notificationModel.js";

export const handleLowStockAlert = async ({
  product_unique_code,
  business_unique_code
}, client = pool) => {

  const { rows: productRows } = await client.query(
    `SELECT product_name, low_stock_alert
     FROM ekbill.products
     WHERE product_unique_code = $1
       AND business_unique_code = $2
       AND is_active = true`,
    [product_unique_code, business_unique_code]
  );

  if (!productRows.length) return;

  const { product_name, low_stock_alert } = productRows[0];
  if (low_stock_alert === null) return;

  const { rows: stockRows } = await client.query(
    `SELECT COALESCE(SUM(
        CASE 
          WHEN transaction_type IN ('OPENING','IN') THEN quantity
          WHEN transaction_type='OUT' THEN -quantity
        END
      ),0) AS current_stock
     FROM ekbill.product_stock_history
     WHERE product_unique_code = $1
       AND business_unique_code = $2`,
    [product_unique_code, business_unique_code]
  );

  const current_stock = Number(stockRows[0].current_stock);

  const { rows: existing } = await client.query(
    `SELECT id FROM ekbill.notifications
     WHERE module='PRODUCT'
       AND reference_code=$1
       AND business_unique_code=$2
       AND action='LOW_STOCK'
       AND status='ACTIVE'
     LIMIT 1`,
    [product_unique_code, business_unique_code]
  );

  if (current_stock <= low_stock_alert && !existing.length) {
    await createNotification({
      business_unique_code,
      title: `Low stock: ${product_name}`,
      message: `Stock is ${current_stock}. Alert level is ${low_stock_alert}.`,
      type: "ALERT",
      module: "PRODUCT",
      reference_code: product_unique_code,
      actor_type: "SYSTEM",
      actor_code: null,
      action: "LOW_STOCK"
    }, client);
    return;
  }

  if (current_stock > low_stock_alert && existing.length) {
    await client.query(
      `UPDATE ekbill.notifications
       SET status='RESOLVED', resolved_at=NOW()
       WHERE id=$1`,
      [existing[0].id]
    );
  }
};
