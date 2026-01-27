import {addBusinessService,getBusinessByUserService} from "../service/businessService.js";

export const addBusinessController = async (req, res) => {
    try {
        const { user_unique_code, business_unique_code } = req.user;
        const businessData = req.body;

        const updatedBusiness = await addBusinessService(business_unique_code, user_unique_code, businessData);
        res.status(200).json({ success: true, data: updatedBusiness });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getBusinessByUserController = async (req, res) => {
    try {
        const { user_unique_code } = req.user;
        const business = await getBusinessByUserService(user_unique_code);
        res.status(200).json({ success: true, data: business });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};