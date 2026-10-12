/**
 * @file analytics.constants.js
 * @description Constants, metric definitions, and configuration for CivicSarthi Phase 13 Analytics & Reporting.
 */

export const ANALYTICS_INTERVALS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month'
};

export const ANALYTICS_REPORT_TYPES = {
  OVERVIEW: 'overview',
  TRENDS: 'trends',
  DEPARTMENTS: 'departments',
  CATEGORIES: 'categories',
  WORKFLOW: 'workflow',
  ALL: 'all'
};

export const ANALYTICS_EXPORT_FORMATS = {
  CSV: 'csv'
};

/**
 * Metric Definitions & Mathematical Formulas Glossary
 */
export const METRIC_DEFINITIONS = {
  RESOLUTION_RATE: {
    name: 'Complaint Resolution Rate',
    code: 'RESOLUTION_RATE',
    formula: '((Resolved Complaints + Closed Complaints) / Total Eligible Complaints in Period) * 100',
    denominator: 'Total complaints registered within the evaluated reporting window.',
    interpretation: 'Percentage of registered complaints that have reached an official terminal resolution state (RESOLVED or CLOSED).'
  },
  SLA_COMPLIANCE_RATE: {
    name: 'SLA Compliance Rate',
    code: 'SLA_COMPLIANCE_RATE',
    formula: '(Complaints Resolved on or before Deadline / Total Resolved Complaints in Period) * 100',
    denominator: 'Total complaints that reached resolution (RESOLVED or CLOSED) within the evaluated period.',
    interpretation: 'Percentage of resolved complaints where resolution was achieved within the departmental or statutory SLA deadline.'
  },
  OVERDUE_BACKLOG: {
    name: 'Overdue Backlog',
    code: 'OVERDUE_BACKLOG',
    formula: 'Active Unresolved Complaints where Current Time > Resolution Deadline',
    denominator: 'Active complaints currently in non-terminal states.',
    interpretation: 'Number of open complaints that have exceeded their target SLA resolution timeframe.'
  },
  RESOLUTION_DURATION: {
    name: 'Resolution Duration',
    code: 'RESOLUTION_DURATION',
    formula: 'Elapsed time from Complaint Submission Timestamp to First Resolution Timestamp',
    unit: 'Hours (or Days)',
    interpretation: 'Speed of departmental redressal, measured as average and median duration for resolved complaints.'
  },
  REASSIGNMENT_LOOPS: {
    name: 'Reassignment Loops',
    code: 'REASSIGNMENT_LOOPS',
    formula: 'Complaints with Reassignment Count >= Configured Threshold (Default 2)',
    interpretation: 'Indicator of jurisdictional ambiguity, multi-agency pinball, or triage bottlenecks.'
  },
  STALE_COMPLAINTS: {
    name: 'Stale Complaints',
    code: 'STALE_COMPLAINTS',
    formula: 'Active Complaints with zero administrative updates or notes for > Configured Days (Default 7)',
    interpretation: 'Indicator of administrative neglect or stalled investigation requiring supervisory intervention.'
  },
  SPAM_FLAG_VS_ABUSE: {
    name: 'Screening Flag vs Confirmed Abuse',
    code: 'SPAM_FLAG_VS_ABUSE',
    interpretation: 'Automated heuristic risk flags (Phase 11) are distinctly separated from human-confirmed abuse decisions. Unconfirmed flags never penalize citizens.'
  }
};

/**
 * Privacy Safeguards: Minimum threshold for geographic grouping.
 * Groups with counts below threshold are aggregated to prevent deanonymization.
 */
export const MIN_GEOGRAPHIC_AGGREGATION_THRESHOLD = 1;

/**
 * Formula Injection Escaping:
 * Characters that could trigger formula execution in spreadsheet software (Excel, Calc, Google Sheets).
 */
export const CSV_FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes a cell value for safe CSV export, preventing CSV formula injection (CWE-1236).
 * @param {*} value
 * @returns {string}
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let str = String(value);

  // If cell begins with a formula injection trigger, prepend single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // If cell contains commas, double quotes, or newlines, quote the string and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}
