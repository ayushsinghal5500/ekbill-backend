import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

export const createBillModel = async ({
  business_unique_code,
  customer_unique_code,
  invoice_number,
  invoice_date,
  due_date,
  subtotal,
  tax_total,
  discount_total,
  grand_total,
  is_discount_applied,
  discount_type,
  discount_value,
  notes,
  user_unique_code
}, client) => {

  const bill_unique_code = generateUniqueCode("BILL");

  const res = await client.query(
    `INSERT INTO ekbill.bills
     (bill_unique_code,business_unique_code,customer_unique_code,invoice_number,invoice_date,due_date,subtotal,tax_total,discount_total,grand_total,is_discount_applied,discount_type,discount_value,notes,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     RETURNING *`,
    [
      bill_unique_code,
      business_unique_code,
      customer_unique_code || null,
      invoice_number,
      invoice_date || null,
      due_date || null,
      subtotal || 0,
      tax_total || 0,
      discount_total || 0,
      grand_total,
      is_discount_applied || false,
      discount_type || null,
      discount_value || 0,
      notes || null,
      user_unique_code
    ]
  );

  return res.rows[0];
};


export const getBillsList = async (business_unique_code) => {
  const res = await pool.query(
    `
    SELECT 
      b.bill_unique_code,
      b.invoice_number,
      c.customer_name,
      b.grand_total,
      b.created_at,
      b.created_by,

      COALESCE((
        SELECT SUM(p.amount_paid)
        FROM ekbill.bill_payments p
        WHERE p.bill_unique_code = b.bill_unique_code
      ), 0) AS total_paid,

      CASE
        WHEN COALESCE((
          SELECT SUM(p.amount_paid)
          FROM ekbill.bill_payments p
          WHERE p.bill_unique_code = b.bill_unique_code
        ), 0) = 0 THEN 'UNPAID'

        WHEN COALESCE((
          SELECT SUM(p.amount_paid)
          FROM ekbill.bill_payments p
          WHERE p.bill_unique_code = b.bill_unique_code
        ), 0) < b.grand_total THEN 'PARTIAL'

        ELSE 'PAID'
      END AS payment_status

    FROM ekbill.bills b
    LEFT JOIN ekbill.customers c
      ON c.customer_unique_code = b.customer_unique_code

    WHERE b.business_unique_code = $1
    ORDER BY b.created_at DESC
    `,
    [business_unique_code]
  );

  return res.rows;
};



export const getBillDetails = async (bill_unique_code, business_unique_code) => {
  const billRes = await pool.query(
    `SELECT * FROM ekbill.bills
     WHERE bill_unique_code=$1 AND business_unique_code=$2`,
    [bill_unique_code, business_unique_code]
  );

  if (!billRes.rows.length) return null;

  const itemsRes = await pool.query(
    `SELECT 
        item_unique_code,
        product_name,
        quantity,
        selling_price,
        line_total
     FROM ekbill.bill_items
     WHERE bill_unique_code=$1`,
    [bill_unique_code]
  );

  const paymentsRes = await pool.query(
    `SELECT 
        payment_unique_code,
        payment_mode,
        amount_paid,
        payment_date,
        created_at
     FROM ekbill.bill_payments
     WHERE bill_unique_code=$1
     ORDER BY payment_date ASC`,
    [bill_unique_code]
  );

  const chargesRes = await pool.query(
    `SELECT 
        charge_unique_code,
        charge_name,
        charge_amount
     FROM ekbill.charges
     WHERE bill_unique_code=$1`,
    [bill_unique_code]
  );

  return {
    bill: billRes.rows[0],
    items: itemsRes.rows,
    payments: paymentsRes.rows,
    charges: chargesRes.rows
  };
};
