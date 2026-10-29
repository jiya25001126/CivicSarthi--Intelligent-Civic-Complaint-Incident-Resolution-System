import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import config from '../config/app.config.js';
import { userRepository } from '../repositories/user.repository.js';
import { departmentRepository } from '../repositories/department.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { notificationService } from './notification/notification.service.js';

export const registerSchema = z.object({
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100),
  phone: z.string().trim().optional().nullable()
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});

export const provisionUserSchema = z.object({
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100),
  role: z.enum(['officer', 'admin'], {
    errorMap: () => ({ message: 'Provisioned role must be either officer or admin' })
  }),
  departmentId: z.string().trim().optional().nullable()
});

export class AuthService {
  /**
   * Public registration endpoint: STRICTLY CREATES ONLY CITIZEN ACCOUNTS.
   * Any client-supplied role is unconditionally ignored to prevent privilege escalation.
   */
  async register({ email, password, name, phone }) {
    const validated = registerSchema.parse({ email, password, name, phone });

    const existing = await userRepository.findByEmail(validated.email);
    if (existing) {
      const err = new Error('An account with this email address already exists');
      err.status = 409;
      throw err;
    }

    const saltRounds = config.auth.bcryptSaltRounds || 10;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);

    const user = await userRepository.create({
      email: validated.email,
      passwordHash,
      name: validated.name,
      phone: validated.phone || null,
      role: 'citizen', // Enforce citizen role unconditionally
      departmentId: null,
      isActive: true
    });

    const token = this.generateToken(user);
    const csrfToken = this.generateCsrfToken();

    return {
      user: this.sanitizeUser(user),
      token,
      csrfToken
    };
  }

  /**
   * Login with generic failure message to mitigate user enumeration attacks.
   */
  async login({ email, password }) {
    const validated = loginSchema.parse({ email, password });

    const user = await userRepository.findByEmail(validated.email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const passwordMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!passwordMatch) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    if (user.isActive === false) {
      const err = new Error('Account is deactivated. Please contact administrator.');
      err.status = 403;
      throw err;
    }

    const token = this.generateToken(user);
    const csrfToken = this.generateCsrfToken();

    return {
      user: this.sanitizeUser(user),
      token,
      csrfToken
    };
  }

  /**
   * Verify session token and retrieve active user
   */
  async verifySessionToken(token) {
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      const user = await userRepository.findById(decoded.sub);

      if (!user || user.isActive === false) {
        return null;
      }

      return this.sanitizeUser(user);
    } catch {
      return null;
    }
  }

  /**
   * Provision officer or admin account (privileged administrative / CLI operation)
   */
  async provisionUser(data, executor = { id: 'CLI_PROVISIONER', email: 'cli@internal', role: 'admin' }) {
    const validated = provisionUserSchema.parse(data);

    if (validated.role === 'officer') {
      if (!validated.departmentId) {
        const err = new Error('Department ID is required when provisioning an officer account');
        err.status = 400;
        throw err;
      }
      const deptExists = await departmentRepository.exists(validated.departmentId);
      if (!deptExists) {
        const err = new Error(`Department with ID '${validated.departmentId}' does not exist`);
        err.status = 400;
        throw err;
      }
    }

    const existing = await userRepository.findByEmail(validated.email);
    if (existing) {
      const err = new Error(`User with email '${validated.email}' already exists`);
      err.status = 409;
      throw err;
    }

    const saltRounds = config.auth.bcryptSaltRounds || 10;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);

    const newUser = await userRepository.create({
      email: validated.email,
      passwordHash,
      name: validated.name,
      role: validated.role,
      departmentId: validated.role === 'officer' ? validated.departmentId : null,
      isActive: true
    });

    // Record in audit log
    try {
      await auditLogRepository.create({
        userId: executor.id,
        userEmail: executor.email,
        role: executor.role,
        action: 'PROVISION_USER',
        targetResource: newUser.id,
        details: {
          provisionedEmail: newUser.email,
          provisionedRole: newUser.role,
          departmentId: newUser.departmentId
        }
      });
    } catch (logErr) {
      console.error('[Audit Log Warning] Failed to log user provisioning:', logErr.message);
    }

    return this.sanitizeUser(newUser);
  }

  generateToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || null,
      name: user.name
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtExpiresIn
    });
  }

  generateCsrfToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  sanitizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId || null,
      isActive: user.isActive !== undefined ? user.isActive : true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export const authService = new AuthService();
export default authService;
