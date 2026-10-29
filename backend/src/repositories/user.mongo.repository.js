import { UserModel } from '../models/user.model.js';

export class MongoUserRepository {
  async findById(id) {
    if (!id) return null;
    const doc = await UserModel.findOne({ id }).lean();
    return doc || null;
  }

  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const doc = await UserModel.findOne({ email: normalized }).lean();
    return doc || null;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.role && filters.role !== 'ALL') {
      query.role = filters.role;
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      query.departmentId = filters.departmentId;
    }
    if (typeof filters.isActive === 'boolean') {
      query.isActive = filters.isActive;
    }

    const docs = await UserModel.find(query).sort({ createdAt: -1 }).lean();
    return docs;
  }

  async create(userData) {
    const normalizedEmail = userData.email.trim().toLowerCase();
    const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      const err = new Error(`User with email '${normalizedEmail}' already exists`);
      err.status = 409;
      throw err;
    }

    const id = userData.id || `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const doc = await UserModel.create({
      id,
      email: normalizedEmail,
      passwordHash: userData.passwordHash,
      name: userData.name.trim(),
      role: userData.role || 'citizen',
      departmentId: userData.departmentId || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      phone: userData.phone || userData.phoneNumber || null,
      phoneNumber: userData.phoneNumber || userData.phone || null,
      notificationPreferences: userData.notificationPreferences || {
        enabled: true,
        smsOptOut: false,
        whatsappOptOut: false,
        preferredChannel: 'both'
      }
    });

    return doc.toObject();
  }

  async update(id, updates) {
    const current = await UserModel.findOne({ id });
    if (!current) return null;

    if (updates.email) {
      const newEmail = updates.email.trim().toLowerCase();
      const conflict = await UserModel.findOne({ id: { $ne: id }, email: newEmail }).lean();
      if (conflict) {
        const err = new Error(`User with email '${newEmail}' already exists`);
        err.status = 409;
        throw err;
      }
      current.email = newEmail;
    }

    if (updates.passwordHash !== undefined) current.passwordHash = updates.passwordHash;
    if (updates.name !== undefined) current.name = updates.name.trim();
    if (updates.role !== undefined) current.role = updates.role;
    if (updates.departmentId !== undefined) current.departmentId = updates.departmentId;
    if (updates.isActive !== undefined) current.isActive = updates.isActive;
    if (updates.phone !== undefined) current.phone = updates.phone;
    if (updates.phoneNumber !== undefined) current.phoneNumber = updates.phoneNumber;
    if (updates.notificationPreferences !== undefined) {
      current.notificationPreferences = {
        ...(current.notificationPreferences || {}),
        ...updates.notificationPreferences
      };
      if (typeof current.markModified === 'function') {
        current.markModified('notificationPreferences');
      }
    }

    await current.save();
    return current.toObject();
  }

  async count() {
    return UserModel.countDocuments();
  }
}

export const mongoUserRepository = new MongoUserRepository();
export default mongoUserRepository;
