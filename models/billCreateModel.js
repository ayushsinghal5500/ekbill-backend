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
