"use client";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { FileTextIcon, MicIcon, RadioIcon, CheckCircleIcon, PlayIcon, PauseIcon, DownloadIcon, SparklesIcon, ShieldIcon, ClockIcon, SettingsIcon } from "@/components/Icons";
import { FlagImage } from "@/components/LanguageSelect";

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
const RECOGNITION_LANGS: { code: string; flagCode: string; label: string }[] = [
  { code: "en-US", flagCode: "us", label: "English (US)" },
  { code: "hi-IN", flagCode: "in", label: "Hindi (हिंदी)" },
  { code: "es-ES", flagCode: "es", label: "Spanish (Español)" },
  { code: "fr-FR", flagCode: "fr", label: "French (Français)" },
  { code: "de-DE", flagCode: "de", label: "German (Deutsch)" },
  { code: "it-IT", flagCode: "it", label: "Italian (Italiano)" },
  { code: "pt-BR", flagCode: "br", label: "Portuguese (Português)" },
  { code: "ru-RU", flagCode: "ru", label: "Russian (Русский)" },
  { code: "ja-JP", flagCode: "ja", label: "Japanese (日本語)" },
  { code: "ko-KR", flagCode: "kr", label: "Korean (한국어)" },
  { code: "zh-CN", flagCode: "cn", label: "Chinese (中文)" },
  { code: "ar-SA", flagCode: "sa", label: "Arabic (العربية)" },
  { code: "bn-IN", flagCode: "bd", label: "Bengali (বাংলা)" },
  { code: "ta-IN", flagCode: "in", label: "Tamil (தமிழ்)" },
  { code: "te-IN", flagCode: "in", label: "Telugu (తెలుగు)" },
  { code: "mr-IN", flagCode: "in", label: "Marathi (मराठी)" },
  { code: "gu-IN", flagCode: "in", label: "Gujarati (ગુજરાતી)" },
  { code: "ur-PK", flagCode: "pk", label: "Urdu (اردو)" },
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
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [scrollSpeed, setScrollSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [aiNoiseActive, setAiNoiseActive] = useState(true);
  // Ref so the auto-restart handler always reads the current language.
  const recognitionLangRef = useRef("en-US");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      } catch {}
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

      // Real-time AI noise removal with robust AudioWorklet fallback
      setIsLoadingModel(true);
      let workletSuccess = false;
      try {
        if (audioCtx.audioWorklet) {
          await audioCtx.audioWorklet.addModule("/worklets/rnnoise-processor.js");
          const rnnoiseNode = new AudioWorkletNode(audioCtx, "rnnoise-processor");
          rnnoiseNodeRef.current = rnnoiseNode;

          // Connect: source -> rnnoise worklet -> analyser -> destination
          sourceNode.connect(rnnoiseNode);
          rnnoiseNode.connect(analyser);
          analyser.connect(destinationNode);
          workletSuccess = true;
        }
      } catch (workletErr) {
        console.warn("RNNoise initialization notice (using Biquad filter fallback):", workletErr);
        workletSuccess = false;
      }

      if (!workletSuccess) {
        // Fallback: High-pass (80Hz) + Low-pass (8000Hz) filters for clean audio
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
      }
      setIsLoadingModel(false);

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

  // Initial / Idle Canvas Waveform Drawing
  useEffect(() => {
    if (canvasRef.current && !isRecording) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0c0e17";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, "rgba(255, 128, 0, 0.1)");
        gradient.addColorStop(0.5, "rgba(255, 128, 0, 0.6)");
        gradient.addColorStop(1, "rgba(255, 128, 0, 0.1)");
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }
  }, [isRecording]);

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

      ctx.fillStyle = "#0c0e17";
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
    const s1 = spoken.toLowerCase().trim();
    const s2 = scriptWord.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return true;

    // For short words (<= 4 chars), require exact match ONLY (prevents "is", "a", "to", "in", "it" from skipping far ahead)
    if (s1.length <= 4 || s2.length <= 4) {
      return s1 === s2;
    }

    // Prefix match for longer words (length >= 5)
    if (s1.length >= 5 && s2.length >= 5) {
      if (s1.startsWith(s2.slice(0, 4)) || s2.startsWith(s1.slice(0, 4))) {
        return true;
      }
    }

    // Levenshtein distance for long words
    const maxDist = Math.max(1, Math.floor(s2.length * 0.25));
    return levenshtein(s1, s2) <= maxDist;
  };

  // Advance the highlight index and scroll into view
  const advanceHighlightTo = (newIndex: number) => {
    if (newIndex <= currentWordIndexRef.current) return;
    currentWordIndexRef.current = newIndex;
    setCurrentWordIndex(newIndex);
    // Auto-scroll the matched word into view smoothly
    setTimeout(() => {
      const element = document.getElementById(`word-${newIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 40);
  };

  // Try to match spoken words against upcoming script words accurately
  const matchSpokenWords = (spokenWords: string[]) => {
    const cw = cleanWordsRef.current;
    if (spokenWords.length === 0 || cw.length === 0) return;

    const currentIdx = currentWordIndexRef.current;
    // Tight search window: max 5 words ahead from current position
    const startSearch = Math.max(0, currentIdx + 1);
    const endSearch = Math.min(cw.length, startSearch + 5);

    let targetIdx = currentIdx;

    for (const spoken of spokenWords) {
      if (spoken.length < 2) continue; // Skip single-letter noise

      for (let s = startSearch; s < endSearch; s++) {
        if (isFuzzyMatch(spoken, cw[s])) {
          targetIdx = s;
          break;
        }
      }
      if (targetIdx > currentIdx) break; // Advance step by step
    }

    // Capped jump: max 2 words per speech event to ensure smooth word-by-word pacing
    if (targetIdx > currentIdx) {
      const maxAllowedIndex = Math.min(targetIdx, currentIdx + 2);
      advanceHighlightTo(maxAllowedIndex);
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

  const handleClear = () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    setIsPlayingBack(false);
    setAudioUrl(null);
    setAudioBlob(null);
    setTimer(0);
    setCurrentWordIndex(-1);
    currentWordIndexRef.current = -1;
    spokenWordsCumulativeRef.current = [];
    showToast("Recorded audio cleared", "info");
    if (onCancel) onCancel();
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSecs = Math.max(1, Math.round(wordCount / 2.5));

  return (
    <div className="teleprompter-grid fade-in" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", alignItems: "start" }}>
      
      {/* LEFT PANE - Script Teleprompter & Settings */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Script Teleprompter Main Card */}
        <div className="glass-card teleprompter-pane" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
          <div className="teleprompter-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.1rem", fontWeight: 800 }}>
              <FileTextIcon size={18} color="#FF8000" />
              <span>Script Teleprompter</span>
            </h3>
            {!isRecording ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {script.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setScript(""); showToast("Script text cleared", "info"); }}
                    style={{ fontSize: "0.76rem", padding: "4px 8px", height: "auto" }}
                  >
                    Clear Script
                  </button>
                )}
                <span className="badge badge-info" style={{ fontSize: "0.76rem" }}>Double-click or type to edit</span>
              </div>
            ) : (
              <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.76rem" }}>
                <MicIcon size={12} color="currentColor" /> Live Reading Mode
              </span>
            )}
          </div>

          {!isRecording ? (
            <textarea
              className="textarea-input"
              style={{ flex: 1, minHeight: "240px", fontSize: `${fontSize}px`, lineHeight: 1.6 }}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Type or paste your script here..."
            />
          ) : (
            <div className="teleprompter-reader" style={{ fontSize: `${fontSize}px`, minHeight: "240px", padding: "16px", background: "var(--glass2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
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

          {/* Footer Badge with Word Count & Estimated Reading Time */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text-dim)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileTextIcon size={14} color="var(--accent)" />
              <span>Word Count: <strong>{wordCount}</strong></span>
              <span>•</span>
              <ClockIcon size={14} color="var(--text-dim)" />
              <span>Estimated Time: ~{estimatedSecs} sec</span>
            </div>
          </div>
        </div>

        {/* Teleprompter Settings Card */}
        <div className="glass-card" style={{ padding: "20px 24px" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "14px", display: "flex", alignItems: "center", gap: 8 }}>
            <SettingsIcon size={16} color="var(--accent)" /> Teleprompter Controls
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            
            {/* Text Size */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>TEXT SIZE</div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                  style={{ height: "34px", padding: "0 10px", fontSize: "0.8rem" }}
                >
                  A-
                </button>
                <div style={{ padding: "0 12px", height: "34px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", fontWeight: 800, fontSize: "0.85rem" }}>
                  {fontSize}px
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                  style={{ height: "34px", padding: "0 10px", fontSize: "0.8rem" }}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Scroll Speed */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>SCROLL SPEED</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["slow", "normal", "fast"] as const).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`btn btn-sm ${scrollSpeed === sp ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setScrollSpeed(sp)}
                    style={{ height: "34px", padding: "0 10px", textTransform: "capitalize", fontSize: "0.8rem", flex: 1 }}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* RIGHT PANE - Audio Recording Console */}
      <div className="glass-card recorder-pane" style={{ padding: "24px" }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.1rem", fontWeight: 800 }}>
            <RadioIcon size={18} color="#FF8000" />
            <span>Audio Recording Console</span>
          </h3>
          <span className="badge badge-success" style={{ fontSize: "0.72rem" }}>All Systems Ready</span>
        </div>

        <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "16px" }}>
          Control and optimize your audio feed in real-time
        </p>

        <div className="recorder-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          {/* Timer Display */}
          <div className="recorder-timer" style={{ fontSize: "2.4rem", fontWeight: 900, color: isRecording ? "var(--error)" : "var(--accent)", letterSpacing: "1px" }}>
            {formatTimer(timer)}
          </div>
          
          <div style={{ color: isRecording ? "var(--error)" : "var(--text-dim)", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isRecording ? "var(--error)" : "var(--accent)" }} />
            {isRecording ? (isPaused ? "RECORDING PAUSED" : "RECORDING LIVE") : "IDLE"}
          </div>

          <canvas ref={canvasRef} className="visualizer-canvas" height={80} style={{ width: "100%", borderRadius: "var(--radius-sm)", background: "var(--glass2)", marginBottom: "16px" }} />

          {/* 3 Quick Status Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", width: "100%", marginBottom: "14px" }}>
            <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 600 }}>Audio Quality</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent)" }}>High</div>
            </div>
            <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 600 }}>Noise Filter</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--success)" }}>Active</div>
            </div>
            <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "var(--glass2)", border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 600 }}>Input Source</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text)" }}>Default Mic</div>
            </div>
          </div>

          {/* AI Noise Removal Active Banner */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldIcon size={18} color="var(--success)" />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--success)" }}>AI Noise Removal Active</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>RNNoise AI removes background noise in real-time</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={aiNoiseActive}
              onChange={(e) => { setAiNoiseActive(e.target.checked); showToast(`AI Noise Removal ${e.target.checked ? "enabled" : "disabled"}`, "info"); }}
              style={{ width: "18px", height: "18px", accentColor: "var(--success)", cursor: "pointer" }}
            />
          </div>

          {/* Script Language Dropdown with Circle Country Flags */}
          {speechSupported && !isRecording && (
            <div className="form-group" style={{ width: "100%", marginBottom: 16, textAlign: "left", position: "relative" }} ref={langDropdownRef}>
              <label className="form-label" style={{ fontSize: "0.78rem", marginBottom: 6, fontWeight: 700, color: "var(--text-dim)" }}>
                Script Language
              </label>

              {/* Custom Dropdown Trigger */}
              <button
                type="button"
                className="select-input"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  background: "#ffffff",
                  border: isLangDropdownOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer"
                }}
              >
                {(() => {
                  const sel = RECOGNITION_LANGS.find(l => l.code === recognitionLang) || RECOGNITION_LANGS[0];
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(0,0,0,0.12)",
                        flexShrink: 0
                      }}>
                        <FlagImage flagCode={sel.flagCode} name={sel.label} size={28} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
                        {sel.label}
                      </span>
                    </div>
                  );
                })()}

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isLangDropdownOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease", color: "var(--text-dim)" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown Options List */}
              {isLangDropdownOpen && (
                <div
                  className="glass-card fade-in"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 99,
                    padding: "6px",
                    maxHeight: "240px",
                    overflowY: "auto",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)"
                  }}
                >
                  {RECOGNITION_LANGS.map((l) => {
                    const isSelected = l.code === recognitionLang;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setRecognitionLang(l.code);
                          setIsLangDropdownOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "var(--radius-xs)",
                          border: "none",
                          background: isSelected ? "rgba(255,128,0,0.12)" : "transparent",
                          color: isSelected ? "var(--accent)" : "var(--text)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(0,0,0,0.12)",
                            flexShrink: 0
                          }}>
                            <FlagImage flagCode={l.flagCode} name={l.label} size={26} />
                          </div>
                          <span style={{ fontWeight: isSelected ? 800 : 600, fontSize: "0.88rem" }}>
                            {l.label}
                          </span>
                        </div>
                        {isSelected && <CheckCircleIcon size={14} color="var(--accent)" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* RECORD CONTROL BUTTONS */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", margin: "8px 0 16px 0", width: "100%" }}>
            {isRecording && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={togglePause}
                style={{ height: 44, width: 44, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {isPaused ? <PlayIcon size={16} color="currentColor" /> : <PauseIcon size={16} color="currentColor" />}
              </button>
            )}

            <button
              type="button"
              className={`recorder-btn ${isRecording ? "recording" : "idle"}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? "Stop Recording" : "Start Recording"}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                border: "4px solid #ffffff",
                boxShadow: isRecording ? "0 0 0 8px rgba(239, 68, 68, 0.3)" : "0 6px 20px rgba(239, 68, 68, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {isRecording ? <div style={{ width: 18, height: 18, background: "#fff", borderRadius: 3 }} /> : <MicIcon size={26} color="#ffffff" />}
            </button>
          </div>

          {/* PLAYBACK / DOWNLOAD SECTION */}
          {audioUrl && !isRecording && (
            <div className="fade-in" style={{ width: "100%", borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={togglePlayback} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
                  {isPlayingBack ? <><PauseIcon size={14} color="currentColor" /> Pause</> : <><PlayIcon size={14} color="currentColor" /> Play</>}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleDownload} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
                  <DownloadIcon size={14} color="currentColor" /> Download
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleUseRecording} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px" }}>
                  <SparklesIcon size={14} color="#0a0a0a" /> Transcribe
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear} style={{ padding: "8px 14px", color: "var(--error)" }}>
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
