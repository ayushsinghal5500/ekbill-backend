import { createCategory,deleteCategory,getCategoriesByBusiness} from "../models/categoryModel.js";

export const addCategoryService = async (categoryData) => {
  return await createCategory(categoryData);
};

export const listCategoriesService = async (business_unique_code) => {
  return await getCategoriesByBusiness(business_unique_code);
};


export const deleteCategoryService = async (category_unique_code, business_unique_code) => {
  return await deleteCategory(category_unique_code, business_unique_code);
};