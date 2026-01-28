// service/storePublicService.js
import { getPublicCatalogModel } from "../models/storePublicModel.js";

export const getPublicCatalogService = (slug, page, limit, category, search) =>
  getPublicCatalogModel(slug, page, limit, category, search);
