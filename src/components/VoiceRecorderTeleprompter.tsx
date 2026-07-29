"use client";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/Toast";

// Minimal Web Speech API typings — these are not part of the standard lib.dom.
interface SpeechRecognitionAlternative { readonly transcript: string }
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike { readonly error: string }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  webkitAudioContext?: typeof AudioContext;
}

interface VoiceRecorderTeleprompterProps {
  onSave: (file: File) => void;
  onCancel: () => void;
}

// BCP-47 tags for the Web Speech API — must be language-specific for the
// teleprompter word-matching to work in non-English scripts.
const RECOGNITION_LANGS: { code: string; label: string }[] = [
  { code: "en-US", label: "🇺🇸 English" },
  { code: "hi-IN", label: "🇮🇳 Hindi" },
  { code: "es-ES", label: "🇪🇸 Spanish" },
  { code: "fr-FR", label: "🇫🇷 French" },
  { code: "de-DE", label: "🇩🇪 German" },
  { code: "it-IT", label: "🇮🇹 Italian" },
  { code: "pt-BR", label: "🇧🇷 Portuguese" },
  { code: "ru-RU", label: "🇷🇺 Russian" },
  { code: "ja-JP", label: "🇯🇵 Japanese" },
  { code: "ko-KR", label: "🇰🇷 Korean" },
  { code: "zh-CN", label: "🇨🇳 Chinese" },
  { code: "ar-SA", label: "🇸🇦 Arabic" },
  { code: "bn-IN", label: "🇮🇳 Bengali" },
  { code: "ta-IN", label: "🇮🇳 Tamil" },
  { code: "te-IN", label: "🇮🇳 Telugu" },
  { code: "mr-IN", label: "🇮🇳 Marathi" },
  { code: "gu-IN", label: "🇮🇳 Gujarati" },
  { code: "ur-PK", label: "🇵🇰 Urdu" },
];

export default function VoiceRecorderTeleprompter({ onSave, onCancel }: VoiceRecorderTeleprompterProps) {
  const [script, setScript] = useState(
    "Welcome to TransTTS AI. This is a premium live voice recorder and teleprompter feature. You can paste your own text script in the textarea, toggle active noise cancellation to suppress background noise, and hit the record button to start speaking. The teleprompter will split your text into words, highlight them in real-time as you speak, and scroll automatically to keep your place. When you are finished, you can preview your recording and send it directly for transcription. Try it now!"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [timer, setTimer] = useState(0);
  const rnnoiseNodeRef = useRef<AudioWorkletNode | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [mediaSupported, setMediaSupported] = useState(true);
  const [recognitionLang, setRecognitionLang] = useState("en-US");
  // Ref so the auto-restart handler always reads the current language.
  const recognitionLangRef = useRef("en-US");

  // Refs for tracking recording states to avoid closure stale value issues in event listeners
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);

  // Speech Recognition refs
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Ref to track all finalized spoken words across recognition sessions
  const spokenWordsCumulativeRef = useRef<string[]>([]);
  // Ref for cleanWords so the recognition callback never uses a stale closure
  const cleanWordsRef = useRef<string[]>([]);
  // Ref for the current word index to use inside recognition callback (avoids stale state)
  const currentWordIndexRef = useRef(-1);

  const { showToast } = useToast();

  // Keep the recognition-language ref in sync for the auto-restart handler.
  useEffect(() => {
    recognitionLangRef.current = recognitionLang;
  }, [recognitionLang]);

  const setIsRecordingWithRef = (val: boolean) => {
    isRecordingRef.current = val;
    setIsRecording(val);
  };

  const setIsPausedWithRef = (val: boolean) => {
    isPausedRef.current = val;
    setIsPaused(val);
  };

  // Parse words for teleprompter
  const words = script.split(/\s+/).filter(Boolean);
  const cleanWords = words.map(w => 
    w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
  );

  // Keep cleanWordsRef in sync
  useEffect(() => {
    cleanWordsRef.current = cleanWords;
  }, [script]);

  useEffect(() => {
    // Check SpeechRecognition support
    const w = typeof window !== "undefined" ? (window as SpeechWindow) : undefined;
    const SpeechRecognition = w && (w.SpeechRecognition || w.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    // Check microphone capability (insecure context check)
    if (typeof window !== "undefined" && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setMediaSupported(false);
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const stopAllMedia = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (rnnoiseNodeRef.current) {
      try {
        rnnoiseNodeRef.current.port.postMessage({ type: "close" });
      } catch (e) {}
      rnnoiseNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      stopAllMedia();
      setAudioUrl(null);
      setAudioBlob(null);
      setTimer(0);
      setCurrentWordIndex(-1);
      currentWordIndexRef.current = -1;
      spokenWordsCumulativeRef.current = [];
      setIsPlayingBack(false);

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Set up Web Audio API Pipeline
      const AudioContextClass = window.AudioContext || (window as SpeechWindow).webkitAudioContext!;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const destinationNode = audioCtx.createMediaStreamDestination();

      // Always use RNNoise WASM for real-time AI noise removal
      setIsLoadingModel(true);
      try {
        await audioCtx.audioWorklet.addModule("/worklets/rnnoise-processor.js");
        const rnnoiseNode = new AudioWorkletNode(audioCtx, "rnnoise-processor");
        rnnoiseNodeRef.current = rnnoiseNode;

        // Connect: source -> rnnoise worklet -> analyser -> destination
        sourceNode.connect(rnnoiseNode);
        rnnoiseNode.connect(analyser);
        analyser.connect(destinationNode);
      } catch (workletErr) {
        console.error("RNNoise initialization failed, falling back to standard filters:", workletErr);
        // Fallback: Biquad high-pass + low-pass filters
        const hpFilter = audioCtx.createBiquadFilter();
        hpFilter.type = "highpass";
        hpFilter.frequency.value = 80;
        const lpFilter = audioCtx.createBiquadFilter();
        lpFilter.type = "lowpass";
        lpFilter.frequency.value = 8000;

        sourceNode.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(analyser);
        analyser.connect(destinationNode);
      } finally {
        setIsLoadingModel(false);
      }

      // Initialize MediaRecorder on destination node
      const options = { mimeType: "audio/webm" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(destinationNode.stream, options);
      } catch {
        // Fallback for browsers that don't support webm audio
        recorder = new MediaRecorder(destinationNode.stream);
      }
      mediaRecorderRef.current = recorder;

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: recorder.mimeType || "audio/wav" });
        setAudioBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
      };

      recorder.start();
      setIsRecordingWithRef(true);
      setIsPausedWithRef(false);

      // Start Visualizer Loop
      drawWaveform();

      // Start Speech Recognition
      startSpeechRecognition();

      showToast("Recording started", "info");
    } catch (err) {
      console.error("Microphone access failed:", err);
      showToast("Could not access microphone. Please check permissions.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecordingWithRef(false);
    setIsPausedWithRef(false);
    showToast("Recording completed", "success");
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      setIsPausedWithRef(false);
      showToast("Recording resumed", "info");
    } else {
      mediaRecorderRef.current.pause();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsPausedWithRef(true);
      showToast("Recording paused", "info");
    }
  };

  // Live Canvas Waveform Drawing
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgba(6, 6, 11, 0.4)"; // background match var(--bg)
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 3;
      // Gradient line
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "#6366f1"); // var(--accent)
      gradient.addColorStop(0.5, "#a855f7"); // var(--gradient2)
      gradient.addColorStop(1, "#06b6d4"); // var(--accent2)
      ctx.strokeStyle = gradient;

      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(99, 102, 241, 0.5)";

      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  // Levenshtein distance for fuzzy word matching (handles mispronunciations / recognition errors)
  const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  };

  // Check if two words are a fuzzy match
  const isFuzzyMatch = (spoken: string, scriptWord: string): boolean => {
    if (!spoken || !scriptWord) return false;
    // Exact match
    if (spoken === scriptWord) return true;
    // One starts with the other (partial recognition)
    if (spoken.startsWith(scriptWord) || scriptWord.startsWith(spoken)) return true;
    // For short words (<=3 chars), require exact or startsWith match only
    if (scriptWord.length <= 3) return false;
    // Levenshtein distance threshold: allow ~30% character edits
    const maxDist = Math.max(1, Math.floor(scriptWord.length * 0.3));
    return levenshtein(spoken, scriptWord) <= maxDist;
  };

  // Advance the highlight index and scroll into view
  const advanceHighlightTo = (newIndex: number) => {
    if (newIndex <= currentWordIndexRef.current) return;
    currentWordIndexRef.current = newIndex;
    setCurrentWordIndex(newIndex);
    // Auto-scroll the matched word into view
    setTimeout(() => {
      const element = document.getElementById(`word-${newIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  // Try to match spoken words against upcoming script words
  const matchSpokenWords = (spokenWords: string[]) => {
    const cw = cleanWordsRef.current;
    if (spokenWords.length === 0 || cw.length === 0) return;

    const currentIdx = currentWordIndexRef.current;
    // Wide search window: 25 words ahead from current position
    const startSearch = Math.max(0, currentIdx + 1);
    const endSearch = Math.min(cw.length, startSearch + 25);

    let bestMatchIndex = currentIdx;

    // For each spoken word, find the furthest matching script word in the window
    for (const spoken of spokenWords) {
      if (spoken.length < 2) continue; // Skip single-char noise
      for (let s = Math.max(startSearch, bestMatchIndex + 1); s < endSearch; s++) {
        if (isFuzzyMatch(spoken, cw[s])) {
          bestMatchIndex = s;
          break; // Move to next spoken word once we found a match
        }
      }
    }

    if (bestMatchIndex > currentIdx) {
      // Also mark all words between current and matched as completed (sequential fill)
      advanceHighlightTo(bestMatchIndex);
    }
  };

  // Speech Recognition Logic
  const startSpeechRecognition = () => {
    const w = window as SpeechWindow;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = recognitionLangRef.current; // Match the selected script language
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interimTranscript = "";
        let newFinalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript + " ";
          }
        }

        const cleanText = (text: string) =>
          text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").split(/\s+/).filter(Boolean);

        // Process final results: add to cumulative and match
        if (newFinalTranscript.trim()) {
          const finalWords = cleanText(newFinalTranscript);
          spokenWordsCumulativeRef.current.push(...finalWords);
          matchSpokenWords(finalWords);
        }

        // Process interim results: match against upcoming words for responsive highlighting
        if (interimTranscript.trim()) {
          const interimWords = cleanText(interimTranscript);
          // Only use the last few interim words to avoid re-matching old content
          const recentInterim = interimWords.slice(-5);
          matchSpokenWords(recentInterim);
        }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
        const errorType = e.error || "unknown";
        // Ignore harmless 'no-speech' warnings to prevent console pollution/overlays
        if (errorType === "no-speech" || errorType === "aborted") return;

        console.warn("Speech Recognition event:", errorType);

        if (errorType === "not-allowed") {
          showToast("Microphone permission denied for speech recognition.", "error");
        } else if (errorType === "network") {
          showToast("Speech recognition requires active internet connection.", "error");
        } else if (errorType === "audio-capture") {
          showToast("No microphone detected for speech recognition.", "error");
        }
      };

      recognition.onend = () => {
        // Auto restart if still recording and not paused
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech Recognition initialization failed:", err);
    }
  };

  // Playback Control
  const togglePlayback = () => {
    if (!audioUrl) return;

    if (!audioPlaybackRef.current) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlayingBack(false);
      audioPlaybackRef.current = audio;
    }

    if (isPlayingBack) {
      audioPlaybackRef.current.pause();
      setIsPlayingBack(false);
    } else {
      audioPlaybackRef.current.play();
      setIsPlayingBack(true);
    }
  };

  const handleUseRecording = () => {
    if (!audioBlob) return;
    const fileType = audioBlob.type.split(";")[0] || "audio/webm";
    const extension = fileType.includes("webm") ? ".webm" : ".wav";
    const file = new File([audioBlob], `recorded-voice-${Date.now()}${extension}`, {
      type: fileType,
    });
    onSave(file);
    showToast("Recording imported successfully!", "success");
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `recorded-speech-${Date.now()}.wav`;
    a.click();
    showToast("Audio download started", "success");
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="teleprompter-grid fade-in">
      {/* LEFT PANE - Script Input / Teleprompter Viewer */}
      <div className="glass-card teleprompter-pane">
        <div className="teleprompter-header">
          <h3>📝 Script Teleprompter</h3>
          {!isRecording && (
            <span className="badge badge-info">Double-click or type to edit</span>
          )}
          {isRecording && (
            <span className="badge badge-success">🎙️ Live Reading Mode</span>
          )}
        </div>

        {!isRecording ? (
          <textarea
            className="textarea-input"
            style={{ flex: 1, minHeight: "unset", fontSize: "1.05rem" }}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Type or paste your script here..."
          />
        ) : (
          <div className="teleprompter-reader">
            {words.map((word, index) => {
              let className = "word-span";
              if (index < currentWordIndex) {
                className += " completed";
              } else if (index === currentWordIndex) {
                className += " active";
              }
              return (
                <span key={index} id={`word-${index}`} className={className}>
                  {word}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT PANE - Audio Recorder & Controls */}
      <div className="glass-card recorder-pane">
        <h3>🎙️ Audio Recording Console</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 4 }}>
          Control and optimize your audio feed in real-time
        </p>

        <div className="recorder-card">
          <div className="recorder-timer">{formatTimer(timer)}</div>
          
          <div style={{ color: isRecording ? "var(--error)" : "var(--text-dim)", fontWeight: 600, fontSize: "0.9rem" }}>
            {isRecording ? (isPaused ? "⏸️ RECORDING PAUSED" : "🔴 RECORDING LIVE") : "⚪ IDLE"}
          </div>

          <canvas ref={canvasRef} className="visualizer-canvas" width={280} height={120} />

          {/* AI NOISE REMOVAL STATUS */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", borderRadius: "var(--radius-sm)",
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
              marginBottom: 20, width: "100%",
            }}
          >
            <span style={{ fontSize: "1rem" }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--success)" }}>
                AI Noise Removal Active
                {isLoadingModel && <span className="spinner" style={{ height: 12, width: 12, borderWidth: 1.5, marginLeft: 8 }} />}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 2 }}>
                RNNoise AI automatically removes background noise in real-time
              </div>
            </div>
            <span className="badge badge-success" style={{ fontSize: "0.68rem", padding: "2px 8px" }}>ON</span>
          </div>

          {/* SCRIPT LANGUAGE (drives live word-highlight recognition) */}
          {speechSupported && !isRecording && (
            <div className="form-group" style={{ width: "100%", marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: "0.78rem" }}>Script Language</label>
              <select
                className="select-input"
                value={recognitionLang}
                onChange={(e) => setRecognitionLang(e.target.value)}
              >
                {RECOGNITION_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* RECORD CONTROL BUTTONS */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
            {isRecording && (
              <button
                className="btn btn-outline btn-sm"
                onClick={togglePause}
                style={{ height: 44, width: 44, borderRadius: "50%", padding: 0 }}
              >
                {isPaused ? "▶️" : "⏸️"}
              </button>
            )}

            <button
              className={`recorder-btn ${isRecording ? "recording" : "idle"}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? "⏹️" : "🎙️"}
            </button>
          </div>

          {/* WARNING ON FIREFOX/SAFARI IF SPEECH RECOGNITION IS NOT AVAILABLE */}
          {!speechSupported && (
            <div style={{ color: "var(--warning)", fontSize: "0.72rem", maxWidth: "260px", marginBottom: 8 }}>
              ⚠️ Live word highlighting is not supported in this browser. You can still record normally.
            </div>
          )}

          {/* WARNING IF MICROPHONE ACCESS IS NOT SUPPORTED (NON-SECURE CONTEXT OR BROWSER LIMITATION) */}
          {!mediaSupported && (
            <div style={{ color: "var(--error)", fontSize: "0.72rem", maxWidth: "260px", marginBottom: 8 }}>
              ⚠️ Microphone recording is not supported in this environment. Ensure you are using HTTPS or localhost.
            </div>
          )}

          {/* PLAYBACK / DOWNLOAD SECTION */}
          {audioUrl && !isRecording && (
            <div className="fade-in" style={{ width: "100%", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-outline btn-sm" onClick={togglePlayback}>
                  {isPlayingBack ? "⏸️ Pause Preview" : "▶️ Play Preview"}
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleDownload}>
                  📥 Download Audio
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleUseRecording}>
                  ✨ Transcribe Recording
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
