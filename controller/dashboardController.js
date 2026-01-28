import { getDashboardService,getAllNotificationsService } from "../service/dashboardService.js";

export const getDashboard = async (req,res,next) => {
  try {
    const {business_unique_code} = req.user;
    
    if(!business_unique_code){
      return res.status(400).json({message:"Business not found"});
    }

    const data = await getDashboardService(business_unique_code);
    res.json(data);

  } catch(err){
    next(err);
  }
};

export const getAllNotifications = async (req,res,next) => {
  try {
    const {business_unique_code} = req.user;
    if(!business_unique_code){
      return res.status(400).json({message:"Business not found"});
    }
    const notifications = await getAllNotificationsService(business_unique_code);
    res.json({notifications});
  } catch(err){
    next(err);
  }
};
