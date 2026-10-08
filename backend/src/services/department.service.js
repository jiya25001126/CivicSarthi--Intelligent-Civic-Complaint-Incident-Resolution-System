import departmentRepository from '../repositories/department.repository.js';

export class DepartmentService {
  async getAllDepartments() {
    return departmentRepository.findAll();
  }

  async getDepartmentById(id) {
    return departmentRepository.findById(id);
  }
}

export const departmentService = new DepartmentService();
export default departmentService;
