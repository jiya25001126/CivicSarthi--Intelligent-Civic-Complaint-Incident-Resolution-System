/**
 * @file notification.adapter.js
 * @description Isolated provider adapter for Live SMS and WhatsApp dispatching.
 * Supports configurable providers (Mock, Twilio, Generic REST) with bounded retries,
 * strict timeout limits, and clean fallback behavior.
 */

import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PROVIDER,
  NOTIFICATION_CONFIG
} from '../../constants/notification.constants.js';

export class NotificationAdapter {
  constructor(options = {}) {
    this.provider = options.provider || process.env.NOTIFICATION_PROVIDER || NOTIFICATION_PROVIDER.MOCK;
    this.timeoutMs = Number(options.timeoutMs || process.env.NOTIFICATION_TIMEOUT_MS || NOTIFICATION_CONFIG.DEFAULT_TIMEOUT_MS);
    this.maxRetries = Number(options.maxRetries || process.env.NOTIFICATION_MAX_RETRIES || NOTIFICATION_CONFIG.DEFAULT_MAX_RETRIES);

    // Mock sent messages store for testing and inspection
    this.mockSentMessages = [];
  }

  /**
   * Resets mock sent message history (useful in test suites)
   */
  clearMockHistory() {
    this.mockSentMessages = [];
  }

  /**
   * Retrieves mock sent message history
   */
  getMockHistory() {
    return [...this.mockSentMessages];
  }

  /**
   * Dispatches SMS message through configured provider with bounded retries and timeout
   */
  async sendSms({ to, message, metadata = {} }) {
    if (!to || typeof to !== 'string') {
      const err = new Error('Recipient phone number is required');
      err.code = 'INVALID_RECIPIENT';
      throw err;
    }

    if (!message || typeof message !== 'string') {
      const err = new Error('SMS message body is required');
      err.code = 'INVALID_MESSAGE';
      throw err;
    }

    return this._executeWithRetry(async (attempt) => {
      if (this.provider === NOTIFICATION_PROVIDER.MOCK || !process.env.NOTIFICATION_PROVIDER) {
        return this._mockSend({
          channel: NOTIFICATION_CHANNEL.SMS,
          to,
          message,
          metadata,
          attempt
        });
      }

      if (this.provider === NOTIFICATION_PROVIDER.TWILIO) {
        return this._twilioSend({
          channel: NOTIFICATION_CHANNEL.SMS,
          to,
          message,
          metadata
        });
      }

      if (this.provider === NOTIFICATION_PROVIDER.GENERIC_REST) {
        return this._genericRestSend({
          channel: NOTIFICATION_CHANNEL.SMS,
          to,
          message,
          metadata
        });
      }

      // Default fallback to mock
      return this._mockSend({
        channel: NOTIFICATION_CHANNEL.SMS,
        to,
        message,
        metadata,
        attempt
      });
    });
  }

  /**
   * Dispatches WhatsApp message through configured provider with bounded retries and timeout
   */
  async sendWhatsApp({ to, message, templateName, templateParams, metadata = {} }) {
    if (!to || typeof to !== 'string') {
      const err = new Error('Recipient WhatsApp phone number is required');
      err.code = 'INVALID_RECIPIENT';
      throw err;
    }

    return this._executeWithRetry(async (attempt) => {
      if (this.provider === NOTIFICATION_PROVIDER.MOCK || !process.env.NOTIFICATION_PROVIDER) {
        return this._mockSend({
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          to,
          message,
          templateName,
          templateParams,
          metadata,
          attempt
        });
      }

      if (this.provider === NOTIFICATION_PROVIDER.TWILIO) {
        return this._twilioSend({
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          to,
          message,
          templateName,
          metadata
        });
      }

      if (this.provider === NOTIFICATION_PROVIDER.GENERIC_REST) {
        return this._genericRestSend({
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          to,
          message,
          templateName,
          templateParams,
          metadata
        });
      }

      return this._mockSend({
        channel: NOTIFICATION_CHANNEL.WHATSAPP,
        to,
        message,
        templateName,
        templateParams,
        metadata,
        attempt
      });
    });
  }

  /**
   * Mock sender implementation
   */
  async _mockSend(payload) {
    const providerMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const receipt = {
      success: true,
      providerMessageId,
      channel: payload.channel,
      to: payload.to,
      message: payload.message,
      templateName: payload.templateName || null,
      provider: 'mock',
      timestamp: new Date().toISOString(),
      attempt: payload.attempt || 1
    };

    this.mockSentMessages.push(receipt);
    return receipt;
  }

  /**
   * Twilio REST API integration (using deployment environment variables)
   */
  async _twilioSend({ channel, to, message, templateName }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured in environment variables');
    }

    const fromNumber =
      channel === NOTIFICATION_CHANNEL.WHATSAPP
        ? process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'
        : process.env.TWILIO_SMS_FROM;

    if (!fromNumber) {
      throw new Error(`Twilio sender number not configured for channel ${channel}`);
    }

    const formattedTo =
      channel === NOTIFICATION_CHANNEL.WHATSAPP && !to.startsWith('whatsapp:')
        ? `whatsapp:${to}`
        : to;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: formattedTo,
      From: fromNumber,
      Body: message
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio API responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        providerMessageId: data.sid,
        channel,
        to,
        provider: 'twilio',
        status: data.status,
        timestamp: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generic REST Gateway integration (e.g. MSG91, Gupshup, or government SMS gateway)
   */
  async _genericRestSend({ channel, to, message, templateName, templateParams }) {
    const endpoint =
      channel === NOTIFICATION_CHANNEL.WHATSAPP
        ? process.env.GENERIC_WHATSAPP_ENDPOINT
        : process.env.GENERIC_SMS_ENDPOINT;
    const apiKey =
      channel === NOTIFICATION_CHANNEL.WHATSAPP
        ? process.env.GENERIC_WHATSAPP_API_KEY
        : process.env.GENERIC_SMS_API_KEY;

    if (!endpoint) {
      throw new Error(`REST gateway endpoint not configured for channel ${channel}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-Api-Key': apiKey } : {})
        },
        body: JSON.stringify({
          channel,
          recipient: to,
          text: message,
          template: templateName,
          parameters: templateParams
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST gateway responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        providerMessageId: data.messageId || data.id || `rest_${Date.now()}`,
        channel,
        to,
        provider: 'generic_rest',
        timestamp: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Executes an operation with exponential backoff retries and timeout handling
   */
  async _executeWithRetry(operation) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation(attempt);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = NOTIFICATION_CONFIG.RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export const notificationAdapter = new NotificationAdapter();
export default notificationAdapter;

