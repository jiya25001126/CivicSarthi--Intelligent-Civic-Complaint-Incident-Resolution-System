import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NotificationAdapter } from '../src/services/notification/notification.adapter.js';
import { NotificationService } from '../src/services/notification/notification.service.js';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_EVENT,
  NOTIFICATION_STATUS,
  NOTIFICATION_CONFIG
} from '../src/constants/notification.constants.js';

// In-memory mock repositories for pure isolated unit and integration testing
class InMemoryNotificationLogRepo {
  constructor() {
    this.logs = [];
  }
  async create(data) {
    const record = {
      ...data,
      id: data.id || `NOTIF-TEST-${this.logs.length + 1}`,
      createdAt: data.createdAt || new Date().toISOString()
    };
    this.logs.push(record);
    return record;
  }
  async findById(id) {
    return this.logs.find((l) => l.id === id) || null;
  }
  async findLatestByIdempotencyKey(key) {
    const matches = this.logs.filter((l) => l.idempotencyKey === key);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
  async findAll(filters = {}) {
    let list = [...this.logs];
    if (filters.complaintId) list = list.filter((l) => l.complaintId === filters.complaintId);
    if (filters.citizenId) list = list.filter((l) => l.citizenId === filters.citizenId);
    if (filters.channel) list = list.filter((l) => l.channel === filters.channel);
    if (filters.eventType) list = list.filter((l) => l.eventType === filters.eventType);
    return list;
  }
  async update(id, updates) {
    const idx = this.logs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    this.logs[idx] = { ...this.logs[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.logs[idx];
  }
}

class InMemoryUserRepo {
  constructor() {
    this.users = new Map();
  }
  async findById(id) {
    return this.users.get(id) || null;
  }
  async update(id, updates) {
    const existing = this.users.get(id) || { id };
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }
}

describe('Feature A: Live SMS and WhatsApp Notifications Subsystem', () => {
  let adapter;
  let logRepo;
  let userRepo;
  let service;

  beforeEach(() => {
    adapter = new NotificationAdapter({ provider: 'mock' });
    logRepo = new InMemoryNotificationLogRepo();
    userRepo = new InMemoryUserRepo();
    service = new NotificationService(adapter, logRepo, userRepo);
  });

  describe('1. Phone Number Normalization & Validation', () => {
    test('normalizes 10-digit Indian mobile numbers to E.164 (+91)', () => {
      assert.strictEqual(service.normalizePhoneNumber('9876543210'), '+919876543210');
      assert.strictEqual(service.normalizePhoneNumber(' 88888 12345 '), '+918888812345');
      assert.strictEqual(service.normalizePhoneNumber('919876543210'), '+919876543210');
    });

    test('preserves valid international E.164 numbers', () => {
      assert.strictEqual(service.normalizePhoneNumber('+14155552671'), '+14155552671');
      assert.strictEqual(service.normalizePhoneNumber('+447700900077'), '+447700900077');
    });

    test('rejects malformed numbers and records SKIPPED_INVALID_RECIPIENT', async () => {
      assert.strictEqual(service.normalizePhoneNumber('12345'), null);
      assert.strictEqual(service.normalizePhoneNumber('abcdefghij'), null);

      const result = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: 'invalid_number'
      });

      assert.strictEqual(result.status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
      assert.strictEqual(adapter.getMockHistory().length, 0);
    });
  });

  describe('2. Consent & Opt-Out Enforcement', () => {
    test('delivers notification when citizen has not opted out', async () => {
      userRepo.users.set('cit_001', {
        id: 'cit_001',
        phone: '+919876543210',
        notificationPreferences: { enabled: true }
      });

      const res = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210',
        citizenId: 'cit_001',
        templateParams: { referenceNumber: 'GRV-2026-001', departmentName: 'Roads' }
      });

      assert.strictEqual(res.status, NOTIFICATION_STATUS.DELIVERED);
      assert.strictEqual(adapter.getMockHistory().length, 1);
    });

    test('respects global notification opt-out and logs SKIPPED_OPT_OUT', async () => {
      userRepo.users.set('cit_opted_out', {
        id: 'cit_opted_out',
        notificationPreferences: { enabled: false }
      });

      const res = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210',
        citizenId: 'cit_opted_out'
      });

      assert.strictEqual(res.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.strictEqual(adapter.getMockHistory().length, 0);
    });

    test('respects channel-specific SMS opt-out while allowing WhatsApp', async () => {
      userRepo.users.set('cit_partial', {
        id: 'cit_partial',
        notificationPreferences: { enabled: true, smsOptOut: true, whatsappOptOut: false }
      });

      const smsRes = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        citizenId: 'cit_partial',
        templateParams: { referenceNumber: 'GRV-001', status: 'IN_PROGRESS' }
      });

      const waRes = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.WHATSAPP,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        citizenId: 'cit_partial',
        templateParams: { referenceNumber: 'GRV-001', status: 'IN_PROGRESS' }
      });

      assert.strictEqual(smsRes.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.strictEqual(waRes.status, NOTIFICATION_STATUS.DELIVERED);
      assert.strictEqual(adapter.getMockHistory().length, 1);
      assert.strictEqual(adapter.getMockHistory()[0].channel, NOTIFICATION_CHANNEL.WHATSAPP);
    });
  });

  describe('3. Duplicate-Send Prevention (Idempotency)', () => {
    test('suppresses rapid duplicate dispatches within cooldown window', async () => {
      const payload = {
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        complaintId: 'cmp_100',
        complaintReference: 'GRV-100',
        stateIdentifier: 'IN_PROGRESS',
        templateParams: { referenceNumber: 'GRV-100', status: 'IN_PROGRESS' }
      };

      const first = await service.dispatchNotification(payload);
      assert.strictEqual(first.status, NOTIFICATION_STATUS.DELIVERED);

      // Immediate second dispatch with exact same state identifier
      const second = await service.dispatchNotification(payload);
      assert.strictEqual(second.status, NOTIFICATION_STATUS.DUPLICATE_SUPPRESSED);
      assert.strictEqual(adapter.getMockHistory().length, 1);
    });
  });

  describe('4. Lifecycle Notification Events Integration', () => {
    test('notifyCitizenRegistration sends welcome SMS and WhatsApp', async () => {
      const results = await service.notifyRegistration({
        id: 'cit_new',
        name: 'Ramesh Kumar',
        phone: '9876543210'
      });

      assert.strictEqual(results.length, 2);
      assert.strictEqual(adapter.getMockHistory().length, 2);
      const text = adapter.getMockHistory()[0].message;
      assert.ok(text.includes('Ramesh Kumar'));
    });

    test('notifyComplaintCreated formats reference and department name', async () => {
      const results = await service.notifyComplaintCreated({
        id: 'cmp_water',
        referenceNumber: 'GRV-2026-9999',
        category: 'water',
        departmentId: 'DEPT_WATER',
        citizenPhone: '9876543210'
      });

      assert.strictEqual(results.length, 2);
      const sentSms = adapter.getMockHistory().find((m) => m.channel === 'sms');
      assert.ok(sentSms.message.includes('GRV-2026-9999'));
      assert.ok(sentSms.message.includes('DEPT_WATER'));
    });

    test('notifyStatusChanged correctly formats status updates', async () => {
      const results = await service.notifyStatusChanged(
        {
          id: 'cmp_road',
          referenceNumber: 'GRV-2026-1111',
          citizenPhone: '9876543210'
        },
        'IN_PROGRESS',
        'Field inspection scheduled'
      );

      assert.strictEqual(results.length, 2);
      const sentWa = adapter.getMockHistory().find((m) => m.channel === 'whatsapp');
      assert.ok(sentWa.message.includes('IN_PROGRESS'));
    });

    test('notifyComplaintResolved delivers resolution alert with summary', async () => {
      const results = await service.notifyComplaintResolved(
        {
          id: 'cmp_road',
          referenceNumber: 'GRV-2026-1111',
          departmentId: 'DEPT_ROADS',
          citizenPhone: '9876543210'
        },
        'Pothole patch work completed and verified by site inspector.'
      );

      assert.strictEqual(results.length, 2);
      const sentSms = adapter.getMockHistory().find((m) => m.channel === 'sms');
      assert.ok(sentSms.message.includes('RESOLVED'));
      assert.ok(sentSms.message.includes('Pothole patch work completed'));
    });
  });

  describe('5. Bounded Retries & Fault Tolerance', () => {
    test('adapter retries transient network errors up to maxRetries without crashing caller', async () => {
      let callCount = 0;
      const failingAdapter = new NotificationAdapter({
        provider: 'mock',
        maxRetries: 3,
        timeoutMs: 100
      });

      // Override mock send to simulate failures
      failingAdapter._mockSend = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Simulated gateway timeout');
        }
        return { success: true, provider: 'mock', providerMessageId: 'retry_success' };
      };

      const failingService = new NotificationService(failingAdapter, logRepo, userRepo);
      const res = await failingService.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210'
      });

      assert.strictEqual(callCount, 3);
      assert.strictEqual(res.status, NOTIFICATION_STATUS.DELIVERED);
    });
  });
});

