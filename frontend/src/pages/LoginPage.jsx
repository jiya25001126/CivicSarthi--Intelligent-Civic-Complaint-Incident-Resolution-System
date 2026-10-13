import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const from = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email, password });
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'citizen') {
        navigate('/citizen', { replace: true });
      } else {
        navigate('/officer', { replace: true });
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center border-b-4 border-blue-600">
          <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-white text-2xl mx-auto mb-3 shadow">
            CS
          </div>
          <h1 className="text-xl font-bold tracking-tight">Sign In to CivicSarthi</h1>
          <p className="text-xs text-blue-200 mt-1">
            Access your grievance dashboard or nodal officer cockpit
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Authentication Notice</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="citizen@example.com or officer@dept.internal"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errorMessage)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  autoComplete="current-password"
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
                <>Verifying Identity...</>
              ) : (
                <>
                  Sign In <ArrowRight size={14} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Panel for Evaluation */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={13} className="text-blue-600" aria-hidden="true" />
                Quick Demo Credentials
              </span>
              <span className="text-[10px] text-slate-400 font-medium">1-Click Fill</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Select a persona below to populate pre-configured synthetic demonstration credentials:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEmail('citizen.demo@civicsarthi.internal');
                  setPassword('DemoUser@2026');
                  setErrorMessage('');
                }}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition text-[11px]"
              >
                <span className="font-semibold text-slate-800 block text-[11px]">👤 Demo Citizen</span>
                <span className="text-[10px] text-slate-500 block truncate">citizen.demo@civicsarthi.internal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('officer.roads@civicsarthi.internal');
                  setPassword('DemoUser@2026');
                  setErrorMessage('');
                }}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition text-[11px]"
              >
                <span className="font-semibold text-slate-800 block text-[11px]">🚧 Roads Officer</span>
                <span className="text-[10px] text-slate-500 block truncate">DEPT_ROADS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('officer.water@civicsarthi.internal');
                  setPassword('DemoUser@2026');
                  setErrorMessage('');
                }}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition text-[11px]"
              >
                <span className="font-semibold text-slate-800 block text-[11px]">💧 Water Officer</span>
                <span className="text-[10px] text-slate-500 block truncate">DEPT_WATER</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin.demo@civicsarthi.internal');
                  setPassword('DemoUser@2026');
                  setErrorMessage('');
                }}
                className="p-2 text-left rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition text-[11px]"
              >
                <span className="font-semibold text-slate-800 block text-[11px]">🛡️ System Admin</span>
                <span className="text-[10px] text-slate-500 block truncate">Full Platform Scope</span>
              </button>
            </div>
          </div>

          {/* Registration Prompt for Citizens */}
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Need to file a public complaint?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-800 underline">
                Register citizen account
              </Link>
            </p>
          </div>

          {/* System Security Notice */}
          <div className="mt-4 p-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield size={12} className="text-blue-600" />
              Role & Access Governance
            </p>
            <p>
              Citizens may self-register. Department nodal officers and system administrators are provisioned securely through backend administrative procedures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
