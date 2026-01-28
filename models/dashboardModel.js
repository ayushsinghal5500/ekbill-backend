import pool from "../config/dbConnection.js";

export const getDashboardSnapshot = async (business_unique_code) => {
  const { rows } = await pool.query(`
    SELECT
      bp.business_name,

      -- Today's Sales
      (
        SELECT COALESCE(SUM(grand_total), 0)
        FROM ekbill.bills
        WHERE business_unique_code = $1
          AND invoice_date = CURRENT_DATE
      ) AS today_sales,

      -- Pending Payments
      (
        SELECT COALESCE(SUM(balance_after), 0)
        FROM ekbill.customer_ledger
        WHERE business_unique_code = $1
      ) AS pending_payments,

      -- Low Stock Items
      (
        SELECT COUNT(*)
        FROM ekbill.products p
        JOIN (
          SELECT
            product_unique_code,
            business_unique_code,
            SUM(
              CASE
                WHEN transaction_type IN ('OPENING','IN') THEN quantity
                WHEN transaction_type = 'OUT' THEN -quantity
                ELSE 0
              END
            ) AS stock
          FROM ekbill.product_stock_history
          GROUP BY product_unique_code, business_unique_code
        ) s
          ON s.product_unique_code = p.product_unique_code
         AND s.business_unique_code = p.business_unique_code
        WHERE p.business_unique_code = $1
          AND p.low_stock_alert IS NOT NULL
          AND s.stock <= p.low_stock_alert
      ) AS low_stock_items,

      -- Customers With Pending Payments
      (
        SELECT COUNT(DISTINCT customer_unique_code)
        FROM ekbill.customer_ledger
        WHERE business_unique_code = $1
          AND balance_after > 0
      ) AS payment_reminders

    FROM ekbill.business_profiles bp
    WHERE bp.business_unique_code = $1
  `, [business_unique_code]);

  return rows[0];
};


export const getLatestDashboardNotifications = async (business_unique_code, limit=5) => {
  const { rows } = await pool.query(`
    SELECT title,message,type,module,action,created_at,status
    FROM ekbill.notifications
    WHERE business_unique_code=$1
    ORDER BY created_at DESC
    LIMIT $2
  `,[business_unique_code,limit]);

  return rows;
};

export const getAllNotifications = async (business_unique_code) => {
  const { rows } = await pool.query(`
    SELECT title,message,type,module,action,created_at,status
    FROM ekbill.notifications
    WHERE business_unique_code=$1
    ORDER BY created_at DESC
  `,[business_unique_code]);

  return rows;
};
