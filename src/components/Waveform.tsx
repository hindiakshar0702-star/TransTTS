"use client";
import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}

/**
 * `createMediaElementSource` may only be called ONCE per
 * <audio> element. If React reuses the same element across re-renders
 * (which it does), calling it a second time throws:
 *
 *   InvalidStateError: HTMLMediaElement already connected previously
 *   to a different MediaElementSourceNode.
 *
 * Old code worked around this with a single `initializedRef` flag
 * scoped to the component instance — fine on first mount, but the
 * waveform stayed frozen if the parent re-mounted Waveform with the
 * same <audio> element (e.g. after "Generate New").
 *
 * Fix: cache the source node + analyser PER HTMLMediaElement in a
 * module-level WeakMap. The same element is given the same nodes;
 * the GC can still collect them when the audio element goes away.
 */

type AudioNodes = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
};

const ELEMENT_NODES = new WeakMap<HTMLMediaElement, AudioNodes>();

function getOrCreateNodes(audio: HTMLMediaElement): AudioNodes | null {
  const cached = ELEMENT_NODES.get(audio);
  if (cached) return cached;

  try {
    type WindowWithLegacyAudio = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtor: typeof AudioContext | undefined =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext ||
          (window as WindowWithLegacyAudio).webkitAudioContext;
    if (!AudioCtor) return null;

    const ctx = new AudioCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const nodes = { ctx, analyser, source };
    ELEMENT_NODES.set(audio, nodes);
    return nodes;
  } catch (err) {
    console.warn("Waveform: AudioContext setup failed:", err);
    return null;
  }
}

export default function Waveform({ audioRef, isPlaying }: WaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));
  const animRef = useRef<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const nodes = getOrCreateNodes(audio);
    if (!nodes) return;

    if (!isPlaying) {
      cancelAnimationFrame(animRef.current);
      setBars(Array(32).fill(4));
      return;
    }

    if (nodes.ctx.state === "suspended") {
      // Browser autoplay policy: user gesture is required to start audio
      // contexts. Resuming here works because isPlaying flips on click.
      nodes.ctx.resume().catch(() => {});
    }

    const data = new Uint8Array(nodes.analyser.frequencyBinCount);

    const animate = () => {
      nodes.analyser.getByteFrequencyData(data);
      const newBars = Array.from({ length: 32 }, (_, i) => {
        const val = data[i] || 0;
        return Math.max(4, (val / 255) * 56);
      });
      setBars(newBars);
      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, audioRef]);

  return (
    <div className="waveform-container" aria-hidden="true">
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
