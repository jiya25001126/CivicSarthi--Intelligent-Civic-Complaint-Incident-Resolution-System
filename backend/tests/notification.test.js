import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs/promises';
import { NotificationAdapter } from '../src/services/notification/notification.adapter.js';
import { NotificationService } from '../src/services/notification/notification.service.js';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_EVENT,
  NOTIFICATION_STATUS,
  NOTIFICATION_CONFIG
} from '../src/constants/notification.constants.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { JsonUserRepository } from '../src/repositories/user.json.repository.js';
import { updatePreferences, getPreferences, getNotificationLogs } from '../src/controllers/notification.controller.js';

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
  async findByProviderMessageId(providerMessageId) {
    return this.logs.find((l) => l.providerMessageId === providerMessageId) || null;
  }
  async findAll(filters = {}) {
    let list = [...this.logs];
    if (filters.complaintId) list = list.filter((l) => l.complaintId === filters.complaintId);
    if (filters.citizenId) list = list.filter((l) => l.citizenId === filters.citizenId);
    if (filters.channel) list = list.filter((l) => l.channel === filters.channel);
    if (filters.eventType) list = list.filter((l) => l.eventType === filters.eventType);
    if (filters.providerMessageId) list = list.filter((l) => l.providerMessageId === filters.providerMessageId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

      assert.strictEqual(res.status, NOTIFICATION_STATUS.SIMULATED);
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
      assert.strictEqual(waRes.status, NOTIFICATION_STATUS.SIMULATED);
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
      assert.strictEqual(first.status, NOTIFICATION_STATUS.SIMULATED);

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
      assert.strictEqual(res.status, NOTIFICATION_STATUS.SIMULATED);
    });
  });
  describe('6. Provider Gateway Acceptance & Delivery Receipt Verification', () => {
    test('records SENT (accepted by gateway) when real provider accepts message', async () => {
      // Custom adapter simulating Twilio/REST gateway acceptance
      const twilioAdapter = {
        sendSms: async () => ({
          success: true,
          provider: 'twilio',
          providerMessageId: 'SM_TWILIO_TEST_001',
          status: 'queued',
          timestamp: new Date().toISOString()
        })
      };

      const realService = new NotificationService(twilioAdapter, logRepo, userRepo);
      const res = await realService.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210',
        complaintReference: 'GRV-REAL-001'
      });

      assert.strictEqual(res.status, NOTIFICATION_STATUS.SENT);
      assert.strictEqual(res.provider, 'twilio');
      assert.strictEqual(res.providerMessageId, 'SM_TWILIO_TEST_001');
    });

    test('transitions SENT message to DELIVERED upon receiving carrier delivery receipt', async () => {
      const twilioAdapter = {
        sendSms: async () => ({
          success: true,
          provider: 'twilio',
          providerMessageId: 'SM_DLR_002',
          status: 'sent',
          timestamp: new Date().toISOString()
        })
      };

      const realService = new NotificationService(twilioAdapter, logRepo, userRepo);
      await realService.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        complaintReference: 'GRV-DLR-002'
      });

      // Carrier posts delivery receipt callback
      const receiptRes = await realService.processDeliveryReceipt({
        providerMessageId: 'SM_DLR_002',
        status: NOTIFICATION_STATUS.DELIVERED,
        timestamp: new Date().toISOString()
      });

      assert.ok(receiptRes);
      assert.strictEqual(receiptRes.status, NOTIFICATION_STATUS.DELIVERED);
    });

    test('records FAILED when provider rejects dispatch or network fails', async () => {
      const failingAdapter = {
        sendSms: async () => {
          throw new Error('Carrier gateway unreachable: 503 Service Unavailable');
        }
      };

      const failService = new NotificationService(failingAdapter, logRepo, userRepo);
      const res = await failService.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210'
      });

      assert.strictEqual(res.status, NOTIFICATION_STATUS.FAILED);
      assert.ok(res.error.includes('Carrier gateway unreachable'));
    });
  });

  describe('7. Profile Phone Number Fallback & Missing Phone Safety', () => {
    test('resolves registered phone from citizen user profile when complaint lacks citizenPhone', async () => {
      userRepo.users.set('cit_registered_phone', {
        id: 'cit_registered_phone',
        phone: '+919123456789',
        notificationPreferences: { enabled: true }
      });

      const results = await service.notifyComplaintCreated({
        id: 'cmp_no_phone',
        referenceNumber: 'GRV-FALLBACK-001',
        citizenId: 'cit_registered_phone',
        category: 'roads',
        departmentId: 'DEPT_ROADS'
        // citizenPhone intentionally missing
      });

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(results[0].recipientPhone, '+919123456789');
    });

    test('records SKIPPED_INVALID_RECIPIENT when neither complaint nor citizen has phone number', async () => {
      userRepo.users.set('cit_without_phone', {
        id: 'cit_without_phone',
        phone: null,
        notificationPreferences: { enabled: true }
      });

      const results = await service.notifyComplaintCreated({
        id: 'cmp_totally_no_phone',
        referenceNumber: 'GRV-UNKNOWN-001',
        citizenId: 'cit_without_phone',
        category: 'roads',
        departmentId: 'DEPT_ROADS'
      });

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
      assert.strictEqual(results[0].error, 'Phone number missing or invalid format');
      assert.strictEqual(results[0].recipientPhone, 'UNKNOWN');
    });
  });

  describe('8. Preferred Channel Enforcement', () => {
    test('suppresses WhatsApp and delivers SMS when citizen prefers SMS only', async () => {
      userRepo.users.set('cit_sms_only', {
        id: 'cit_sms_only',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'sms' }
      });

      const results = await service.notifyComplaintCreated({
        id: 'cmp_pref_sms',
        referenceNumber: 'GRV-SMS-ONLY',
        citizenId: 'cit_sms_only',
        category: 'water',
        departmentId: 'DEPT_WATER'
      });

      const sms = results.find(r => r.channel === NOTIFICATION_CHANNEL.SMS);
      const wa = results.find(r => r.channel === NOTIFICATION_CHANNEL.WHATSAPP);

      assert.strictEqual(sms.status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(wa.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(wa.error.includes('SMS only'));
    });

    test('suppresses SMS and delivers WhatsApp when citizen prefers WhatsApp only', async () => {
      userRepo.users.set('cit_wa_only', {
        id: 'cit_wa_only',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'whatsapp' }
      });

      const results = await service.notifyComplaintCreated({
        id: 'cmp_pref_wa',
        referenceNumber: 'GRV-WA-ONLY',
        citizenId: 'cit_wa_only',
        category: 'water',
        departmentId: 'DEPT_WATER'
      });

      const sms = results.find(r => r.channel === NOTIFICATION_CHANNEL.SMS);
      const wa = results.find(r => r.channel === NOTIFICATION_CHANNEL.WHATSAPP);

      assert.strictEqual(sms.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(sms.error.includes('WhatsApp only'));
      assert.strictEqual(wa.status, NOTIFICATION_STATUS.SIMULATED);
    });
  });

  describe('9. Issue 4 Regression Suite: Phone Persistence, Audit Reliability & Edge Cases', () => {
    function mockReqRes(user, body = {}, query = {}) {
      const req = { user, body, query };
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        }
      };
      return { req, res };
    }

    test('1. Registered phone number saves successfully via updatePreferences', async () => {
      const uid = `USR-SCENARIO-1-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const testUser = {
        id: uid,
        email: `${uid.toLowerCase()}@civicsarthi.internal`,
        name: 'Scenario 1 Citizen',
        role: 'citizen'
      };
      await userRepository.create(testUser);

      const { req, res } = mockReqRes(
        testUser,
        {
          phone: '9876543210',
          preferredChannel: 'whatsapp',
          enabled: true
        }
      );

      await updatePreferences(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.phone, '+919876543210');
      assert.strictEqual(res.body.data.preferences.preferredChannel, 'whatsapp');

      const savedInRepo = await userRepository.findById(uid);
      assert.strictEqual(savedInRepo.phone, '+919876543210');
      assert.strictEqual(savedInRepo.phoneNumber, '+919876543210');
    });

    test('2. Phone number remains available across fresh repository instances', async () => {
      const testUserFilePath = path.resolve('tests/sandbox-test-data', `test-users-${Date.now()}.json`);
      const repo1 = new JsonUserRepository(testUserFilePath);
      const uid = `USR-FRESH-${Date.now()}`;
      await repo1.create({
        id: uid,
        email: `${uid.toLowerCase()}@civicsarthi.internal`,
        name: 'Fresh Citizen',
        phone: '+919876543210',
        role: 'citizen'
      });

      // Instantiate a completely new repository instance targeting the exact same file
      const repo2 = new JsonUserRepository(testUserFilePath);
      const fetched = await repo2.findById(uid);

      assert.ok(fetched);
      assert.strictEqual(fetched.id, uid);
      assert.strictEqual(fetched.phone, '+919876543210');

      // Cleanup temp test file
      await fs.unlink(testUserFilePath).catch(() => {});
    });

    test('3. getPreferences returns saved phone number', async () => {
      const uid = `USR-SCENARIO-3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const testUser = {
        id: uid,
        email: `${uid.toLowerCase()}@civicsarthi.internal`,
        name: 'Scenario 3 Citizen',
        phone: '+919876543210',
        role: 'citizen',
        notificationPreferences: {
          enabled: true,
          preferredChannel: 'sms'
        }
      };
      await userRepository.create(testUser);

      const { req, res } = mockReqRes(testUser);
      await getPreferences(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.phone, '+919876543210');
      assert.strictEqual(res.body.data.preferences.preferredChannel, 'sms');
    });

    test('4. Omitted phone field does not erase existing phone number', async () => {
      const uid = `USR-SCENARIO-4-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const testUser = {
        id: uid,
        email: `${uid.toLowerCase()}@civicsarthi.internal`,
        name: 'Scenario 4 Citizen',
        phone: '+919876543210',
        role: 'citizen',
        notificationPreferences: {
          enabled: true,
          preferredChannel: 'whatsapp'
        }
      };
      await userRepository.create(testUser);

      // Call updatePreferences with phone omitted (undefined)
      const { req, res } = mockReqRes(
        testUser,
        {
          preferredChannel: 'sms',
          smsOptOut: false
        }
      );

      await updatePreferences(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.phone, '+919876543210');

      const saved = await userRepository.findById(uid);
      assert.strictEqual(saved.phone, '+919876543210');
      assert.strictEqual(saved.notificationPreferences.preferredChannel, 'sms');
    });

    test('5. Complaint without phone uses citizen registered profile phone', async () => {
      userRepo.users.set('cit_reg_profile_5', {
        id: 'cit_reg_profile_5',
        phone: '+919988776655',
        notificationPreferences: { enabled: true, preferredChannel: 'both' }
      });

      const results = await service.notifyComplaintCreated({
        id: 'cmp_no_direct_phone_5',
        referenceNumber: 'GRV-PROFILE-FALLBACK-005',
        citizenId: 'cit_reg_profile_5',
        category: 'electricity',
        departmentId: 'DEPT_ELECTRICITY'
      });

      assert.strictEqual(results.length, 2);
      for (const res of results) {
        assert.strictEqual(res.status, NOTIFICATION_STATUS.SIMULATED);
        assert.strictEqual(res.recipientPhone, '+919988776655');
      }
    });

    test('6. Missing or invalid phone produces accurate SKIPPED_INVALID_RECIPIENT status', async () => {
      userRepo.users.set('cit_no_contact_6', {
        id: 'cit_no_contact_6',
        phone: null,
        notificationPreferences: { enabled: true }
      });

      // Sub-case 6a: Missing phone -> recipientPhone defaults to 'UNKNOWN'
      const missingResults = await service.notifyComplaintCreated({
        id: 'cmp_missing_phone_6',
        referenceNumber: 'GRV-MISSING-006',
        citizenId: 'cit_no_contact_6'
      });

      assert.strictEqual(missingResults.length, 2);
      for (const res of missingResults) {
        assert.strictEqual(res.status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
        assert.strictEqual(res.error, 'Phone number missing or invalid format');
        assert.strictEqual(res.recipientPhone, 'UNKNOWN');
      }

      // Sub-case 6b: Malformed invalid phone string -> recorded without throwing
      const invalidResults = await service.notifyComplaintCreated({
        id: 'cmp_invalid_phone_6',
        referenceNumber: 'GRV-INVALID-006',
        citizenId: 'cit_no_contact_6',
        citizenPhone: 'invalid_short_phone'
      });

      assert.strictEqual(invalidResults.length, 2);
      for (const res of invalidResults) {
        assert.strictEqual(res.status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
        assert.strictEqual(res.error, 'Phone number missing or invalid format');
        assert.strictEqual(res.recipientPhone, 'invalid_short_phone');
      }
    });

    test('7. Delivery Audit refresh displays new records in newest-first order', async () => {
      await logRepo.create({
        id: 'AUDIT-LOG-OLDER',
        citizenId: 'cit_audit_7',
        channel: 'sms',
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        status: NOTIFICATION_STATUS.SIMULATED,
        createdAt: new Date(Date.now() - 60000).toISOString()
      });

      await logRepo.create({
        id: 'AUDIT-LOG-NEWER',
        citizenId: 'cit_audit_7',
        channel: 'whatsapp',
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        status: NOTIFICATION_STATUS.SIMULATED,
        createdAt: new Date().toISOString()
      });

      const logs = await service.getDeliveryLogs({ citizenId: 'cit_audit_7' });
      assert.strictEqual(logs.length, 2);
      // Newest should be first
      assert.strictEqual(logs[0].id, 'AUDIT-LOG-NEWER');
      assert.strictEqual(logs[1].id, 'AUDIT-LOG-OLDER');
    });

    test('8. Existing audit history is preserved intact upon new dispatches', async () => {
      const historicalId = 'NOTIF-HISTORICAL-PRESERVED';
      await logRepo.create({
        id: historicalId,
        citizenId: 'cit_preserve_8',
        channel: 'sms',
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        status: NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT,
        error: 'Phone number missing or invalid format',
        createdAt: '2026-10-28T12:00:00.000Z'
      });

      userRepo.users.set('cit_preserve_8', {
        id: 'cit_preserve_8',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'sms' }
      });

      await service.notifyStatusChanged(
        { id: 'cmp_preserve_8', citizenId: 'cit_preserve_8', referenceNumber: 'GRV-PRESERVE-008' },
        'IN_PROGRESS',
        'Technician assigned'
      );

      // 1 historical log + 2 new channel dispatches (SMS + WhatsApp) = 3 total logs
      const allLogs = await logRepo.findAll({ citizenId: 'cit_preserve_8' });
      assert.strictEqual(allLogs.length, 3);

      const historical = allLogs.find(l => l.id === historicalId);
      assert.ok(historical);
      assert.strictEqual(historical.status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
      assert.strictEqual(historical.error, 'Phone number missing or invalid format');
    });

    test('9. Consent and preferredChannel restrictions remain strictly enforced', async () => {
      // Scenario A: preferredChannel === 'whatsapp'
      userRepo.users.set('cit_prefs_wa_9', {
        id: 'cit_prefs_wa_9',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'whatsapp' }
      });

      const waResults = await service.notifyComplaintCreated({
        id: 'cmp_wa_only_9',
        referenceNumber: 'GRV-WA-9',
        citizenId: 'cit_prefs_wa_9'
      });

      const waSms = waResults.find(r => r.channel === NOTIFICATION_CHANNEL.SMS);
      const waMsg = waResults.find(r => r.channel === NOTIFICATION_CHANNEL.WHATSAPP);
      assert.strictEqual(waSms.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(waSms.error.includes('WhatsApp only'));
      assert.strictEqual(waMsg.status, NOTIFICATION_STATUS.SIMULATED);

      // Scenario B: preferredChannel === 'sms'
      userRepo.users.set('cit_prefs_sms_9', {
        id: 'cit_prefs_sms_9',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'sms' }
      });

      const smsResults = await service.notifyComplaintCreated({
        id: 'cmp_sms_only_9',
        referenceNumber: 'GRV-SMS-9',
        citizenId: 'cit_prefs_sms_9'
      });

      const smsSms = smsResults.find(r => r.channel === NOTIFICATION_CHANNEL.SMS);
      const smsWa = smsResults.find(r => r.channel === NOTIFICATION_CHANNEL.WHATSAPP);
      assert.strictEqual(smsSms.status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(smsWa.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(smsWa.error.includes('SMS only'));

      // Scenario C: Global opt-out enabled === false
      userRepo.users.set('cit_prefs_optout_9', {
        id: 'cit_prefs_optout_9',
        phone: '+919876543210',
        notificationPreferences: { enabled: false }
      });

      const optOutResults = await service.notifyComplaintCreated({
        id: 'cmp_optout_9',
        referenceNumber: 'GRV-OPTOUT-9',
        citizenId: 'cit_prefs_optout_9'
      });

      for (const res of optOutResults) {
        assert.strictEqual(res.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
        assert.ok(res.error.includes('Citizen has disabled all notifications'));
      }
    });
  });

  describe('10. End-to-End Regression Test: Complete Sequence (Issue 4 Re-verification)', () => {
    test('executes complete 8-step end-to-end phone save, reload, and notification resolution sequence', async () => {
      // 1. Authenticate as a test citizen
      const citizenUid = `USR-CITIZEN-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const citizenUser = {
        id: citizenUid,
        email: `${citizenUid.toLowerCase()}@civicsarthi.internal`,
        name: 'Priya Sharma (Test Citizen)',
        role: 'citizen',
        phone: null,
        phoneNumber: null,
        notificationPreferences: {
          enabled: true,
          smsOptOut: false,
          whatsappOptOut: false,
          preferredChannel: 'both'
        }
      };
      await userRepository.create(citizenUser);

      // Verify initial state has no phone
      const initialUser = await userRepository.findById(citizenUid);
      assert.strictEqual(initialUser.phone, null);

      const citizenAuthSession = {
        id: citizenUid,
        email: citizenUser.email,
        name: citizenUser.name,
        role: 'citizen'
      };

      // 2. Save a phone number
      const saveRes = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };
      const saveReq = {
        user: citizenAuthSession,
        body: {
          phone: '9876543210',
          preferredChannel: 'both',
          enabled: true
        }
      };

      await updatePreferences(saveReq, saveRes, (err) => { if (err) throw err; });

      assert.strictEqual(saveRes.statusCode, 200);
      assert.strictEqual(saveRes.body.success, true);
      assert.strictEqual(saveRes.body.data.phone, '+919876543210');
      assert.strictEqual(saveRes.body.data.preferences.preferredChannel, 'both');

      // Verify the user repository actually persisted the number
      const persistedUser = await userRepository.findById(citizenUid);
      assert.strictEqual(persistedUser.phone, '+919876543210');
      assert.strictEqual(persistedUser.phoneNumber, '+919876543210');

      // 3. Fetch preferences again using a fresh request
      const freshReq = {
        user: citizenAuthSession,
        query: {}
      };
      const freshRes = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };

      await getPreferences(freshReq, freshRes, (err) => { if (err) throw err; });

      // 4. Confirm the returned number matches the saved number
      assert.strictEqual(freshRes.statusCode, 200);
      assert.strictEqual(freshRes.body.success, true);
      assert.strictEqual(freshRes.body.data.phone, '+919876543210');
      assert.strictEqual(freshRes.body.data.citizenId, citizenUid);
      assert.strictEqual(freshRes.body.data.preferences.preferredChannel, 'both');

      // 5. Simulate a page reload and confirm the input is populated from the fetched data
      const simulatedPageReloadState = {
        loadedPhone: freshRes.body.data.phone,
        loadedPreferences: freshRes.body.data.preferences
      };
      assert.strictEqual(simulatedPageReloadState.loadedPhone, '+919876543210');
      assert.ok(simulatedPageReloadState.loadedPhone !== '');
      assert.ok(simulatedPageReloadState.loadedPhone !== null);

      // Verify that submitting preferences with empty/omitted phone field preserves the registered number
      const noPhoneReq = {
        user: citizenAuthSession,
        body: {
          preferredChannel: 'whatsapp',
          smsOptOut: false
        }
      };
      const noPhoneRes = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };
      await updatePreferences(noPhoneReq, noPhoneRes, (err) => { if (err) throw err; });
      assert.strictEqual(noPhoneRes.body.data.phone, '+919876543210');
      const preservedAfterOmit = await userRepository.findById(citizenUid);
      assert.strictEqual(preservedAfterOmit.phone, '+919876543210');

      // 6. Trigger a new notification event
      const complaintWithoutPhone = {
        id: `CMP-E2E-${Date.now()}`,
        referenceNumber: `GRV-E2E-${Date.now()}`,
        citizenId: citizenUid,
        category: 'sanitation',
        departmentId: 'DEPT_MUNICIPAL'
      };

      // 7. Confirm the notification service resolves the registered number
      const e2eService = new NotificationService(adapter, logRepo, userRepository);
      const dispatchResults = await e2eService.notifyComplaintCreated(complaintWithoutPhone);

      assert.strictEqual(dispatchResults.length, 2);
      for (const result of dispatchResults) {
        assert.strictEqual(result.recipientPhone, '+919876543210');
        assert.strictEqual(result.citizenId, citizenUid);
      }

      // 8. Confirm the audit records the accurate outcome
      const auditLogs = await e2eService.getDeliveryLogs({ citizenId: citizenUid });
      assert.strictEqual(auditLogs.length, 2);

      const smsLog = auditLogs.find(l => l.channel === 'sms');
      const waLog = auditLogs.find(l => l.channel === 'whatsapp');

      assert.ok(smsLog);
      assert.ok(waLog);

      // Both target the resolved registered phone number
      assert.strictEqual(smsLog.recipientPhone, '+919876543210');
      assert.strictEqual(waLog.recipientPhone, '+919876543210');

      // WhatsApp was dispatched (SIMULATED in test)
      assert.strictEqual(waLog.status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(waLog.error || null, null);
      assert.strictEqual(waLog.complaintReference, complaintWithoutPhone.referenceNumber);

      // SMS was accurately skipped due to citizen's preference for WhatsApp
      assert.strictEqual(smsLog.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(smsLog.error.includes('WhatsApp only'));
    });

    test('supports explicit removal of registered phone number when requested', async () => {
      const citizenUid = `USR-CITIZEN-REMOVABLE-${Date.now()}`;
      await userRepository.create({
        id: citizenUid,
        email: `${citizenUid.toLowerCase()}@civicsarthi.internal`,
        name: 'Removable Citizen',
        role: 'citizen',
        phone: '+919876543210',
        phoneNumber: '+919876543210'
      });

      const removeReq = {
        user: { id: citizenUid, role: 'citizen' },
        body: { removePhone: true }
      };
      const removeRes = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };

      await updatePreferences(removeReq, removeRes, (err) => { if (err) throw err; });

      assert.strictEqual(removeRes.body.success, true);
      assert.strictEqual(removeRes.body.data.phone, null);

      const afterRemoval = await userRepository.findById(citizenUid);
      assert.strictEqual(afterRemoval.phone, null);
    });
  });

  describe('11. SMS Delivery Failure Diagnosis & Truthful Reporting Suite', () => {
    test('1. A valid, saved phone number is retrieved correctly after reloading the user profile', async () => {
      const uid = `USR-DIAG-RELOAD-${Date.now()}`;
      await userRepository.create({
        id: uid,
        email: `${uid.toLowerCase()}@civicsarthi.internal`,
        name: 'Reload Citizen',
        role: 'citizen',
        phone: '+919876543210',
        phoneNumber: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'sms' }
      });

      // Reload profile
      const reloaded = await userRepository.findById(uid);
      assert.ok(reloaded);
      assert.strictEqual(reloaded.phone, '+919876543210');
      assert.strictEqual(reloaded.phoneNumber, '+919876543210');
    });

    test('2. Phone-number normalization and validation behave correctly', () => {
      assert.strictEqual(service.normalizePhoneNumber('9876543210'), '+919876543210');
      assert.strictEqual(service.normalizePhoneNumber('+919876543210'), '+919876543210');
      assert.strictEqual(service.normalizePhoneNumber('+14155552671'), '+14155552671');
      assert.strictEqual(service.normalizePhoneNumber('12345'), null);
      assert.strictEqual(service.normalizePhoneNumber('invalid'), null);
      assert.strictEqual(service.normalizePhoneNumber(null), null);
    });

    test('3. SMS-only preference suppresses WhatsApp dispatch while allowing SMS', async () => {
      userRepo.users.set('cit_diag_sms_only', {
        id: 'cit_diag_sms_only',
        phone: '+919876543210',
        notificationPreferences: { enabled: true, preferredChannel: 'sms' }
      });

      const results = await service.notifyStatusChanged(
        { id: 'cmp_sms_pref', referenceNumber: 'CS-2026-SMSPREF', citizenId: 'cit_diag_sms_only' },
        'IN_PROGRESS',
        'Field work commenced'
      );

      const sms = results.find(r => r.channel === NOTIFICATION_CHANNEL.SMS);
      const wa = results.find(r => r.channel === NOTIFICATION_CHANNEL.WHATSAPP);

      assert.strictEqual(sms.status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(sms.recipientPhone, '+919876543210');

      assert.strictEqual(wa.status, NOTIFICATION_STATUS.SKIPPED_OPT_OUT);
      assert.ok(wa.error.includes('SMS only'));
    });

    test('4. Mock-provider behavior is accurately represented as SIMULATED, never claiming real DELIVERED', async () => {
      const mockResult = await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        complaintReference: 'CS-2026-MOCK-TEST'
      });

      assert.strictEqual(mockResult.status, NOTIFICATION_STATUS.SIMULATED);
      assert.strictEqual(mockResult.provider, 'mock');
      assert.strictEqual(mockResult.error || null, null);
      assert.notStrictEqual(mockResult.status, NOTIFICATION_STATUS.DELIVERED);
      assert.notStrictEqual(mockResult.status, NOTIFICATION_STATUS.FAILED);
    });

    test('5. Provider configuration or dispatch errors produce accurate FAILED status with safe diagnostics', async () => {
      const failingAdapter = {
        sendSms: async () => {
          throw new Error('Carrier gateway error 503: Service Unavailable');
        }
      };
      const failingSvc = new NotificationService(failingAdapter, logRepo, userRepo);
      const failResult = await failingSvc.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
        recipientPhone: '+919876543210',
        complaintReference: 'CS-2026-FAIL-TEST'
      });

      assert.strictEqual(failResult.status, NOTIFICATION_STATUS.FAILED);
      assert.ok(failResult.error.includes('Carrier gateway error 503'));
    });

    test('6. An accepted dispatch is marked SENT (not DELIVERED) until confirmed', async () => {
      const gatewayAdapter = {
        sendSms: async () => ({
          success: true,
          provider: 'twilio',
          providerMessageId: 'SM_TEST_GATEWAY_ACCEPTED',
          status: 'queued',
          timestamp: new Date().toISOString()
        })
      };
      const gwSvc = new NotificationService(gatewayAdapter, logRepo, userRepo);
      const res = await gwSvc.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        complaintReference: 'CS-2026-GW-01'
      });

      assert.strictEqual(res.status, NOTIFICATION_STATUS.SENT);
      assert.strictEqual(res.provider, 'twilio');
      assert.strictEqual(res.providerMessageId, 'SM_TEST_GATEWAY_ACCEPTED');
      assert.notStrictEqual(res.status, NOTIFICATION_STATUS.DELIVERED);
    });

    test('7. A delivery receipt updates the correct notification from SENT to DELIVERED', async () => {
      const gatewayAdapter = {
        sendSms: async () => ({
          success: true,
          provider: 'twilio',
          providerMessageId: 'SM_DLR_CONFIRM_TEST',
          status: 'sent',
          timestamp: new Date().toISOString()
        })
      };
      const gwSvc = new NotificationService(gatewayAdapter, logRepo, userRepo);
      await gwSvc.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        complaintReference: 'CS-2026-DLR-01'
      });

      // Receipt arrives from carrier
      const receipt = await gwSvc.processDeliveryReceipt({
        providerMessageId: 'SM_DLR_CONFIRM_TEST',
        status: NOTIFICATION_STATUS.DELIVERED,
        timestamp: new Date().toISOString()
      });

      assert.ok(receipt);
      assert.strictEqual(receipt.status, NOTIFICATION_STATUS.DELIVERED);
      assert.strictEqual(receipt.providerMessageId, 'SM_DLR_CONFIRM_TEST');
    });

    test('8. Historical audit entries remain unchanged and immutable', async () => {
      const historicalId = 'NOTIF-IMMUTABLE-HISTORICAL';
      await logRepo.create({
        id: historicalId,
        citizenId: 'cit_immutable_test',
        channel: 'sms',
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        status: NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT,
        error: 'Phone number missing or invalid format',
        createdAt: '2026-10-25T10:00:00.000Z'
      });

      // Perform a new dispatch
      await service.dispatchNotification({
        channel: NOTIFICATION_CHANNEL.SMS,
        eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
        recipientPhone: '+919876543210',
        citizenId: 'cit_immutable_test',
        complaintReference: 'CS-2026-NEW-EVENT'
      });

      const historicalRecord = await logRepo.findById(historicalId);
      assert.strictEqual(historicalRecord.status, NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT);
      assert.strictEqual(historicalRecord.error, 'Phone number missing or invalid format');
    });

    test('9. Tests do not send real messages or require real provider credentials', () => {
      const defaultAdapter = new NotificationAdapter();
      assert.strictEqual(defaultAdapter.provider, 'mock');
      assert.strictEqual(process.env.NOTIFICATION_PROVIDER || 'mock', 'mock');
    });
  });
});