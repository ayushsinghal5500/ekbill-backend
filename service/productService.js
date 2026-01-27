// ==================== PRODUCT SERVICE (FINAL) ====================

import * as productModel from "../models/productModel.js";
import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";
import { handleLowStockAlert } from "../utils/lowStockAlert.js";

const ensureCategoryForProduct = async (created_by, business_unique_code, categoryName) => {
  if (!categoryName) return null;

  let category_name = String(categoryName).trim();
  if (!category_name) return null;

  const existing = await pool.query(
    `SELECT category_unique_code 
     FROM ekbill.categories
     WHERE business_unique_code = $1 
       AND LOWER(category_name) = LOWER($2)
       AND is_active = true`,
    [business_unique_code, category_name]
  );

  if (existing.rows.length > 0) return existing.rows[0].category_unique_code;

  const category_unique_code = generateUniqueCode({ table: "CAT" });

  await pool.query(
    `INSERT INTO ekbill.categories
      (category_unique_code, business_unique_code, category_name, created_by, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
    [category_unique_code, business_unique_code, category_name, created_by]
  );

  return category_unique_code;
};

// ==================== PRODUCT CRUD ====================

export const createProductService = async (data) => {
  if (!data.product_name || typeof data.product_name !== "string") {
    throw new Error("Product name is required");
  }

  const sellingPrice = Number(data.selling_price);
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    throw new Error("Selling price must be a number greater than 0");
  }

  data.is_gst_inclusive =
    data.is_gst_inclusive === true || data.is_gst_inclusive === "true";

  if (
    data.is_gst_inclusive &&
    (!data.gst_percentage || Number(data.gst_percentage) <= 0)
  ) {
    throw new Error("GST percentage required for GST inclusive product");
  }

  if (data.expiry_alert_days !== undefined) {
    const expiryAlertDays = Number(data.expiry_alert_days);
    if (!Number.isInteger(expiryAlertDays) || expiryAlertDays < 0) {
      throw new Error("Expiry alert days must be an integer >= 0");
    }
    data.expiry_alert_days = expiryAlertDays;
  }

  if (data.low_stock_alert !== undefined) {
    const lowStockAlert = Number(data.low_stock_alert);
    if (!Number.isInteger(lowStockAlert) || lowStockAlert < 0) {
      throw new Error("Low stock alert must be an integer >= 0");
    }
    data.low_stock_alert = lowStockAlert;
  }

  if (data.opening_stock !== undefined) {
    const openingStock = Number(data.opening_stock);
    if (!Number.isInteger(openingStock) || openingStock < 0) {
      throw new Error("Opening stock must be an integer >= 0");
    }
    data.opening_stock = openingStock;

    if (
      data.low_stock_alert !== undefined &&
      openingStock < data.low_stock_alert
    ) {
      throw new Error("Opening stock cannot be less than low stock alert");
    }
  }

  let category_code = data.category_unique_code || null;

  if (!category_code && data.category_name) {
    category_code = await ensureCategoryForProduct(
      data.created_by,
      data.business_unique_code,
      data.category_name
    );
  }

  // Map unit_type to primary_unit for database
  const productData = { ...data };
  if (productData.unit_type) {
    productData.primary_unit = productData.unit_type;
    delete productData.unit_type;
  }

  return await productModel.createProduct({
    ...productData,
    selling_price: sellingPrice,
    category_unique_code: category_code,
    is_gst_inclusive: data.is_gst_inclusive
  });
};


export const getProductsService = async (business_unique_code, filters = {}) => {
  return await productModel.getProducts(business_unique_code, filters);
};

export const getProductByIdService = async (product_unique_code, business_unique_code) => {
  const result = await productModel.getProductById(
    product_unique_code,
    business_unique_code
  );

  // IMPORTANT FIX — block inactive product
  if (!result || !result.product) {
    throw new Error("Product not found");
  }

  return result;
};

export const updateProductService = async (product_unique_code, business_unique_code, data) => {
  await getProductByIdService(product_unique_code, business_unique_code);

  if (data.expiry_alert_days !== undefined && data.expiry_alert_days < 0) {
    throw new Error("Expiry alert days must be 0 or greater");
  }

  if (data.is_gst_inclusive !== undefined && typeof data.is_gst_inclusive !== "boolean") {
    throw new Error("is_gst_inclusive must be boolean");
  }

  if (data.has_secondary_unit === true) {
    if (!data.secondary_unit) throw new Error("Secondary unit is required");
    if (data.conversion_factor === undefined || Number(data.conversion_factor) <= 0) {
      throw new Error("Conversion factor must be greater than 0");
    }
    // Map unit_type to primary_unit for comparison
    const primaryUnit = data.primary_unit || data.unit_type;
    if (primaryUnit && data.secondary_unit === primaryUnit) {
      throw new Error("Primary and secondary unit cannot be same");
    }
    data.conversion_factor = Number(data.conversion_factor);
  }

  // Map unit_type to primary_unit for database
  if (data.unit_type) {
    data.primary_unit = data.unit_type;
    delete data.unit_type;
  }

  if (data.has_secondary_unit === false) {
    data.secondary_unit = null;
    data.conversion_factor = null;
  }

  if (data.category_name && data.category_name.trim() !== "") {
    data.category_unique_code = await ensureCategoryForProduct(
      data.updated_by,
      business_unique_code,
      data.category_name.trim()
    );
  }

  return await productModel.updateProduct(
    product_unique_code,
    business_unique_code,
    data
  );
};


export const deleteProductService = async (product_unique_code, business_unique_code) => {
  // throws if product inactive or not found
  await getProductByIdService(product_unique_code, business_unique_code);

  return await productModel.deleteProduct(
    product_unique_code,
    business_unique_code
  );
};

// ==================== STOCK SERVICE ====================

export const stockInService = async (data) => {
  if (!data.product_unique_code || !data.quantity || !data.price)
    throw new Error("Product code, quantity, and price are required");

  if (data.quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (data.price <= 0) throw new Error("Price must be greater than 0");

  // blocks inactive - validate product belongs to business
  await getProductByIdService(
    data.product_unique_code,
    data.business_unique_code
  );

  const result = await productModel.stockIn(data);

  await handleLowStockAlert({
    product_unique_code: data.product_unique_code,
    business_unique_code: data.business_unique_code
  });

  return result;
};


export const stockOutService = async (data) => {
  if (!data.product_unique_code || !data.quantity || !data.price)
    throw new Error("Product code, quantity, and price are required");

  if (data.quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (data.price <= 0) throw new Error("Price must be greater than 0");

  // blocks inactive - validate product belongs to business
  await getProductByIdService(
    data.product_unique_code,
    data.business_unique_code
  );

  const result = await productModel.stockOut(data);

  await handleLowStockAlert({
    product_unique_code: data.product_unique_code,
    business_unique_code: data.business_unique_code
  });

  return result;
};

export const getStockHistoryService = async (
  product_unique_code,
  business_unique_code,
  filters = {}
) => {
  await getProductByIdService(product_unique_code, business_unique_code);

  return await productModel.getStockHistory(
    product_unique_code,
    business_unique_code,
    filters
  );
};

export const getStockBalanceService = async (
  product_unique_code,
  business_unique_code
) => {
  await getProductByIdService(product_unique_code, business_unique_code);

  const balance = await productModel.getStockBalance(
    product_unique_code,
    business_unique_code
  );

  return (
    balance || {
      product_unique_code,
      business_unique_code,
      current_stock: 0,
      total_stock_in: 0,
      total_stock_out: 0,
    }
  );
};


export const getInitialCategoryProductsService = async (business_unique_code) => {
  const data = await productModel.getInitialCategoryProducts(business_unique_code);

  return {
    categories: data.categories || [],
    products: data.products || []
  };
};

