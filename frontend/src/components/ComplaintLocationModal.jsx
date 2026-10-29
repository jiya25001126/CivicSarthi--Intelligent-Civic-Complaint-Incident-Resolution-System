import React, { useEffect } from 'react';
import LocationPickerMap from './LocationPickerMap';
import { MapPin, X, AlertCircle, Building2, Tag } from 'lucide-react';

/**
 * Validates whether an object contains finite, in-range WGS84 coordinates.
 */
export function isValidCoordinate(coords) {
  if (!coords || typeof coords !== 'object') return false;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  return (
    typeof coords.lat !== 'undefined' &&
    coords.lat !== null &&
    typeof coords.lng !== 'undefined' &&
    coords.lng !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Modal to display an authorized officer's read-only inspection of a complaint's saved coordinates.
 * - Handles Escape key to close.
 * - Displays reference number, category, and exact latitude/longitude.
 * - Cleans up Leaflet instance upon modal close.
 */
export default function ComplaintLocationModal({
  complaint,
  onClose,
  lang = 'en'
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!complaint) return null;

  const valid = isValidCoordinate(complaint.coordinates);
  const refNum = complaint.referenceNumber || complaint.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <MapPin size={18} />
            </div>
            <div>
              <h3 id="location-modal-title" className="text-sm font-bold text-slate-900">
                {lang === 'hi' ? 'शिकायत का सहेजा गया स्थान' : 'Saved Complaint Location'}
              </h3>
              <p className="text-xs font-mono text-slate-500">{refNum}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
            aria-label={lang === 'hi' ? 'बंद करें' : 'Close modal'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {complaint.category && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                <Tag size={11} className="text-slate-500" />
                <span className="capitalize">{complaint.category}</span>
              </span>
            )}
            {(complaint.departmentId || complaint.department) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                <Building2 size={11} className="text-slate-500" />
                <span>{complaint.departmentId || complaint.department}</span>
              </span>
            )}
          </div>

          {complaint.title && (
            <p className="text-xs font-semibold text-slate-800 line-clamp-2">
              {complaint.title || complaint.text}
            </p>
          )}

          {valid ? (
            <>
              {/* Coordinates Pill */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">
                    {lang === 'hi' ? 'जीपीएस निर्देशांक' : 'GPS Coordinates'}
                  </span>
                  <div className="font-mono text-xs text-blue-950 font-semibold">
                    {complaint.coordinates.lat.toFixed(6)}, {complaint.coordinates.lng.toFixed(6)}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                  {lang === 'hi' ? 'सत्यापित स्थान' : 'Verified Location'}
                </span>
              </div>

              {/* Read-Only Interactive Map */}
              <LocationPickerMap
                coordinates={{
                  lat: Number(complaint.coordinates.lat),
                  lng: Number(complaint.coordinates.lng)
                }}
                readOnly={true}
                lang={lang}
              />
            </>
          ) : (
            <div className="py-8 px-4 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <AlertCircle size={28} className="text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700">
                {lang === 'hi' ? 'स्थान प्रदान नहीं किया गया' : 'Location not provided'}
              </h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {lang === 'hi'
                  ? 'नागरिक ने शिकायत दर्ज करते समय कोई जीपीएस निर्देशांक संलग्न नहीं किए।'
                  : 'The citizen did not attach GPS coordinates when submitting this grievance.'}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition"
          >
            {lang === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
