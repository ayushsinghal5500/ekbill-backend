import cron from "node-cron";
import pool from "../config/dbConnection.js";
import { createNotification } from "../models/notificationModel.js";

cron.schedule("0 0 * * *", async () => {
  try {
    const { rows: products } = await pool.query(`
      SELECT product_unique_code,
             user_unique_code,
             product_name,
             expiry_date,
             expiry_alert_days
      FROM ekbill.products
      WHERE is_active = true
        AND expiry_date IS NOT NULL
        AND expiry_alert_days > 0
    `);

    const today = new Date();
    today.setHours(0,0,0,0);

    for (const product of products) {
      const expiry = new Date(product.expiry_date);
      expiry.setHours(0,0,0,0);

      const daysLeft = Math.ceil((expiry - today) / 86400000);

      const { rows: existing } = await pool.query(
        `SELECT id FROM ekbill.notifications
         WHERE module='PRODUCT'
           AND reference_code=$1
           AND action='EXPIRY_ALERT'
           AND status='ACTIVE'
         LIMIT 1`,
        [product.product_unique_code]
      );

      // 🔔 FIRE
      if (daysLeft <= product.expiry_alert_days && !existing.length) {
        await createNotification({
          user_unique_code: product.user_unique_code,
          title: `Expiry alert: ${product.product_name}`,
          message: `Product will expire in ${daysLeft} day(s)`,
          type: "ALERT",
          module: "PRODUCT",
          reference_code: product.product_unique_code,
          actor_type: "SYSTEM",
          actor_code: null,
          action: "EXPIRY_ALERT"
        });
      }

      // ✅ RESOLVE
      if (daysLeft > product.expiry_alert_days && existing.length) {
        await pool.query(
          `UPDATE ekbill.notifications
           SET status='RESOLVED', resolved_at=NOW()
           WHERE id=$1`,
          [existing[0].id]
        );
      }
    }
  } catch (err) {
    console.error("Expiry cron failed:", err.message);
  }
});
