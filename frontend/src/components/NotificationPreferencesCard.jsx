import React, { useEffect, useState } from 'react';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  fetchNotificationLogs
} from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ShieldCheck,
  Send,
  History,
  Sliders,
  Sparkles,
  Check
} from 'lucide-react';

export default function NotificationPreferencesCard() {
  const { user, updateUser } = useAuth() || {};
  const { lang, formatDate } = useLanguage();

  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'history'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Preference fields
  const [enabled, setEnabled] = useState(true);
  const [smsOptOut, setSmsOptOut] = useState(false);
  const [whatsappOptOut, setWhatsappOptOut] = useState(false);
  const [preferredChannel, setPreferredChannel] = useState('both');
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');

  // Synchronize phone from user profile when auth context finishes loading
  useEffect(() => {
    const userPhone = user?.phone || user?.phoneNumber;
    if (userPhone && !phone) {
      setPhone(userPhone);
    }
  }, [user]);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await fetchNotificationPreferences();
      if (res?.data) {
        const prefs = res.data.preferences || {};
        setEnabled(prefs.enabled !== false);
        setSmsOptOut(Boolean(prefs.smsOptOut));
        setWhatsappOptOut(Boolean(prefs.whatsappOptOut));
        setPreferredChannel(prefs.preferredChannel || 'both');
        if (res.data.phone) {
          setPhone(res.data.phone);
        } else if (user?.phone || user?.phoneNumber) {
          setPhone(user.phone || user.phoneNumber);
        }
        if (updateUser && (res.data.phone || res.data.preferences)) {
          updateUser({
            phone: res.data.phone || user?.phone,
            phoneNumber: res.data.phone || user?.phoneNumber,
            notificationPreferences: res.data.preferences || user?.notificationPreferences
          });
        }
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || (lang === 'hi' ? 'सूचना प्राथमिकताएं लोड करने में विफल।' : 'Failed to load notification preferences.')
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const res = await fetchNotificationLogs({ _t: Date.now() });
      setLogs(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setLogsError(err.message || (lang === 'hi' ? 'सूचना इतिहास लोड करने में विफल।' : 'Failed to load notification delivery logs.'));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      loadLogs();
    }
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        enabled,
        smsOptOut,
        whatsappOptOut,
        preferredChannel
      };
      if (phone && phone.trim()) {
        payload.phone = phone.trim();
      }

      const res = await updateNotificationPreferences(payload);
      if (res?.data) {
        if (res.data.preferences) {
          const prefs = res.data.preferences;
          setEnabled(prefs.enabled !== false);
          setSmsOptOut(Boolean(prefs.smsOptOut));
          setWhatsappOptOut(Boolean(prefs.whatsappOptOut));
          setPreferredChannel(prefs.preferredChannel || 'both');
        }
        if (res.data.phone) {
          setPhone(res.data.phone);
        } else if (user?.phone || user?.phoneNumber) {
          setPhone(user.phone || user.phoneNumber);
        }
        if (updateUser && (res.data.phone || res.data.preferences)) {
          updateUser({
            phone: res.data.phone || user?.phone,
            phoneNumber: res.data.phone || user?.phoneNumber,
            notificationPreferences: res.data.preferences || user?.notificationPreferences
          });
        }
      }
      setFeedback({
        type: 'success',
        text: res?.message || (lang === 'hi' ? 'आपकी सूचना प्राथमिकताएं सफलतापूर्वक सहेजी गईं!' : 'Your notification preferences have been saved successfully!')
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || (lang === 'hi' ? 'प्राथमिकताएं सहेजने में विफल।' : 'Failed to save notification preferences.')
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={11} className="text-emerald-600" />
            {lang === 'hi' ? 'सत्यापित वितरित' : 'Confirmed Delivered'}
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Send size={11} className="text-blue-600" />
            {lang === 'hi' ? 'गेटवे द्वारा प्रेषित' : 'Sent via Gateway'}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={11} className="text-amber-600" />
            {lang === 'hi' ? 'कतार में' : 'Queued for Dispatch'}
          </span>
        );
      case 'SKIPPED_OPT_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            {lang === 'hi' ? 'सहमति रोकी गई (ऑप्ट-आउट)' : 'Suppressed (Opt-Out)'}
          </span>
        );
      case 'DUPLICATE_SUPPRESSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            {lang === 'hi' ? 'डुप्लिकेट दबाया गया' : 'Duplicate Suppressed'}
          </span>
        );
      case 'SIMULATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200" title="Simulated dispatch using mock provider in development mode">
            <Sparkles size={11} className="text-purple-600" />
            {lang === 'hi' ? 'सिम्युलेटेड (मॉक मोड)' : 'Simulated (Mock Provider)'}
          </span>
        );
      case 'SKIPPED_INVALID_RECIPIENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle size={11} className="text-amber-600" />
            {lang === 'hi' ? 'छोड़ा गया (कोई संपर्क नंबर नहीं)' : 'Skipped (No Contact Number)'}
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle size={11} className="text-rose-600" />
            {lang === 'hi' ? 'वितरण विफल' : 'Delivery Failed'}
          </span>
        );
    }
  };

  const formatEventType = (ev) => {
    switch (ev) {
      case 'COMPLAINT_REGISTERED':
        return lang === 'hi' ? 'शिकायत दर्ज हुई' : 'Grievance Registered';
      case 'STATUS_CHANGED':
        return lang === 'hi' ? 'स्थिति अद्यतन' : 'Status Updated';
      case 'CLARIFICATION_REQUESTED':
        return lang === 'hi' ? 'स्पष्टीकरण अनुरोध' : 'Clarification Requested';
      case 'COMPLAINT_RESOLVED':
        return lang === 'hi' ? 'शिकायत निवारित' : 'Grievance Resolved';
      case 'CITIZEN_REGISTRATION':
        return lang === 'hi' ? 'खाता पंजीकरण' : 'Citizen Registration';
      default:
        return ev;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-500 space-y-2">
        <RefreshCw size={20} className="animate-spin mx-auto text-blue-600" />
        <p className="text-xs font-medium">
          {lang === 'hi' ? 'सूचना प्राथमिकताएं लोड हो रही हैं...' : 'Loading notification preferences...'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <Bell size={20} />
          </span>
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {lang === 'hi' ? 'नागरिक सूचना एवं अलर्ट प्राथमिकताएं' : 'Citizen Notification & Alert Preferences'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'hi'
                ? 'शिकायत की स्थिति, अधिकारी प्रतिक्रिया और समाधान अलर्ट के लिए SMS और WhatsApp चैनल प्रबंधित करें।'
                : 'Manage real-time SMS & WhatsApp alerts for grievance tracking, officer clarifications, and resolution updates.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabChange('settings')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders size={13} />
            <span>{lang === 'hi' ? 'प्राथमिकताएं' : 'Channels & Consent'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={13} />
            <span>{lang === 'hi' ? 'वितरण इतिहास' : 'Delivery Audit'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <Check size={14} className="text-emerald-600 shrink-0" /> : <AlertCircle size={14} className="text-rose-600 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: Channel Settings & Citizen Consent */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Global Master Switch */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">
                {lang === 'hi' ? 'मल्टी-चैनल सूचनाएं सक्रिय करें' : 'Enable Multi-Channel Grievance Alerts'}
              </span>
              <p className="text-[11px] text-slate-500">
                {lang === 'hi'
                  ? 'अक्षम होने पर सभी स्वचालित बाहरी SMS और WhatsApp संदेश तुरंत रोक दिए जाएंगे।'
                  : 'Master switch to allow or suppress all automated real-time dispatch events.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Granular Channel Controls (Enabled only if Master switch is on) */}
          <div className={`space-y-4 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SMS Channel Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                      <MessageSquare size={16} />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {lang === 'hi' ? 'SMS पाठ संदेश' : 'SMS Alerts'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {lang === 'hi' ? 'मानक सेल्युलर सूचना' : 'Standard cellular text dispatches'}
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!smsOptOut}
                      onChange={(e) => setSmsOptOut(!e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {smsOptOut
                    ? (lang === 'hi' ? '⚠️ SMS सूचनाओं से ऑप्ट-आउट किया गया है।' : '⚠️ SMS updates are currently opted-out.')
                    : (lang === 'hi' ? '✓ स्थिति परिवर्तन और संदर्भ संख्या पर तत्काल SMS प्राप्त होंगे।' : '✓ Receives reference codes and status updates on registered mobile.')}
                </p>
              </div>

              {/* WhatsApp Channel Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <Phone size={16} />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {lang === 'hi' ? 'WhatsApp संदेश' : 'WhatsApp Business Alerts'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {lang === 'hi' ? 'विस्तृत निवारण विवरण' : 'Rich messaging with resolution notes'}
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!whatsappOptOut}
                      onChange={(e) => setWhatsappOptOut(!e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {whatsappOptOut
                    ? (lang === 'hi' ? '⚠️ WhatsApp सूचनाओं से ऑप्ट-आउट किया गया है।' : '⚠️ WhatsApp updates are currently opted-out.')
                    : (lang === 'hi' ? '✓ विस्तृत अधिकारी टिप्पणियों के साथ WhatsApp संदेश प्राप्त होंगे।' : '✓ Receives rich grievance cards and remediation remarks via WhatsApp.')}
                </p>
              </div>
            </div>

            {/* Preferred Channel & Contact Phone Grid */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'प्राथमिक चैनल चयन *' : 'Preferred Dispatch Channel *'}
                </label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                >
                  <option value="both">{lang === 'hi' ? 'दोनों चैनल (SMS और WhatsApp)' : 'Both SMS & WhatsApp'}</option>
                  <option value="sms">{lang === 'hi' ? 'केवल SMS (SMS Only)' : 'SMS Only'}</option>
                  <option value="whatsapp">{lang === 'hi' ? 'केवल WhatsApp (WhatsApp Only)' : 'WhatsApp Only'}</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {lang === 'hi' ? 'महत्वपूर्ण अलर्ट्स के लिए अनुशंसित चैनल।' : 'Recommended dispatch method for high-priority alerts.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'hi' ? 'पंजीकृत मोबाइल नंबर' : 'Registered Mobile Contact Number'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {lang === 'hi' ? 'देश कोड सहित दर्ज करें (उदा. +91...)' : 'Include country code prefix (e.g. +91...)'}
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              {lang === 'hi' ? 'सूचना सहमति डिजिटल इंडिया एवं DPDP नियमों के अनुसार सुरक्षित है।' : 'Citizen consent is strictly audited under DPDP Act & TRAI guidelines.'}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>{lang === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>{lang === 'hi' ? 'प्राथमिकताएं सहेजें' : 'Save Preferences'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Delivery Audit Trail */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">
              {lang === 'hi' ? 'हालिया भेजे गए संदेश एवं वितरण स्थिति:' : 'Recent alerts dispatched for your grievances:'}
            </span>
            <button
              type="button"
              onClick={loadLogs}
              disabled={logsLoading}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} />
              <span>{lang === 'hi' ? 'ताज़ा करें' : 'Refresh Logs'}</span>
            </button>
          </div>

          {/* Provider Transparency Callout */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
            <ShieldCheck size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">
                {lang === 'hi' ? 'प्रणालीगत पारदर्शिता एवं गेटवे स्थिति' : 'System Transparency & Gateway Delivery Status'}
              </p>
              <p className="mt-0.5">
                {lang === 'hi'
                  ? 'वितरण स्थिति आधिकारिक सेल्युलर/WhatsApp गेटवे द्वारा रिपोर्ट की जाती है। विकास एवं परीक्षण मोड में सुरक्षा हेतु संदेश सुरक्षित रूप से सिम्युलेट किए जाते हैं। वास्तविक SMS प्रेषण के लिए वैध गेटवे क्रेडेंशियल्स (TWILIO_ACCOUNT_SID अथवा GENERIC_SMS_ENDPOINT) आवश्यक हैं।'
                  : 'Delivery states are tracked via real-time provider receipts. In mock or testing environments, dispatches are safely simulated without incurring cellular tariff costs. Real SMS transmission requires active gateway credentials (TWILIO_ACCOUNT_SID or GENERIC_SMS_ENDPOINT).'}
              </p>
            </div>
          </div>

          {logsLoading ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <RefreshCw size={18} className="animate-spin mx-auto text-blue-600" />
              <p className="text-xs">{lang === 'hi' ? 'ऑडिट लॉग प्राप्त हो रहे हैं...' : 'Retrieving delivery logs...'}</p>
            </div>
          ) : logsError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{logsError}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {lang === 'hi' ? 'कोई सूचना लॉग नहीं मिले' : 'No Notification History Found'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                {lang === 'hi'
                  ? 'जब आप नई शिकायत दर्ज करेंगे या स्थिति में बदलाव होगा, तो यहाँ संदेश ऑडिट उपलब्ध होगा।'
                  : 'Automated notification delivery logs will appear here when your grievances are registered, updated, or resolved.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">{lang === 'hi' ? 'चैनल' : 'Channel'}</th>
                      <th className="py-2.5 px-3">{lang === 'hi' ? 'घटना प्रकार' : 'Event'}</th>
                      <th className="py-2.5 px-3">{lang === 'hi' ? 'संदर्भ' : 'Reference'}</th>
                      <th className="py-2.5 px-3">{lang === 'hi' ? 'वितरण स्थिति' : 'Delivery Status'}</th>
                      <th className="py-2.5 px-3 text-right">{lang === 'hi' ? 'समय' : 'Timestamp'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 font-semibold uppercase text-[11px]">
                            {log.channel === 'whatsapp' ? (
                              <>
                                <Phone size={12} className="text-emerald-600" />
                                <span className="text-emerald-700">WhatsApp</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare size={12} className="text-sky-600" />
                                <span className="text-sky-700">SMS</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {formatEventType(log.eventType)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {log.complaintReference || log.complaintId || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {getStatusBadge(log.status)}
                          {log.error && (log.status === 'FAILED' || log.status === 'SKIPPED_INVALID_RECIPIENT' || log.status === 'SKIPPED_OPT_OUT') && (
                            <span className="block text-[10px] text-slate-500 mt-0.5 max-w-xs truncate" title={log.error}>
                              {log.error}
                            </span>
                          )}
                          {log.status === 'SIMULATED' && (
                            <span className="block text-[10px] text-purple-600 mt-0.5 max-w-xs truncate" title={log.providerMessageId ? `Mock ID: ${log.providerMessageId}` : 'Simulated local dispatch'}>
                              {lang === 'hi' ? 'विकास मोड में सिम्युलेटेड (मॉक गेटवे)' : 'Simulated via mock provider (dev mode)'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">
                          {formatDate(log.sentAt || log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
