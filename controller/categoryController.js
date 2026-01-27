import { addCategoryService,listCategoriesService,deleteCategoryService } from "../service/categoryService.js";

export const addCategoryController = async (req, res) => {
  try {
    const { category_name } = req.body;
    const { user_unique_code, business_unique_code } = req.user;
    const categoryData = { category_name, business_unique_code, user_unique_code };
    const newCategory = await addCategoryService(categoryData);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategorylistController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const category = await listCategoriesService(business_unique_code);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const deleteCategoryController = async (req, res) => {
    try {
        const { category_unique_code, business_unique_code } = req.body;
        const deletedCategory = await deleteCategoryService(category_unique_code, business_unique_code);
        res.status(200).json({ success: true, data: deletedCategory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};