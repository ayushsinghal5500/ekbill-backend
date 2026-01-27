import { generateUniqueCode } from "../utils/codeGenerator.js";

export const addItem = async ({
  bill_unique_code,
  product_unique_code,
  product_name,
  quantity,
  unit,
  selling_price,
  tax_applicable,
  gst_rate,
  gst_amount,
  cgst,
  sgst,
  igst,
  line_total
}, client) => {

  const item_unique_code = generateUniqueCode("ITEM");

  const res = await client.query(
    `INSERT INTO ekbill.bill_items
     (item_unique_code,bill_unique_code,product_unique_code,product_name,quantity,unit,selling_price,tax_applicable,gst_rate,gst_amount,cgst,sgst,igst,line_total,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     RETURNING *`,
    [
      item_unique_code,
      bill_unique_code,
      product_unique_code || null,
      product_name,
      quantity,
      unit || "PCS",
      selling_price,
      tax_applicable || false,
      gst_rate || 0,
      gst_amount || 0,
      cgst || 0,
      sgst || 0,
      igst || 0,
      line_total
    ]
  );

  return res.rows[0];
};
