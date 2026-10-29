import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Globe, AlertCircle, CheckCircle2, RotateCcw, Info } from 'lucide-react';
import {
  VOICE_LANGUAGES,
  getSpeechRecognitionConstructor,
  mapRecognitionError,
  mergeTranscript
} from './voiceInput.constants.js';

export { VOICE_LANGUAGES, getSpeechRecognitionConstructor, mapRecognitionError, mergeTranscript };

/**
 * Reusable VoiceInput component for CivicSarthi complaints.
 * 
 * Architectural & Safety guarantees:
 * 1. Uses native Web Speech API (zero server-side or paid transcription dependency).
 * 2. Defaults to Hindi (hi-IN) with fallback to English and regional Indian locales.
 * 3. Never triggers automated complaint submission (explicit type="button").
 * 4. Preserves existing description text and supports append (default) or replace.
 * 5. Cleans up recognition instance and releases microphone on unmount.
 * 6. Guarantees no duplicate text between interim and final transcripts.
 * 7. Accessible controls and live announcements for screen readers.
 */
export default function VoiceInput({
  onTranscript,
  disabled = false,
  className = ''
}) {
  const [isSupported, setIsSupported] = useState(true);
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [insertMode, setInsertMode] = useState('append'); // 'append' | 'replace'
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'success' | 'error'
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastInsertedTranscript, setLastInsertedTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef(null);
  const isMountedRef = useRef(true);
  const selectedLangRef = useRef(selectedLang);
  const insertModeRef = useRef(insertMode);
  const onTranscriptRef = useRef(onTranscript);

  // Keep refs synchronized to avoid stale closures in recognition callbacks
  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  useEffect(() => {
    insertModeRef.current = insertMode;
  }, [insertMode]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const sessionFinalTextRef = useRef('');
  const sessionInterimTextRef = useRef('');

  // Check Web Speech API availability on mount and clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const SpeechConstructor = getSpeechRecognitionConstructor();
    if (!SpeechConstructor) {
      setIsSupported(false);
    }
    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors during unmount
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Stop active recognition helper
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Recognition might already have stopped
      }
    }
  }, []);

  // If form submission disables the component, immediately stop listening
  useEffect(() => {
    if (disabled && status === 'listening') {
      stopRecognition();
    }
  }, [disabled, status, stopRecognition]);

  // Start voice recognition session
  const startRecognition = useCallback(() => {
    const SpeechConstructor = getSpeechRecognitionConstructor();
    if (!SpeechConstructor) {
      setIsSupported(false);
      setErrorMessage('Browser speech recognition is not supported in this browser. Please type your grievance directly.');
      setStatus('error');
      return;
    }

    // Stop and clean up any pre-existing session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    setErrorMessage('');
    setInterimTranscript('');
    sessionFinalTextRef.current = '';
    sessionInterimTextRef.current = '';
    setStatus('listening');

    try {
      const recognition = new SpeechConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLangRef.current;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (!isMountedRef.current) return;
        setStatus('listening');
      };

      recognition.onresult = (event) => {
        if (!isMountedRef.current) return;
        let finalAccumulator = '';
        let interimAccumulator = '';

        // Iterate through all results in the current session
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptPiece = result[0]?.transcript || '';
          if (result.isFinal) {
            finalAccumulator += transcriptPiece + ' ';
          } else {
            interimAccumulator += transcriptPiece;
          }
        }

        sessionFinalTextRef.current = finalAccumulator.trim();
        sessionInterimTextRef.current = interimAccumulator.trim();

        // Update live preview for the user
        const displayPreview = sessionInterimTextRef.current || sessionFinalTextRef.current;
        setInterimTranscript(displayPreview);
      };

      recognition.onerror = (event) => {
        if (!isMountedRef.current) return;
        const mappedError = mapRecognitionError(event.error);
        if (mappedError) {
          setErrorMessage(mappedError);
          setStatus('error');
        }
      };

      recognition.onend = () => {
        if (!isMountedRef.current) return;

        // Combine finalized text and any remaining interim utterance without duplicates
        let fullTranscript = sessionFinalTextRef.current;
        if (sessionInterimTextRef.current) {
          fullTranscript = fullTranscript
            ? `${fullTranscript} ${sessionInterimTextRef.current}`
            : sessionInterimTextRef.current;
        }
        fullTranscript = fullTranscript.trim();

        if (fullTranscript && onTranscriptRef.current) {
          onTranscriptRef.current(fullTranscript, insertModeRef.current);
          setLastInsertedTranscript(fullTranscript);
          setStatus('success');
        } else {
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        }

        setInterimTranscript('');
        sessionFinalTextRef.current = '';
        sessionInterimTextRef.current = '';
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      if (!isMountedRef.current) return;
      setErrorMessage(err.message || 'Failed to start speech recognition. Please verify microphone permissions.');
      setStatus('error');
      recognitionRef.current = null;
    }
  }, []);

  const handleToggleListening = () => {
    if (status === 'listening') {
      stopRecognition();
    } else {
      startRecognition();
    }
  };

  const handleLanguageChange = (e) => {
    if (status === 'listening') {
      stopRecognition();
    }
    setSelectedLang(e.target.value);
  };

  // If browser does not support Web Speech API, render accessible fallback notice
  if (!isSupported) {
    return (
      <div
        className={`p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5 ${className}`}
        role="region"
        aria-label="Voice input support notice"
      >
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold text-slate-700">Voice Input Unavailable in this Browser</p>
          <p className="text-slate-500 mt-0.5">
            Your browser does not support built-in speech recognition. You can continue typing your grievance narrative in the text box below.
          </p>
        </div>
      </div>
    );
  }

  const isListening = status === 'listening';

  return (
    <div
      className={`p-4 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-3 transition-colors ${
        isListening ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-300' : ''
      } ${className}`}
      role="region"
      aria-label="Multilingual voice input assistant"
    >
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="voice-language-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Globe size={14} className="text-blue-600" aria-hidden="true" />
            <span>Spoken Language:</span>
          </label>
          <select
            id="voice-language-select"
            value={selectedLang}
            onChange={handleLanguageChange}
            disabled={disabled || isListening}
            className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {VOICE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label} {lang.code === 'hi-IN' ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Insertion Mode (Append vs Replace) */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Narrative Action:</span>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="insertMode"
              value="append"
              checked={insertMode === 'append'}
              onChange={() => setInsertMode('append')}
              disabled={disabled || isListening}
              className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span>Append</span>
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="insertMode"
              value="replace"
              checked={insertMode === 'replace'}
              onChange={() => setInsertMode('replace')}
              disabled={disabled || isListening}
              className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span>Replace</span>
          </label>
        </div>

        {/* Start / Stop Voice Button (explicit type="button" to prevent form submission) */}
        <div>
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={disabled}
            aria-pressed={isListening}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 disabled:opacity-60'
            }`}
          >
            {isListening ? (
              <>
                <MicOff size={15} className="animate-spin text-white" aria-hidden="true" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic size={15} aria-hidden="true" />
                <span>Start Speaking</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Status Region */}
      <div aria-live="polite" className="text-xs">
        {isListening && (
          <div className="flex items-start gap-2 bg-blue-100/60 border border-blue-200 text-blue-900 p-2.5 rounded-lg">
            <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">
                Listening in {VOICE_LANGUAGES.find((l) => l.code === selectedLang)?.label}...
              </p>
              <p className="text-slate-700 italic">
                {interimTranscript || 'Speak clearly into your microphone. Your words will be transcribed here and inserted into the narrative.'}
              </p>
            </div>
          </div>
        )}

        {status === 'success' && lastInsertedTranscript && (
          <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" aria-hidden="true" />
              <span>
                Transcribed text was successfully {insertMode === 'replace' ? 'set' : 'appended'} to your grievance narrative.
              </span>
            </div>
            <button
              type="button"
              onClick={startRecognition}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline ml-2"
            >
              Speak more
            </button>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="flex items-start justify-between gap-2 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Voice Input Error</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={startRecognition}
              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-rose-300 text-rose-700 px-2 py-1 rounded hover:bg-rose-100 transition-colors shrink-0"
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Privacy and Accessibility Hint */}
      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
        <span>
          Microphone is active only while listening. Speech recognition uses your browser's native engine.
        </span>
        <span className="font-medium text-slate-600">Review and edit narrative before submitting.</span>
      </div>
    </div>
  );
}
