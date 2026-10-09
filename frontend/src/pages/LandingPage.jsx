import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchComplaintStats } from '../api/client';
import {
  FilePlus,
  Search,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  Languages,
  Info
} from 'lucide-react';

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetchComplaintStats();
        setStats(res.data);
      } catch (err) {
        console.warn('Could not load landing stats:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-2xl p-8 sm:p-12 shadow-xl border border-slate-700">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            Civic Tech Hackathon Prototype
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            JanSahay
            <span className="block text-blue-400 text-2xl sm:text-3xl font-semibold mt-1">
              From Complaint to Resolution
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            JanSahay: AI-assisted grievance resolution layer for CPGRAMS. Designed to augment existing public grievance portals with intelligent decision-support, cross-department coordination, and transparent citizen communication.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/citizen"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition"
            >
              <span>Citizen Portal</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/citizen/submit"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition"
            >
              <FilePlus size={16} />
              <span>Submit Complaint</span>
            </Link>

            <Link
              to="/citizen/track"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-600 transition"
            >
              <Search size={16} />
              <span>Track Complaint</span>
            </Link>

            <Link
              to="/officer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-blue-300 font-medium text-sm border border-slate-700 transition"
            >
              <ShieldCheck size={16} />
              <span>Officer Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Disclaimer Callout Box */}
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-3">
          <Info size={18} className="shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Important Prototype Notice:</span>{' '}
            JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS. This platform operates entirely on synthetic demonstration data and does not submit complaints to official government systems.
          </div>
        </div>
      </div>

      {/* Live System Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Tracked</span>
            <Activity size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : (stats?.total ?? 18)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Synthetic grievance cases</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">In Progress / Assigned</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {loading ? '...' : (stats?.inProgress ?? 8)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Under active officer triage</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Resolved</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {loading ? '...' : (stats?.resolved ?? 3)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Completed resolution cycles</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Departments Active</span>
            <Building2 size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">11</div>
          <p className="text-[11px] text-slate-500 mt-1">Configured demo departments</p>
        </div>
      </div>

      {/* Platform Pillars */}
      <div>
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            How JanSahay Augments Existing Systems
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Bridging the gap between bureaucratic workflows and citizen reassurance without requiring a rip-and-replace of national infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Multi-Agency Incident Clustering</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When disaster strikes (e.g. urban flooding), multiple citizens submit complaints touching roads, water, power, and healthcare. JanSahay groups related complaints under synchronized composite incident roots.
            </p>
            <Link to="/incident" className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
              <span>View Incident Concept</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Neglect Radar & Loop Detection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Detects departmental ping-pong loops where grievances bounce between offices (&ge; 2 reassignments) or remain untouched for over 7 days, alerting senior supervisory officers proactively.
            </p>
            <Link to="/neglect-radar" className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold hover:underline">
              <span>View Neglect Radar</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Languages size={20} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Citizen Plain Language Translation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Translates opaque bureaucratic notices like "FORWARDED_TO_SUBORDINATE_OFFICE" into clear, empathetic plain-language updates in local regional languages with realistic next steps.
            </p>
            <Link to="/status-translator" className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:underline">
              <span>View Status Translator</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
