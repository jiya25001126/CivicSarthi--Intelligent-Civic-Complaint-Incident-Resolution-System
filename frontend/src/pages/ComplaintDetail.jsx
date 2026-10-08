import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchComplaintById } from '../api/client';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Shield,
  FileCheck,
  AlertTriangle,
  FileText,
  Paperclip
} from 'lucide-react';

export default function ComplaintDetail() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchComplaintById(id);
        setComplaint(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
        <p className="text-slate-600 text-sm">Loading grievance details for {id}...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-4">
        <div className="text-rose-600 font-semibold">Error retrieving complaint</div>
        <p className="text-slate-600 text-sm">{error || 'Complaint not found.'}</p>
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Back link */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-semibold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={14} /> Back to Grievance List
        </Link>
        <span className="text-xs text-slate-500 font-mono">CPGRAMS Reference: {complaint.id}</span>
      </div>

      {/* Main Detail Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-900">{complaint.id}</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 capitalize">
                {complaint.category}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-white">
                Priority: {complaint.priority}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Department Assigned: <span className="font-semibold text-slate-700">{complaint.department}</span>
            </p>
          </div>

          <div className="text-right self-start md:self-auto">
            <span className="text-[11px] text-slate-500 block">Official CPGRAMS Status</span>
            <span className="inline-block mt-0.5 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              {complaint.officialStatus}
            </span>
          </div>
        </div>

        {/* Grievance Narrative */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              Citizen Grievance Narrative
            </h2>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 text-sm leading-relaxed">
              {complaint.text}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Calendar size={13} />
                <span>Date Filed</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Clock size={13} />
                <span>Last Updated</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {new Date(complaint.lastUpdated).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Shield size={13} />
                <span>Reassignments</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.reassignments} handoffs
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <AlertTriangle size={13} />
                <span>Citizen Reminders</span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {complaint.citizenReminders} reminders
              </span>
            </div>
          </div>

          {/* Evidence Attachments */}
          <div>
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
              Attached Evidence & Citations
            </h2>
            {complaint.evidence && complaint.evidence.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {complaint.evidence.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-medium"
                  >
                    <Paperclip size={13} className="text-blue-600" />
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No evidence attached.</p>
            )}
          </div>

          {/* SLA Analysis */}
          {complaint.slaMetrics && (
            <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 text-xs font-bold uppercase tracking-wider">
                <FileCheck size={14} className="text-blue-700" />
                <span>SLA Configuration & Diagnostic</span>
              </div>
              <div className="text-xs text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                <div>
                  <span className="text-slate-500">Case Age:</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.ageDays} days</span> (Threshold: {complaint.slaMetrics.slaDeadlineDays}d)
                </div>
                <div>
                  <span className="text-slate-500">Days Since Last Touch:</span>{' '}
                  <span className="font-semibold">{complaint.slaMetrics.daysSinceUpdate} days</span>
                </div>
                <div>
                  <span className="text-slate-500">Health Status:</span>{' '}
                  {complaint.slaMetrics.isSlaBreached ? (
                    <span className="text-red-700 font-bold">SLA Breached</span>
                  ) : complaint.slaMetrics.isStale ? (
                    <span className="text-amber-700 font-bold">Stalled (Stale)</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Normal Compliance</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
