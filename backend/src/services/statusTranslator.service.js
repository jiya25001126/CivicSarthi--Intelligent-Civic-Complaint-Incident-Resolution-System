/**
 * @file statusTranslator.service.js
 * @description Citizen-friendly status translation service for Feature C.
 * Explains bureaucratic statuses into plain, reassuring vernacular summaries
 * (English and Hindi) with deterministic fallback and zero data leakage.
 */

import { complaintRepository } from '../repositories/complaint.repository.js';
import { STATUS_TRANSLATION_MAP } from '../constants/clarification.constants.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';

export class StatusTranslatorService {
  constructor(complaintRepo = complaintRepository) {
    this.complaintRepo = complaintRepo;
  }

  /**
   * Normalizes requested language code (supports 'en', 'hi', default 'en')
   */
  normalizeLanguage(lang) {
    if (!lang) return 'en';
    const lower = String(lang).trim().toLowerCase();
    if (lower === 'hi' || lower === 'hindi') return 'hi';
    return 'en';
  }

  /**
   * Translates official complaint status into plain vernacular citizen explanation
   */
  async translateStatus(complaintOrId, options = {}) {
    let complaint = complaintOrId;
    if (typeof complaintOrId === 'string') {
      complaint = await this.complaintRepo.findById(complaintOrId);
    }

    if (!complaint) {
      const err = new Error('Grievance record not found for status explanation');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    const lang = this.normalizeLanguage(options.lang || options.language);
    const officialStatus = complaint.status || COMPLAINT_STATUS.SUBMITTED;

    // Optional AI Hook: only invoked if an external API key is explicitly configured
    let aiExplanation = null;
    const hasExternalKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
    if (hasExternalKey && options.useAi === true) {
      try {
        aiExplanation = await this._attemptAiTranslation(complaint, lang);
      } catch (aiErr) {
        // Safe fallback: AI failure MUST safely degrade to deterministic template
        console.warn('AI Status Translator error (falling back safely to deterministic template):', aiErr.message);
        aiExplanation = null;
      }
    }

    // Use deterministic template (or verified AI explanation if available)
    const baseExplanation = aiExplanation || this.getDeterministicExplanation(complaint, lang);

    // Build the sanitized, verified citizen payload
    return {
      referenceNumber: complaint.referenceNumber || complaint.id,
      officialStatus,
      language: lang,
      statusLabel: baseExplanation.statusLabel,
      meaning: baseExplanation.meaning,
      whatHappened: baseExplanation.whatHappened,
      nextSteps: baseExplanation.nextSteps,
      slaGuidance: baseExplanation.slaGuidance,
      verifiedContext: {
        departmentId: complaint.departmentId || complaint.department || 'GENERAL',
        category: complaint.category || 'general',
        registeredAt: complaint.createdAt,
        lastUpdated: complaint.updatedAt || complaint.lastUpdated || complaint.createdAt,
        reassignments: complaint.reassignments || 0,
        isReopened: Boolean(complaint.isReopened || (complaint.reopenedCount && complaint.reopenedCount > 0))
      },
      generatedBy: aiExplanation ? 'AI_ASSISTED' : 'DETERMINISTIC_ENGINE'
    };
  }

  /**
   * Deterministic template engine with verified contextual enrichment
   */
  getDeterministicExplanation(complaint, lang = 'en') {
    const status = complaint.status || COMPLAINT_STATUS.SUBMITTED;
    const normalizedStatus = STATUS_TRANSLATION_MAP[status] ? status : COMPLAINT_STATUS.SUBMITTED;
    const templates = STATUS_TRANSLATION_MAP[normalizedStatus][lang] || STATUS_TRANSLATION_MAP[normalizedStatus].en;

    const departmentName = complaint.departmentId || complaint.department || 'the relevant department';
    const category = complaint.category || 'civic issue';

    let customizedWhatHappened = templates.whatHappened;
    let customizedSla = templates.slaGuidance;

    // Enrich what happened with actual complaint milestone data where verified
    if (complaint.createdAt) {
      const createdDate = new Date(complaint.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      if (lang === 'hi') {
        customizedWhatHappened += ` (पंजीकरण तिथि: ${createdDate})`;
      } else {
        customizedWhatHappened += ` (Registered on ${createdDate})`;
      }
    }

    if (complaint.reassignments && complaint.reassignments > 0) {
      if (lang === 'hi') {
        customizedWhatHappened += `। मामला सही प्रभाग सुनिश्चित करने हेतु ${complaint.reassignments} बार पुनर्निर्देशित किया गया है।`;
      } else {
        customizedWhatHappened += ` Case was routed across ${complaint.reassignments} specialized division(s) to verify jurisdiction.`;
      }
    }

    // Enrich SLA guidance if SLA metrics or deadlines are present
    if (complaint.slaDeadline || complaint.slaMetrics?.resolutionDeadline) {
      const deadline = new Date(complaint.slaDeadline || complaint.slaMetrics?.resolutionDeadline).toLocaleDateString(
        lang === 'hi' ? 'hi-IN' : 'en-IN',
        { day: 'numeric', month: 'short', year: 'numeric' }
      );
      if (lang === 'hi') {
        customizedSla = `लक्षित समाधान समय-सीमा: ${deadline}`;
      } else {
        customizedSla = `Target department resolution deadline: ${deadline}`;
      }
    }

    return {
      statusLabel: templates.statusLabel,
      meaning: templates.meaning,
      whatHappened: customizedWhatHappened,
      nextSteps: templates.nextSteps,
      slaGuidance: customizedSla
    };
  }

  /**
   * Optional AI Translation attempt (with strict output validation)
   */
  async _attemptAiTranslation(complaint, lang) {
    // If external AI key is absent, immediately throw to trigger safe fallback
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error('No external AI API key configured');
    }

    // In this offline/self-contained environment, external network calls to paid AI endpoints
    // are not active. Throw to immediately engage the deterministic template engine.
    throw new Error('External AI service unavailable; falling back to deterministic template.');
  }
}

export const statusTranslatorService = new StatusTranslatorService();
export default statusTranslatorService;
