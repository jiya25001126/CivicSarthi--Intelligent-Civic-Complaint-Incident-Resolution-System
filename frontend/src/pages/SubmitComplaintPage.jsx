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
  Paperclip
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
  const [contactInfo, setContactInfo] = useState('');

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
    setError(null);

    // Validation
    if (!title.trim() || title.length < 3) {
      setError('Complaint title must be at least 3 characters long.');
      return;
    }
    if (!description.trim() || description.length < 10) {
      setError('Please provide a detailed description (minimum 10 characters).');
      return;
    }
    if (!state.trim() || !district.trim()) {
      setError('Please provide both State and District.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        state,
        district: district.trim(),
        locality: locality.trim(),
        preferredLanguage,
        departmentId: departmentId || undefined,
        evidence: evidenceName.trim() ? [evidenceName.trim()] : []
      };

      const res = await createComplaint(payload);
      setSuccessResult(res.data);
    } catch (err) {
      setError(err.message);
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
            Your complaint has been logged in the CivicSarthi demonstration coordination registry.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Generated Unique Reference Number
          </span>
          <div className="text-3xl font-mono font-extrabold text-blue-700 tracking-wider">
            {successResult.referenceNumber}
          </div>
          <p className="text-[11px] text-slate-500">
            Initial Status: <span className="font-semibold text-slate-700">SUBMITTED</span> &bull; Default Priority: <span className="font-semibold text-slate-700">MEDIUM (Provisional)</span>
          </p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-amber-900">
            <HelpCircle size={14} />
            Next Step in Workflow
          </span>
          <p>
            Your grievance is now visible in your <span className="font-semibold">My Complaints</span> dashboard and in the <span className="font-semibold">Officer Triage Cockpit</span> for departmental review.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to={`/citizen/track/${encodeURIComponent(successResult.referenceNumber)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            <span>Track Progress</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/citizen/complaints"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <span>View All My Complaints</span>
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
            Fill in the details below to register a public complaint for departmental attention.
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
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Complaint Subject / Title <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Broken water supply pipe causing flooding in Sector 4"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Category & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Civic Category <span className="text-rose-600">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Provisional Department Assignment
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={loadingDepts}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Assigned as a demo default; official officers can reassign if needed.
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Detailed Grievance Narrative <span className="text-rose-600">*</span>
          </label>
          <textarea
            required
            rows={5}
            placeholder="Describe the issue, exact street or landmark location, when it started, and impact on residents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
          ></textarea>
        </div>

        {/* Location Details */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Location Information
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">State *</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">District *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pune"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Locality / Landmark</label>
              <input
                type="text"
                placeholder="e.g. Ward 4, Near Water Tank"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Supporting Evidence and Preferences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Attached Evidence Citation (Optional)
            </label>
            <div className="relative">
              <Paperclip size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. photo_pipeline_leak_synth.jpg"
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Synthetic reference file/photo name for demo tracking.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Preferred Language
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Initial Status will be recorded as <span className="font-semibold text-slate-700">SUBMITTED</span>.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Send size={14} className={submitting ? 'animate-pulse' : ''} />
            {submitting ? 'Lodging Complaint...' : 'Submit Grievance'}
          </button>
        </div>
      </form>
    </div>
  );
}
