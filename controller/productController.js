import * as productService from '../service/productService.js';

export const createProduct = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const created_by = req.user.name || req.user.unique_code || req.user.user_unique_code;

    const data = { ...req.body, created_by, business_unique_code};

    if (data.category_name !== undefined && data.category_name !== null) {
      if (Array.isArray(data.category_name)) data.category_name = data.category_name[0];
      if (typeof data.category_name === "object") data.category_name = "";
      data.category_name = String(data.category_name).trim() || null;
    } else {
      data.category_name = null;
    }

    if (req.file) {
      // Use the URL format for database: uploads/business_unique_code/product/filename
      data.image_url = req.file.url || req.file.relativePath || req.file.path;
      data.image_name = req.file.originalname;
      data.image_type = req.file.mimetype;
      data.image_size = req.file.size;
    }

    if (data.is_gst_inclusive !== undefined) {
      data.is_gst_inclusive =
        data.is_gst_inclusive === true || data.is_gst_inclusive === "true";
    }

    if (!data.product_name || !data.selling_price) {
      return res.status(400).json({
        success: false,
        message: "Product name and selling price are required"
      });
    }

    const product = await productService.createProductService(data);

    const response = { success: true, data: product };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.status(201).json(response);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to create product"
    });
  }
};
export const getProducts = async (req, res) => {
  try {
    const{business_unique_code}=req.user;
    const filters = {
      category_unique_code: req.query.category_unique_code || null,
      search: req.query.search || null,
      status: req.query.status || null
    };

    const products = await productService.getProductsService(business_unique_code, filters);

    const response = {
      success: true,
      data: products,
      count: products.length
    };

    if (req.user.session_token) {
      response.session_token = req.user.session_token;
    }

    res.json(response);
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch products"
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { product_unique_code } = req.params;
    const {business_unique_code}=req.user;

    const product = await productService.getProductByIdService(product_unique_code, business_unique_code);

    const response = { success: true, data: product };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.json(response);
  } catch (err) {
    console.error('Get product error:', err);
    const statusCode = err.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to fetch product'
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { product_unique_code } = req.params;
    const {business_unique_code}=req.user;
    const updated_by = req.user.name || req.user.unique_code || req.user.user_unique_code;

    const data = { ...req.body, updated_by };

    if (data.category_name !== undefined && data.category_name !== null) {
      if (Array.isArray(data.category_name)) data.category_name = data.category_name[0];
      if (typeof data.category_name === "object") data.category_name = null;
      data.category_name = String(data.category_name || "").trim() || null;
    } else {
      data.category_name = null;
    }

    if (req.file) {
      // Use the URL format for database: uploads/business_unique_code/product/filename
      data.image_url = req.file.url || req.file.relativePath || req.file.path;
      data.image_name = req.file.originalname;
      data.image_type = req.file.mimetype;
      data.image_size = req.file.size;
    }

    if (data.is_gst_inclusive !== undefined) {
      data.is_gst_inclusive =
        data.is_gst_inclusive === true || data.is_gst_inclusive === "true";
    }

    if (data.has_secondary_unit !== undefined) {
      data.has_secondary_unit =
        data.has_secondary_unit === true || data.has_secondary_unit === "true";

      if (!data.has_secondary_unit) {
        data.secondary_unit = null;
        data.conversion_factor = null;
      } else if (data.conversion_factor !== undefined) {
        data.conversion_factor = Number(data.conversion_factor);
      }
    }

    const result = await productService.updateProductService(product_unique_code,business_unique_code,data);

    res.json({ success: true, data: result, message: "Product updated successfully" });
  } catch (err) {
    res.status(err.message === "Product not found" ? 404 : 500).json({
      success: false,
      message: err.message || "Failed to update product"
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { product_unique_code } = req.params;
    const {business_unique_code}=req.user;

    await productService.deleteProductService(product_unique_code, business_unique_code);

    const response = { success: true, message: 'Product deleted successfully' };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.json(response);
  } catch (err) {
    console.error('Delete product error:', err);
    const statusCode = err.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to delete product'
    });
  }
};

// ==================== STOCK CONTROLLERS ====================

export const stockIn = async (req, res) => {
  try {
    const {business_unique_code}=req.user;
    const created_by = req.user.name || req.user.unique_code || req.user.user_unique_code;

    const {product_unique_code, quantity, unit,price,notes,entry_date } = req.body;

    if (!product_unique_code || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: 'Product code, quantity, and price are required'
      });
    }

    const data = {
      business_unique_code,
      product_unique_code,
      quantity: parseInt(quantity),
      unit: unit || 'PCS',
      price: parseFloat(price),
      notes: notes || null,
      entry_date: entry_date || new Date().toISOString().split('T')[0],
      created_by
    };

    const stockHistory = await productService.stockInService(data);

    const response = {
      success: true,
      data: stockHistory,
      message: 'Stock added successfully'
    };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.status(201).json(response);
  } catch (err) {
    console.error('Stock in error:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to add stock'
    });
  }
};

export const stockOut = async (req, res) => {
  try {
    const {business_unique_code}=req.user;
    const created_by = req.user.name || req.user.unique_code || req.user.user_unique_code;

    const {product_unique_code,quantity,unit,price,notes,entry_date} = req.body;
   
    if (!product_unique_code || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: 'Product code, quantity, and price are required'
      });
    }

    const data = {
      business_unique_code,
      product_unique_code,
      quantity: parseInt(quantity),
      unit: unit || 'PCS',
      price: parseFloat(price),
      notes: notes || null,
      entry_date: entry_date || new Date().toISOString().split('T')[0],
      created_by
    };

    const stockHistory = await productService.stockOutService(data);

    const response = {
      success: true,
      data: stockHistory,
      message: 'Stock removed successfully'
    };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.status(200).json(response);
  } catch (err) {
    console.error('Stock out error:', err);
    let statusCode = 500;
    if (err.message.includes('not found')) statusCode = 404;
    if (err.message.includes('Insufficient stock')) statusCode = 400;

    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to remove stock'
    });
  }
};

export const getStockHistory = async (req, res) => {
  try {
    const { product_unique_code } = req.params;
    const {business_unique_code}=req.user;

    const filters = {
      transaction_type: req.query.transaction_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const history = await productService.getStockHistoryService(product_unique_code,business_unique_code,filters);

    const response = {
      success: true,
      data: history,
      count: history.length
    };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.json(response);
  } catch (err) {
    console.error('Get stock history error:', err);
    const statusCode = err.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to fetch stock history'
    });
  }
};


export const getStockBalance = async (req, res) => {
  try {
    const { product_unique_code } = req.params;
    const {business_unique_code}=req.user;

    const balance = await productService.getStockBalanceService(product_unique_code, business_unique_code);

    const response = { success: true, data: balance };
    if (req.user.session_token) response.session_token = req.user.session_token;

    res.json(response);
  } catch (err) {
    console.error('Get stock balance error:', err);
    const statusCode = err.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to fetch stock balance'
    });
  }
};

export const getInitialCategoryProducts = async (req, res) => {
  try {
    const {business_unique_code}=req.user;

    const data = await productService.getInitialCategoryProductsService(business_unique_code);

    const response = {
      success: true,
      data
    };

    if (req.user.session_token) {
      response.session_token = req.user.session_token;
    }

    res.json(response);

  } catch (err) {
    console.error("Initial category/product fetch error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to load categories and products"
    });
  }
};
