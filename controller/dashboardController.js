import { getDashboardService,getAllNotificationsService } from "../service/dashboardService.js";

export const getDashboard = async (req,res,next) => {
  try {
    const user_unique_code = req.user.user_unique_code;

    if(!user_unique_code){
      return res.status(400).json({message:"User not found"});
    }

    const data = await getDashboardService(user_unique_code);
    res.json(data);

  } catch(err){
    next(err);
  }
};

export const getAllNotifications = async (req,res,next) => {
  try {
    const user_unique_code = req.user.user_unique_code;
    if(!user_unique_code){
      return res.status(400).json({message:"User not found"});
    }
    const notifications = await getAllNotificationsService(user_unique_code);
    res.json({notifications});
  } catch(err){
    next(err);
  }
};
