import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Shield, User, Mail, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t, lang } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage(
        lang === 'hi'
          ? 'कृपया पंजीकरण के सभी आवश्यक फ़ील्ड भरें।'
          : 'Please fill in all required registration fields.'
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        lang === 'hi'
          ? 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।'
          : 'Password must be at least 8 characters in length.'
      );
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage(
        lang === 'hi'
          ? 'पासवर्ड में कम से कम एक अक्षर और एक अंक होना अनिवार्य है।'
          : 'Password must contain at least one letter and one number.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        lang === 'hi'
          ? 'पासवर्ड मेल नहीं खाते। कृपया अपना पासवर्ड पुनः दर्ज करें।'
          : 'Passwords do not match. Please re-enter your password.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/citizen', { replace: true });
    } catch (err) {
      const rawMsg = err.message || '';
      let localized = rawMsg;
      if (lang === 'hi') {
        if (/already exists|duplicate/i.test(rawMsg)) {
          localized = 'यह ईमेल पता पहले से पंजीकृत है। कृपया लॉगिन करें।';
        } else if (/weak|invalid password/i.test(rawMsg)) {
          localized = 'अमान्य पासवर्ड। कृपया नियमों का पालन करें।';
        } else {
          localized = `पंजीकरण विफल: ${rawMsg}`;
        }
      }
      setErrorMessage(localized || (lang === 'hi' ? 'पंजीकरण विफल। कृपया अपनी जानकारी की जांच करें।' : 'Registration failed. Please check your information and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center border-b-4 border-blue-600">
          <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-white text-2xl mx-auto mb-3 shadow">
            CS
          </div>
          <h1 className="text-xl font-bold tracking-tight">{t('auth.registerTitle')}</h1>
          <p className="text-xs text-blue-200 mt-1">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">{lang === 'hi' ? 'पंजीकरण त्रुटि' : 'Registration Issue'}</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('auth.fullNameLabel')} <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-name"
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.fullNamePlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('auth.emailLabel')} <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-email"
                  type="email"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('auth.passwordLabel')} <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-password"
                  type="password"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang === 'hi' ? 'कम से कम 8 अक्षर, जिसमें अक्षर और अंक हों' : 'Minimum 8 characters with letter & number'}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="new-password"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {t('auth.passwordRuleText')}
              </p>
            </div>

            <div>
              <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('auth.confirmPasswordLabel')} <span className="text-rose-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-confirm-password"
                  type="password"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs tracking-wide text-white flex items-center justify-center gap-2 transition ${
                submitting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
              }`}
            >
              {submitting ? (
                <>{t('auth.creatingAccount')}</>
              ) : (
                <>
                  {t('auth.registerButton')} <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-800 underline">
                {t('auth.signInHere')}
              </Link>
            </p>
          </div>

          {/* RBAC Notice */}
          <div className="mt-5 p-3 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-amber-900">
              <Shield size={12} className="text-amber-700" />
              {t('auth.publicRegistrationPolicy')}
            </p>
            <p>
              {t('auth.registrationPolicyText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
