import authService from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';

export const provisionUser = async (req, res, next) => {
  try {
    const executor = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    };

    const newUser = await authService.provisionUser(req.body, executor);

    res.status(201).json({
      success: true,
      message: `User '${newUser.name}' provisioned successfully with role '${newUser.role}'`,
      data: newUser
    });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const filters = {
      role: req.query.role,
      departmentId: req.query.departmentId
    };

    const users = await userRepository.findAll(filters);
    const sanitized = users.map(u => authService.sanitizeUser(u));

    res.json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (error) {
    next(error);
  }
};

export const listAuditLogs = async (req, res, next) => {
  try {
    const filters = {
      action: req.query.action,
      userId: req.query.userId,
      limit: req.query.limit || 50
    };

    const logs = await auditLogRepository.findAll(filters);

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

export default {
  provisionUser,
  listUsers,
  listAuditLogs
};
