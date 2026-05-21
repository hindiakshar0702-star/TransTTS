"use client";
import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}

export default function Waveform({ audioRef, isPlaying }: WaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current || initializedRef.current) return;

    try {
      // Create audio context only once
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      initializedRef.current = true;
    } catch (err) {
      // MediaElementAudioSourceNode may already be created for this element
      console.warn("Waveform: AudioContext setup failed:", err);
    }
  }, [audioRef]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      cancelAnimationFrame(animRef.current);
      setBars(Array(32).fill(4));
      return;
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (ctxRef.current && ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
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
