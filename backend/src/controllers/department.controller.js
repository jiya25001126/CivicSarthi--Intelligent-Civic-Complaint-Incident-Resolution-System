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

export const getDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await departmentService.getDepartmentById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        error: `Department with id '${id}' not found`
      });
    }
    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
};
