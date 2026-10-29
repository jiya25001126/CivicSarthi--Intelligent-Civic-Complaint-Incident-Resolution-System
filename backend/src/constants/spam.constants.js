/**
 * @file spam.constants.js
 * @description Centralized constants, enums, risk levels, and reason codes
 * for CivicSarthi Phase 11: Spam/Fake Complaint Detection with Human Review.
 */

export const SPAM_RISK_LEVEL = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});
export const SPAM_RISK_LEVELS = SPAM_RISK_LEVEL;

export const SPAM_SCORE_THRESHOLDS = Object.freeze({
  LOW_MAX: 29,
  MEDIUM_MAX: 59,
  HIGH_MAX: 79,
  CRITICAL_MIN: 80,
  FLAG_FOR_REVIEW_MIN: 60 // High and Critical automatically queue for human review
});

export const SPAM_REVIEW_STATUS = Object.freeze({
  NOT_FLAGGED: 'NOT_FLAGGED',
  PENDING: 'PENDING',
  PENDING_REVIEW: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  REVIEWED: 'REVIEWED',
  RESOLVED: 'REVIEWED'
});
export const SPAM_REVIEW_STATUSES = SPAM_REVIEW_STATUS;

export const SPAM_REVIEW_OUTCOMES = Object.freeze({
  LEGITIMATE: 'LEGITIMATE',
  NEEDS_MORE_INFORMATION: 'NEEDS_MORE_INFORMATION',
  CONFIRMED_ABUSE: 'CONFIRMED_ABUSE',
  DISMISSED: 'LEGITIMATE',
  CLARIFICATION_REQUESTED: 'NEEDS_MORE_INFORMATION',
  REVIEWED_FINDING: 'CONFIRMED_ABUSE',
  ESCALATED: 'ESCALATED'
});

export const SPAM_REVIEW_OUTCOME_LABELS = Object.freeze({
  LEGITIMATE: 'Legitimate Grievance (False Positive Cleared)',
  NEEDS_MORE_INFORMATION: 'Needs Citizen Clarification (Preserved Pending Information)',
  CONFIRMED_ABUSE: 'Confirmed Malicious/Spam Submission (Explicit Finding)',
  ESCALATED: 'Escalated to Supervisory Authority'
});

export const SPAM_REASON_CODES = Object.freeze({
  BURST_FREQUENCY: 'BURST_FREQUENCY',
  BURST_SUBMISSION_DETECTED: 'BURST_FREQUENCY',
  DUPLICATE_TEXT_EXACT: 'DUPLICATE_TEXT_EXACT',
  IDENTICAL_COMPLAINT_TEXT: 'DUPLICATE_TEXT_EXACT',
  DUPLICATE_TEXT_SIMILAR: 'DUPLICATE_TEXT_SIMILAR',
  PHASE6_DUPLICATE_MATCH: 'PHASE6_DUPLICATE_MATCH',
  DUPLICATE_CONTENT_DETECTED: 'PHASE6_DUPLICATE_MATCH',
  REPETITIVE_CHARACTERS: 'REPETITIVE_CHARACTERS',
  GIBBERISH_NONSENSE_DETECTED: 'REPETITIVE_CHARACTERS',
  LOW_INFORMATION_DENSITY: 'LOW_INFORMATION_DENSITY',
  RAPID_CATEGORY_CYCLING: 'RAPID_CATEGORY_CYCLING',
  MALFORMED_CONTENT: 'MALFORMED_CONTENT',
  EXCESSIVE_PUNCTUATION_SYMBOLS: 'EXCESSIVE_PUNCTUATION_SYMBOLS',
  AUTOMATED_SPAM_PATTERNS: 'AUTOMATED_SPAM_PATTERNS',
  COORDINATED_REPETITION: 'COORDINATED_REPETITION'
});

export const SPAM_REASON_DESCRIPTIONS = Object.freeze({
  BURST_FREQUENCY: 'Unusually high submission volume from this citizen account in a narrow time window',
  DUPLICATE_TEXT_EXACT: 'Exact duplicate text matching previously submitted grievances',
  DUPLICATE_TEXT_SIMILAR: 'High textual and contextual similarity to existing grievances from same user',
  PHASE6_DUPLICATE_MATCH: 'Automated duplicate detection identified high-confidence duplicate candidate',
  REPETITIVE_CHARACTERS: 'Repetitive keyboard patterns, character mash, or automated nonsensical strings',
  LOW_INFORMATION_DENSITY: 'Extremely sparse or uninformative text failing to describe actionable civic defect',
  RAPID_CATEGORY_CYCLING: 'Multiple distinct departments targeted with identical metadata within minutes',
  MALFORMED_CONTENT: 'Malformed grievance body containing non-lexical entropy or unreadable formatting',
  EXCESSIVE_PUNCTUATION_SYMBOLS: 'High density of repeated symbols, punctuation floods, or markup artifacts',
  AUTOMATED_SPAM_PATTERNS: 'Commercial, phishing, or automated advertising syntax detected in civic complaint',
  COORDINATED_REPETITION: 'Coordinated identical copy-paste campaign detected across submission records'
});

export const CITIZEN_REPUTATION_STATUS = Object.freeze({
  GOOD_STANDING: 'GOOD_STANDING',
  UNDER_OBSERVATION: 'UNDER_OBSERVATION',
  RESTRICTED_REVIEW_PRIORITY: 'RESTRICTED_REVIEW_PRIORITY'
});
export const CITIZEN_REPUTATION_STATUSES = CITIZEN_REPUTATION_STATUS;

export const REPUTATION_EVENT_TYPES = Object.freeze({
  SUBMISSION_LOGGED: 'SUBMISSION_LOGGED',
  REVIEW_CLEARED_LEGITIMATE: 'REVIEW_CLEARED_LEGITIMATE',
  CONFIRMED_ABUSE: 'CONFIRMED_ABUSE',
  ABUSE_REVERSED: 'ABUSE_REVERSED'
});

/**
 * Default heuristic weights for deterministic screening
 */
export const DEFAULT_SPAM_CONFIG = Object.freeze({
  ruleVersion: '1.0.0',
  windowMinutes: 15,
  burstThresholdModerate: 3, // >= 3 in window adds 20 pts
  burstThresholdHigh: 5,     // >= 5 in window adds 35 pts
  exactDuplicateWeight: 45,
  similarDuplicateWeight: 25,
  phase6DuplicateWeight: 30,
  gibberishPatternWeight: 35,
  rapidCategoryCyclingWeight: 25,
  malformedContentWeight: 35,
  symbolFloodWeight: 20,
  promotionalSpamWeight: 40,
  coordinatedRepetitionWeight: 30,
  flagThreshold: 60
});
