import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

export const findStaffByBusinessAndUser = async (business_unique_code, user_unique_code) => {
  const res = await pool.query(
    `SELECT * FROM ekbill.business_staff 
     WHERE business_unique_code=$1 AND user_unique_code=$2`,
    [business_unique_code, user_unique_code]
  );
  return res.rows[0];
};

export const addOwnerAsStaff = async (business_unique_code, user_unique_code) => {
  const staff_unique_code = generateUniqueCode({ table: 'STF' });
  const res = await pool.query(
    `INSERT INTO ekbill.business_staff
     (staff_unique_code, business_unique_code, user_unique_code)
     VALUES ($1,$2,$3)
     ON CONFLICT (business_unique_code, user_unique_code) DO NOTHING
     RETURNING *`,
    [staff_unique_code, business_unique_code, user_unique_code]
  );
  if (res.rows[0]) return res.rows[0];
  const existing = await findStaffByBusinessAndUser(business_unique_code, user_unique_code);
  return existing;
};


export const assignStaffRoleByName = async (staff_unique_code, role_name) => {
  const result = await pool.query(
    `INSERT INTO ekbill.business_staff_roles (staff_unique_code, role_name, role_id)
     SELECT $1, r.role_name, r.role_id
     FROM ekbill.roles r
     WHERE r.role_name = $2
     ON CONFLICT (staff_unique_code, role_id) DO NOTHING
     RETURNING role_id`,
    [staff_unique_code, role_name.toUpperCase()]
  );

  if (result.rowCount === 0) {
    throw new Error("Invalid role name");
  }

  return result.rows[0];
};

