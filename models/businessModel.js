import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";
import { nanoid } from "nanoid";

/* ================= ENSURE PUBLIC STORE EXISTS ================= */
const ensurePublicStore = async (client, business_unique_code, business_name) => {
  const existing = await client.query(
    `SELECT store_unique_code FROM ekbill.public_stores WHERE business_unique_code=$1`,
    [business_unique_code]
  );
  if (existing.rows.length) return;

  await client.query(
    `INSERT INTO ekbill.public_stores
     (store_unique_code, business_unique_code, public_slug, store_name)
     VALUES ($1,$2,$3,$4)`,
    [
      generateUniqueCode({ table: "STORE" }),
      business_unique_code,
      nanoid(10),
      business_name || "My Store"
    ]
  );
};

/* ================= FIND BUSINESS ================= */
export const findBusinessByOwner = async (user_unique_code) => {
  const res = await pool.query(
    `SELECT * FROM ekbill.business_profiles WHERE owner_user_unique_code=$1`,
    [user_unique_code]
  );
  return res.rows[0];
};

/* ================= CREATE BUSINESS ================= */
export const createBusiness = async ({ user_unique_code, phone }) => {
  const business_unique_code = generateUniqueCode({ table: "BUS" });

  const res = await pool.query(
    `INSERT INTO ekbill.business_profiles
     (business_unique_code, owner_user_unique_code, primary_phone)
     VALUES ($1,$2,$3)
     ON CONFLICT (owner_user_unique_code) DO NOTHING
     RETURNING *`,
    [business_unique_code, user_unique_code, phone]
  );

  if (res.rows[0]) return res.rows[0];
  return await findBusinessByOwner(user_unique_code);
};

/* ================= ADD / UPDATE FULL BUSINESS ================= */
export const addbusiness = async (business_unique_code, user_unique_code, businessData) => {
  const { profile, assets, financials, addresses } = businessData;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ===== BUSINESS PROFILE ===== */
    if (profile) {
      await client.query(
        `UPDATE ekbill.business_profiles 
         SET business_name=$1, business_type=$2, business_category=$3,
             primary_phone=$4, secondary_phone=$5, primary_email=$6,
             status=$7, updated_at=NOW()
         WHERE business_unique_code=$8 AND owner_user_unique_code=$9`,
        [
          profile.business_name,
          profile.business_type,
          profile.business_category,
          profile.primary_phone,
          profile.secondary_phone,
          profile.primary_email,
          profile.status,
          business_unique_code,
          user_unique_code
        ]
      );

      // 🔹 AUTO CREATE PUBLIC STORE IF NOT EXISTS
      if (profile.business_name) {
        await ensurePublicStore(client, business_unique_code, profile.business_name);
      }
    }

    /* ===== BUSINESS ASSETS ===== */
    if (assets?.length) {
      for (const asset of assets) {
        const existing = await client.query(
          `SELECT asset_id FROM ekbill.business_assets 
           WHERE business_unique_code=$1 AND asset_type=$2`,
          [business_unique_code, asset.asset_type]
        );

        if (existing.rows.length) {
          await client.query(
            `UPDATE ekbill.business_assets
             SET signature_type=$1, text_value=$2, file_url=$3, mime_type=$4, file_size=$5
             WHERE business_unique_code=$6 AND asset_type=$7`,
            [
              asset.signature_type,
              asset.text_value,
              asset.file_url,
              asset.mime_type,
              asset.file_size,
              business_unique_code,
              asset.asset_type
            ]
          );
        } else {
          await client.query(
            `INSERT INTO ekbill.business_assets
             (business_unique_code, asset_type, signature_type, text_value, file_url, mime_type, file_size)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              business_unique_code,
              asset.asset_type,
              asset.signature_type,
              asset.text_value,
              asset.file_url,
              asset.mime_type,
              asset.file_size
            ]
          );
        }
      }
    }

    /* ===== BUSINESS FINANCIALS ===== */
    if (financials) {
      await client.query(
        `INSERT INTO ekbill.business_financials
         (business_unique_code, pan_number, gstin, bank_name, ifsc_code, bank_account_number, upi_id, bank_confirmed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (business_unique_code) DO UPDATE SET
           pan_number=EXCLUDED.pan_number,
           gstin=EXCLUDED.gstin,
           bank_name=EXCLUDED.bank_name,
           ifsc_code=EXCLUDED.ifsc_code,
           bank_account_number=EXCLUDED.bank_account_number,
           upi_id=EXCLUDED.upi_id,
           bank_confirmed=EXCLUDED.bank_confirmed,
           updated_at=NOW()`,
        [
          business_unique_code,
          financials.pan_number,
          financials.gstin,
          financials.bank_name,
          financials.ifsc_code,
          financials.bank_account_number,
          financials.upi_id,
          financials.bank_confirmed
        ]
      );
    }

    /* ===== BUSINESS ADDRESSES ===== */
    if (addresses?.length) {
      await client.query(
        `DELETE FROM ekbill.entity_addresses
         WHERE entity_unique_code=$1 AND entity_type='business'`,
        [business_unique_code]
      );

      for (const addr of addresses) {
        const address_unique_code = generateUniqueCode({ table: "ADDR" });

        await client.query(
          `INSERT INTO ekbill.addresses
           (address_unique_code, address_label, address_line1, address_line2, city, state, postal_code, country, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            address_unique_code,
            addr.label || "Business Address",
            addr.line1,
            addr.line2 || null,
            addr.city,
            addr.state,
            addr.postal_code,
            addr.country || "India",
            user_unique_code
          ]
        );

        await client.query(
          `INSERT INTO ekbill.entity_addresses
           (address_unique_code, entity_unique_code, entity_type, address_role, is_primary, created_by)
           VALUES ($1,$2,'business',$3,$4,$5)`,
          [
            address_unique_code,
            business_unique_code,
            addr.address_role || "billing",
            addr.is_primary || false,
            user_unique_code
          ]
        );
      }
    }

    await client.query("COMMIT");

    const res = await pool.query(
      `SELECT * FROM ekbill.business_profiles WHERE business_unique_code=$1`,
      [business_unique_code]
    );

    return res.rows[0];

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/* ================= GET FULL BUSINESS DATA ================= */
export const getBusinessByUserCode = async (user_unique_code) => {
  const res = await pool.query(
    `SELECT 
      bp.business_unique_code,
      bp.business_name,
      bp.owner_user_unique_code,
      bp.primary_phone,
      bp.secondary_phone,
      bp.primary_email,
      bp.business_type,
      bp.business_category,
      bp.status,
      bp.created_at,
      bp.updated_at,

      bf.pan_number,
      bf.gstin,
      bf.bank_name,
      bf.ifsc_code,
      bf.bank_account_number,
      bf.upi_id,
      bf.bank_confirmed,

      COALESCE((
        SELECT json_agg(jsonb_build_object(
          'asset_type', ba.asset_type,
          'signature_type', ba.signature_type,
          'text_value', ba.text_value,
          'file_url', ba.file_url,
          'mime_type', ba.mime_type,
          'file_size', ba.file_size
        ))
        FROM ekbill.business_assets ba
        WHERE ba.business_unique_code = bp.business_unique_code
      ), '[]') AS assets,

      COALESCE((
        SELECT json_agg(jsonb_build_object(
          'address_unique_code', a.address_unique_code,
          'label', a.address_label,
          'line1', a.address_line1,
          'line2', a.address_line2,
          'city', a.city,
          'state', a.state,
          'postal_code', a.postal_code,
          'country', a.country,
          'address_role', ea.address_role,
          'is_primary', ea.is_primary
        ))
        FROM ekbill.entity_addresses ea
        JOIN ekbill.addresses a 
          ON a.address_unique_code = ea.address_unique_code
        WHERE ea.entity_unique_code = bp.business_unique_code
          AND ea.entity_type = 'business'
          AND a.is_deleted = FALSE
      ), '[]') AS addresses

     FROM ekbill.business_profiles bp
     LEFT JOIN ekbill.business_financials bf 
       ON bf.business_unique_code = bp.business_unique_code
     WHERE bp.owner_user_unique_code = $1`,
    [user_unique_code]
  );

  return res.rows[0];
};
