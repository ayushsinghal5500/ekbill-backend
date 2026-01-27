import express from "express";
import * as productController from '../controller/productController.js';
import {authenticateJWT} from "../middleware/authMiddleware.js";
import {uploadProductImage, multerErrorHandler, addFileUrl} from "../middleware/multer.js";

const router = express.Router();
router.use(authenticateJWT);

router.get("/init", productController.getInitialCategoryProducts);
router.post('/add', uploadProductImage.single('image'), multerErrorHandler, addFileUrl('product'), productController.createProduct);
router.get('/list', productController.getProducts);
router.post('/stock/in', productController.stockIn);
router.post('/stock/out', productController.stockOut);
router.get('/:product_unique_code/stock/history', productController.getStockHistory);
router.get('/:product_unique_code/stock/balance', productController.getStockBalance);
router.get('/:product_unique_code', productController.getProductById);
router.put('/:product_unique_code', uploadProductImage.single('image'), multerErrorHandler, addFileUrl('product'), productController.updateProduct);
router.delete('/:product_unique_code', productController.deleteProduct);

export default router;