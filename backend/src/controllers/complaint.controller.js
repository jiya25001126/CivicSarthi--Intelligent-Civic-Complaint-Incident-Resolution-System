import complaintService from '../services/complaint.service.js';

export const listComplaints = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      departmentId: req.query.departmentId,
      department: req.query.department,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await complaintService.getAllComplaints(filters);

    if (result && result.pagination) {
      return res.json({
        success: true,
        count: result.items.length,
        pagination: result.pagination,
        data: result.items
      });
    }

    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintStats = async (req, res, next) => {
  try {
    const stats = await complaintService.getSummaryStats();
    res.json({
      success: true,
      data: stats
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
        error: `Complaint with id or reference '${id}' not found`
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

export const createComplaint = async (req, res, next) => {
  try {
    const complaint = await complaintService.createComplaint(req.body);
    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      referenceNumber: complaint.referenceNumber,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, actorType } = req.body;

    const updated = await complaintService.updateComplaintStatus(id, {
      status,
      remarks,
      actorType: actorType || 'OFFICER'
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const updateComplaintDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { departmentId, remarks, actorType } = req.body;

    const updated = await complaintService.updateComplaintDepartment(id, {
      departmentId,
      remarks,
      actorType: actorType || 'OFFICER'
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      message: `Complaint reassigned to department ${departmentId}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const addOfficerNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, officerId } = req.body;

    const updated = await complaintService.addOfficerNote(id, {
      note,
      officerId: officerId || 'OFFICER_ADMIN'
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      message: 'Officer review note appended successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await complaintService.getStatusHistory(id);

    if (!history) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};
