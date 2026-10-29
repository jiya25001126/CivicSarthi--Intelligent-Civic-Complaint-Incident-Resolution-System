/**
 * @file spamScreening.service.js
 * @description Deterministic, explainable heuristic screening service for
 * CivicSarthi Phase 11 & Feature B: Explainable False/Suspicious Complaint Analysis.
 *
 * Implements strict fairness safeguards:
 * - Official and political criticism is protected civic expression and NEVER adds risk points.
 * - Multilingual Hindi/Devanagari ([\u0900-\u097F]) and Hinglish terms are fully supported and never penalized.
 * - Spelling/grammatical variations are tolerated and never classified as abuse.
 * - Multiple citizens reporting the same civic defect (e.g., shared water outage) is protected.
 * - Genuine complaints are never automatically rejected by AI scores.
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
   * Detects malformed content, excessive punctuation, and symbol floods
   * @param {string} text
   * @returns {object} { isMalformed, isSymbolFlood, ratio, explanation }
   */
  detectMalformedContent(text) {
    if (!text || typeof text !== 'string') return { isMalformed: false, isSymbolFlood: false, symbolRatio: 0 };
    const raw = text.trim();
    if (raw.length < 10) return { isMalformed: false, isSymbolFlood: false, symbolRatio: 0 };

    // Punctuation flood: 4 or more repeated punctuation characters (e.g. '????', '!!!!!', '....')
    const hasRepeatedPunctuation = /([!?.,;:~@#$%^&*_\-+=\\|<>/\(\)\[\]{}])\1{3,}/.test(raw);

    // Symbol to total character ratio
    const symbols = raw.match(/[^a-zA-Z0-9\s\u0900-\u097F]/g) || [];
    const symbolRatio = symbols.length / raw.length;

    const isSymbolFlood = hasRepeatedPunctuation || symbolRatio >= 0.35;
    const isMalformed = symbolRatio >= 0.50 || (raw.length >= 25 && symbols.length >= 15 && symbolRatio >= 0.40);

    return {
      isMalformed,
      isSymbolFlood,
      symbolRatio: Math.round(symbolRatio * 100) / 100,
      hasRepeatedPunctuation
    };
  }

  /**
   * Detects commercial, promotional, or phishing spam patterns in civic complaints
   * @param {string} text
   * @returns {boolean}
   */
  isPromotionalOrPhishingSpam(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();

    const promotionalKeywords = [
      'win cash', 'cash prize', 'lottery prize', 'jackpot', 'crypto giveaway',
      'buy bitcoin', 'free recharge', 'earn money fast', 'work from home job call',
      'casino bonus', 'betting app', 'call for instant loan', 'wa.me/', 't.me/',
      'bit.ly/', 'tinyurl.com/'
    ];

    return promotionalKeywords.some((w) => lower.includes(w));
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
   * @returns {object} Explainable screening result with structured risk indicators
   */
  evaluateComplaint(complaint = {}, context = {}) {
    const userRecentComplaints = context.userRecentComplaints || complaint.citizenHistory || [];
    const candidatePool = context.candidatePool || [];
    const duplicateMatches = context.duplicateMatches || complaint.duplicateCandidates || [];

    let score = 0;
    const reasons = [];
    const explanations = [];
    const riskIndicators = [];
    const signals = {
      burstFrequency: { triggered: false, score: 0 },
      repeatedIdenticalText: { triggered: false, score: 0 },
      gibberishOrMash: { triggered: false, score: 0 },
      lowInformationDensity: { triggered: false, score: 0 },
      duplicateCandidates: { triggered: false, score: 0 },
      rapidCategoryCycling: { triggered: false, score: 0 },
      malformedContent: { triggered: false, score: 0 },
      promotionalSpam: { triggered: false, score: 0 },
      coordinatedRepetition: { triggered: false, score: 0 }
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
        const expl = `Rapid burst submissions: ${recentFromSameUser.length + 1} complaints submitted by this account within ${this.config.windowMinutes} minutes.`;
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.BURST_FREQUENCY,
          signal: 'BURST_FREQUENCY',
          weight: 35,
          score: 35,
          description: SPAM_REASON_DESCRIPTIONS.BURST_FREQUENCY,
          evidence: `${recentFromSameUser.length + 1} submissions in ${this.config.windowMinutes}m`,
          recommendation: 'Check whether multiple distinct civic issues exist or an automated tool was used.'
        });
      } else if (recentFromSameUser.length >= this.config.burstThresholdModerate) {
        score += 20;
        signals.burstFrequency = { triggered: true, score: 20 };
        reasons.push(SPAM_REASON_CODES.BURST_FREQUENCY);
        const expl = `Elevated submission velocity: ${recentFromSameUser.length + 1} complaints submitted by this account within ${this.config.windowMinutes} minutes.`;
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.BURST_FREQUENCY,
          signal: 'BURST_FREQUENCY',
          weight: 20,
          score: 20,
          description: SPAM_REASON_DESCRIPTIONS.BURST_FREQUENCY,
          evidence: `${recentFromSameUser.length + 1} submissions in ${this.config.windowMinutes}m`,
          recommendation: 'Officer review to verify individual merit.'
        });
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
        const expl = 'Exact identical title and description matches a grievance previously submitted by the same account.';
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.DUPLICATE_TEXT_EXACT,
          signal: 'DUPLICATE_TEXT_EXACT',
          weight: this.config.exactDuplicateWeight,
          score: this.config.exactDuplicateWeight,
          description: SPAM_REASON_DESCRIPTIONS.DUPLICATE_TEXT_EXACT,
          evidence: 'Exact match with prior grievance from same account',
          recommendation: 'Link as duplicate or verify if prior grievance was closed without resolution.'
        });
      } else if (similarFound) {
        score += this.config.similarDuplicateWeight;
        signals.repeatedIdenticalText = { triggered: true, score: this.config.similarDuplicateWeight };
        reasons.push(SPAM_REASON_CODES.DUPLICATE_TEXT_SIMILAR);
        const expl = `High textual similarity (${Math.round(topSim * 100)}%) detected against another recent grievance submitted by this account.`;
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.DUPLICATE_TEXT_SIMILAR,
          signal: 'DUPLICATE_TEXT_SIMILAR',
          weight: this.config.similarDuplicateWeight,
          score: this.config.similarDuplicateWeight,
          description: SPAM_REASON_DESCRIPTIONS.DUPLICATE_TEXT_SIMILAR,
          evidence: `${Math.round(topSim * 100)}% vocabulary match with recent submission`,
          recommendation: 'Assess whether this is an intentional repeat follow-up or separate complaint.'
        });
      }
    }

    // 3. SIGNAL 3: REPETITIVE CHARACTER MASH OR GIBBERISH
    const titleMash = this.isRepetitiveCharacterMash(title);
    const descMash = this.isRepetitiveCharacterMash(description);

    if (titleMash || descMash) {
      score += this.config.gibberishPatternWeight;
      signals.gibberishOrMash = { triggered: true, score: this.config.gibberishPatternWeight };
      reasons.push(SPAM_REASON_CODES.REPETITIVE_CHARACTERS);
      const expl = 'Text contains repetitive character strings or automated keyboard mash patterns.';
      explanations.push(expl);
      riskIndicators.push({
        code: SPAM_REASON_CODES.REPETITIVE_CHARACTERS,
        signal: 'REPETITIVE_CHARACTERS',
        weight: this.config.gibberishPatternWeight,
        score: this.config.gibberishPatternWeight,
        description: SPAM_REASON_DESCRIPTIONS.REPETITIVE_CHARACTERS,
        evidence: 'Detected repeated keyboard row or character cycles',
        recommendation: 'Request clarification from citizen for readable description.'
      });
    }

    // 4. SIGNAL 4: LOW INFORMATION DENSITY / EMPTY PLACEHOLDERS
    const cleanTokens = this.normalizeText(fullText).split(' ').filter(Boolean);
    const hasMeaningfulContent = cleanTokens.length >= 4;
    const isProtected = this.isProtectedCivicExpression(fullText);

    if (!hasMeaningfulContent && !isProtected && fullText.length < 15) {
      score += 20;
      signals.lowInformationDensity = { triggered: true, score: 20 };
      reasons.push(SPAM_REASON_CODES.LOW_INFORMATION_DENSITY);
      const expl = 'Grievance text lacks actionable civic details and consists of bare placeholder tokens.';
      explanations.push(expl);
      riskIndicators.push({
        code: SPAM_REASON_CODES.LOW_INFORMATION_DENSITY,
        signal: 'LOW_INFORMATION_DENSITY',
        weight: 20,
        score: 20,
        description: SPAM_REASON_DESCRIPTIONS.LOW_INFORMATION_DENSITY,
        evidence: `Sparse text length (${fullText.length} chars)`,
        recommendation: 'Request supplementary information from citizen.'
      });
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
          const expl = `Automated duplicate detection engine identified high-confidence duplicate (${Math.round(matchScore * 100)}%) with case ${topMatch.referenceNumber || topMatch.referenceId || topMatch.complaintReference || topMatch.id}.`;
          explanations.push(expl);
          riskIndicators.push({
            code: SPAM_REASON_CODES.PHASE6_DUPLICATE_MATCH,
            signal: 'PHASE6_DUPLICATE_MATCH',
            weight: this.config.phase6DuplicateWeight,
            score: this.config.phase6DuplicateWeight,
            description: SPAM_REASON_DESCRIPTIONS.PHASE6_DUPLICATE_MATCH,
            evidence: `Duplicate score ${Math.round(matchScore * 100)}% with ${topMatch.referenceNumber || topMatch.id}`,
            recommendation: 'Consider linking duplicate rather than marking abuse.'
          });
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
        const expl = `Rapid category cycling detected: account filed grievances across ${distinctDepts.size} distinct departments within minutes.`;
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.RAPID_CATEGORY_CYCLING,
          signal: 'RAPID_CATEGORY_CYCLING',
          weight: this.config.rapidCategoryCyclingWeight,
          score: this.config.rapidCategoryCyclingWeight,
          description: SPAM_REASON_DESCRIPTIONS.RAPID_CATEGORY_CYCLING,
          evidence: `${distinctDepts.size} departments targeted simultaneously`,
          recommendation: 'Evaluate whether complaints represent cross-department coordinated issues.'
        });
      }
    }

    // 7. SIGNAL 7: MALFORMED CONTENT / SYMBOL FLOOD (Feature B Enhancement)
    const malformedAnalysis = this.detectMalformedContent(fullText);
    if (malformedAnalysis.isMalformed) {
      const weight = this.config.malformedContentWeight || 35;
      score += weight;
      signals.malformedContent = { triggered: true, score: weight };
      reasons.push(SPAM_REASON_CODES.MALFORMED_CONTENT);
      const expl = `Malformed content detected: grievance contains abnormal symbol/markup density (${Math.round(malformedAnalysis.symbolRatio * 100)}%).`;
      explanations.push(expl);
      riskIndicators.push({
        code: SPAM_REASON_CODES.MALFORMED_CONTENT,
        signal: 'MALFORMED_CONTENT',
        weight,
        score: weight,
        description: SPAM_REASON_DESCRIPTIONS.MALFORMED_CONTENT,
        evidence: `${Math.round(malformedAnalysis.symbolRatio * 100)}% symbol density`,
        recommendation: 'Request citizen clarification with legible text.'
      });
    } else if (malformedAnalysis.isSymbolFlood) {
      const weight = this.config.symbolFloodWeight || 20;
      score += weight;
      signals.malformedContent = { triggered: true, score: weight };
      reasons.push(SPAM_REASON_CODES.EXCESSIVE_PUNCTUATION_SYMBOLS);
      const expl = 'Text contains excessive repeated punctuation or symbol artifacts.';
      explanations.push(expl);
      riskIndicators.push({
        code: SPAM_REASON_CODES.EXCESSIVE_PUNCTUATION_SYMBOLS,
        signal: 'EXCESSIVE_PUNCTUATION_SYMBOLS',
        weight,
        score: weight,
        description: SPAM_REASON_DESCRIPTIONS.EXCESSIVE_PUNCTUATION_SYMBOLS,
        evidence: 'Repeated punctuation sequences',
        recommendation: 'Inspect text readability.'
      });
    }

    // 8. SIGNAL 8: COMMERCIAL / PROMOTIONAL / PHISHING SPAM (Feature B Enhancement)
    if (this.isPromotionalOrPhishingSpam(fullText)) {
      const weight = this.config.promotionalSpamWeight || 40;
      score += weight;
      signals.promotionalSpam = { triggered: true, score: weight };
      reasons.push(SPAM_REASON_CODES.AUTOMATED_SPAM_PATTERNS);
      const expl = 'Commercial advertisement, promotional scam, or phishing link detected in civic grievance.';
      explanations.push(expl);
      riskIndicators.push({
        code: SPAM_REASON_CODES.AUTOMATED_SPAM_PATTERNS,
        signal: 'AUTOMATED_SPAM_PATTERNS',
        weight,
        score: weight,
        description: SPAM_REASON_DESCRIPTIONS.AUTOMATED_SPAM_PATTERNS,
        evidence: 'Detected promotional or phishing keywords',
        recommendation: 'Officer review to confirm commercial abuse finding.'
      });
    }

    // 9. SIGNAL 9: COORDINATED EXACT COPY-PASTE ACROSS REPOSITORIES (Feature B Enhancement)
    if (Array.isArray(candidatePool) && candidatePool.length > 0 && fullText.length >= 30) {
      let crossCitizenMatches = 0;
      for (const cand of candidatePool) {
        if (cand.id === complaint.id) continue;
        if (cand.citizenId && citizenId && cand.citizenId !== citizenId) {
          const candFull = `${cand.title || ''} ${cand.description || cand.text || ''}`.trim();
          if (candFull.length >= 30 && this.normalizeText(fullText) === this.normalizeText(candFull)) {
            crossCitizenMatches++;
          }
        }
      }

      if (crossCitizenMatches >= 2) {
        const weight = this.config.coordinatedRepetitionWeight || 30;
        score += weight;
        signals.coordinatedRepetition = { triggered: true, score: weight };
        reasons.push(SPAM_REASON_CODES.COORDINATED_REPETITION);
        const expl = `Coordinated repetition pattern: identical long text matched ${crossCitizenMatches} prior submissions from distinct accounts.`;
        explanations.push(expl);
        riskIndicators.push({
          code: SPAM_REASON_CODES.COORDINATED_REPETITION,
          signal: 'COORDINATED_REPETITION',
          weight,
          score: weight,
          description: SPAM_REASON_DESCRIPTIONS.COORDINATED_REPETITION,
          evidence: `${crossCitizenMatches} identical cross-account records`,
          recommendation: 'Review whether this is an organized civic campaign or automated script.'
        });
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
      riskIndicators,
      ruleVersion: this.config.ruleVersion,
      evaluatedAt: new Date().toISOString(),
      reviewStatus: flagged ? 'PENDING' : 'NOT_FLAGGED'
    };
  }
}

export const spamScreeningService = new SpamScreeningService();
export default spamScreeningService;
