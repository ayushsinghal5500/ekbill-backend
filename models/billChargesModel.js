import { generateUniqueCode } from "../utils/codeGenerator.js";

export const addCharge = async ({ bill_unique_code, charge_name, charge_amount }, client) => {
  const charge_unique_code = generateUniqueCode("CHARGE");

  const res = await client.query(
    `INSERT INTO ekbill.charges
     (charge_unique_code,bill_unique_code,charge_name,charge_amount,created_at)
     VALUES ($1,$2,$3,$4,NOW())
     RETURNING *`,
    [charge_unique_code, bill_unique_code, charge_name, charge_amount]
  );

  return res.rows[0];
};
