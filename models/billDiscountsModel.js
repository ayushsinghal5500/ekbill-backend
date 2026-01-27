import { generateUniqueCode } from "../utils/codeGenerator.js";

export const addDiscount = async (
  { bill_unique_code, discount_type, discount_value, discount_amount },
  client
) => {
  const discount_unique_code = generateUniqueCode("DISC");

  const res = await client.query(
    `INSERT INTO ekbill.discounts
     (discount_unique_code,bill_unique_code,discount_type,discount_value,discount_amount,created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     RETURNING *`,
    [discount_unique_code, bill_unique_code, discount_type, discount_value, discount_amount]
  );

  return res.rows[0];
};
