import express from "express";
import {deleteCategoryController, getCategorylistController, addCategoryController} from "../controller/categoryController.js";
import {authenticateJWT} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", authenticateJWT, addCategoryController);
router.get("/list", authenticateJWT, getCategorylistController);
router.delete("/:category_unique_code", authenticateJWT, deleteCategoryController);
//update and single category routes can be added here in future
export default router;