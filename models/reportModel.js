import pool from "../config/dbConnection.js";

/* DATE FILTER HELPERS */
const currCond = (f) => {
  switch (f) {
    case "today": return `DATE(b.created_at)=CURRENT_DATE`;
    case "week": return `DATE(b.created_at)>=DATE_TRUNC('week',CURRENT_DATE) AND DATE(b.created_at)<=CURRENT_DATE`;
    case "month": return `DATE(b.created_at)>=DATE_TRUNC('month',CURRENT_DATE) AND DATE(b.created_at)<=CURRENT_DATE`;
    default: return `1=1`;
  }
};
const prevCond = (f) => {
  switch (f) {
    case "today": return `DATE(b.created_at)=CURRENT_DATE-INTERVAL '1 day'`;
    case "week": return `DATE(b.created_at)>=DATE_TRUNC('week',CURRENT_DATE-INTERVAL '1 week') AND DATE(b.created_at)<DATE_TRUNC('week',CURRENT_DATE)`;
    case "month": return `DATE(b.created_at)>=DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month') AND DATE(b.created_at)<DATE_TRUNC('month',CURRENT_DATE)`;
    default: return `1=1`;
  }
};

/* ================= CUSTOMER REPORT ================= */
export const CustomerReportsModel = {
  getCustomerReport: async ({ business_unique_code }) => {
    const [totalCustomers,activeCustomers,newCustomers,returningCustomers,topCustomers,dues,recentActivity] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.customers WHERE business_unique_code=$1`, [business_unique_code]),
      pool.query(`SELECT COUNT(DISTINCT customer_unique_code)::int v FROM (SELECT customer_unique_code FROM ekbill.customer_ledger WHERE business_unique_code=$1 UNION SELECT customer_unique_code FROM ekbill.bills WHERE business_unique_code=$1) t`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.customers WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COUNT(DISTINCT b.customer_unique_code)::int v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND DATE(b.created_at)=CURRENT_DATE AND EXISTS (SELECT 1 FROM ekbill.bills x WHERE x.customer_unique_code=b.customer_unique_code AND x.business_unique_code=$1 AND DATE(x.created_at)<CURRENT_DATE)`, [business_unique_code]),
      pool.query(`SELECT c.customer_name,COUNT(b.bill_unique_code)::int orders,SUM(b.grand_total) amount FROM ekbill.bills b JOIN ekbill.customers c ON c.customer_unique_code=b.customer_unique_code WHERE b.business_unique_code=$1 GROUP BY c.customer_unique_code,c.customer_name ORDER BY amount DESC LIMIT 5`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN balance_after>0 THEN balance_after ELSE 0 END),0) will_get,COALESCE(SUM(CASE WHEN balance_after<0 THEN ABS(balance_after) ELSE 0 END),0) will_give FROM (SELECT customer_unique_code,balance_after FROM ekbill.customer_ledger WHERE business_unique_code=$1 AND (customer_unique_code,entry_datetime) IN (SELECT customer_unique_code,MAX(entry_datetime) FROM ekbill.customer_ledger WHERE business_unique_code=$1 GROUP BY customer_unique_code)) t`, [business_unique_code]),
      pool.query(`SELECT c.customer_name,l.transaction_type,l.amount,l.entry_datetime FROM ekbill.customer_ledger l JOIN ekbill.customers c ON c.customer_unique_code=l.customer_unique_code WHERE l.business_unique_code=$1 ORDER BY l.entry_datetime DESC LIMIT 5`, [business_unique_code])
    ]);
    return {
      total_customers: totalCustomers.rows[0].v,
      active_customers: activeCustomers.rows[0].v,
      new_customers: newCustomers.rows[0].v,
      returning_customers: returningCustomers.rows[0]?.v || 0,
      top_customers: topCustomers.rows,
      dues_overview: dues.rows[0],
      recent_customer_activity: recentActivity.rows
    };
  }
};

/* ================= DAILY REPORT ================= */
export const DailyReportsModel = {
  getDaily: async ({ business_unique_code }) => {
    const [todaySales,yesterdaySales,todayBills,yesterdayBills,todayAOV,yesterdayAOV,lowStock,expiredStock] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE(created_at)=CURRENT_DATE-INTERVAL '1 day'`, [business_unique_code]),
      pool.query(`SELECT p.product_name,COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity ELSE 0 END),0) stock FROM ekbill.products p LEFT JOIN ekbill.product_stock_history h ON p.product_unique_code=h.product_unique_code WHERE p.business_unique_code=$1 AND p.low_stock_alert>0 GROUP BY p.product_unique_code,p.product_name,p.low_stock_alert HAVING COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity ELSE 0 END),0)<=p.low_stock_alert ORDER BY stock ASC LIMIT 5`, [business_unique_code]),
      pool.query(`SELECT product_name,expiry_date FROM ekbill.products WHERE business_unique_code=$1 AND expiry_date<CURRENT_DATE ORDER BY expiry_date ASC LIMIT 5`, [business_unique_code])
    ]);
    const pct=(c,p)=>p===0?(c>0?100:0):Number((((c-p)/p)*100).toFixed(2));
    const ts=+todaySales.rows[0].v, ys=+yesterdaySales.rows[0].v;
    const tb=+todayBills.rows[0].v, yb=+yesterdayBills.rows[0].v;
    const ta=+todayAOV.rows[0].v, ya=+yesterdayAOV.rows[0].v;
    return {
      today_sales:{amount:ts,percentage:pct(ts,ys)},
      bills:{count:tb,percentage:pct(tb,yb)},
      avg_bill_value:{amount:Math.round(ta),percentage:pct(ta,ya)},
      low_stock_alert:lowStock.rows,
      expired_stocks:expiredStock.rows
    };
  }
};

/* ================= OVERVIEW REPORT ================= */
export const OverviewReportsModel = {
  getOverview: async ({ business_unique_code, filter }) => {
    const c=currCond(filter), p=prevCond(filter);
    const [currSales,prevSales,currOrders,prevOrders,currAOV,prevAOV,topProducts,lowStock] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${p}`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COUNT(*)::int v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${p}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${p}`, [business_unique_code]),
      pool.query(`SELECT bi.product_name,SUM(bi.quantity)::int items_sold,SUM(bi.line_total) revenue FROM ekbill.bill_items bi JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code WHERE b.business_unique_code=$1 AND ${c.replace(/b.created_at/g,"b.created_at")} GROUP BY bi.product_name ORDER BY items_sold DESC LIMIT 5`, [business_unique_code]),
      pool.query(`SELECT p.product_name,COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity ELSE 0 END),0) stock FROM ekbill.products p LEFT JOIN ekbill.product_stock_history h ON p.product_unique_code=h.product_unique_code WHERE p.business_unique_code=$1 AND p.low_stock_alert>0 GROUP BY p.product_unique_code,p.product_name,p.low_stock_alert HAVING COALESCE(SUM(CASE WHEN h.transaction_type IN ('OPENING','IN','ADJUSTMENT') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity ELSE 0 END),0)<=p.low_stock_alert ORDER BY stock ASC LIMIT 5`, [business_unique_code])
    ]);
    const pct=(a,b)=>b===0?(a>0?100:0):Number((((a-b)/b)*100).toFixed(2));
    const cs=+currSales.rows[0].v, ps=+prevSales.rows[0].v;
    const co=+currOrders.rows[0].v, po=+prevOrders.rows[0].v;
    const ca=+currAOV.rows[0].v, pa=+prevAOV.rows[0].v;
    return {
      filter,
      sales:{amount:cs,percentage:pct(cs,ps)},
      orders:{count:co,percentage:pct(co,po)},
      avg_order_value:{amount:Math.round(ca),percentage:pct(ca,pa)},
      top_selling_products:topProducts.rows,
      low_stock_alert:lowStock.rows
    };
  }
};

/* ================= SALES REPORT ================= */
export const SalesReportsModel = {
  getSales: async ({ business_unique_code, filter }) => {
    const c=currCond(filter), p=prevCond(filter);
    const [currSales,prevSales,avgMonthly,lastYearSales,salesByCategory,cogs,customers,aov,newReturning] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${p}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND DATE_TRUNC('month',created_at)=DATE_TRUNC('month',CURRENT_DATE)`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(grand_total),0) v FROM ekbill.bills WHERE business_unique_code=$1 AND created_at>=CURRENT_DATE-INTERVAL '1 year'`, [business_unique_code]),
      pool.query(`SELECT c.category_name,SUM(bi.line_total) total FROM ekbill.bill_items bi JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code JOIN ekbill.products p ON p.product_unique_code=bi.product_unique_code JOIN ekbill.categories c ON c.category_unique_code=p.category_unique_code WHERE b.business_unique_code=$1 AND ${c.replace(/b.created_at/g,"b.created_at")} GROUP BY c.category_name ORDER BY total DESC`, [business_unique_code]),
      pool.query(`SELECT COALESCE(SUM(bi.quantity*p.cost_price),0) v FROM ekbill.bill_items bi JOIN ekbill.products p ON p.product_unique_code=bi.product_unique_code JOIN ekbill.bills b ON b.bill_unique_code=bi.bill_unique_code WHERE b.business_unique_code=$1 AND ${c.replace(/b.created_at/g,"b.created_at")}`, [business_unique_code]),
      pool.query(`SELECT COUNT(DISTINCT customer_unique_code)::int v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COALESCE(AVG(grand_total),0) v FROM ekbill.bills b WHERE b.business_unique_code=$1 AND ${c}`, [business_unique_code]),
      pool.query(`SELECT COUNT(DISTINCT CASE WHEN rn=1 THEN customer_unique_code END)::int new_customers,COUNT(DISTINCT CASE WHEN rn>1 THEN customer_unique_code END)::int returning_customers FROM (SELECT customer_unique_code,ROW_NUMBER() OVER (PARTITION BY customer_unique_code ORDER BY created_at) rn FROM ekbill.bills WHERE business_unique_code=$1 AND ${c}) t`, [business_unique_code])
    ]);
    const pct=(a,b)=>b===0?(a>0?100:0):Number((((a-b)/b)*100).toFixed(2));
    const totalSales=+currSales.rows[0].v;
    const grossProfit=totalSales-+cogs.rows[0].v;
    return {
      filter,
      total_sales:{amount:totalSales,percentage:pct(totalSales,+prevSales.rows[0].v)},
      avg_monthly_sales:Math.round(+avgMonthly.rows[0].v),
      avg_order_value:Math.round(+aov.rows[0].v),
      sales_growth_percent:pct(totalSales,+lastYearSales.rows[0].v),
      sales_by_category:salesByCategory.rows,
      cogs:+cogs.rows[0].v,
      gross_profit_margin:totalSales===0?0:Number(((grossProfit/totalSales)*100).toFixed(2)),
      customer_insights:{total_customers_served:customers.rows[0].v,new_customers:newReturning.rows[0].new_customers,returning_customers:newReturning.rows[0].returning_customers}
    };
  }
};
