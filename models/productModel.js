import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

/* ===== CURRENT STOCK FROM HISTORY ===== */
const getCurrentStockFromHistory = async (product_unique_code, business_unique_code) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN transaction_type IN ('OPENING','IN') THEN quantity WHEN transaction_type='OUT' THEN -quantity ELSE 0 END),0) AS current_stock
     FROM ekbill.product_stock_history 
     WHERE product_unique_code=$1 AND business_unique_code=$2`,
    [product_unique_code, business_unique_code]
  );
  return Number(rows[0].current_stock);
};

/* ===== CREATE PRODUCT ===== */
export const createProduct = async (data) => {
  const {
    business_unique_code, category_unique_code, product_name, selling_price,
    gst_percentage, is_gst_inclusive, cost_price, barcode, opening_stock,
    unit_type, expiry_date, expiry_alert_days, low_stock_alert, created_by,
    image_url, image_name, image_type, image_size,
    has_secondary_unit, secondary_unit, conversion_factor
  } = data;

  const product_unique_code = generateUniqueCode({ table: "PRODUCT" });

  // Insert into products table (only columns that exist in the table)
  const { rows } = await pool.query(
    `
    INSERT INTO ekbill.products (
      product_unique_code, business_unique_code, category_unique_code, product_name,
      barcode, primary_unit, has_secondary_unit, conversion_factor, secondary_unit,
      expiry_date, expiry_alert_days, low_stock_alert, created_by, created_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
    )
    RETURNING *
    `,
    [
      product_unique_code, business_unique_code, category_unique_code, product_name,
      barcode || null, unit_type || "PCS", has_secondary_unit || false,
      conversion_factor || 1, secondary_unit || null,
      expiry_date || null, expiry_alert_days || 0, low_stock_alert || 0,
      created_by
    ]
  );

  // Insert pricing into product_pricing table if provided
  if (selling_price || cost_price) {
    await pool.query(
      `
      INSERT INTO ekbill.product_pricing (
        product_unique_code, selling_price, cost_price, tax_applicability,
        gst_rate, price_includes_tax, tax_structure, hsn_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        product_unique_code,
        selling_price || 0,
        cost_price || 0,
        gst_percentage && gst_percentage > 0 ? 'GST' : 'NONE',
        gst_percentage || 0,
        is_gst_inclusive === true,
        'STANDARD',
        null
      ]
    );
  }

  // Insert image into product_media table if provided
  if (image_url) {
    await pool.query(
      `
      INSERT INTO ekbill.product_media (
        product_unique_code, image_url, image_name, image_type, image_size, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        product_unique_code, image_url, image_name || null,
        image_type || null, image_size || null, created_by
      ]
    );
  }

  // Insert opening stock into stock history if provided
  if (opening_stock && opening_stock > 0) {
    await pool.query(
      `
      INSERT INTO ekbill.product_stock_history (
        history_unique_code, product_unique_code, business_unique_code,
        transaction_type, transaction_source, quantity, unit, price, note, entry_datetime, created_by
      )
      VALUES ($1, $2, $3, 'OPENING', 'MANUAL', $4, $5, $6, $7, NOW(), $8)
      `,
      [
        generateUniqueCode({ table: "STOCK_HIST" }),
        product_unique_code, business_unique_code, opening_stock,
        unit_type || "PCS", selling_price || 0,
        'Opening Stock', created_by
      ]
    );
  }

  return rows[0];
};


/* ===== PRODUCT LIST ===== */
export const getProducts = async (business_unique_code, filters = {}) => {
  let whereConditions = [`p.business_unique_code = $1`, `p.is_active = true`];
  let queryParams = [business_unique_code];
  let paramIndex = 2;

  if (filters.category_unique_code) {
    whereConditions.push(`p.category_unique_code = $${paramIndex}`);
    queryParams.push(filters.category_unique_code);
    paramIndex++;
  }

  if (filters.search) {
    whereConditions.push(`(p.product_name ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`);
    queryParams.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.status === 'low_stock') {
    whereConditions.push(`(
      COALESCE(
        (SELECT SUM(CASE WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity WHEN h.transaction_type='OUT' THEN -h.quantity END)
         FROM ekbill.product_stock_history h WHERE h.product_unique_code = p.product_unique_code AND h.business_unique_code = p.business_unique_code), 0
      ) <= p.low_stock_alert AND p.low_stock_alert > 0
    )`);
  }

  const whereClause = whereConditions.join(' AND ');

  const summaryQuery = `
    SELECT
      COUNT(*) AS total_products,
      COUNT(DISTINCT p.category_unique_code) AS total_categories,
      COALESCE(
        SUM(
          (
            COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity
                    WHEN h.transaction_type='OUT' THEN -h.quantity
                  END
                )
                FROM ekbill.product_stock_history h
                WHERE h.product_unique_code = p.product_unique_code 
                  AND h.business_unique_code = p.business_unique_code
              ),0
            ) * COALESCE(pp.selling_price, 0)
          )
        ),0
      ) AS total_value
    FROM ekbill.products p
    LEFT JOIN ekbill.product_pricing pp ON pp.product_unique_code = p.product_unique_code
    WHERE ${whereClause}
  `;

  const productsQuery = `
    SELECT
      p.product_unique_code, p.product_name, pm.image_url, c.category_name,
      pp.selling_price AS price, pp.gst_rate AS gst_percentage,
      (
        COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity
                WHEN h.transaction_type='OUT' THEN -h.quantity
              END
            )
            FROM ekbill.product_stock_history h
            WHERE h.product_unique_code = p.product_unique_code 
              AND h.business_unique_code = p.business_unique_code
          ),0
        ) * COALESCE(pp.selling_price, 0)
      ) AS value,
      CASE
        WHEN COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity
                WHEN h.transaction_type='OUT' THEN -h.quantity
              END
            )
            FROM ekbill.product_stock_history h
            WHERE h.product_unique_code = p.product_unique_code 
              AND h.business_unique_code = p.business_unique_code
          ),0
        ) <= p.low_stock_alert AND p.low_stock_alert > 0
        THEN true ELSE false
      END AS is_low_stock,
      CASE
        WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE
        THEN true ELSE false
      END AS is_expired
    FROM ekbill.products p
    LEFT JOIN ekbill.categories c ON p.category_unique_code = c.category_unique_code
    LEFT JOIN ekbill.product_pricing pp ON pp.product_unique_code = p.product_unique_code
    LEFT JOIN ekbill.product_media pm ON pm.product_unique_code = p.product_unique_code
    WHERE ${whereClause}
    ORDER BY p.created_at DESC
  `;

  const [summaryRes, productsRes] = await Promise.all([
    pool.query(summaryQuery, queryParams),
    pool.query(productsQuery, queryParams)
  ]);

  return {
    summary: summaryRes.rows[0],
    products: productsRes.rows
  };
};


/* ===== PRODUCT BY ID ===== */
export const getProductById = async (product_unique_code, business_unique_code) => {
  const productQuery = `
    SELECT
      p.product_unique_code, p.product_name, pm.image_url,
      pp.selling_price, pp.cost_price, p.primary_unit AS unit_type,
      p.has_secondary_unit, p.secondary_unit, p.conversion_factor,
      p.low_stock_alert, pp.hsn_code,
      pp.gst_rate AS gst_percentage, pp.price_includes_tax AS is_gst_inclusive,
      COALESCE(
        (SELECT SUM(CASE
          WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity
          WHEN h.transaction_type='OUT' THEN -h.quantity END)
         FROM ekbill.product_stock_history h
         WHERE h.product_unique_code=p.product_unique_code 
           AND h.business_unique_code=p.business_unique_code),0
      ) AS current_stock,
      COALESCE(
        (SELECT SUM(CASE
          WHEN h.transaction_type IN ('OPENING','IN') THEN (h.quantity * h.price)
          WHEN h.transaction_type='OUT' THEN -(h.quantity * h.price) END)
         FROM ekbill.product_stock_history h
         WHERE h.product_unique_code=p.product_unique_code 
           AND h.business_unique_code=p.business_unique_code),0
      ) AS stock_value
    FROM ekbill.products p
    LEFT JOIN ekbill.product_pricing pp ON pp.product_unique_code = p.product_unique_code
    LEFT JOIN ekbill.product_media pm ON pm.product_unique_code = p.product_unique_code
    WHERE p.product_unique_code=$1 AND p.business_unique_code=$2 AND p.is_active=true
  `;

  const historyQuery = `
    SELECT transaction_type, quantity, unit, price, (quantity * price) AS stock_value, note, entry_datetime, created_at
    FROM ekbill.product_stock_history
    WHERE product_unique_code=$1 AND business_unique_code=$2
    ORDER BY created_at DESC
  `;

  const productRes = await pool.query(productQuery, [product_unique_code, business_unique_code]);
  if (!productRes.rows.length) return null;

  const historyRes = await pool.query(historyQuery, [product_unique_code, business_unique_code]);

  return { product: productRes.rows[0], stock_history: historyRes.rows };
};

/* ===== UPDATE PRODUCT ===== */
export const updateProduct = async (product_unique_code, business_unique_code, data) => {
  delete data.opening_stock;
  delete data.stock_value;

  if (data.has_secondary_unit === false) {
    data.secondary_unit = null;
    data.conversion_factor = null;
  }

  if (data.conversion_factor !== undefined && data.conversion_factor !== null) {
    data.conversion_factor = Number(data.conversion_factor);
  }

  if (data.primary_unit && data.secondary_unit && data.primary_unit === data.secondary_unit) {
    throw new Error("Primary and secondary unit cannot be same");
  }

  // Handle products table fields
  const productAllowed = [
    "product_name","category_unique_code","expiry_date","barcode","primary_unit",
    "has_secondary_unit","secondary_unit","conversion_factor",
    "expiry_alert_days","low_stock_alert","updated_by"
  ];

  // Handle pricing table fields separately
  const pricingFields = {};
  if (data.selling_price !== undefined) pricingFields.selling_price = data.selling_price;
  if (data.cost_price !== undefined) pricingFields.cost_price = data.cost_price;
  if (data.gst_percentage !== undefined) pricingFields.gst_rate = data.gst_percentage;
  if (data.is_gst_inclusive !== undefined) pricingFields.price_includes_tax = data.is_gst_inclusive;
  if (data.hsn_code !== undefined) pricingFields.hsn_code = data.hsn_code;

  // Handle media table fields separately
  const mediaFields = {};
  if (data.image_url !== undefined) mediaFields.image_url = data.image_url;
  if (data.image_name !== undefined) mediaFields.image_name = data.image_name;
  if (data.image_type !== undefined) mediaFields.image_type = data.image_type;
  if (data.image_size !== undefined) mediaFields.image_size = data.image_size;

  const fields=[], values=[];
  let i=1;

  for (const k of productAllowed) {
    if (data[k] !== undefined) {
      fields.push(`${k}=$${i++}`);
      values.push(data[k]);
    }
  }

  if (!fields.length && Object.keys(pricingFields).length === 0 && Object.keys(mediaFields).length === 0) {
    return getProductById(product_unique_code, business_unique_code);
  }

  values.push(product_unique_code, business_unique_code);

  // Update products table
  if (fields.length > 0) {
    await pool.query(
      `UPDATE ekbill.products SET ${fields.join(", ")},updated_at=NOW()
       WHERE product_unique_code=$${i} AND business_unique_code=$${i+1} AND is_active=true`,
      values
    );
  }

  // Update or insert pricing
  if (Object.keys(pricingFields).length > 0) {
    const pricingExists = await pool.query(
      `SELECT pricing_id FROM ekbill.product_pricing WHERE product_unique_code=$1`,
      [product_unique_code]
    );

    if (pricingExists.rows.length > 0) {
      const pricingFieldsList = Object.keys(pricingFields).map((k, idx) => `${k}=$${idx + 2}`).join(', ');
      const pricingValues = [product_unique_code, ...Object.values(pricingFields)];
      await pool.query(
        `UPDATE ekbill.product_pricing SET ${pricingFieldsList}, updated_at=NOW() WHERE product_unique_code=$1`,
        pricingValues
      );
    } else {
      const pricingKeys = Object.keys(pricingFields).join(', ');
      const pricingPlaceholders = Object.keys(pricingFields).map((_, idx) => `$${idx + 2}`).join(', ');
      const pricingValues = [product_unique_code, ...Object.values(pricingFields)];
      await pool.query(
        `INSERT INTO ekbill.product_pricing (product_unique_code, ${pricingKeys}, tax_applicability, tax_structure, created_at, updated_at)
         VALUES ($1, ${pricingPlaceholders}, 'GST', 'STANDARD', NOW(), NOW())`,
        pricingValues
      );
    }
  }

  // Update or insert media
  if (Object.keys(mediaFields).length > 0) {
    const mediaExists = await pool.query(
      `SELECT media_id FROM ekbill.product_media WHERE product_unique_code=$1`,
      [product_unique_code]
    );

    if (mediaExists.rows.length > 0) {
      const mediaFieldsList = Object.keys(mediaFields).map((k, idx) => `${k}=$${idx + 2}`).join(', ');
      const mediaValues = [product_unique_code, ...Object.values(mediaFields)];
      await pool.query(
        `UPDATE ekbill.product_media SET ${mediaFieldsList}, updated_at=NOW() WHERE product_unique_code=$1`,
        mediaValues
      );
    } else {
      const mediaKeys = Object.keys(mediaFields).join(', ');
      const mediaPlaceholders = Object.keys(mediaFields).map((_, idx) => `$${idx + 2}`).join(', ');
      const mediaValues = [product_unique_code, ...Object.values(mediaFields)];
      await pool.query(
        `INSERT INTO ekbill.product_media (product_unique_code, ${mediaKeys}, created_by, created_at, updated_at)
         VALUES ($1, ${mediaPlaceholders}, $${Object.keys(mediaFields).length + 2}, NOW(), NOW())`,
        [...mediaValues, data.updated_by]
      );
    }
  }

  const { rows } = await pool.query(
    `SELECT * FROM ekbill.products WHERE product_unique_code=$1 AND business_unique_code=$2 AND is_active=true`,
    [product_unique_code, business_unique_code]
  );

  return rows[0];
};

/* ===== DELETE PRODUCT ===== */
export const deleteProduct = async (product_unique_code, business_unique_code) => {
  const { rows } = await pool.query(
    `UPDATE ekbill.products SET is_active=false,updated_at=NOW()
     WHERE product_unique_code=$1 AND business_unique_code=$2 RETURNING *`,
    [product_unique_code, business_unique_code]
  );
  return rows[0];
};

/* ===== STOCK IN ===== */
export const stockIn = async (data) => {
  const { product_unique_code, business_unique_code, quantity, unit, price, notes, entry_date, created_by } = data;
  const { rows } = await pool.query(
    `INSERT INTO ekbill.product_stock_history
     (history_unique_code,product_unique_code,business_unique_code,transaction_type,transaction_source,quantity,unit,price,note,entry_datetime,created_by)
     VALUES ($1,$2,$3,'IN','MANUAL',$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      generateUniqueCode({ table: "STOCK_HIST" }),
      product_unique_code, business_unique_code, quantity,
      unit || "PCS", price,
      notes || null, entry_date ? new Date(entry_date) : new Date(), created_by
    ]
  );
  return rows[0];
};


/* ===== STOCK OUT ===== */
export const stockOut = async (data) => {
  const { product_unique_code, business_unique_code, quantity, unit, price, notes, entry_date, created_by } = data;
  const currentStock = await getCurrentStockFromHistory(product_unique_code, business_unique_code);
  if (currentStock < quantity) {
    throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO ekbill.product_stock_history
     (history_unique_code,product_unique_code,business_unique_code,transaction_type,transaction_source,quantity,unit,price,note,entry_datetime,created_by)
     VALUES ($1,$2,$3,'OUT','MANUAL',$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      generateUniqueCode({ table: "STOCK_HIST" }),
      product_unique_code, business_unique_code, quantity,
      unit || "PCS", price,
      notes || null, entry_date ? new Date(entry_date) : new Date(), created_by
    ]
  );
  return rows[0];
};

/* ===== STOCK HISTORY ===== */
export const getStockHistory = async (product_unique_code, business_unique_code, filters = {}) => {
  let whereConditions = [`product_unique_code=$1`, `business_unique_code=$2`];
  let queryParams = [product_unique_code, business_unique_code];
  let paramIndex = 3;

  if (filters.transaction_type) {
    whereConditions.push(`transaction_type=$${paramIndex}`);
    queryParams.push(filters.transaction_type);
    paramIndex++;
  }

  if (filters.start_date) {
    whereConditions.push(`entry_datetime >= $${paramIndex}`);
    queryParams.push(filters.start_date);
    paramIndex++;
  }

  if (filters.end_date) {
    whereConditions.push(`entry_datetime <= $${paramIndex}`);
    queryParams.push(filters.end_date);
    paramIndex++;
  }

  let limitClause = '';
  if (filters.limit) {
    limitClause = `LIMIT $${paramIndex}`;
    queryParams.push(filters.limit);
  }

  const { rows } = await pool.query(
    `SELECT * FROM ekbill.product_stock_history
     WHERE ${whereConditions.join(' AND ')}
     ORDER BY created_at DESC
     ${limitClause}`,
    queryParams
  );
  return rows;
};

/* ===== STOCK BALANCE ===== */
export const getStockBalance = async (product_unique_code, business_unique_code) => {
  const { rows } = await pool.query(
    `
    SELECT 
      p.product_unique_code,
      COALESCE(
        SUM(CASE 
          WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity 
          WHEN h.transaction_type='OUT' THEN -h.quantity 
          ELSE 0 
        END), 0
      ) AS current_stock,
      COALESCE(
        SUM(CASE WHEN h.transaction_type IN ('OPENING','IN') THEN h.quantity ELSE 0 END), 0
      ) AS total_stock_in,
      COALESCE(
        SUM(CASE WHEN h.transaction_type='OUT' THEN h.quantity ELSE 0 END), 0
      ) AS total_stock_out
    FROM ekbill.products p
    LEFT JOIN ekbill.product_stock_history h 
      ON h.product_unique_code = p.product_unique_code 
      AND h.business_unique_code = p.business_unique_code
    WHERE p.product_unique_code = $1 AND p.business_unique_code = $2 AND p.is_active = true
    GROUP BY p.product_unique_code
    `,
    [product_unique_code, business_unique_code]
  );

  if (!rows.length) return null;
  return rows[0];
};

export const getInitialCategoryProducts = async (business_unique_code) => {
  const query = `
    WITH cats AS (
      SELECT c.category_unique_code, c.category_name
      FROM ekbill.categories c
      WHERE c.business_unique_code = $1 AND c.is_active = true
      ORDER BY c.category_name
    ),

    stock AS (
      SELECT 
        product_unique_code,
        business_unique_code,
        SUM(
          CASE 
            WHEN transaction_type IN ('OPENING','IN') THEN quantity
            WHEN transaction_type = 'OUT' THEN -quantity
            ELSE 0
          END
        ) AS current_stock
      FROM ekbill.product_stock_history
      GROUP BY product_unique_code, business_unique_code
    ),

    prods AS (
      SELECT 
        p.product_unique_code,
        p.product_name,
        p.category_unique_code,
        c.category_name,
        p.created_at,

        /* Latest Image Only */
        pm.image_url,

        /* Pricing (single row assumed, still left join safe) */
        pp.selling_price,
        pp.gst_rate AS gst_percentage,
        pp.price_includes_tax AS is_gst_inclusive,

        /* Pre-calculated stock */
        COALESCE(s.current_stock, 0) AS current_stock

      FROM ekbill.products p

      LEFT JOIN ekbill.categories c 
        ON p.category_unique_code = c.category_unique_code

      LEFT JOIN ekbill.product_pricing pp 
        ON pp.product_unique_code = p.product_unique_code

      LEFT JOIN LATERAL (SELECT image_url FROM ekbill.product_media pm  WHERE pm.product_unique_code = p.product_unique_code ORDER BY pm.created_at DESC  LIMIT 1 ) pm ON true

      LEFT JOIN stock s
        ON s.product_unique_code = p.product_unique_code
       AND s.business_unique_code = p.business_unique_code

      WHERE p.business_unique_code = $1 
        AND p.is_active = true
    )

    SELECT
      (
        SELECT json_agg(json_build_object(
          'category_unique_code', cats.category_unique_code,
          'category_name', cats.category_name
        ) ORDER BY cats.category_name)
        FROM cats
      ) AS categories,

      (
        SELECT json_agg(json_build_object(
          'product_unique_code', prods.product_unique_code,
          'product_name', prods.product_name,
          'category_unique_code', prods.category_unique_code,
          'category_name', prods.category_name,
          'image_url', prods.image_url,
          'selling_price', prods.selling_price,
          'gst_percentage', prods.gst_percentage,
          'is_gst_inclusive', prods.is_gst_inclusive,
          'current_stock', prods.current_stock
        ) ORDER BY prods.created_at DESC)
        FROM prods
      ) AS products
  `;

  const { rows } = await pool.query(query, [business_unique_code]);
  const result = rows[0];

  return {
    categories: [
      { category_unique_code: "ALL", category_name: "All" },
      ...(result.categories || [])
    ],
    products: result.products || []
  };
};
