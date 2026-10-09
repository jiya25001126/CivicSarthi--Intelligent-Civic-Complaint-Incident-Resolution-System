import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createComplaint, fetchDepartments } from '../api/client';
import {
  FilePlus,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Shield,
  FileText,
  Paperclip,
  Clock,
  ExternalLink
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Gujarat', 'Haryana',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'
];

const CATEGORIES = [
  { value: 'roads', label: 'Roads & Infrastructure' },
  { value: 'electricity', label: 'Electricity & Power Distribution' },
  { value: 'water', label: 'Drinking Water Supply & Drainage' },
  { value: 'healthcare', label: 'Public Health & Government Clinics' },
  { value: 'pension', label: 'Social Welfare & Pensions' },
  { value: 'scholarship', label: 'Higher Education & Scholarships' },
  { value: 'ration', label: 'PDS Ration & Food Security' },
  { value: 'municipal', label: 'Municipal Sanitation & Waste' },
  { value: 'revenue', label: 'Revenue & Land Administration' },
  { value: 'police', label: 'Police Liaison & Traffic' },
  { value: 'flood relief', label: 'Flood Relief & Disaster Response' }
];

export default function SubmitComplaintPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('roads');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune');
  const [locality, setLocality] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [departmentId, setDepartmentId] = useState('');
  const [evidenceName, setEvidenceName] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await fetchDepartments();
        const depts = res.data || [];
        setDepartments(depts);
        if (depts.length > 0) {
          setDepartmentId(depts[0].id);
        }
      } catch (err) {
        console.warn('Failed to load departments list:', err.message);
      } finally {
        setLoadingDepts(false);
      }
    }
    loadDepts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate click
    setError(null);

    // Client-side Validation
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedDistrict = district.trim();
    const trimmedLocality = locality.trim();
    const trimmedEvidence = evidenceName.trim();

    if (!trimmedTitle || trimmedTitle.length < 3) {
      setError('Complaint title must be at least 3 characters long.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setError('Complaint title cannot exceed 200 characters.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setError('Please provide a detailed grievance description (minimum 10 characters).');
      return;
    }
    if (trimmedDesc.length > 3000) {
      setError('Description cannot exceed 3000 characters.');
      return;
    }
    if (!state.trim() || !trimmedDistrict) {
      setError('Please provide both State and District.');
      return;
    }
    if (trimmedEvidence && !/^[\w\-.\s]{1,255}$/.test(trimmedEvidence)) {
      setError('Evidence attachment reference contains invalid characters. Do not use directory slashes (../ or \\).');
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        title: trimmedTitle,
        description: trimmedDesc,
        category,
        state,
        district: trimmedDistrict,
        locality: trimmedLocality || undefined,
        preferredLanguage,
        departmentId: departmentId || undefined,
        evidence: trimmedEvidence ? [trimmedEvidence] : []
      };

      const res = await createComplaint(payload, idempotencyKey);
      setSuccessResult(res.data);
    } catch (err) {
      setError(err.message || 'Failed to submit grievance. Please verify fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success Confirmation Screen
  if (successResult) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-md space-y-6 my-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 size={36} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Grievance Successfully Registered
          </h2>
          <p className="text-sm text-slate-600">
            Your complaint has been safely recorded in CivicSarthi and assigned an official tracking reference.
          </p>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block">
            Official Grievance Reference
          </span>
          <div className="text-3xl font-mono font-extrabold text-blue-700 tracking-wider">
            {successResult.referenceNumber || successResult.id}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              Status: SUBMITTED
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
              Priority: MEDIUM
            </span>
          </div>
          {successResult.statusDescription && (
            <p className="text-xs text-slate-600 pt-1 italic max-w-md mx-auto">
              "{successResult.statusDescription}"
            </p>
          )}
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1.5">
          <span className="font-bold flex items-center gap-1.5 text-amber-950">
            <HelpCircle size={15} />
            What happens next?
          </span>
          <p className="text-slate-700 leading-relaxed">
            Your grievance is now pending triage by the nodal grievance coordinator. You can track live updates using your tracking reference at any time without logging in, or manage your full filing history from your Citizen Dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to={`/citizen/track/${encodeURIComponent(successResult.referenceNumber || successResult.id)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            <span>Track Progress</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            to={`/citizen/complaints/${encodeURIComponent(successResult.id)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <span>View Full Grievance</span>
          </Link>
          <Link
            to="/citizen/complaints"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <span>My Complaints</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FilePlus size={24} className="text-blue-600" />
            Lodge a Civic Grievance
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Provide the details below to register your public grievance for departmental redressal.
          </p>
        </div>
        <Link
          to="/citizen"
          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          Cancel & Return
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="complaint-title" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Complaint Subject / Title <span className="text-rose-600">*</span>
          </label>
          <input
            id="complaint-title"
            type="text"
            required
            placeholder="e.g. Broken water pipeline causing flooding in Sector 4"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
          />
          <p className="text-[11px] text-slate-400">Brief 3-200 character summary of the issue.</p>
        </div>

        {/* Category & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="complaint-category" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Civic Category <span className="text-rose-600">*</span>
            </label>
            <select
              id="complaint-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complaint-department" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Department Assignment
            </label>
            <select
              id="complaint-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={loadingDepts || submitting}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700 disabled:opacity-60"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Assigned automatically; nodal officers can route appropriately during triage.
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="complaint-description" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Detailed Grievance Narrative <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="complaint-description"
            required
            rows={5}
            placeholder="Describe the problem, exact street, locality, landmark, duration of the issue, and impact on residents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed disabled:opacity-60"
          ></textarea>
          <p className="text-[11px] text-slate-400">Minimum 10 characters, maximum 3000 characters.</p>
        </div>

        {/* Location Details */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Incident Location Information
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="complaint-state" className="block text-[11px] font-semibold text-slate-600 mb-1">State *</label>
              <select
                id="complaint-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="complaint-district" className="block text-[11px] font-semibold text-slate-600 mb-1">District *</label>
              <input
                id="complaint-district"
                type="text"
                required
                placeholder="e.g. Pune"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="complaint-locality" className="block text-[11px] font-semibold text-slate-600 mb-1">Locality / Landmark</label>
              <input
                id="complaint-locality"
                type="text"
                placeholder="e.g. Ward 4, Near Water Tank"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Supporting Evidence and Preferences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="complaint-evidence" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Attached Evidence Citation (Optional)
            </label>
            <div className="relative">
              <Paperclip size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                id="complaint-evidence"
                type="text"
                placeholder="e.g. photo_pipeline_leak_2026.jpg"
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
                disabled={submitting}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Safe document reference or photo filename for investigation record.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complaint-language" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Preferred Language
            </label>
            <select
              id="complaint-language"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
            </select>
          </div>
        </div>

        {/* Submit Button & Guard */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Initial Status is recorded as <span className="font-semibold text-slate-800">SUBMITTED</span>.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Send size={14} className={submitting ? 'animate-spin' : ''} />
            <span>{submitting ? 'Registering Grievance with CivicSarthi...' : 'Submit Grievance'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
