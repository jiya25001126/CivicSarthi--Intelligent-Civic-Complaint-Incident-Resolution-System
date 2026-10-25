/**
 * @file analytics.service.js
 * @description Orchestration service for CivicSarthi Phase 13: Aggregate Analytics & Reporting.
 * Computes deterministic, access-controlled municipal metrics, time-series trends, department
 * performance, category/geography breakdowns, workflow indicators, and CSV exports.
 */

import { analyticsRepository } from '../repositories/analytics.repository.js';
import config from '../config/app.config.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY } from '../constants/status.constants.js';
import {
  ANALYTICS_INTERVALS,
  ANALYTICS_REPORT_TYPES,
  METRIC_DEFINITIONS,
  escapeCsvCell
} from '../constants/analytics.constants.js';

export class AnalyticsService {
  constructor(deps = {}) {
    this.analyticsRepo = deps.analyticsRepository || analyticsRepository;
  }

  /**
   * Enforces server-side role-based access control and department scope.
   * Citizens are forbidden. Officers are locked to user.departmentId.
   * Admins can query all departments or a specific department.
   *
   * @param {Object} user - Authenticated user entity from req.user
   * @param {Object} filters - Query filters
   * @returns {{ departmentId: string|null, isCrossDepartment: boolean }}
   */
  _resolveAccessScope(user, filters = {}) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: citizen role is not authorized to access administrative aggregate analytics');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    if (user.role === 'officer') {
      if (!user.departmentId) {
        const err = new Error('Access denied: officer has no assigned department scope');
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT';
        throw err;
      }
      // Strictly enforce officer's authorized department, ignoring client-supplied parameter
      return {
        departmentId: user.departmentId,
        isCrossDepartment: false
      };
    }

    // Role is admin: can filter by specific department or aggregate cross-department
    const adminDeptFilter = filters.departmentId ? String(filters.departmentId).trim() : null;
    return {
      departmentId: adminDeptFilter,
      isCrossDepartment: !adminDeptFilter
    };
  }

  /**
   * Validates and parses date filter bounds.
   *
   * @param {Object} filters
   * @returns {{ start: Date|null, end: Date|null }}
   */
  _parseDateRange(filters = {}) {
    let start = null;
    let end = null;

    if (filters.startDate) {
      start = new Date(filters.startDate);
      if (isNaN(start.getTime())) {
        const err = new Error('Invalid date filter: startDate format is unparseable');
        err.status = 400;
        err.code = 'INVALID_DATE_FORMAT';
        throw err;
      }
    }

    if (filters.endDate) {
      end = new Date(filters.endDate);
      if (isNaN(end.getTime())) {
        const err = new Error('Invalid date filter: endDate format is unparseable');
        err.status = 400;
        err.code = 'INVALID_DATE_FORMAT';
        throw err;
      }
    }

    if (start && end && start > end) {
      const err = new Error('Invalid date range: startDate cannot be after endDate');
      err.status = 400;
      err.code = 'INVALID_DATE_RANGE';
      throw err;
    }

    return { start, end };
  }

  /**
   * Builds department SLA days lookup map
   */
  _buildDepartmentSlaMap(departments = []) {
    const map = {};
    for (const d of departments) {
      if (d.id) {
        map[d.id] = Number(d.slaDays) || config.sla.resolutionDeadlineDays;
      }
      if (d.category) {
        map[d.category] = Number(d.slaDays) || config.sla.resolutionDeadlineDays;
      }
    }
    return map;
  }

  /**
   * Evaluates if an active complaint has breached its SLA deadline
   */
  _isComplaintOverdue(complaint, referenceTime, slaMap) {
    if (!complaint) return false;
    // Terminal states are not actively overdue
    if (complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED) {
      return false;
    }

    const created = new Date(complaint.createdAt);
    if (isNaN(created.getTime())) return false;

    let deadline;
    if (complaint.deadline) {
      deadline = new Date(complaint.deadline);
    } else {
      const deptSla = slaMap[complaint.departmentId] || slaMap[complaint.department] || config.sla.resolutionDeadlineDays;
      deadline = new Date(created.getTime() + deptSla * 24 * 60 * 60 * 1000);
    }

    return referenceTime.getTime() > deadline.getTime();
  }

  /**
   * Retrieves the earliest resolution timestamp from statusHistory or metadata
   */
  _getResolutionTimestamp(complaint) {
    if (complaint.resolvedAt) {
      const d = new Date(complaint.resolvedAt);
      if (!isNaN(d.getTime())) return d;
    }

    if (Array.isArray(complaint.statusHistory)) {
      for (const h of complaint.statusHistory) {
        if (h.status === COMPLAINT_STATUS.RESOLVED || h.status === COMPLAINT_STATUS.CLOSED) {
          const d = new Date(h.timestamp);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }

    return new Date(complaint.updatedAt || complaint.lastUpdated || complaint.createdAt);
  }

  /**
   * Evaluates if a resolved complaint was resolved on or before its target SLA deadline
   */
  _isResolvedWithinSla(complaint, slaMap) {
    if (complaint.status !== COMPLAINT_STATUS.RESOLVED && complaint.status !== COMPLAINT_STATUS.CLOSED) {
      return false;
    }

    const created = new Date(complaint.createdAt);
    if (isNaN(created.getTime())) return false;

    const resolvedTime = this._getResolutionTimestamp(complaint);

    let deadline;
    if (complaint.deadline) {
      deadline = new Date(complaint.deadline);
    } else {
      const deptSla = slaMap[complaint.departmentId] || slaMap[complaint.department] || config.sla.resolutionDeadlineDays;
      deadline = new Date(created.getTime() + deptSla * 24 * 60 * 60 * 1000);
    }

    return resolvedTime.getTime() <= deadline.getTime();
  }

  /**
   * Filters complaints by scope and optional date/category criteria
   */
  _filterComplaints(complaints, { departmentId, category, start, end }) {
    return complaints.filter((c) => {
      if (departmentId && c.departmentId !== departmentId && c.department !== departmentId) {
        return false;
      }
      if (category && c.category?.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
      if (start || end) {
        const cDate = new Date(c.createdAt);
        if (isNaN(cDate.getTime())) return false;
        if (start && cDate < start) return false;
        if (end && cDate > end) return false;
      }
      return true;
    });
  }

  /**
   * 1. Overview Metrics
   */
  async getOverview(filters = {}, user) {
    const scope = this._resolveAccessScope(user, filters);
    const { start, end } = this._parseDateRange(filters);

    const [rawComplaints, departments] = await Promise.all([
      this.analyticsRepo.getComplaints(),
      this.analyticsRepo.getDepartments()
    ]);

    const slaMap = this._buildDepartmentSlaMap(departments);
    const list = this._filterComplaints(rawComplaints, {
      departmentId: scope.departmentId,
      category: filters.category,
      start,
      end
    });

    const now = new Date();
    const activeStatuses = [
      COMPLAINT_STATUS.SUBMITTED,
      COMPLAINT_STATUS.UNDER_REVIEW,
      COMPLAINT_STATUS.ASSIGNED,
      COMPLAINT_STATUS.IN_PROGRESS,
      COMPLAINT_STATUS.AWAITING_INFORMATION,
      COMPLAINT_STATUS.REOPENED
    ];
    const pendingStatuses = [
      COMPLAINT_STATUS.SUBMITTED,
      COMPLAINT_STATUS.UNDER_REVIEW,
      COMPLAINT_STATUS.AWAITING_INFORMATION
    ];

    const totalComplaints = list.length;
    const activeComplaints = list.filter((c) => activeStatuses.includes(c.status)).length;
    const resolvedComplaints = list.filter((c) => c.status === COMPLAINT_STATUS.RESOLVED).length;
    const closedComplaints = list.filter((c) => c.status === COMPLAINT_STATUS.CLOSED).length;
    const resolvedAndClosed = resolvedComplaints + closedComplaints;
    const pendingComplaints = list.filter((c) => pendingStatuses.includes(c.status)).length;

    const overdueComplaints = list.filter((c) => this._isComplaintOverdue(c, now, slaMap)).length;

    const priorityCounts = {
      LOW: list.filter((c) => c.priority === COMPLAINT_PRIORITY.LOW).length,
      MEDIUM: list.filter((c) => c.priority === COMPLAINT_PRIORITY.MEDIUM).length,
      HIGH: list.filter((c) => c.priority === COMPLAINT_PRIORITY.HIGH).length,
      CRITICAL: list.filter((c) => c.priority === COMPLAINT_PRIORITY.CRITICAL).length
    };
    const highAndCriticalCount = priorityCounts.HIGH + priorityCounts.CRITICAL;

    // Mathematical Rates
    const resolutionRate =
      totalComplaints > 0 ? Math.round((resolvedAndClosed / totalComplaints) * 10000) / 100 : 0.0;

    const resolvedCohort = list.filter(
      (c) => c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED
    );
    const resolvedWithinSlaCount = resolvedCohort.filter((c) => this._isResolvedWithinSla(c, slaMap)).length;
    const slaComplianceRate =
      resolvedCohort.length > 0
        ? Math.round((resolvedWithinSlaCount / resolvedCohort.length) * 10000) / 100
        : null;

    // Change Over Time Comparison (if start and end bounds provided)
    let comparison = {
      hasSufficientComparisonData: false,
      previousPeriod: null,
      percentChange: null
    };

    if (start && end) {
      const durationMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - durationMs);
      const prevEnd = new Date(start.getTime());

      const prevList = this._filterComplaints(rawComplaints, {
        departmentId: scope.departmentId,
        category: filters.category,
        start: prevStart,
        end: prevEnd
      });

      if (prevList.length > 0) {
        const prevResolved = prevList.filter(
          (c) => c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED
        ).length;
        const prevOverdue = prevList.filter((c) => this._isComplaintOverdue(c, prevEnd, slaMap)).length;
        const prevResRate = Math.round((prevResolved / prevList.length) * 10000) / 100;

        const calcChange = (curr, prev) => {
          if (prev === 0) return curr > 0 ? 100.0 : 0.0;
          return Math.round(((curr - prev) / prev) * 1000) / 10;
        };

        comparison = {
          hasSufficientComparisonData: true,
          previousPeriod: {
            startDate: prevStart.toISOString(),
            endDate: prevEnd.toISOString(),
            totalComplaints: prevList.length,
            resolvedAndClosed: prevResolved,
            overdueComplaints: prevOverdue,
            resolutionRate: prevResRate
          },
          percentChange: {
            totalComplaints: calcChange(totalComplaints, prevList.length),
            resolvedAndClosed: calcChange(resolvedAndClosed, prevResolved),
            overdueComplaints: calcChange(overdueComplaints, prevOverdue),
            resolutionRate: Math.round((resolutionRate - prevResRate) * 100) / 100
          }
        };
      }
    }

    return {
      scope: {
        departmentId: scope.departmentId || 'ALL_DEPARTMENTS',
        isCrossDepartment: scope.isCrossDepartment,
        dateRange: {
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null
        }
      },
      metrics: {
        totalComplaints,
        activeComplaints,
        resolvedComplaints,
        closedComplaints,
        resolvedAndClosed,
        pendingComplaints,
        overdueComplaints,
        priorityCounts,
        highAndCriticalCount,
        resolutionRate,
        slaComplianceRate,
        resolvedWithinSlaCount,
        eligibleResolvedForSla: resolvedCohort.length
      },
      metricDefinitions: {
        resolutionRate: METRIC_DEFINITIONS.RESOLUTION_RATE,
        slaComplianceRate: METRIC_DEFINITIONS.SLA_COMPLIANCE_RATE,
        overdueBacklog: METRIC_DEFINITIONS.OVERDUE_BACKLOG
      },
      comparison
    };
  }

  /**
   * 2. Time-Series Trends
   */
  async getTimeSeriesTrends(filters = {}, user) {
    const scope = this._resolveAccessScope(user, filters);
    let { start, end } = this._parseDateRange(filters);

    // If no date range specified, default to past 30 days
    const now = new Date();
    if (!end) end = now;
    if (!start) start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const interval = (filters.interval || ANALYTICS_INTERVALS.DAY).toLowerCase();

    const [rawComplaints, departments] = await Promise.all([
      this.analyticsRepo.getComplaints(),
      this.analyticsRepo.getDepartments()
    ]);
    const slaMap = this._buildDepartmentSlaMap(departments);

    const scopedComplaints = this._filterComplaints(rawComplaints, {
      departmentId: scope.departmentId,
      category: filters.category
    });

    // Generate Bins based on interval
    const bins = [];
    const stepMs =
      interval === ANALYTICS_INTERVALS.MONTH
        ? 30 * 24 * 60 * 60 * 1000
        : interval === ANALYTICS_INTERVALS.WEEK
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    let cursor = new Date(start.getTime());
    while (cursor <= end) {
      const binStart = new Date(cursor.getTime());
      const binEnd = new Date(Math.min(end.getTime(), cursor.getTime() + stepMs - 1));

      const label =
        interval === ANALYTICS_INTERVALS.MONTH
          ? binStart.toISOString().slice(0, 7)
          : binStart.toISOString().slice(0, 10);

      bins.push({
        period: label,
        binStart,
        binEnd,
        submitted: 0,
        resolved: 0,
        openBacklog: 0,
        slaBreaches: 0
      });

      cursor = new Date(cursor.getTime() + stepMs);
    }

    // Populate Bins from real historical timestamps
    for (const bin of bins) {
      // 1. Submitted in bin
      bin.submitted = scopedComplaints.filter((c) => {
        const cDate = new Date(c.createdAt);
        return cDate >= bin.binStart && cDate <= bin.binEnd;
      }).length;

      // 2. Resolved in bin (reconstructed strictly from resolution events, not current status)
      bin.resolved = scopedComplaints.filter((c) => {
        if (c.status !== COMPLAINT_STATUS.RESOLVED && c.status !== COMPLAINT_STATUS.CLOSED) {
          return false;
        }
        const resTime = this._getResolutionTimestamp(c);
        return resTime >= bin.binStart && resTime <= bin.binEnd;
      }).length;

      // 3. Open Backlog at bin end: Cumulative submitted on or before binEnd minus cumulative resolved on or before binEnd
      const cumulativeSubmitted = scopedComplaints.filter((c) => new Date(c.createdAt) <= bin.binEnd).length;
      const cumulativeResolved = scopedComplaints.filter((c) => {
        if (c.status !== COMPLAINT_STATUS.RESOLVED && c.status !== COMPLAINT_STATUS.CLOSED) {
          return false;
        }
        const resTime = this._getResolutionTimestamp(c);
        return resTime <= bin.binEnd;
      }).length;

      bin.openBacklog = Math.max(0, cumulativeSubmitted - cumulativeResolved);

      // 4. SLA breaches in bin (complaints that exceeded deadline during this interval)
      bin.slaBreaches = scopedComplaints.filter((c) => {
        const created = new Date(c.createdAt);
        if (isNaN(created.getTime())) return false;
        const deptSla = slaMap[c.departmentId] || slaMap[c.department] || config.sla.resolutionDeadlineDays;
        const deadline = c.deadline ? new Date(c.deadline) : new Date(created.getTime() + deptSla * 24 * 60 * 60 * 1000);

        if (deadline >= bin.binStart && deadline <= bin.binEnd) {
          // Breached if still open at deadline or resolved after deadline
          const resTime = this._getResolutionTimestamp(c);
          return c.status !== COMPLAINT_STATUS.RESOLVED && c.status !== COMPLAINT_STATUS.CLOSED
            ? true
            : resTime > deadline;
        }
        return false;
      }).length;
    }

    return {
      scope: {
        departmentId: scope.departmentId || 'ALL_DEPARTMENTS',
        interval,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      trends: bins.map((b) => ({
        period: b.period,
        startDate: b.binStart.toISOString(),
        endDate: b.binEnd.toISOString(),
        submitted: b.submitted,
        resolved: b.resolved,
        openBacklog: b.openBacklog,
        slaBreaches: b.slaBreaches
      }))
    };
  }

  /**
   * 3. Department Performance Breakdown
   */
  async getDepartmentPerformance(filters = {}, user) {
    const scope = this._resolveAccessScope(user, filters);
    const { start, end } = this._parseDateRange(filters);

    const [rawComplaints, departments] = await Promise.all([
      this.analyticsRepo.getComplaints(),
      this.analyticsRepo.getDepartments()
    ]);

    const slaMap = this._buildDepartmentSlaMap(departments);
    const now = new Date();

    // Determine target departments to report
    let targetDepartments = departments;
    if (scope.departmentId) {
      targetDepartments = departments.filter((d) => d.id === scope.departmentId);
      if (targetDepartments.length === 0) {
        // Fallback synthetic entry if departmentId not found in directory
        targetDepartments = [{ id: scope.departmentId, name: scope.departmentId, slaDays: 30 }];
      }
    }

    const performance = targetDepartments.map((dept) => {
      const deptComplaints = this._filterComplaints(rawComplaints, {
        departmentId: dept.id,
        category: filters.category,
        start,
        end
      });

      const total = deptComplaints.length;
      const activeStatuses = [
        COMPLAINT_STATUS.SUBMITTED,
        COMPLAINT_STATUS.UNDER_REVIEW,
        COMPLAINT_STATUS.ASSIGNED,
        COMPLAINT_STATUS.IN_PROGRESS,
        COMPLAINT_STATUS.AWAITING_INFORMATION,
        COMPLAINT_STATUS.REOPENED
      ];
      const activeWorkload = deptComplaints.filter((c) => activeStatuses.includes(c.status)).length;
      const resolvedCohort = deptComplaints.filter(
        (c) => c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED
      );
      const resolvedCount = resolvedCohort.length;
      const overdueCount = deptComplaints.filter((c) => this._isComplaintOverdue(c, now, slaMap)).length;

      const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 10000) / 100 : 0.0;
      const resolvedWithinSlaCount = resolvedCohort.filter((c) => this._isResolvedWithinSla(c, slaMap)).length;
      const slaComplianceRate =
        resolvedCount > 0 ? Math.round((resolvedWithinSlaCount / resolvedCount) * 10000) / 100 : null;

      // Resolution Durations (Hours)
      const durations = resolvedCohort
        .map((c) => {
          const cDate = new Date(c.createdAt);
          const rDate = this._getResolutionTimestamp(c);
          return Math.max(0, (rDate.getTime() - cDate.getTime()) / (1000 * 60 * 60));
        })
        .sort((a, b) => a - b);

      const avgDurationHours =
        durations.length > 0 ? Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10 : null;

      const medianDurationHours =
        durations.length > 0
          ? Math.round(
              durations.length % 2 === 0
                ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
                : durations[Math.floor(durations.length / 2)]
            )
          : null;

      const priorityBreakdown = {
        LOW: deptComplaints.filter((c) => c.priority === COMPLAINT_PRIORITY.LOW).length,
        MEDIUM: deptComplaints.filter((c) => c.priority === COMPLAINT_PRIORITY.MEDIUM).length,
        HIGH: deptComplaints.filter((c) => c.priority === COMPLAINT_PRIORITY.HIGH).length,
        CRITICAL: deptComplaints.filter((c) => c.priority === COMPLAINT_PRIORITY.CRITICAL).length
      };

      const reassignmentLoopsCount = deptComplaints.filter(
        (c) => (c.reassignments || 0) >= config.sla.reassignmentLoopThreshold
      ).length;

      const staleCasesCount = deptComplaints.filter((c) => {
        if (!activeStatuses.includes(c.status)) return false;
        const lastUpdated = new Date(c.updatedAt || c.lastUpdated || c.createdAt);
        const days = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        return days > config.sla.staleUpdateDays;
      }).length;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        code: dept.code || dept.id,
        targetSlaDays: dept.slaDays || config.sla.resolutionDeadlineDays,
        totalComplaints: total,
        activeWorkload,
        resolvedCount,
        overdueCount,
        resolutionRate,
        slaComplianceRate,
        averageResolutionDurationHours: avgDurationHours,
        medianResolutionDurationHours: medianDurationHours,
        priorityBreakdown,
        reassignmentLoopsCount,
        staleCasesCount
      };
    });

    return {
      scope: {
        departmentId: scope.departmentId || 'ALL_DEPARTMENTS',
        isCrossDepartment: scope.isCrossDepartment
      },
      departments: performance
    };
  }

  /**
   * 4. Complaint Category & Geography Aggregates
   */
  async getCategoryAndGeography(filters = {}, user) {
    const scope = this._resolveAccessScope(user, filters);
    const { start, end } = this._parseDateRange(filters);

    const rawComplaints = await this.analyticsRepo.getComplaints();
    const list = this._filterComplaints(rawComplaints, {
      departmentId: scope.departmentId,
      category: filters.category,
      start,
      end
    });

    const total = list.length;

    // Category Distribution
    const categoryMap = {};
    for (const c of list) {
      const cat = (c.category || 'uncategorized').toLowerCase();
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          count: 0,
          resolved: 0,
          active: 0,
          priorityBreakdown: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
        };
      }
      categoryMap[cat].count++;
      if (c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED) {
        categoryMap[cat].resolved++;
      } else {
        categoryMap[cat].active++;
      }
      if (c.priority && categoryMap[cat].priorityBreakdown[c.priority] !== undefined) {
        categoryMap[cat].priorityBreakdown[c.priority]++;
      }
    }

    const categories = Object.values(categoryMap).map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0.0
    }));

    // Priority Distribution
    const priorities = {
      LOW: list.filter((c) => c.priority === COMPLAINT_PRIORITY.LOW).length,
      MEDIUM: list.filter((c) => c.priority === COMPLAINT_PRIORITY.MEDIUM).length,
      HIGH: list.filter((c) => c.priority === COMPLAINT_PRIORITY.HIGH).length,
      CRITICAL: list.filter((c) => c.priority === COMPLAINT_PRIORITY.CRITICAL).length
    };

    // Geographic Aggregation (Strictly State/District Level; Zero Citizen PII)
    const stateMap = {};
    for (const c of list) {
      const stateName = c.state || 'Unspecified State';
      const districtName = c.district || 'Unspecified District';

      if (!stateMap[stateName]) {
        stateMap[stateName] = {
          state: stateName,
          totalComplaints: 0,
          districts: {}
        };
      }
      stateMap[stateName].totalComplaints++;

      if (!stateMap[stateName].districts[districtName]) {
        stateMap[stateName].districts[districtName] = {
          district: districtName,
          count: 0,
          resolved: 0,
          active: 0
        };
      }
      stateMap[stateName].districts[districtName].count++;
      if (c.status === COMPLAINT_STATUS.RESOLVED || c.status === COMPLAINT_STATUS.CLOSED) {
        stateMap[stateName].districts[districtName].resolved++;
      } else {
        stateMap[stateName].districts[districtName].active++;
      }
    }

    const geography = Object.values(stateMap).map((st) => ({
      state: st.state,
      totalComplaints: st.totalComplaints,
      districts: Object.values(st.districts)
    }));

    return {
      scope: {
        departmentId: scope.departmentId || 'ALL_DEPARTMENTS',
        totalSampled: total
      },
      categories,
      priorities,
      geography,
      privacySafeguard: {
        guarantee: 'State and district aggregates only. Street addresses, citizen identities, and coordinates are strictly stripped.',
        aggregationThreshold: 1
      }
    };
  }

  /**
   * 5. Operational Workflow & Quality Indicators
   */
  async getWorkflowAndQuality(filters = {}, user) {
    const scope = this._resolveAccessScope(user, filters);
    const { start, end } = this._parseDateRange(filters);

    const [
      rawComplaints,
      incidents,
      subtasks,
      feedback,
      appeals,
      reopenings,
      spamReviews,
      clarifications,
      reminders
    ] = await Promise.all([
      this.analyticsRepo.getComplaints(),
      this.analyticsRepo.getIncidents(),
      this.analyticsRepo.getSubtasks(),
      this.analyticsRepo.getFeedback(),
      this.analyticsRepo.getAppeals(),
      this.analyticsRepo.getReopeningRequests(),
      this.analyticsRepo.getSpamReviews(),
      this.analyticsRepo.getClarifications(),
      this.analyticsRepo.getReminders()
    ]);

    const list = this._filterComplaints(rawComplaints, {
      departmentId: scope.departmentId,
      category: filters.category,
      start,
      end
    });

    const now = new Date();
    const total = list.length;

    // Status Distribution
    const statusDistribution = {};
    for (const s of Object.values(COMPLAINT_STATUS)) {
      statusDistribution[s] = list.filter((c) => c.status === s).length;
    }

    // Workflow anomalies
    const reassignmentLoopsCount = list.filter(
      (c) => (c.reassignments || 0) >= config.sla.reassignmentLoopThreshold
    ).length;

    const staleCasesCount = list.filter((c) => {
      const activeStatuses = [
        COMPLAINT_STATUS.SUBMITTED,
        COMPLAINT_STATUS.UNDER_REVIEW,
        COMPLAINT_STATUS.ASSIGNED,
        COMPLAINT_STATUS.IN_PROGRESS,
        COMPLAINT_STATUS.AWAITING_INFORMATION,
        COMPLAINT_STATUS.REOPENED
      ];
      if (!activeStatuses.includes(c.status)) return false;
      const lastUpdated = new Date(c.updatedAt || c.lastUpdated || c.createdAt);
      const days = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      return days > config.sla.staleUpdateDays;
    }).length;

    // Subtasks & Incidents Workload (Phase 7)
    const filteredSubtasks = scope.departmentId
      ? subtasks.filter((st) => st.departmentId === scope.departmentId)
      : subtasks;
    const completedSubtasks = filteredSubtasks.filter((st) => st.status === 'COMPLETED').length;
    const subtaskCompletionRate =
      filteredSubtasks.length > 0 ? Math.round((completedSubtasks / filteredSubtasks.length) * 1000) / 10 : null;

    // Clarifications Activity (Phase 12)
    const filteredClarifications = scope.departmentId
      ? clarifications.filter((clr) => clr.departmentId === scope.departmentId)
      : clarifications;
    const clarificationMetrics = {
      totalRequests: filteredClarifications.length,
      openRequests: filteredClarifications.filter((clr) => clr.status === 'OPEN').length,
      respondedRequests: filteredClarifications.filter((clr) => clr.status === 'RESPONDED').length,
      closedRequests: filteredClarifications.filter((clr) => clr.status === 'CLOSED').length
    };

    // Reminders Activity (Phase 12)
    const filteredReminders = scope.departmentId
      ? reminders.filter((rem) => rem.departmentId === scope.departmentId)
      : reminders;
    const reminderMetrics = {
      totalRemindersLogged: filteredReminders.length,
      uniqueComplaintsReminded: new Set(filteredReminders.map((r) => r.complaintId)).size
    };

    // Citizen Feedback & Satisfaction (Phase 10)
    const filteredFeedback = scope.departmentId
      ? feedback.filter((fb) => fb.departmentId === scope.departmentId)
      : feedback;
    const feedbackTotal = filteredFeedback.length;
    const feedbackDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    for (const fb of filteredFeedback) {
      const r = Number(fb.rating);
      if (feedbackDistribution[r] !== undefined) {
        feedbackDistribution[r]++;
        ratingSum += r;
      }
    }
    const averageCitizenRating =
      feedbackTotal > 0 ? Math.round((ratingSum / feedbackTotal) * 100) / 100 : null;

    // Appeals (Phase 10)
    const filteredAppeals = scope.departmentId
      ? appeals.filter((a) => a.departmentId === scope.departmentId)
      : appeals;
    const appealsMetrics = {
      totalAppeals: filteredAppeals.length,
      pendingAppeals: filteredAppeals.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length,
      acceptedAppeals: filteredAppeals.filter((a) => a.status === 'ACCEPTED').length,
      rejectedAppeals: filteredAppeals.filter((a) => a.status === 'REJECTED').length
    };

    // Reopenings (Phase 10)
    const filteredReopenings = scope.departmentId
      ? reopenings.filter((ro) => ro.departmentId === scope.departmentId)
      : reopenings;
    const reopeningsMetrics = {
      totalPetitions: filteredReopenings.length,
      pendingPetitions: filteredReopenings.filter((ro) => ro.status === 'PENDING').length,
      approvedPetitions: filteredReopenings.filter((ro) => ro.status === 'APPROVED').length,
      rejectedPetitions: filteredReopenings.filter((ro) => ro.status === 'REJECTED').length
    };

    // Spam Screening & Human Review Desk (Phase 11)
    // Strictly separates automated heuristic risk flags from human-confirmed abuse
    const filteredSpam = scope.departmentId
      ? spamReviews.filter((sr) => sr.departmentId === scope.departmentId)
      : spamReviews;
    const spamReviewMetrics = {
      totalScreeningFlags: filteredSpam.length,
      riskLevelCounts: {
        LOW: filteredSpam.filter((sr) => sr.riskLevel === 'LOW').length,
        MEDIUM: filteredSpam.filter((sr) => sr.riskLevel === 'MEDIUM').length,
        HIGH: filteredSpam.filter((sr) => sr.riskLevel === 'HIGH').length,
        CRITICAL: filteredSpam.filter((sr) => sr.riskLevel === 'CRITICAL').length
      },
      humanReviewOutcomes: {
        pendingReview: filteredSpam.filter((sr) => sr.status === 'PENDING').length,
        clearedLegitimate: filteredSpam.filter((sr) => sr.decision === 'LEGITIMATE').length,
        needsMoreInformation: filteredSpam.filter((sr) => sr.decision === 'NEEDS_MORE_INFORMATION').length,
        confirmedAbuse: filteredSpam.filter((sr) => sr.decision === 'CONFIRMED_ABUSE').length,
        escalated: filteredSpam.filter((sr) => sr.decision === 'ESCALATED').length
      },
      privacySafeguard:
        'Automated screening flags are explicitly separated from confirmed abuse. Citizen reputation scores and complaint text are excluded.'
    };

    return {
      scope: {
        departmentId: scope.departmentId || 'ALL_DEPARTMENTS',
        isCrossDepartment: scope.isCrossDepartment
      },
      statusDistribution,
      anomalies: {
        reassignmentLoops: {
          count: reassignmentLoopsCount,
          percentage: total > 0 ? Math.round((reassignmentLoopsCount / total) * 1000) / 10 : 0.0
        },
        staleCases: {
          count: staleCasesCount,
          percentage: total > 0 ? Math.round((staleCasesCount / total) * 1000) / 10 : 0.0
        }
      },
      interAgencyWorkload: {
        parentIncidentsCount: incidents.length,
        subtasksCount: filteredSubtasks.length,
        completedSubtasks,
        subtaskCompletionRate
      },
      clarifications: clarificationMetrics,
      reminders: reminderMetrics,
      satisfactionFeedback: {
        totalResponses: feedbackTotal,
        averageRating: averageCitizenRating,
        ratingDistribution: feedbackDistribution
      },
      appeals: appealsMetrics,
      reopenings: reopeningsMetrics,
      spamReviewDesk: spamReviewMetrics
    };
  }

  /**
   * 6. Report Generation & CSV Export
   */
  async exportReport(filters = {}, user, req = {}) {
    const scope = this._resolveAccessScope(user, filters);
    const { start, end } = this._parseDateRange(filters);
    const reportType = (filters.reportType || ANALYTICS_REPORT_TYPES.ALL).toLowerCase();

    // Parallel fetch required data sections
    const [overviewData, deptData, catData, workflowData] = await Promise.all([
      this.getOverview(filters, user),
      this.getDepartmentPerformance(filters, user),
      this.getCategoryAndGeography(filters, user),
      this.getWorkflowAndQuality(filters, user)
    ]);

    const generatedAt = new Date().toISOString();
    const rows = [];

    // Header metadata lines with CSV comment indicators
    rows.push('# CivicSarthi — Intelligent Civic Complaint & Incident Resolution System');
    rows.push('# Official Municipal Grievance Resolution & Decision Support Analytics Export');
    rows.push(`# Report Type: ${escapeCsvCell(reportType.toUpperCase())}`);
    rows.push(`# Generated At (ISO): ${escapeCsvCell(generatedAt)}`);
    rows.push(`# Generated By Role: ${escapeCsvCell(user.role)}`);
    rows.push(`# Department Scope: ${escapeCsvCell(scope.departmentId || 'ALL_DEPARTMENTS')}`);
    rows.push(
      `# Selected Date Window: ${escapeCsvCell(
        `${start ? start.toISOString().slice(0, 10) : 'BASELINE'} to ${end ? end.toISOString().slice(0, 10) : 'PRESENT'}`
      )}`
    );
    rows.push('#');
    rows.push('# METRIC DEFINITIONS & FORMULAS GLOSSARY:');
    rows.push('# - Resolution Rate: (Resolved Complaints + Closed Complaints) / Total Registered Complaints * 100');
    rows.push('# - SLA Compliance Rate: (Resolved on or before Deadline) / (Total Resolved Complaints) * 100');
    rows.push('# - Overdue Backlog: Active complaints where Current Date > Target SLA Resolution Deadline');
    rows.push('# - Reassignment Loops: Complaints with >= 2 inter-departmental transfers');
    rows.push('# - Stale Complaints: Active cases without operational update for > 7 days');
    rows.push('# - Spam Flags vs Confirmed Abuse: Automated screening flags are distinct from human-adjudicated abuse');
    rows.push('#');
    rows.push('# PRIVACY & FORMULA INJECTION SAFEGUARD:');
    rows.push('# All metrics are aggregated. Citizen PII, addresses, private officer notes, and reputation scores are excluded.');
    rows.push('# Spreadsheet formula injection characters (=, +, -, @) have been safely escaped.');
    rows.push('');

    // SECTION 1: OVERVIEW METRICS
    if (reportType === ANALYTICS_REPORT_TYPES.OVERVIEW || reportType === ANALYTICS_REPORT_TYPES.ALL) {
      rows.push('--- SECTION 1: EXECUTIVE KPI SUMMARY ---');
      rows.push('Metric,Value,Denominator / Explanation');
      rows.push(`Total Complaints,${overviewData.metrics.totalComplaints},"Total complaints filed in reporting period"`);
      rows.push(`Active Backlog,${overviewData.metrics.activeComplaints},"Unresolved complaints in non-terminal states"`);
      rows.push(`Resolved Complaints,${overviewData.metrics.resolvedComplaints},"Complaints reported remediated"`);
      rows.push(`Closed Complaints,${overviewData.metrics.closedComplaints},"Complaints formally closed"`);
      rows.push(`Resolved and Closed Total,${overviewData.metrics.resolvedAndClosed},"Combined terminal resolution count"`);
      rows.push(`Pending Initial Review,${overviewData.metrics.pendingComplaints},"SUBMITTED / UNDER_REVIEW / AWAITING_INFO"`);
      rows.push(`Overdue Complaints,${overviewData.metrics.overdueComplaints},"Active complaints past SLA deadline"`);
      rows.push(`High and Critical Priority,${overviewData.metrics.highAndCriticalCount},"Priority mix needing urgent attention"`);
      rows.push(`Resolution Rate (%),${overviewData.metrics.resolutionRate},"Resolved + Closed / Total * 100"`);
      rows.push(
        `SLA Compliance Rate (%),${overviewData.metrics.slaComplianceRate ?? 'N/A'},"Resolved within SLA / Total Resolved * 100"`
      );
      rows.push('');
    }

    // SECTION 2: DEPARTMENT PERFORMANCE
    if (reportType === ANALYTICS_REPORT_TYPES.DEPARTMENTS || reportType === ANALYTICS_REPORT_TYPES.ALL) {
      rows.push('--- SECTION 2: DEPARTMENT PERFORMANCE & WORKLOAD ---');
      rows.push(
        'Department ID,Department Name,Code,SLA Days,Total Complaints,Active Workload,Resolved Count,Overdue Count,Resolution Rate (%),SLA Compliance (%),Avg Duration (Hrs),Median Duration (Hrs),Reassignment Loops,Stale Cases'
      );
      for (const d of deptData.departments) {
        rows.push(
          [
            escapeCsvCell(d.departmentId),
            escapeCsvCell(d.departmentName),
            escapeCsvCell(d.code),
            d.targetSlaDays,
            d.totalComplaints,
            d.activeWorkload,
            d.resolvedCount,
            d.overdueCount,
            d.resolutionRate,
            d.slaComplianceRate ?? 'N/A',
            d.averageResolutionDurationHours ?? 'N/A',
            d.medianResolutionDurationHours ?? 'N/A',
            d.reassignmentLoopsCount,
            d.staleCasesCount
          ].join(',')
        );
      }
      rows.push('');
    }

    // SECTION 3: CATEGORIES & GEOGRAPHY
    if (reportType === ANALYTICS_REPORT_TYPES.CATEGORIES || reportType === ANALYTICS_REPORT_TYPES.ALL) {
      rows.push('--- SECTION 3: COMPLAINT CATEGORIES ---');
      rows.push('Category,Total Count,Percentage (%),Active,Resolved,Low Priority,Medium Priority,High Priority,Critical Priority');
      for (const c of catData.categories) {
        rows.push(
          [
            escapeCsvCell(c.category),
            c.count,
            c.percentage,
            c.active,
            c.resolved,
            c.priorityBreakdown.LOW,
            c.priorityBreakdown.MEDIUM,
            c.priorityBreakdown.HIGH,
            c.priorityBreakdown.CRITICAL
          ].join(',')
        );
      }
      rows.push('');

      rows.push('--- SECTION 4: GEOGRAPHIC DISTRIBUTION (STATE & DISTRICT AGGREGATES) ---');
      rows.push('State,District,Total Grievances,Active Grievances,Resolved Grievances');
      for (const st of catData.geography) {
        for (const dist of st.districts) {
          rows.push(
            [
              escapeCsvCell(st.state),
              escapeCsvCell(dist.district),
              dist.count,
              dist.active,
              dist.resolved
            ].join(',')
          );
        }
      }
      rows.push('');
    }

    // SECTION 5: WORKFLOW, QUALITY & FOLLOW-UPS
    if (reportType === ANALYTICS_REPORT_TYPES.WORKFLOW || reportType === ANALYTICS_REPORT_TYPES.ALL) {
      rows.push('--- SECTION 5: WORKFLOW, REMINDERS & QUALITY ---');
      rows.push('Metric Category,Metric Name,Value');
      rows.push(`Status Distribution,SUBMITTED,${workflowData.statusDistribution.SUBMITTED || 0}`);
      rows.push(`Status Distribution,UNDER_REVIEW,${workflowData.statusDistribution.UNDER_REVIEW || 0}`);
      rows.push(`Status Distribution,ASSIGNED,${workflowData.statusDistribution.ASSIGNED || 0}`);
      rows.push(`Status Distribution,IN_PROGRESS,${workflowData.statusDistribution.IN_PROGRESS || 0}`);
      rows.push(`Status Distribution,AWAITING_INFORMATION,${workflowData.statusDistribution.AWAITING_INFORMATION || 0}`);
      rows.push(`Status Distribution,RESOLVED,${workflowData.statusDistribution.RESOLVED || 0}`);
      rows.push(`Status Distribution,CLOSED,${workflowData.statusDistribution.CLOSED || 0}`);
      rows.push(`Status Distribution,REOPENED,${workflowData.statusDistribution.REOPENED || 0}`);
      rows.push(`Workflow Anomalies,Reassignment Loops Count,${workflowData.anomalies.reassignmentLoops.count}`);
      rows.push(`Workflow Anomalies,Stale Complaints Count,${workflowData.anomalies.staleCases.count}`);
      rows.push(`Clarifications,Total Clarification Requests,${workflowData.clarifications.totalRequests}`);
      rows.push(`Clarifications,Open Requests,${workflowData.clarifications.openRequests}`);
      rows.push(`Clarifications,Responded Requests,${workflowData.clarifications.respondedRequests}`);
      rows.push(`Citizen Reminders,Total Reminders Logged,${workflowData.reminders.totalRemindersLogged}`);
      rows.push(`Citizen Reminders,Unique Grievances Reminded,${workflowData.reminders.uniqueComplaintsReminded}`);
      rows.push(
        `Citizen Feedback,Average Rating (1-5),${workflowData.satisfactionFeedback.averageRating ?? 'N/A'}`
      );
      rows.push(`Dispute Appeals,Total Appeals Filed,${workflowData.appeals.totalAppeals}`);
      rows.push(`Dispute Appeals,Appeals Accepted,${workflowData.appeals.acceptedAppeals}`);
      rows.push(`Dispute Appeals,Appeals Rejected,${workflowData.appeals.rejectedAppeals}`);
      rows.push(`Reopening Petitions,Total Reopenings,${workflowData.reopenings.totalPetitions}`);
      rows.push(`Spam Screening Desk,Automated Flags Count,${workflowData.spamReviewDesk.totalScreeningFlags}`);
      rows.push(
        `Spam Screening Desk,Cleared Legitimate Complaints,${workflowData.spamReviewDesk.humanReviewOutcomes.clearedLegitimate}`
      );
      rows.push(
        `Spam Screening Desk,Confirmed Abuse Adjudications,${workflowData.spamReviewDesk.humanReviewOutcomes.confirmedAbuse}`
      );
      rows.push('');
    }

    const csvContent = rows.join('\r\n');
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = `civicsarthi_analytics_${reportType}_${filenameDate}.csv`;

    // Record audit log for administrative export action
    await this.analyticsRepo.logExportAction({
      action: 'ANALYTICS_REPORT_EXPORTED',
      userId: user.id,
      userEmail: user.email,
      role: user.role,
      targetResource: `ANALYTICS_EXPORT_${reportType.toUpperCase()}`,
      details: {
        format: 'csv',
        reportType,
        departmentScope: scope.departmentId || 'ALL_DEPARTMENTS',
        dateRange: {
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null
        }
      },
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1'
    });

    return {
      csvData: csvContent,
      filename,
      contentType: 'text/csv'
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
