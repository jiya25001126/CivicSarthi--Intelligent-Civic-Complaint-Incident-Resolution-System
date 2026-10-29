import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, MapPin, X } from 'lucide-react';

const DEFAULT_CENTER = [18.5204, 73.8567]; // Pune, Maharashtra (Default CivicSarthi jurisdiction)
const DEFAULT_ZOOM = 13;

function createMarkerIcon(isReadOnly) {
  return L.divIcon({
    className: 'civicsarthi-map-marker',
    html: `<div style="
      background: #2563eb;
      width: 26px;
      height: 26px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ${isReadOnly ? 'default' : 'grab'};
    ">
      <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26]
  });
}

/**
 * Interactive Leaflet Location Picker & Viewer Map for CivicSarthi.
 * - Supports map-click selection and draggable marker in edit mode (citizen).
 * - Supports strictly read-only inspection with fixed marker in officer mode.
 * - Graceful fallback if tile requests fail.
 * - Strict single-instance lifecycle management to prevent duplicate map errors.
 */
export default function LocationPickerMap({
  coordinates,
  onLocationSelect = () => {},
  onClear = () => {},
  lang = 'en',
  disabled = false,
  readOnly = false
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [tileError, setTileError] = useState(false);

  // Keep a mutable ref to the latest props to avoid stale closures in Leaflet event listeners
  const propsRef = useRef({ disabled, readOnly, onLocationSelect });
  propsRef.current = { disabled, readOnly, onLocationSelect };

  function bindMarkerDrag(marker) {
    marker.on('dragend', (e) => {
      if (propsRef.current.disabled || propsRef.current.readOnly) return;
      const pos = e.target.getLatLng();
      propsRef.current.onLocationSelect({
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6))
      });
    });
  }

  // Initialize Leaflet map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'
      ? [coordinates.lat, coordinates.lng]
      : DEFAULT_CENTER;
    const initialZoom = coordinates ? 15 : DEFAULT_ZOOM;

    let map;
    try {
      map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true
      });
      mapRef.current = map;

      // OpenStreetMap standard tile layer with visible attribution
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      });

      tileLayer.on('tileerror', () => {
        setTileError(true);
      });

      tileLayer.addTo(map);

      // Click on map to select/move location (always checks latest propsRef to prevent stale closure)
      map.on('click', (e) => {
        if (propsRef.current.disabled || propsRef.current.readOnly) return;
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        propsRef.current.onLocationSelect({ lat, lng });
      });

      // Handle initial marker if coordinates were already set
      if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
        const marker = L.marker([coordinates.lat, coordinates.lng], {
          icon: createMarkerIcon(readOnly),
          draggable: !disabled && !readOnly
        }).addTo(map);

        bindMarkerDrag(marker);
        markerRef.current = marker;
      }
    } catch (err) {
      console.warn('Leaflet map initialization warning:', err.message);
    }

    // Auto-resize observer to handle dynamic layout and container rendering
    let resizeObserver;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sync marker position and map center when coordinates change from external source (GPS, manual input, or complaint switch)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
      const latLng = [coordinates.lat, coordinates.lng];

      if (markerRef.current) {
        markerRef.current.setLatLng(latLng);
        // Synchronize draggability and cursor icon when disabled or readOnly prop changes on an already-mounted marker
        if (disabled || readOnly) {
          markerRef.current.dragging?.disable();
          markerRef.current.setIcon(createMarkerIcon(true));
        } else {
          markerRef.current.dragging?.enable();
          markerRef.current.setIcon(createMarkerIcon(false));
        }
      } else {
        const marker = L.marker(latLng, {
          icon: createMarkerIcon(readOnly),
          draggable: !disabled && !readOnly
        }).addTo(map);

        bindMarkerDrag(marker);
        markerRef.current = marker;
      }

      // Smooth pan to new location if far from current center
      try {
        const center = map.getCenter();
        const dist = map.distance(center, latLng);
        if (dist > 50) {
          map.setView(latLng, Math.max(map.getZoom(), 14));
        }
      } catch {}
    } else {
      // Coordinates cleared: remove marker
      if (markerRef.current) {
        try {
          map.removeLayer(markerRef.current);
        } catch {}
        markerRef.current = null;
      }
    }
  }, [coordinates, disabled, readOnly]);

  return (
    <div className="space-y-1.5">
      <div className="relative w-full h-64 sm:h-72 rounded-lg border border-slate-300 overflow-hidden shadow-inner bg-slate-100 z-0">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '16rem' }}
          aria-label={
            readOnly
              ? (lang === 'hi' ? 'शिकायत का सहेजा गया स्थान' : 'Saved complaint location map')
              : (lang === 'hi' ? 'इंटरैक्टिव शिकायत स्थान मानचित्र' : 'Interactive complaint location map')
          }
        />

        {/* Graceful fallback banner if tile loading fails */}
        {tileError && (
          <div className="absolute top-2 left-2 right-2 bg-amber-50/95 border border-amber-300 text-amber-800 text-[11px] px-2.5 py-1.5 rounded shadow z-[500] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={13} className="shrink-0 text-amber-600" />
              <span>
                {lang === 'hi'
                  ? 'मानचित्र टाइलें लोड नहीं हो सकीं। आप अभी भी निर्देशांक देख सकते हैं।'
                  : 'Map tiles could not be loaded. Location coordinates remain visible and intact.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTileError(false)}
              className="text-amber-700 hover:text-amber-900 ml-2"
              aria-label="Dismiss warning"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 px-0.5">
        {readOnly ? (
          <span className="flex items-center gap-1 text-slate-600">
            <MapPin size={11} className="text-blue-600 shrink-0" />
            <span>
              {lang === 'hi' ? 'सहेजा गया स्थान (केवल पढ़ने योग्य):' : 'Saved complaint location (read-only):'}{' '}
              {coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number' ? (
                <strong className="font-mono text-slate-900">{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</strong>
              ) : (
                <span className="italic">{lang === 'hi' ? 'उपलब्ध नहीं है' : 'Not available'}</span>
              )}
            </span>
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-blue-600 shrink-0" />
              {lang === 'hi'
                ? 'मानचित्र पर क्लिक करें या मार्कर खींचकर स्थान बदलें'
                : 'Click on the map or drag the marker to adjust location'}
            </span>
            {coordinates && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="text-rose-600 hover:text-rose-700 font-medium underline transition"
              >
                {lang === 'hi' ? 'स्थान हटाएं' : 'Clear Location'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
