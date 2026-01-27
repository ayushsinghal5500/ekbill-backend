import { generateUniqueCode } from "../utils/codeGenerator.js";

export const addPayment = async (
  { bill_unique_code, user_unique_code, customer_unique_code, payment_mode, amount_paid },
  client
) => {
  const payment_unique_code = generateUniqueCode("PAY");

  const res = await client.query(
    `INSERT INTO ekbill.bill_payments
     (payment_unique_code,bill_unique_code,user_unique_code,customer_unique_code,payment_mode,amount_paid,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     RETURNING *`,
    [
      payment_unique_code,
      bill_unique_code,
      user_unique_code,
      customer_unique_code || null,
      payment_mode,
      amount_paid,
      user_unique_code
    ]
  );

  return res.rows[0];
};
