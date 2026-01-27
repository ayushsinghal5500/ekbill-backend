import {addbusiness, getBusinessByUserCode} from "../models/businessModel.js";

export const addBusinessService = async (business_unique_code, user_unique_code, businessData) => {
    return await addbusiness(business_unique_code, user_unique_code, businessData);
};

export const getBusinessByUserService = async (user_unique_code) => {
    return await getBusinessByUserCode(user_unique_code);
};