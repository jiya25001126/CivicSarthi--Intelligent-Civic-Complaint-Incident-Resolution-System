import complaintService from '../services/complaint.service.js';

export const listComplaints = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      department: req.query.department,
      status: req.query.status,
      priority: req.query.priority
    };
    const complaints = await complaintService.getAllComplaints(filters);
    res.json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complaint = await complaintService.getComplaintById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};
