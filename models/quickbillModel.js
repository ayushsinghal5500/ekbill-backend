import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

/* ================= INSERT QUICK BILL ================= */
export const insertQuickBill = async (client, bill) => {
  const quick_bill_unique_code = generateUniqueCode({ table: "QBL" });

  await client.query(
    `INSERT INTO ekbill.quick_bills (
      quick_bill_unique_code, business_unique_code, invoice_name, customer_name, customer_phone, customer_country_code,
      customer_gstin, customer_address, billing_user_phone, notes, invoice_date, due_date,subtotal, has_discount, has_gst,
      discount_type, discount_value, discount_amount,gst_type, gst_percentage, is_gst_inclusive, cgst_amount, sgst_amount, igst_amount,
      total_gst_amount, grand_total, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
    [quick_bill_unique_code, bill.business_unique_code, bill.invoice_name,bill.customer_name || null, bill.customer_phone || null, bill.customer_country_code || null,
      bill.customer_gstin || null, bill.customer_address || null, bill.billing_user_phone || null,bill.notes || null, bill.invoice_date || null, bill.due_date || null,
      bill.subtotal, bill.has_discount, bill.has_gst,bill.discount_type, bill.discount_value, bill.discount_amount,
      bill.gst_type, bill.gst_percentage, bill.is_gst_inclusive,bill.cgst_amount, bill.sgst_amount, bill.igst_amount,
      bill.total_gst_amount, bill.grand_total, bill.created_by ]
  );
  return quick_bill_unique_code;
};

/* ================= INSERT ITEMS ================= */
export const insertQuickBillItems = async (client, quick_bill_unique_code, items) => {
  for (const item of items) {
    const item_code = generateUniqueCode({ table: "QBI" });

    await client.query(
      `INSERT INTO ekbill.quick_bill_items (
        quick_bill_item_unique_code,quick_bill_unique_code,item_name,quantity,price,line_total
      ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [item_code, quick_bill_unique_code, item.item_name, item.quantity, item.price, item.line_total]
    );
  }
};

/* ================= INSERT PAYMENTS ================= */
export const insertQuickBillPayments = async (client, quick_bill_unique_code, payments, created_by) => {
  for (const pay of payments) {
    const payment_code = generateUniqueCode({ table: "QBP" });

    await client.query(
      `INSERT INTO ekbill.quick_bill_payments (
        quick_bill_payment_unique_code,quick_bill_unique_code,payment_mode,amount,remaining_due,created_by
      ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [payment_code, quick_bill_unique_code, pay.payment_mode, pay.amount, pay.remaining_due || 0, created_by]
    );
  }
};

/* ================= INSERT CHARGES ================= */
export const insertQuickBillCharges = async (client, quick_bill_unique_code, charges) => {
  for (const ch of charges) {
    const charge_code = generateUniqueCode({ table: "QBC" });

    await client.query(
      `INSERT INTO ekbill.quick_bill_charges (
        quick_bill_charge_unique_code,quick_bill_unique_code,charge_name,amount
      ) VALUES ($1,$2,$3,$4)`,
      [charge_code, quick_bill_unique_code, ch.charge_name, ch.amount]
    );
  }
};

/* ================= GET BILL FULL ================= */
export const getQuickBillsList = async (business_unique_code) => {
  const res = await pool.query(
    `
    SELECT 
      qb.quick_bill_unique_code,
      qb.invoice_name,
      qb.customer_name,
      qb.grand_total,
      qb.created_at,
      qb.created_by,

      COALESCE((
        SELECT SUM(qp.amount)
        FROM ekbill.quick_bill_payments qp
        WHERE qp.quick_bill_unique_code = qb.quick_bill_unique_code
      ), 0) AS total_paid,

      CASE
        WHEN COALESCE((
          SELECT SUM(qp.amount)
          FROM ekbill.quick_bill_payments qp
          WHERE qp.quick_bill_unique_code = qb.quick_bill_unique_code
        ), 0) = 0 THEN 'UNPAID'

        WHEN COALESCE((
          SELECT SUM(qp.amount)
          FROM ekbill.quick_bill_payments qp
          WHERE qp.quick_bill_unique_code = qb.quick_bill_unique_code
        ), 0) < qb.grand_total THEN 'PARTIAL'

        ELSE 'PAID'
      END AS payment_status

    FROM ekbill.quick_bills qb
    WHERE qb.business_unique_code = $1
    ORDER BY qb.created_at DESC
    `,
    [business_unique_code]
  );

  return res.rows;
};

/* ================= GET BILL DETAILS ================= */
export const getQuickBillDetails = async (quick_bill_unique_code, business_unique_code) => {
  const billRes = await pool.query(
    `SELECT * FROM ekbill.quick_bills
     WHERE quick_bill_unique_code=$1 AND business_unique_code=$2`,
    [quick_bill_unique_code, business_unique_code]
  );
  if (!billRes.rows.length) return null;

  const itemsRes = await pool.query(
    `SELECT quick_bill_item_unique_code,item_name,quantity,price,line_total
     FROM ekbill.quick_bill_items
     WHERE quick_bill_unique_code=$1`,
    [quick_bill_unique_code]
  );

  const paymentsRes = await pool.query(
    `SELECT quick_bill_payment_unique_code,payment_mode,amount,remaining_due,created_at
     FROM ekbill.quick_bill_payments
     WHERE quick_bill_unique_code=$1
     ORDER BY created_at ASC`,
    [quick_bill_unique_code]
  );

  const chargesRes = await pool.query(
    `SELECT quick_bill_charge_unique_code,charge_name,amount
     FROM ekbill.quick_bill_charges
     WHERE quick_bill_unique_code=$1`,
    [quick_bill_unique_code]
  );

  return {
    bill: billRes.rows[0],
    items: itemsRes.rows,
    payments: paymentsRes.rows,
    charges: chargesRes.rows
  };
};
