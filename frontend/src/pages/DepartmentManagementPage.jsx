import React, { useEffect, useState } from 'react';
import { fetchDepartments, fetchComplaints } from '../api/client';
import {
  Building2,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Info
} from 'lucide-react';

export default function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([]);
  const [complaintCounts, setComplaintCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [deptRes, compRes] = await Promise.all([
        fetchDepartments(),
        fetchComplaints()
      ]);

      const depts = deptRes.data || [];
      const comps = compRes.data || [];

      // Calculate caseload per department
      const counts = {};
      for (const c of comps) {
        const dId = c.departmentId || c.department;
        counts[dId] = (counts[dId] || 0) + 1;
      }

      setDepartments(depts);
      setComplaintCounts(counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 size={24} className="text-blue-600" />
            Demonstration Department Directory
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configured administrative departments, nodal contact emails, and active caseload allocations.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Demonstration Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info size={18} className="shrink-0 text-blue-600 mt-0.5" />
        <div>
          <span className="font-bold">Demonstration Configuration:</span> These departmental mappings represent synthetic simulation nodes for CivicSarthi's decision-support layer and do not replace authoritative government directories.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Department Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200">
          <RefreshCw size={24} className="animate-spin text-blue-600" />
          <span>Loading department directory...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const count = complaintCounts[dept.id] || 0;
            return (
              <div
                key={dept.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-xs text-slate-700 border border-slate-200">
                      {dept.code || dept.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} />
                      Active Node
                    </span>
                  </div>

                  <h2 className="font-bold text-sm text-slate-900">
                    {dept.name}
                  </h2>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {dept.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={13} />
                      Target SLA:
                    </span>
                    <span className="font-semibold text-slate-800">{dept.slaDays || 30} days</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <FolderOpen size={13} />
                      Active Caseload:
                    </span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {count} cases
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate pt-1">
                    <Mail size={12} className="shrink-0" />
                    <span className="truncate">{dept.contactEmail}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
