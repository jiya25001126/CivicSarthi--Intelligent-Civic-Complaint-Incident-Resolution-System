/**
 * @file notification.constants.js
 * @description Centralized constants, enums, templates, and delivery configuration
 * for CivicSarthi Live SMS and WhatsApp Notification Subsystem (Feature A).
 */

export const NOTIFICATION_CHANNEL = Object.freeze({
  SMS: 'sms',
  WHATSAPP: 'whatsapp'
});

export const NOTIFICATION_CHANNELS = [NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.WHATSAPP];

export const NOTIFICATION_EVENT = Object.freeze({
  CITIZEN_REGISTRATION: 'CITIZEN_REGISTRATION',
  COMPLAINT_REGISTERED: 'COMPLAINT_REGISTERED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  CLARIFICATION_RESPONDED: 'CLARIFICATION_RESPONDED',
  COMPLAINT_RESOLVED: 'COMPLAINT_RESOLVED'
});

export const NOTIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  SKIPPED_OPT_OUT: 'SKIPPED_OPT_OUT',
  SKIPPED_INVALID_RECIPIENT: 'SKIPPED_INVALID_RECIPIENT',
  DUPLICATE_SUPPRESSED: 'DUPLICATE_SUPPRESSED',
  SIMULATED: 'SIMULATED'
});

export const NOTIFICATION_PROVIDER = Object.freeze({
  MOCK: 'mock',
  TWILIO: 'twilio',
  GENERIC_REST: 'generic_rest'
});

export const NOTIFICATION_CONFIG = Object.freeze({
  DEFAULT_TIMEOUT_MS: 5000,
  DEFAULT_MAX_RETRIES: 3,
  DEDUPLICATION_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  RETRY_INITIAL_DELAY_MS: 1000
});

/**
 * Standard compliance templates for SMS and WhatsApp Business API
 */
export const NOTIFICATION_TEMPLATES = Object.freeze({
  [NOTIFICATION_EVENT.CITIZEN_REGISTRATION]: {
    sms: (params) =>
      `CivicSarthi: Namaste ${params.name || 'Citizen'}, your account is registered. File and track grievances anytime at civicsarthi.gov.in. Helpdesk: 1800-CIVIC-SARTHI.`,
    whatsapp: {
      templateName: 'civicsarthi_welcome',
      fallbackText: (params) =>
        `Namaste ${params.name || 'Citizen'}! Welcome to CivicSarthi. Your citizen account has been successfully created. File and track your civic complaints seamlessly.`
    }
  },
  [NOTIFICATION_EVENT.COMPLAINT_REGISTERED]: {
    sms: (params) =>
      `CivicSarthi: Grievance ${params.referenceNumber} registered under ${params.departmentName || 'Civic Authority'}. Track status at civicsarthi.gov.in/citizen/track/${params.referenceNumber}`,
    whatsapp: {
      templateName: 'civicsarthi_complaint_registered',
      fallbackText: (params) =>
        `Your grievance *${params.referenceNumber}* (${params.category || 'Civic Issue'}) has been registered under *${params.departmentName || 'Civic Authority'}*. Our officers are reviewing your complaint. Track: civicsarthi.gov.in/citizen/track/${params.referenceNumber}`
    }
  },
  [NOTIFICATION_EVENT.STATUS_CHANGED]: {
    sms: (params) =>
      `CivicSarthi: Update on ${params.referenceNumber}. Status changed to ${params.status}. Details: ${params.statusDescription || 'Work in progress.'}`,
    whatsapp: {
      templateName: 'civicsarthi_status_update',
      fallbackText: (params) =>
        `Status update for grievance *${params.referenceNumber}*: Your complaint status is now *${params.status}*. Description: ${params.statusDescription || 'In progress by municipal officers.'}`
    }
  },
  [NOTIFICATION_EVENT.CLARIFICATION_REQUESTED]: {
    sms: (params) =>
      `CivicSarthi: Clarification requested for ${params.referenceNumber}. Please review and respond in your citizen dashboard to avoid delay.`,
    whatsapp: {
      templateName: 'civicsarthi_clarification_prompt',
      fallbackText: (params) =>
        `Action Required: The assigned officer has requested clarification regarding grievance *${params.referenceNumber}*: "${params.prompt || 'Additional location details needed.'}". Please reply via your CivicSarthi citizen dashboard.`
    }
  },
  [NOTIFICATION_EVENT.CLARIFICATION_RESPONDED]: {
    sms: (params) =>
      `CivicSarthi: Officer responded to your inquiry on ${params.referenceNumber}. View response in your dashboard.`,
    whatsapp: {
      templateName: 'civicsarthi_clarification_response',
      fallbackText: (params) =>
        `Update on grievance *${params.referenceNumber}*: Officer has responded to your inquiry. Please check your citizen dashboard for details.`
    }
  },
  [NOTIFICATION_EVENT.COMPLAINT_RESOLVED]: {
    sms: (params) =>
      `CivicSarthi: Grievance ${params.referenceNumber} has been RESOLVED. Action: ${params.resolutionSummary || 'Civic defect rectified'}. Please submit your feedback on the portal.`,
    whatsapp: {
      templateName: 'civicsarthi_resolution_alert',
      fallbackText: (params) =>
        `Good news! Grievance *${params.referenceNumber}* has been marked *RESOLVED* by ${params.departmentName || 'the assigned department'}.\n\nResolution Action: ${params.resolutionSummary || 'Defect resolved and verified.'}\n\nPlease take a moment to rate the resolution quality on CivicSarthi.`
    }
  }
});

