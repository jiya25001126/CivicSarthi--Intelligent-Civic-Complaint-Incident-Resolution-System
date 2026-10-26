import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createComplaint, fetchDepartments, analyzeGrievancePreview, uploadAttachment } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
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
  ExternalLink,
  Sparkles,
  Copy,
  Info,
  UploadCloud,
  X,
  Image as ImageIcon,
  Trash2
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
  const { t, lang, tStatus, tPriority, tCategory, tDepartment } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('roads');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune');
  const [locality, setLocality] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(lang || 'en');
  const [departmentId, setDepartmentId] = useState('');
  const [evidenceName, setEvidenceName] = useState('');

  // Photo Attachment State
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // AI Assistant preview state
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

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

  // Debounced AI intelligence analysis
  useEffect(() => {
    const textToAnalyze = `${title} ${description}`.trim();
    if (textToAnalyze.length < 15) {
      setAiSuggestion(null);
      setAiApplied(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setAnalyzingAi(true);
        const res = await analyzeGrievancePreview({
          title,
          description,
          category,
          district,
          locality
        });
        if (res && res.data) {
          setAiSuggestion(res.data);
        }
      } catch (err) {
        // Non-blocking failure - do not disrupt citizen filing
        console.info('AI assistant preview unavailable:', err.message);
      } finally {
        setAnalyzingAi(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [title, description, district, locality]);

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion?.classification) return;
    const recCategory = aiSuggestion.classification.category;
    const recDeptId = aiSuggestion.classification.departmentId;

    if (recCategory && CATEGORIES.some((c) => c.value === recCategory)) {
      setCategory(recCategory);
    }
    if (recDeptId && departments.some((d) => d.id === recDeptId)) {
      setDepartmentId(recDeptId);
    }
    setAiApplied(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    // Validate size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError(lang === 'hi' ? 'फ़ाइल का आकार 5MB की सीमा से अधिक है। कृपया 5MB से कम आकार की फ़ोटो चुनें।' : 'File size exceeds 5MB limit. Please select a photo under 5MB.');
      return;
    }

    // Validate MIME type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setFileError(lang === 'hi' ? 'अमान्य फ़ाइल प्रारूप। अनुमत प्रारूप: JPEG, PNG, WebP।' : 'Invalid file format. Allowed formats: JPEG, PNG, WebP.');
      return;
    }

    setSelectedFile(file);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  };

  const handleRemoveFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
  };

  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

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
      setError(lang === 'hi' ? 'शिकायत का शीर्षक कम से कम 3 अक्षर लंबा होना चाहिए।' : 'Complaint title must be at least 3 characters long.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setError(lang === 'hi' ? 'शिकायत का शीर्षक 200 अक्षरों से अधिक नहीं हो सकता।' : 'Complaint title cannot exceed 200 characters.');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      setError(lang === 'hi' ? 'कृपया विस्तृत शिकायत विवरण प्रदान करें (न्यूनतम 10 अक्षर)।' : 'Please provide a detailed grievance description (minimum 10 characters).');
      return;
    }
    if (trimmedDesc.length > 3000) {
      setError(lang === 'hi' ? 'विवरण 3000 अक्षरों से अधिक नहीं हो सकता।' : 'Description cannot exceed 3000 characters.');
      return;
    }
    if (!state.trim() || !trimmedDistrict) {
      setError(lang === 'hi' ? 'कृपया राज्य और जिला दोनों प्रदान करें।' : 'Please provide both State and District.');
      return;
    }
    if (trimmedEvidence && !/^[\w\-.\s]{1,255}$/.test(trimmedEvidence)) {
      setError(lang === 'hi' ? 'साक्ष्य संदर्भ में अमान्य वर्ण हैं। निर्देशिका स्लैश (../ या \\) का उपयोग न करें।' : 'Evidence attachment reference contains invalid characters. Do not use directory slashes (../ or \\).');
      return;
    }

    try {
      setSubmitting(true);
      let evidenceList = [];

      // If a photo file was selected, upload it first
      if (selectedFile) {
        setUploadingFile(true);
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            const base64String = typeof result === 'string' && result.includes(',')
              ? result.split(',')[1]
              : result;
            resolve(base64String);
          };
          reader.onerror = () => reject(new Error('Failed to read selected image file.'));
          reader.readAsDataURL(selectedFile);
        });

        const uploadRes = await uploadAttachment({
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          base64Data
        });

        if (uploadRes?.data?.filename) {
          evidenceList.push(uploadRes.data.filename);
        } else {
          throw new Error('Upload succeeded but server did not return a valid attachment reference.');
        }
      } else if (trimmedEvidence) {
        evidenceList.push(trimmedEvidence);
      }

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
        evidence: evidenceList
      };

      const res = await createComplaint(payload, idempotencyKey);
      setSuccessResult(res.data);
    } catch (err) {
      setError(err.message || 'Failed to submit grievance. Please verify fields and try again.');
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
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
            {t('submitComplaint.successTitle')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('submitComplaint.successSubtitle')}
          </p>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block">
            {t('submitComplaint.successRefTitle')}
          </span>
          <div className="text-3xl font-mono font-extrabold text-blue-700 tracking-wider">
            {successResult.referenceNumber || successResult.id}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              {t('common.status')}: {tStatus('SUBMITTED')}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
              {t('common.priority')}: {tPriority('MEDIUM')}
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
            {t('submitComplaint.whatHappensNext')}
          </span>
          <p className="text-slate-700 leading-relaxed">
            {t('submitComplaint.nextStepsText')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to={`/citizen/track/${encodeURIComponent(successResult.referenceNumber || successResult.id)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            <span>{t('submitComplaint.trackNowBtn')}</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            to={`/citizen/complaints/${encodeURIComponent(successResult.id)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <span>{t('submitComplaint.viewFullGrievance')}</span>
          </Link>
          <Link
            to="/citizen/complaints"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <span>{t('myComplaints')}</span>
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
            {t('submitComplaint.title')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('submitComplaint.subtitle')}
          </p>
        </div>
        <Link
          to="/citizen"
          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          {t('submitComplaint.cancelReturn')}
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center gap-3 text-sm"
        >
          <AlertCircle size={20} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="complaint-title" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            {t('submitComplaint.formTitle')} <span className="text-rose-600">*</span>
          </label>
          <input
            id="complaint-title"
            type="text"
            required
            placeholder={t('submitComplaint.formTitlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
          />
          <p className="text-[11px] text-slate-400">{t('submitComplaint.titleHelper')}</p>
        </div>

        {/* AI Assistant Category & Duplicate Intelligence Strip */}
        {(analyzingAi || aiSuggestion) && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                <Sparkles size={16} className="text-blue-600 animate-pulse" />
                <span>{t('submitComplaint.aiBannerTitle')}</span>
              </div>
              {analyzingAi ? (
                <span className="text-[11px] text-blue-600 font-medium animate-pulse">
                  {t('submitComplaint.analyzingAi')}
                </span>
              ) : aiSuggestion?.classification?.confidence ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-200 text-blue-900 font-semibold">
                  {t('submitComplaint.aiConfidence', { score: Math.round(aiSuggestion.classification.confidence * 100) })}
                </span>
              ) : null}
            </div>

            {aiSuggestion?.classification && (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500">{t('submitComplaint.recommendedCategory')} </span>
                    <span className="font-bold text-slate-900 capitalize">
                      {tCategory(aiSuggestion.classification.category)}
                    </span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-slate-500">{t('common.department')}: </span>
                    <span className="font-bold text-slate-900">
                      {tDepartment(aiSuggestion.classification.departmentName)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAiSuggestion}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
                      aiApplied || category === aiSuggestion.classification.category
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Sparkles size={12} />
                    <span>
                      {aiApplied || category === aiSuggestion.classification.category
                        ? t('submitComplaint.aiApplied')
                        : t('submitComplaint.applyRecommendation')}
                    </span>
                  </button>
                </div>

                {aiSuggestion.classification.explanation && (
                  <p className="text-[11px] text-slate-600 italic">
                    {t('submitComplaint.reason')} {aiSuggestion.classification.explanation}
                  </p>
                )}
              </div>
            )}

            {/* Non-blocking Duplicate Advisory */}
            {aiSuggestion?.potentialDuplicates && aiSuggestion.potentialDuplicates.length > 0 && (
              <div className="pt-2 border-t border-blue-200/80 text-[11px] text-amber-900 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 flex items-start gap-2">
                <Info size={14} className="shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">
                    {t('submitComplaint.similarAdvisory', { count: aiSuggestion.potentialDuplicates.length })}
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {t('submitComplaint.similarAdvisoryText')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="complaint-category" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              {t('submitComplaint.categoryLabel')} <span className="text-rose-600">*</span>
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
                  {tCategory(cat.value)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complaint-department" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              {t('submitComplaint.departmentLabel')}
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
                  {tDepartment(d.name || d.id)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              {t('submitComplaint.deptAutoSelectNote')}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="complaint-description" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            {t('submitComplaint.descriptionLabel')} <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="complaint-description"
            required
            rows={5}
            placeholder={t('submitComplaint.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed disabled:opacity-60"
          ></textarea>
          <p className="text-[11px] text-slate-400">{t('submitComplaint.descHelper')}</p>
        </div>

        {/* Location Details */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            {t('submitComplaint.locationHeading')}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="complaint-state" className="block text-[11px] font-semibold text-slate-600 mb-1">{t('submitComplaint.stateLabel')} *</label>
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
              <label htmlFor="complaint-district" className="block text-[11px] font-semibold text-slate-600 mb-1">{t('submitComplaint.districtLabel')} *</label>
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
              <label htmlFor="complaint-locality" className="block text-[11px] font-semibold text-slate-600 mb-1">{t('submitComplaint.localityLabel')}</label>
              <input
                id="complaint-locality"
                type="text"
                placeholder={t('submitComplaint.localityPlaceholder')}
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Supporting Evidence and Preferences */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                {t('submitComplaint.attachmentHeading')}
              </label>
              <span className="text-[11px] text-slate-500">{t('submitComplaint.attachmentDesc')}</span>
            </div>

            {/* File Upload / Preview Area */}
            {selectedFile && filePreview ? (
              <div className="flex items-center gap-4 p-3 bg-white border border-emerald-200 rounded-xl shadow-xs">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img
                    src={filePreview}
                    alt="Evidence Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                      {t('submitComplaint.ready')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={submitting}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                  title={t('submitComplaint.removePhoto')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="complaint-photo-input"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 rounded-xl p-5 cursor-pointer transition text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-2 transition">
                    <UploadCloud size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">
                    {t('submitComplaint.dragDropPrompt')}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    {t('submitComplaint.attachmentDesc')}
                  </span>
                  <input
                    id="complaint-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={submitting}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {fileError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <AlertCircle size={14} className="shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Optional text reference */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
              <Paperclip size={14} className="text-slate-400 shrink-0" />
              <input
                id="complaint-evidence"
                type="text"
                placeholder={t('submitComplaint.evidenceIdPlaceholder')}
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
                disabled={submitting || Boolean(selectedFile)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complaint-language" className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              {t('submitComplaint.preferredLangLabel')}
            </label>
            <select
              id="complaint-language"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
            >
              <option value="en">{t('submitComplaint.langEn')}</option>
              <option value="hi">{t('submitComplaint.langHi')}</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>
        </div>

        {/* Submit Button & Guard */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            {t('submitComplaint.initialStatusNote')}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Send size={14} className={submitting ? 'animate-spin' : ''} />
            <span>{submitting ? t('submitComplaint.submittingBtn') : t('submitComplaint.submitBtn')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
