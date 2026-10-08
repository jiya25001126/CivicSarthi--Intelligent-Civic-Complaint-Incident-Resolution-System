import departmentService from '../services/department.service.js';

export const listDepartments = async (req, res, next) => {
  try {
    const departments = await departmentService.getAllDepartments();
    res.json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};
