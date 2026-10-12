/**
 * @file spamScreening.service.js
 * @description Deterministic, explainable heuristic screening service for
 * CivicSarthi Phase 11: Spam/Fake Complaint Detection with Human Review.
 *
 * Implements strict fairness safeguards:
 * - Official and political criticism is protected civic expression and NEVER adds risk points.
 * - Multilingual Hindi/Devanagari ([\u0900-\u097F]) and Hinglish terms are fully supported and never penalized.
 * - Spelling/grammatical variations are tolerated and never classified as abuse.
 * - Multiple citizens reporting the same civic defect (e.g., shared water outage) is protected.
 */

import {
  SPAM_RISK_LEVEL,
  SPAM_SCORE_THRESHOLDS,
  SPAM_REASON_CODES,
  SPAM_REASON_DESCRIPTIONS,
  DEFAULT_SPAM_CONFIG
} from '../constants/spam.constants.js';

export class SpamScreeningService {
  constructor(config = DEFAULT_SPAM_CONFIG) {
    this.config = { ...DEFAULT_SPAM_CONFIG, ...config };
  }

  /**
   * Normalizes text for linguistic analysis while preserving Devanagari and Latin letters
   * @param {string} text
   * @returns {string}
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculates word token Jaccard similarity between two strings
   * @param {string} a
   * @param {string} b
   * @returns {number} 0.0 to 1.0
   */
  calculateWordSimilarity(a, b) {
    const tokensA = new Set(this.normalizeText(a).split(' ').filter(Boolean));
    const tokensB = new Set(this.normalizeText(b).split(' ').filter(Boolean));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersectionCount = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersectionCount++;
    }

    const unionCount = new Set([...tokensA, ...tokensB]).size;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
  }

  /**
   * Detects repetitive character mash, keyboard spam, or low-entropy patterns
   * @param {string} text
   * @returns {boolean}
   */
  isRepetitiveCharacterMash(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    if (clean.length < 8) return false;

    // Pattern 1: Same single character repeated 5 or more times (e.g. "aaaaa", "xxxxxx")
    if (/(.)\1{4,}/.test(clean)) {
      return true;
    }

    // Pattern 2: Short 2-4 char sequence repeated 3+ times (e.g. "asdfasdfasdf", "abcabcabc")
    if (/(.{2,4})\1{2,}/.test(clean)) {
      return true;
    }

    // Pattern 3: Common keyboard row sequences (qwerty, asdfgh, zxcvbn)
    if (/(qwerty|asdfgh|zxcvbn)/i.test(clean)) {
      return true;
    }

    // Pattern 4: Ratio of unique characters to total length is ridiculously low on non-short strings
    if (clean.length >= 20) {
      const uniqueChars = new Set(clean.toLowerCase().replace(/\s/g, '')).size;
      if (uniqueChars <= 4) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates if text is merely short criticism or genuine civic concern
   * Note: Harsh tone, criticism of administration, and frustration are PROTECTED.
   */
  isProtectedCivicExpression(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    const civicCriticismKeywords = [
      'corrupt', 'corruption', 'bribe', 'useless', 'lazy', 'shame', 'pathetic',
      'terrible', 'worst', 'inaction', 'negligent', 'negligence', 'slow', 'delay',
      'harassment', 'fraud', 'lying', 'failed', 'complaining', 'no action', 'fake',
      'scam', 'officer', 'department', 'nagarpalika', 'collector', 'mcgm', 'bbmp'
    ];
    return civicCriticismKeywords.some((w) => lower.includes(w));
  }

  /**
   * Comprehensive, deterministic screening of complaint data
   *
   * @param {object} complaint - Target complaint to evaluate
   * @param {object} [context={}] - Historical and candidate context
   * @returns {object} Explainable screening result
   */
  evaluateComplaint(complaint = {}, context = {}) {
    const userRecentComplaints = context.userRecentComplaints || complaint.citizenHistory || [];
    const duplicateMatches = context.duplicateMatches || complaint.duplicateCandidates || [];

    let score = 0;
    const reasons = [];
    const explanations = [];
    const signals = {
      burstFrequency: { triggered: false, score: 0 },
      repeatedIdenticalText: { triggered: false, score: 0 },
      gibberishOrMash: { triggered: false, score: 0 },
      lowInformationDensity: { triggered: false, score: 0 },
      duplicateCandidates: { triggered: false, score: 0 },
      rapidCategoryCycling: { triggered: false, score: 0 }
    };

    const title = String(complaint.title || '').trim();
    const description = String(complaint.description || complaint.text || '').trim();
    const fullText = `${title} ${description}`.trim();
    const citizenId = complaint.citizenId;
    const complaintTime = complaint.createdAt ? new Date(complaint.createdAt).getTime() : Date.now();
    const windowMs = (this.config.windowMinutes || 15) * 60 * 1000;

    // 1. SIGNAL 1: BURST SUBMISSION FREQUENCY (same authenticated citizen)
    if (citizenId && Array.isArray(userRecentComplaints) && userRecentComplaints.length > 0) {
      const recentFromSameUser = userRecentComplaints.filter((c) => {
        if (!c.createdAt) return false;
        const t = new Date(c.createdAt).getTime();
        return Math.abs(complaintTime - t) <= windowMs && c.id !== complaint.id;
      });

      if (recentFromSameUser.length >= this.config.burstThresholdHigh) {
        score += 35;
        signals.burstFrequency = { triggered: true, score: 35 };
        reasons.push(SPAM_REASON_CODES.BURST_FREQUENCY);
        explanations.push(
          `Rapid burst submissions: ${recentFromSameUser.length + 1} complaints submitted by this account within ${this.config.windowMinutes} minutes.`
        );
      } else if (recentFromSameUser.length >= this.config.burstThresholdModerate) {
        score += 20;
        signals.burstFrequency = { triggered: true, score: 20 };
        reasons.push(SPAM_REASON_CODES.BURST_FREQUENCY);
        explanations.push(
          `Elevated submission velocity: ${recentFromSameUser.length + 1} complaints submitted by this account within ${this.config.windowMinutes} minutes.`
        );
      }
    }

    // 2. SIGNAL 2: IDENTICAL / NEAR-IDENTICAL REPEATED CONTENT
    if (citizenId && Array.isArray(userRecentComplaints) && userRecentComplaints.length > 0) {
      let exactFound = false;
      let similarFound = false;
      let topSim = 0;

      for (const past of userRecentComplaints) {
        if (past.id === complaint.id) continue;
        const pastFull = `${past.title || ''} ${past.description || past.text || ''}`.trim();
        if (!pastFull) continue;

        // Exact match check
        if (
          this.normalizeText(title) === this.normalizeText(past.title || '') &&
          this.normalizeText(description) === this.normalizeText(past.description || past.text || '')
        ) {
          exactFound = true;
          break;
        }

        // Word overlap similarity
        const sim = this.calculateWordSimilarity(fullText, pastFull);
        if (sim > topSim) {
          topSim = sim;
        }
        if (sim >= 0.82) {
          similarFound = true;
        }
      }

      if (exactFound) {
        score += this.config.exactDuplicateWeight;
        signals.repeatedIdenticalText = { triggered: true, score: this.config.exactDuplicateWeight };
        reasons.push(SPAM_REASON_CODES.DUPLICATE_TEXT_EXACT);
        explanations.push('Exact identical title and description matches a grievance previously submitted by the same account.');
      } else if (similarFound) {
        score += this.config.similarDuplicateWeight;
        signals.repeatedIdenticalText = { triggered: true, score: this.config.similarDuplicateWeight };
        reasons.push(SPAM_REASON_CODES.DUPLICATE_TEXT_SIMILAR);
        explanations.push(
          `High textual similarity (${Math.round(topSim * 100)}%) detected against another recent grievance submitted by this account.`
        );
      }
    }

    // 3. SIGNAL 3: REPETITIVE CHARACTER MASH OR GIBBERISH
    const titleMash = this.isRepetitiveCharacterMash(title);
    const descMash = this.isRepetitiveCharacterMash(description);

    if (titleMash || descMash) {
      score += this.config.gibberishPatternWeight;
      signals.gibberishOrMash = { triggered: true, score: this.config.gibberishPatternWeight };
      reasons.push(SPAM_REASON_CODES.REPETITIVE_CHARACTERS);
      explanations.push('Text contains repetitive character strings or automated keyboard mash patterns.');
    }

    // 4. SIGNAL 4: LOW INFORMATION DENSITY / EMPTY PLACEHOLDERS
    const cleanTokens = this.normalizeText(fullText).split(' ').filter(Boolean);
    const hasMeaningfulContent = cleanTokens.length >= 4;
    const isProtected = this.isProtectedCivicExpression(fullText);

    if (!hasMeaningfulContent && !isProtected && fullText.length < 15) {
      score += 20;
      signals.lowInformationDensity = { triggered: true, score: 20 };
      reasons.push(SPAM_REASON_CODES.LOW_INFORMATION_DENSITY);
      explanations.push('Grievance text lacks actionable civic details and consists of bare placeholder tokens.');
    }

    // 5. SIGNAL 5: PHASE 6 DUPLICATE MATCH CORRELATION
    // Note: Only flagged as spam if duplicate match is from the SAME citizen.
    // If from a DIFFERENT citizen, it is legitimate collective public reporting!
    if (Array.isArray(duplicateMatches) && duplicateMatches.length > 0) {
      const topMatch = duplicateMatches[0];
      const matchScore = topMatch.confidence || topMatch.similarity || topMatch.similarityScore || 0;

      if (matchScore >= 0.85 && (!topMatch.citizenId || topMatch.citizenId === citizenId)) {
        score += this.config.phase6DuplicateWeight;
        signals.duplicateCandidates = { triggered: true, score: this.config.phase6DuplicateWeight };
        if (!reasons.includes(SPAM_REASON_CODES.PHASE6_DUPLICATE_MATCH)) {
          reasons.push(SPAM_REASON_CODES.PHASE6_DUPLICATE_MATCH);
          explanations.push(
            `Phase 6 AI duplicate engine identified high-confidence duplicate (${Math.round(matchScore * 100)}%) with case ${topMatch.referenceNumber || topMatch.referenceId || topMatch.complaintReference || topMatch.id}.`
          );
        }
      }
    }

    // 6. SIGNAL 6: RAPID CATEGORY CYCLING (same citizen, multiple different departments in narrow window)
    if (citizenId && Array.isArray(userRecentComplaints) && userRecentComplaints.length >= 2) {
      const distinctDepts = new Set(
        userRecentComplaints.map((c) => c.departmentId || c.department).filter(Boolean)
      );
      if (complaint.departmentId) {
        distinctDepts.add(complaint.departmentId);
      }

      if (distinctDepts.size >= 3) {
        score += this.config.rapidCategoryCyclingWeight;
        signals.rapidCategoryCycling = { triggered: true, score: this.config.rapidCategoryCyclingWeight };
        reasons.push(SPAM_REASON_CODES.RAPID_CATEGORY_CYCLING);
        explanations.push(
          `Rapid category cycling detected: account filed grievances across ${distinctDepts.size} distinct departments within minutes.`
        );
      }
    }

    // Clamp score to 0 - 100
    const normalizedScore = Math.min(100, Math.max(0, score));

    // Determine Risk Level
    let riskLevel = SPAM_RISK_LEVEL.LOW;
    if (normalizedScore >= SPAM_SCORE_THRESHOLDS.CRITICAL_MIN) {
      riskLevel = SPAM_RISK_LEVEL.CRITICAL;
    } else if (normalizedScore >= this.config.flagThreshold) {
      riskLevel = SPAM_RISK_LEVEL.HIGH;
    } else if (normalizedScore > SPAM_SCORE_THRESHOLDS.LOW_MAX) {
      riskLevel = SPAM_RISK_LEVEL.MEDIUM;
    }

    const flagged = normalizedScore >= this.config.flagThreshold;

    return {
      score: normalizedScore,
      riskLevel,
      flagged,
      isFlagged: flagged,
      reasons: explanations,
      reasonCodes: reasons,
      signals,
      ruleVersion: this.config.ruleVersion,
      evaluatedAt: new Date().toISOString(),
      reviewStatus: flagged ? 'PENDING' : 'NOT_FLAGGED'
    };
  }
}

export const spamScreeningService = new SpamScreeningService();
export default spamScreeningService;
