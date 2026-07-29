"use client";
import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}

// A given HTMLMediaElement can be bound to exactly ONE MediaElementSourceNode
// for its entire lifetime — calling createMediaElementSource on it twice throws
// InvalidStateError, even after the AudioContext is closed. React 19 Strict Mode
// double-invokes effects in dev, and TTS remounts this component per generation,
// so we cache the audio graph per element and reuse it instead of rebuilding.
interface AudioGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
}
const graphCache = new WeakMap<HTMLMediaElement, AudioGraph>();
// Only one Waveform is on screen at a time; track the previous context so we can
// close it when a new element appears, instead of leaking one per generation.
let previousCtx: AudioContext | null = null;

export default function Waveform({ audioRef, isPlaying }: WaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    let graph = graphCache.get(el);
    if (!graph) {
      // New audio element — close the prior generation's context first.
      if (previousCtx && previousCtx.state !== "closed") {
        previousCtx.close().catch(() => {});
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaElementSource(el); // safe: once per element
      source.connect(analyser);
      analyser.connect(ctx.destination);
      graph = { ctx, analyser, source };
      graphCache.set(el, graph);
      previousCtx = ctx;
    }

    ctxRef.current = graph.ctx;
    analyserRef.current = graph.analyser;
    sourceRef.current = graph.source;

    // Do NOT close/disconnect on unmount: the graph is cached and reused, and
    // the element stays permanently bound to its source node. Just stop drawing.
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [audioRef]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      cancelAnimationFrame(animRef.current);
      setBars(Array(32).fill(4));
      return;
    }

    // Routing <audio> through a MediaElementSource mutes output while the
    // AudioContext is suspended (Chrome autoplay policy). Resume on play.
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(data);
      const newBars = Array.from({ length: 32 }, (_, i) => {
        const val = data[i] || 0;
        return Math.max(4, (val / 255) * 56);
      });
      setBars(newBars);
      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  return (
    <div className="waveform-container">
      {bars.map((h, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{ height: `${h}px`, opacity: isPlaying ? 1 : 0.3 }}
        />
      ))}
    </div>
  );
}
