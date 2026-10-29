import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Mic, RotateCcw, Square } from 'lucide-react';
import { transcribeVoice } from '../api/client';

const LANGUAGE_CODE = 'hi';
const MAX_RECORDING_MS = 120000;

function transcriptFrom(response) {
  const body = response?.data ?? response;
  const candidates = [body?.transcript, body?.text, body?.data?.transcript, body?.data?.text,
    body?.result?.transcript, body?.pipelineResponse?.[0]?.output?.[0]?.source];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

export default function VoiceTranscription({ onTranscript, disabled = false }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const limitRef = useRef(null);
  const mountedRef = useRef(true);

  const release = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    window.clearInterval(timerRef.current);
    window.clearTimeout(limitRef.current);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      release();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  const upload = async (blob, mime) => {
    if (!blob.size) { setError('No audio was captured. Please record again.'); return; }
    setUploading(true);
    setError('');
    setStatus('Uploading audio and transcribing Hindi speech…');
    try {
      const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
      const form = new FormData();
      form.append('audio', new File([blob], `civicsarthi-voice.${ext}`, { type: mime || blob.type }));
      form.append('language', LANGUAGE_CODE);
      const result = await transcribeVoice(form);
      const text = transcriptFrom(result);
      if (!text) throw new Error('The server returned no transcript. Please try again.');
      if (!mountedRef.current) return;
      setTranscript(text);
      onTranscript?.(text);
      setStatus('Transcript ready. Review and edit it before submitting your complaint.');
    } catch (err) {
      if (mountedRef.current) { setError(err.message || 'Transcription failed. Please try again.'); setStatus(''); }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  const start = async () => {
    setError(''); setStatus(''); setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser. Use a recent browser over HTTPS.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { release(); setRecording(false); setError('Recording failed. Check your microphone and try again.'); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' });
        release();
        if (mountedRef.current) { setRecording(false); void upload(blob, recorder.mimeType || mime || blob.type); }
      };
      recorder.start(250); setRecording(true);
      setStatus('Recording in Hindi. Stop when you have finished speaking.');
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
      limitRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      release(); setRecording(false);
      const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(err?.name);
      setError(denied ? 'Microphone permission was denied. Allow microphone access in browser settings and try again.'
        : err?.name === 'NotFoundError' ? 'No microphone was found. Connect or enable a microphone.'
        : 'Could not start recording. Check microphone access and HTTPS.');
    }
  };

  const stop = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); };
  const editTranscript = (value) => { setTranscript(value); onTranscript?.(value); };

  return <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-label="Hindi voice input">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Mic size={20} /></div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-slate-900">Speak your complaint <span className="font-medium text-slate-500">(हिन्दी)</span></h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">Record in Hindi, then review and edit the transcript before submitting.</p>
      </div>
      <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-700">hi</span>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {!recording ? <button type="button" onClick={start} disabled={disabled || uploading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Mic size={15} /> Start recording</button>
        : <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700"><Square size={14} /> Stop recording</button>}
      {recording && <span className="inline-flex items-center gap-2 text-xs font-semibold text-rose-700" aria-live="polite"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" /> Recording {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>}
      {uploading && <span className="inline-flex items-center gap-2 text-xs text-blue-700" role="status"><LoaderCircle size={15} className="animate-spin" /> Transcribing…</span>}
      {transcript && !recording && !uploading && <button type="button" onClick={start} disabled={disabled} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"><RotateCcw size={13} /> Record again</button>}
    </div>
    {status && <p className="text-xs text-slate-600" role="status" aria-live="polite">{status}</p>}
    {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
    {transcript && <div className="space-y-1.5">
      <label htmlFor="voice-transcript" className="block text-xs font-bold text-slate-800">Review and edit transcript</label>
      <textarea id="voice-transcript" rows={3} maxLength={3000} value={transcript} onChange={(e) => editTranscript(e.target.value)} disabled={disabled || uploading}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60" />
      <div className="flex items-center justify-between text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600" /> Not submitted yet</span><span>{transcript.length}/3000</span></div>
    </div>}
    <p className="text-[10px] leading-relaxed text-slate-500">Recording stops after 2 minutes. Voice input only fills the description; it never submits your complaint.</p>
  </section>;
}
