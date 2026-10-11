/**
 * CivicSarthi AI Complaint Intelligence Service
 * 
 * Provides deterministic, explainable, and offline decision-support capabilities:
 * 1. Intelligent Complaint Classification (Category & Department)
 * 2. Explainable Priority Recommendations (Public Safety & SLA Signals)
 * 3. Duplicate Complaint Detection (Lexical, Categorical & Geospatial Signals)
 * 
 * All outputs are strictly assistive recommendations that never replace human officer authority.
 */

import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITY } from '../constants/status.constants.js';

// Canonical mapping of grievance category to primary handling department ID
export const CATEGORY_DEPARTMENT_MAP = {
  roads: 'DEPT_ROADS',
  electricity: 'DEPT_POWER',
  water: 'DEPT_WATER',
  healthcare: 'DEPT_HEALTH',
  scholarship: 'DEPT_SCHOLARSHIP',
  pension: 'DEPT_PENSION',
  ration: 'DEPT_RATION',
  municipal: 'DEPT_MUNICIPAL',
  revenue: 'DEPT_REVENUE',
  police: 'DEPT_POLICE',
  'flood relief': 'DEPT_DISASTER',
  OTHER: 'GENERAL_ADMIN',
  UNKNOWN: 'GENERAL_ADMIN'
};

// Comprehensive category lexicons with weighted civic terminology
export const CATEGORY_LEXICONS = {
  roads: {
    phrases: [
      'pothole on road', 'broken road', 'road repair', 'damaged asphalt', 'traffic signal damaged',
      'street crater', 'divider broken', 'flyover crack', 'bridge repair', 'highway pit', 'footpath broken'
    ],
    keywords: [
      'pothole', 'potholes', 'road', 'roads', 'asphalt', 'tar', 'highway', 'flyover', 'bridge',
      'divider', 'pavement', 'footpath', 'crater', 'resurface', 'bitumen', 'lanes', 'speedbreaker'
    ]
  },
  electricity: {
    phrases: [
      'power cut', 'power outage', 'transformer burst', 'transformer fire', 'hanging wire',
      'live wire', 'electric shock', 'sparking pole', 'voltage fluctuation', 'meter faulty', 'low voltage'
    ],
    keywords: [
      'electricity', 'power', 'blackout', 'outage', 'wire', 'wires', 'transformer', 'pole', 'current',
      'voltage', 'meter', 'shock', 'shortcircuit', 'substation', 'fuse', 'cable', 'discom', 'feeder'
    ]
  },
  water: {
    phrases: [
      'water pipeline leak', 'broken pipeline', 'dirty water supply', 'no water supply',
      'water contamination', 'pipeline burst', 'drinking water issue', 'sewage pipe broken',
      'overflowing gutter', 'blocked drain', 'drainage blockage'
    ],
    keywords: [
      'water', 'pipeline', 'pipe', 'leakage', 'leak', 'drainage', 'sewer', 'sewage', 'gutter',
      'tap', 'supply', 'contaminated', 'drinking', 'jal', 'tanker', 'manhole', 'overflow', 'plumbing'
    ]
  },
  healthcare: {
    phrases: [
      'government hospital', 'civil hospital', 'primary health centre', 'medicine shortage',
      'doctor absent', 'ambulance delay', 'dengue outbreak', 'malaria outbreak', 'icu bed'
    ],
    keywords: [
      'hospital', 'clinic', 'doctor', 'nurse', 'medicine', 'medicines', 'health', 'ambulance',
      'phc', 'chc', 'patient', 'treatment', 'disease', 'dengue', 'malaria', 'vaccine', 'medical'
    ]
  },
  pension: {
    phrases: [
      'old age pension', 'widow pension', 'disability pension', 'pension delay', 'pension stopped',
      'pension arrears', 'life certificate', 'pension disbursement'
    ],
    keywords: [
      'pension', 'pensioner', 'epfo', 'gratuity', 'superannuation', 'arrears', 'widow',
      'disability', 'stipend', 'dbt', 'senior'
    ]
  },
  scholarship: {
    phrases: [
      'scholarship not received', 'post matric scholarship', 'tuition fee reimbursement',
      'student stipend', 'scholarship portal error', 'fee waiver issue'
    ],
    keywords: [
      'scholarship', 'scholarships', 'stipend', 'tuition', 'student', 'college', 'school',
      'fee', 'fellowship', 'academic', 'dhe', 'grant', 'admission'
    ]
  },
  ration: {
    phrases: [
      'ration card', 'fair price shop', 'fps dealer', 'ration not given', 'epos machine',
      'pds quota', 'food grain shortage', 'bpl card'
    ],
    keywords: [
      'ration', 'rationcard', 'pds', 'fps', 'dealer', 'grain', 'wheat', 'rice', 'sugar',
      'kerosene', 'quota', 'epos', 'nfsa', 'foodgrains'
    ]
  },
  municipal: {
    phrases: [
      'garbage dump', 'uncollected garbage', 'solid waste', 'stray dog menace', 'street light off',
      'sanitation worker', 'open dumping', 'dead animal', 'park maintenance'
    ],
    keywords: [
      'garbage', 'waste', 'trash', 'debris', 'sanitation', 'cleanliness', 'dump', 'dustbin',
      'streetlight', 'dog', 'dogs', 'sweeper', 'safai', 'litter', 'park', 'stench', 'municipal'
    ]
  },
  revenue: {
    phrases: [
      'land record dispute', 'patwari delay', 'tehsildar office', 'illegal encroachment',
      'property tax error', 'land demarcation', 'stamp duty issue', 'mutation of land'
    ],
    keywords: [
      'land', 'revenue', 'patwari', 'tehsildar', 'registry', 'property', 'encroachment',
      'mutation', 'khasra', 'khatauni', 'deed', 'demarcation', 'tax', 'dispute'
    ]
  },
  police: {
    phrases: [
      'traffic congestion', 'illegal parking', 'noise pollution loudspeaker', 'theft report',
      'police harassment', 'extortion demand', 'public nuisance'
    ],
    keywords: [
      'police', 'traffic', 'jam', 'parking', 'theft', 'harassment', 'noise', 'loudspeaker',
      'vandalism', 'patrol', 'extortion', 'bribe', 'fir', 'nuisance', 'unauthorized'
    ]
  },
  'flood relief': {
    phrases: [
      'flood relief compensation', 'monsoon flooding', 'houses submerged', 'waterlogged area',
      'rescue operation', 'relief camp', 'ex gratia flood', 'disaster management'
    ],
    keywords: [
      'flood', 'flooding', 'submerged', 'waterlogging', 'monsoon', 'inundation', 'cyclone',
      'disaster', 'rescue', 'evacuation', 'ddma', 'dam', 'landslide'
    ]
  }
};

// High-urgency indicators that pose threats to human life, public safety, or acute infrastructure hazards
const CRITICAL_SAFETY_INDICATORS = [
  { pattern: /\b(live wire|hanging wire|sparking wire|electric shock|electrocution)\b/i, label: 'Live electrical wire / electrocution hazard' },
  { pattern: /\b(transformer fire|transformer burst|cylinder blast|gas leak)\b/i, label: 'Active fire / explosion risk' },
  { pattern: /\b(open manhole|deep pit without barricade|manhole cover missing)\b/i, label: 'Open manhole / fatal falling hazard' },
  { pattern: /\b(bridge collapse|wall collapse|building collapse|structural crack)\b/i, label: 'Structural failure / collapse danger' },
  { pattern: /\b(toxic water|poisonous water|severe contamination|cholera|epidemic outbreak)\b/i, label: 'Critical water poisoning / disease outbreak' },
  { pattern: /\b(houses submerged|flash flood|trapped in water|drowning)\b/i, label: 'Severe flood / life-threatening waterlogging' },
  { pattern: /\b(icu power|oxygen supply|ventilator)\b/i, label: 'Critical healthcare infrastructure disruption' }
];

const HIGH_URGENCY_INDICATORS = [
  { pattern: /\b(hospital route blocked|ambulance stuck|school bus stuck)\b/i, label: 'Emergency transit route obstruction' },
  { pattern: /\b(stray dog pack biting|rabies threat|aggressive dogs)\b/i, label: 'Animal attack / public safety risk' },
  { pattern: /\b(major road crater|arterial road blocked|accident prone)\b/i, label: 'Severe road accident hazard' },
  { pattern: /\b(pipeline burst|drinking water stopped for \d+ days|no water for \d+ days)\b/i, label: 'Prolonged potable water deprivation' },
  { pattern: /\b(blackout for \d+ hours|entire colony in dark)\b/i, label: 'Mass electrical blackout' }
];

// Stopwords for lexical similarity calculation
const COMMON_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did',
  'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'please', 'sir', 'madam',
  'issue', 'problem', 'complaint', 'grievance', 'there', 'is', 'are', 'due', 'area', 'near'
]);

export class AiIntelligenceService {
  /**
   * Tokenize and normalize input text into meaningful word tokens
   * @param {string} text 
   * @returns {string[]}
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !COMMON_STOPWORDS.has(token));
  }

  /**
   * Feature A: Intelligent Complaint Classification
   * Predicts the most appropriate civic grievance category and department with confidence and explanation.
   * 
   * @param {object} params
   * @param {string} [params.title]
   * @param {string} [params.description]
   * @param {string} [params.category] - current category if already selected
   * @returns {object} Classification recommendation result
   */
  classifyComplaint(params = {}) {
    const input = params || {};
    const title = input.title || '';
    const description = input.description || '';
    const category = input.category || '';
    const combinedText = `${title} ${description}`.trim().toLowerCase();

    // Safe fallback for empty or insufficient input
    if (!combinedText || combinedText.length < 5) {
      const fallbackDept = category && CATEGORY_DEPARTMENT_MAP[category] ? CATEGORY_DEPARTMENT_MAP[category] : 'GENERAL_ADMIN';
      return {
        category: category || 'OTHER',
        suggestedCategory: category || 'OTHER',
        departmentId: fallbackDept,
        suggestedDepartment: fallbackDept,
        confidence: 0.1,
        confidenceLevel: 'LOW',
        explanation: 'Insufficient grievance narrative to compute automated category recommendation. Manual triage required.',
        matchedKeywords: [],
        method: 'deterministic-lexical-v1',
        isFallback: true
      };
    }

    const scores = {};
    const matchedTermsMap = {};

    for (const [cat, lexicon] of Object.entries(CATEGORY_LEXICONS)) {
      let score = 0;
      const matched = new Set();

      // Check multi-word phrase matches (weight: 3.5 per match)
      for (const phrase of lexicon.phrases) {
        if (combinedText.includes(phrase)) {
          score += 3.5;
          matched.add(phrase);
        }
      }

      // Check single keyword matches (weight: 1.5 per match)
      for (const kw of lexicon.keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(combinedText)) {
          score += 1.5;
          matched.add(kw);
        }
      }

      // Bonus if category name itself is explicitly mentioned in narrative
      if (combinedText.includes(cat)) {
        score += 2.0;
        matched.add(cat);
      }

      scores[cat] = score;
      matchedTermsMap[cat] = Array.from(matched);
    }

    // Rank categories by computed score
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCategory, topScore] = ranked[0];
    const secondScore = ranked[1] ? ranked[1][1] : 0;

    // If no keywords matched across any category, return unclassified fallback
    if (topScore === 0) {
      const fallbackDept = category && CATEGORY_DEPARTMENT_MAP[category] ? CATEGORY_DEPARTMENT_MAP[category] : 'GENERAL_ADMIN';
      return {
        category: category || 'OTHER',
        suggestedCategory: category || 'OTHER',
        departmentId: fallbackDept,
        suggestedDepartment: fallbackDept,
        confidence: 0.15,
        confidenceLevel: 'LOW',
        explanation: 'Insufficient clear category signals found in description. Defaulting to general review.',
        matchedKeywords: [],
        method: 'deterministic-lexical-v1',
        isFallback: true
      };
    }

    // Compute normalized confidence score between 0.35 and 0.95
    let confidence = 0.45;
    let confidenceLevel = 'LOW';

    if (topScore >= 6.0 && (topScore - secondScore >= 2.5)) {
      confidence = Math.min(0.95, 0.75 + (topScore * 0.03));
      confidenceLevel = 'HIGH';
    } else if (topScore >= 3.0) {
      confidence = Math.min(0.80, 0.55 + (topScore * 0.03));
      confidenceLevel = 'MEDIUM';
    } else {
      confidence = Math.max(0.35, 0.35 + (topScore * 0.05));
      confidenceLevel = 'LOW';
    }

    confidence = Math.round(confidence * 100) / 100;
    const targetDept = CATEGORY_DEPARTMENT_MAP[topCategory] || null;
    const matchedList = matchedTermsMap[topCategory] || [];
    const matchedSummary = matchedList.slice(0, 4).join("', '");

    const explanation = `Matched ${matchedList.length} relevant indicator${matchedList.length === 1 ? '' : 's'} ('${matchedSummary}') mapped to '${topCategory}' and routed to ${targetDept || 'triage'}.`;

    return {
      category: topCategory,
      suggestedCategory: topCategory,
      departmentId: targetDept,
      suggestedDepartment: targetDept,
      confidence,
      confidenceLevel,
      explanation,
      matchedKeywords: matchedList,
      method: 'deterministic-lexical-v1',
      isFallback: false
    };
  }

  /**
   * Feature B: Explainable Priority Recommendations
   * Analyzes narrative for public safety risks, SLA urgency, and recurrence signals.
   * 
   * @param {object} complaintData 
   * @returns {object} Priority recommendation result with clear explanation
   */
  recommendPriority(complaintData = {}, existingDuplicatesOrCount = 0) {
    const title = complaintData.title || '';
    const description = complaintData.description || complaintData.text || '';
    const combinedText = `${title} ${description}`.trim();
    const category = (complaintData.category || '').toLowerCase();
    const slaMetrics = complaintData.slaMetrics || null;

    let duplicateCount = complaintData.potentialDuplicateCount || 0;
    if (Array.isArray(existingDuplicatesOrCount)) {
      duplicateCount = existingDuplicatesOrCount.length;
    } else if (typeof existingDuplicatesOrCount === 'number' && existingDuplicatesOrCount > 0) {
      duplicateCount = existingDuplicatesOrCount;
    }

    const urgencySignals = [];
    let isSafetyHazard = false;
    let baseScore = 2.0; // Default: MEDIUM baseline

    // 1. Critical Public Safety & Hazard Checks
    for (const indicator of CRITICAL_SAFETY_INDICATORS) {
      if (indicator.pattern.test(combinedText)) {
        isSafetyHazard = true;
        urgencySignals.push(`Public safety hazard: ${indicator.label}`);
        baseScore = Math.max(baseScore, 5.5);
      }
    }

    // 2. High Urgency Checks
    for (const indicator of HIGH_URGENCY_INDICATORS) {
      if (indicator.pattern.test(combinedText)) {
        urgencySignals.push(`Urgent Condition: ${indicator.label}`);
        baseScore = Math.max(baseScore, 4.0);
      }
    }

    // Urgency Keywords Detection
    const URGENCY_KEYWORD_REGEX = /\b(urgent|urgently|emergency|critical|immediate|severity|hazardous)\b/i;
    if (URGENCY_KEYWORD_REGEX.test(combinedText) && !isSafetyHazard) {
      baseScore = Math.max(baseScore, 4.0);
      const matchedWord = (combinedText.match(URGENCY_KEYWORD_REGEX) || ['urgent'])[0];
      urgencySignals.push(`Urgency keywords ('${matchedWord}') detected in narrative`);
    }

    // 3. Category-Specific Inherent Urgency
    if (category === 'flood relief') {
      baseScore += 1.5;
      urgencySignals.push("Emergency category: Flood Relief & Disaster Response");
    } else if (category === 'healthcare' && !isSafetyHazard) {
      baseScore += 0.8;
      urgencySignals.push("Essential public health service domain");
    } else if (category === 'electricity' && isSafetyHazard) {
      baseScore += 1.0;
    }

    // 4. SLA & Age Dynamics
    if (slaMetrics) {
      if (slaMetrics.isSlaBreached) {
        baseScore += 1.5;
        urgencySignals.push(`SLA Deadline Exceeded (${slaMetrics.ageDays} days active vs ${slaMetrics.slaDeadlineDays}d deadline)`);
      } else if (slaMetrics.isStale) {
        baseScore += 0.8;
        urgencySignals.push(`Stale Case (${slaMetrics.daysSinceUpdate} days without officer update)`);
      }
      if (slaMetrics.isReassignmentLoop) {
        baseScore += 0.7;
        urgencySignals.push(`Department Reassignment Loop detected (${complaintData.reassignments || 0} transfers)`);
      }
    } else if (complaintData.createdAt) {
      const ageDays = Math.floor((Date.now() - new Date(complaintData.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays >= 14) {
        baseScore += 1.5;
        urgencySignals.push(`Complaint age exceeds ${ageDays} days without resolution`);
      }
    }

    // 5. Duplicate Recurrence Multiplier
    if (duplicateCount >= 2) {
      baseScore += 1.5;
      urgencySignals.push(`Repeated civic reports detected: ${duplicateCount} correlated complaints reported`);
    }

    // Determine final recommended priority
    let recommendedPriority = COMPLAINT_PRIORITY.MEDIUM;
    let confidence = 0.70;
    let confidenceLevel = 'MEDIUM';

    if (baseScore >= 5.0 || isSafetyHazard) {
      recommendedPriority = COMPLAINT_PRIORITY.CRITICAL;
      confidence = 0.90;
      confidenceLevel = 'HIGH';
    } else if (baseScore >= 3.5) {
      recommendedPriority = COMPLAINT_PRIORITY.HIGH;
      confidence = 0.82;
      confidenceLevel = 'HIGH';
    } else if (baseScore <= 1.5) {
      recommendedPriority = COMPLAINT_PRIORITY.LOW;
      confidence = 0.75;
      confidenceLevel = 'MEDIUM';
    } else {
      recommendedPriority = COMPLAINT_PRIORITY.MEDIUM;
      confidence = 0.70;
      confidenceLevel = 'MEDIUM';
    }

    if (urgencySignals.length === 0) {
      urgencySignals.push('Standard baseline priority under routine municipal handling guidelines');
    }

    // Formulate transparent explanation
    let explanation = '';
    if (isSafetyHazard) {
      explanation = `Recommended ${recommendedPriority} due to identified public safety threat (${urgencySignals[0]}). Requires immediate prioritized field inspection.`;
    } else if (urgencySignals.length > 0) {
      explanation = `Recommended ${recommendedPriority} based on signals: ${urgencySignals.join('; ')}.`;
    } else {
      explanation = `Recommended ${recommendedPriority} under routine handling guidelines with standard SLA resolution window.`;
    }

    return {
      recommendedPriority,
      priority: recommendedPriority,
      confidence: confidenceLevel,
      confidenceScore: confidence,
      confidenceLevel,
      isSafetyHazard,
      publicSafetyHazard: isSafetyHazard,
      urgencySignals,
      reasons: urgencySignals,
      explanation,
      method: 'explainable-rules-v1'
    };
  }

  /**
   * Feature C: Duplicate Complaint Detection
   * Evaluates text similarity, categorical alignment, and geographical proximity between grievances.
   * 
   * @param {object} targetComplaint - Complaint being evaluated
   * @param {object[]} candidateComplaints - Pool of existing complaints to compare against
   * @param {object} [options]
   * @param {number} [options.threshold=0.45] - Minimum similarity score to qualify as candidate
   * @param {number} [options.limit=5] - Maximum matches to return
   * @returns {object[]} Array of duplicate candidate matches
   */
  detectDuplicates(targetComplaint, candidateComplaints = [], options = {}) {
    if (!targetComplaint || !Array.isArray(candidateComplaints) || candidateComplaints.length === 0) {
      return [];
    }

    const threshold = typeof options.threshold === 'number' ? options.threshold : 0.45;
    const limit = options.limit || 5;

    const targetId = (targetComplaint.id || targetComplaint.referenceNumber || '').toLowerCase();
    const targetTitle = (targetComplaint.title || '').trim();
    const targetDesc = (targetComplaint.description || targetComplaint.text || '').trim();
    const targetCategory = (targetComplaint.category || '').toLowerCase();
    const targetState = (targetComplaint.state || '').trim().toLowerCase();
    const targetDistrict = (targetComplaint.district || '').trim().toLowerCase();
    const targetLocality = (targetComplaint.locality || '').trim().toLowerCase();

    const targetTokens = new Set(this.tokenize(`${targetTitle} ${targetDesc}`));

    const matches = [];

    for (const candidate of candidateComplaints) {
      const candidateId = (candidate.id || candidate.referenceNumber || '').toLowerCase();
      // Skip comparing against itself
      if (candidateId && candidateId === targetId) {
        continue;
      }

      const candTitle = (candidate.title || '').trim();
      const candDesc = (candidate.description || candidate.text || '').trim();
      const candCategory = (candidate.category || '').toLowerCase();
      const candState = (candidate.state || '').trim().toLowerCase();
      const candDistrict = (candidate.district || '').trim().toLowerCase();
      const candLocality = (candidate.locality || '').trim().toLowerCase();

      const candTokens = new Set(this.tokenize(`${candTitle} ${candDesc}`));

      // 1. Lexical Similarity (Jaccard Index, Weight: 0.55)
      let textSimilarity = 0;
      if (targetTokens.size > 0 && candTokens.size > 0) {
        let intersection = 0;
        for (const token of targetTokens) {
          if (candTokens.has(token)) {
            intersection++;
          }
        }
        const union = targetTokens.size + candTokens.size - intersection;
        textSimilarity = union > 0 ? intersection / union : 0;
      }

      // Also boost if titles are nearly identical
      if (targetTitle.length > 5 && candTitle.length > 5 && targetTitle.toLowerCase() === candTitle.toLowerCase()) {
        textSimilarity = Math.max(textSimilarity, 0.85);
      }

      // 2. Category Match (Weight: 0.25)
      const categoryMatch = targetCategory && candCategory && targetCategory === candCategory;
      const categoryScore = categoryMatch ? 0.25 : 0.0;

      // 3. Location Proximity (Weight: 0.20)
      let locationScore = 0.0;
      const locationSignals = [];

      if (targetState && candState && targetState === candState) {
        locationScore += 0.05;
      }
      if (targetDistrict && candDistrict) {
        if (targetDistrict === candDistrict) {
          locationScore += 0.07;
          locationSignals.push(`District match (${candidate.district})`);
        } else {
          locationScore -= 0.20; // Divergent district penalty for physical localized complaints
        }
      }
      if (targetLocality && candLocality) {
        if (targetLocality === candLocality || targetLocality.includes(candLocality) || candLocality.includes(targetLocality)) {
          locationScore += 0.08;
          locationSignals.push(`Matching Locality (${candidate.locality})`);
        }
      }

      // Compute weighted composite score (0.0 to 1.0)
      const totalScore = (textSimilarity * 0.55) + categoryScore + locationScore;
      const roundedScore = Math.round(totalScore * 100) / 100;

      if (roundedScore >= threshold) {
        const matchReasons = [];
        if (categoryMatch) {
          matchReasons.push(`Category match ('${candidate.category}')`);
        }
        if (textSimilarity >= 0.3) {
          matchReasons.push(`Text vocabulary overlap (${Math.round(textSimilarity * 100)}%)`);
        }
        if (locationSignals.length > 0) {
          matchReasons.push(...locationSignals);
        }

        let confidenceLevel = 'MEDIUM';
        if (roundedScore >= 0.70) {
          confidenceLevel = 'HIGH';
        } else if (roundedScore < 0.50) {
          confidenceLevel = 'LOW';
        }

        matches.push({
          id: candidate.id,
          complaintId: candidate.id,
          referenceNumber: candidate.referenceNumber || candidate.id,
          title: candidate.title,
          category: candidate.category,
          status: candidate.status,
          departmentId: candidate.departmentId || candidate.department,
          district: candidate.district,
          locality: candidate.locality || '',
          createdAt: candidate.createdAt,
          similarityScore: roundedScore,
          matchScore: roundedScore,
          confidenceLevel,
          matchReasons,
          signals: matchReasons,
          textSimilarity: Math.round(textSimilarity * 100) / 100
        });
      }
    }

    // Sort by descending similarity score
    matches.sort((a, b) => b.similarityScore - a.similarityScore);
    return matches.slice(0, limit);
  }

  /**
   * Sanitizes duplicate candidates for citizen or public projection to prevent
   * leaking another citizen's private contact details or internal notes.
   * 
   * @param {object[]} duplicates 
   * @returns {object[]} Privacy-safe duplicate summaries
   */
  sanitizeDuplicatesForCitizen(duplicates = []) {
    if (!Array.isArray(duplicates)) return [];
    return duplicates.map(d => ({
      id: d.id || d.complaintId,
      complaintId: d.complaintId || d.id,
      referenceNumber: d.referenceNumber || d.complaintId || d.id,
      title: d.title,
      category: d.category,
      status: d.status,
      district: d.district,
      locality: d.locality || '',
      similarityScore: d.similarityScore || d.matchScore,
      matchScore: d.matchScore || d.similarityScore,
      confidenceLevel: d.confidenceLevel,
      matchReasons: d.matchReasons || d.signals,
      signals: d.signals || d.matchReasons
    }));
  }

  /**
   * Evaluates comprehensive AI complaint intelligence across all three capabilities
   * 
   * @param {object} complaintData 
   * @param {object[]} [candidatePool=[]] 
   * @returns {object} Complete intelligence summary
   */
  evaluateIntelligence(complaintData = {}, candidatePool = []) {
    const classification = this.classifyComplaint({
      title: complaintData.title,
      description: complaintData.description || complaintData.text,
      category: complaintData.category
    });

    const duplicates = this.detectDuplicates(complaintData, candidatePool, { threshold: 0.45, limit: 5 });

    const priorityRec = this.recommendPriority({
      ...complaintData,
      potentialDuplicateCount: duplicates.length
    }, duplicates);

    return {
      classification,
      priorityRecommendation: priorityRec,
      duplicates,
      potentialDuplicates: duplicates,
      summary: {
        suggestedCategory: classification.suggestedCategory,
        suggestedDepartment: classification.suggestedDepartment,
        recommendedPriority: priorityRec.recommendedPriority,
        priority: priorityRec.priority,
        isSafetyHazard: priorityRec.isSafetyHazard,
        publicSafetyHazard: priorityRec.publicSafetyHazard,
        potentialDuplicateCount: duplicates.length,
        duplicateCount: duplicates.length,
        topDuplicateRef: duplicates.length > 0 ? duplicates[0].referenceNumber : null,
        analyzedAt: new Date().toISOString(),
        method: 'civicsarthi-ai-suite-v1'
      }
    };
  }
}

export const aiIntelligenceService = new AiIntelligenceService();
export default aiIntelligenceService;
