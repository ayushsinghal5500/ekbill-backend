import pool from "../config/dbConnection.js";

/* ---------------- DATE RANGE HELPER ---------------- */
const getDateRange = (filter) => {
  const now = new Date();
  let start, end = new Date();

  if (filter === "today") {
    start = new Date(now.setHours(0, 0, 0, 0));
  } else if (filter === "week") {
    const day = now.getDay() || 7;
    start = new Date(now.setDate(now.getDate() - day + 1));
    start.setHours(0, 0, 0, 0);
  } else if (filter === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(0);
  }

  return { start, end: new Date() };
};

/* ================= CUSTOMER REPORT ================= */
export const CustomerReportsModel = {
  async getCustomerReport({ business_unique_code }) {
    const [total, active, todayNew, returning, top, dues, recent] =
      await Promise.all([
        pool.query(`SELECT COUNT(*)::int v FROM ekbill.customers WHERE business_unique_code=$1`, [business_unique_code]),

        pool.query(`
          SELECT COUNT(DISTINCT customer_unique_code)::int v FROM (
            SELECT customer_unique_code FROM ekbill.bills WHERE business_unique_code=$1
            UNION
            SELECT customer_unique_code FROM ekbill.customer_ledger WHERE business_unique_code=$1
          ) t`, [business_unique_code]),

        pool.query(`
          SELECT COUNT(*)::int v FROM ekbill.customers
          WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),

        pool.query(`
          SELECT COUNT(DISTINCT b.customer_unique_code)::int v
          FROM ekbill.bills b
          WHERE b.business_unique_code=$1
          AND DATE(b.created_at)=CURRENT_DATE
          AND EXISTS (
            SELECT 1 FROM ekbill.bills x
            WHERE x.customer_unique_code=b.customer_unique_code
            AND x.business_unique_code=$1
            AND DATE(x.created_at)<CURRENT_DATE
          )`, [business_unique_code]),

        pool.query(`
          SELECT c.customer_name, COUNT(b.bill_unique_code)::int orders,
          SUM(b.grand_total) amount
          FROM ekbill.bills b
          JOIN ekbill.customers c ON c.customer_unique_code=b.customer_unique_code
          WHERE b.business_unique_code=$1
          GROUP BY c.customer_unique_code,c.customer_name
          ORDER BY amount DESC LIMIT 5`, [business_unique_code]),

        pool.query(`
          SELECT
            COALESCE(SUM(CASE WHEN balance_after>0 THEN balance_after ELSE 0 END),0) will_get,
            COALESCE(SUM(CASE WHEN balance_after<0 THEN ABS(balance_after) ELSE 0 END),0) will_give
          FROM (
            SELECT DISTINCT ON (customer_unique_code) customer_unique_code,balance_after
            FROM ekbill.customer_ledger
            WHERE business_unique_code=$1
            ORDER BY customer_unique_code, entry_datetime DESC
          ) t`, [business_unique_code]),

        pool.query(`
          SELECT c.customer_name,l.transaction_type,l.amount,l.entry_datetime
          FROM ekbill.customer_ledger l
          JOIN ekbill.customers c ON c.customer_unique_code=l.customer_unique_code
          WHERE l.business_unique_code=$1
          ORDER BY l.entry_datetime DESC LIMIT 5`, [business_unique_code])
      ]);

    return {
      total_customers: total.rows[0].v,
      active_customers: active.rows[0].v,
      new_customers: todayNew.rows[0].v,
      returning_customers: returning.rows[0].v,
      top_customers: top.rows,
      dues_overview: dues.rows[0],
      recent_customer_activity: recent.rows
    };
  }
};

/* ================= DAILY REPORT ================= */
export const DailyReportsModel = {
  async getDaily({ business_unique_code }) {
    const pct = (c, p) => p === 0 ? (c > 0 ? 100 : 0) : +(((c - p) / p) * 100).toFixed(2);

    const [ts, ys, tb, yb, ta, ya, lowStock, expired] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),

      pool.query(`
        SELECT p.product_name,
        COALESCE(SUM(
          CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity
               WHEN h.transaction_type='OUT' THEN -h.quantity END
        ),0) stock
        FROM ekbill.products p
        LEFT JOIN ekbill.product_stock_history h ON p.product_unique_code=h.product_unique_code
        WHERE p.business_unique_code=$1 AND p.low_stock_alert>0
        GROUP BY p.product_unique_code,p.product_name,p.low_stock_alert
        HAVING COALESCE(SUM(
          CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity
               WHEN h.transaction_type='OUT' THEN -h.quantity END
        ),0)<=p.low_stock_alert
        ORDER BY stock ASC LIMIT 5`, [business_unique_code]),

      pool.query(`SELECT product_name,expiry_date FROM ekbill.products WHERE business_unique_code=$1 AND expiry_date<CURRENT_DATE LIMIT 5`, [business_unique_code])
    ]);

    const todaySales = +ts.rows[0].v, yesterdaySales = +ys.rows[0].v;
    const todayBills = +tb.rows[0].v, yesterdayBills = +yb.rows[0].v;
    const todayAOV = +ta.rows[0].v, yesterdayAOV = +ya.rows[0].v;

    return {
      today_sales: { amount: todaySales, percentage: pct(todaySales, yesterdaySales) },
      bills: { count: todayBills, percentage: pct(todayBills, yesterdayBills) },
      avg_bill_value: { amount: Math.round(todayAOV), percentage: pct(todayAOV, yesterdayAOV) },
      low_stock_alert: lowStock.rows,
      expired_stocks: expired.rows
    };
  }
};

/* ================= OVERVIEW REPORT ================= */
export const OverviewReportsModel = {
  async getOverview({ business_unique_code, filter }) {
    const { start, end } = getDateRange(filter);
    const pct = (a, b) => b === 0 ? (a > 0 ? 100 : 0) : +(((a - b) / b) * 100).toFixed(2);

    const [sales, orders, aov, topProducts, lowStock] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND created_at BETWEEN $2 AND $3`, [business_unique_code, start, end]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills WHERE business_unique_code=$1 AND created_at BETWEEN $2 AND $3`, [business_unique_code, start, end]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND created_at BETWEEN $2 AND $3`, [business_unique_code, start, end]),

      pool.query(`
        SELECT bi.product_name,SUM(bi.quantity)::int items_sold,SUM(bi.line_total) revenue
        FROM ekbill.bill_items bi
        JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code
        WHERE b.business_unique_code=$1 AND b.created_at BETWEEN $2 AND $3
        GROUP BY bi.product_name ORDER BY items_sold DESC LIMIT 5`, [business_unique_code, start, end]),

      pool.query(`
        SELECT p.product_name,
        COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity END),0) stock
        FROM ekbill.products p
        LEFT JOIN ekbill.product_stock_history h ON p.product_unique_code=h.product_unique_code
        WHERE p.business_unique_code=$1 AND p.low_stock_alert>0
        GROUP BY p.product_unique_code,p.product_name,p.low_stock_alert
        HAVING COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity END),0)<=p.low_stock_alert
        ORDER BY stock ASC LIMIT 5`, [business_unique_code])
    ]);

    const totalSales = +sales.rows[0].v;
    const totalOrders = +orders.rows[0].v;
    const avgOrder = +aov.rows[0].v;

    return {
      filter,
      sales: { amount: totalSales },
      orders: { count: totalOrders },
      avg_order_value: Math.round(avgOrder),
      top_selling_products: topProducts.rows,
      low_stock_alert: lowStock.rows
    };
  }
};

/* ================= SALES REPORT ================= */
export const SalesReportsModel = {
  async getSales({ business_unique_code, filter }) {
    const { start, end } = getDateRange(filter);

    const [sales, categories, cogs] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND created_at BETWEEN $2 AND $3`, [business_unique_code, start, end]),

      pool.query(`
        SELECT c.category_name,SUM(bi.line_total) total
        FROM ekbill.bill_items bi
        JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code
        JOIN ekbill.products p ON p.product_unique_code=bi.product_unique_code
        JOIN ekbill.categories c ON c.category_unique_code=p.category_unique_code
        WHERE b.business_unique_code=$1 AND b.created_at BETWEEN $2 AND $3
        GROUP BY c.category_name ORDER BY total DESC`, [business_unique_code, start, end]),

      pool.query(`
        SELECT COALESCE(SUM(bi.quantity * pp.cost_price),0) v
        FROM ekbill.bill_items bi
        JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code
        JOIN ekbill.product_pricing pp ON pp.product_unique_code=bi.product_unique_code
        WHERE b.business_unique_code=$1 AND b.created_at BETWEEN $2 AND $3`, [business_unique_code, start, end])
    ]);

    const totalSales = +sales.rows[0].v;
    const totalCogs = +cogs.rows[0].v;
    const grossProfit = totalSales - totalCogs;

    return {
      filter,
      total_sales: totalSales,
      sales_by_category: categories.rows,
      cogs: totalCogs,
      gross_profit_margin: totalSales === 0 ? 0 : +((grossProfit / totalSales) * 100).toFixed(2)
    };
  }
};
