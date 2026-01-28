// service/storeService.js
import { getPublicStoreLinkModel } from "../models/storeModel.js";

export const getPublicStoreLinkService = async (business_unique_code) => {
  return await getPublicStoreLinkModel(business_unique_code);
};
