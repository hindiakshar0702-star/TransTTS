"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The silhouette of a generated clip, lit up as it plays.
 *
 * This used to plot a live FFT: 32 bars straight off a 64-point transform. At
 * 48 kHz that is 750 Hz per bar, and speech puts nearly all of its energy in
 * the first four — so twenty-eight of the thirty-two bars sat pinned at their
 * 4px floor forever, and the thing read as a broken chart rather than a voice.
 * That is not a styling problem; a linear spectrum of speech is lopsided by
 * construction.
 *
 * So it draws the amplitude envelope of the whole clip instead, computed once
 * from the decoded audio. Every bar then carries real signal, the shape is
 * there before playback starts rather than after, and the same sentence in two
 * different voices draws two visibly different silhouettes.
 *
 * Dropping the analyser also drops a genuine hazard the old graph carried: it
 * routed the element through a MediaElementSource, which binds to that element
 * permanently, needed a WeakMap to survive React's double-invoked effects, and
 * muted playback whenever the AudioContext was left suspended. Nothing here
 * touches the element's own output.
 */

/** Enough to render speech rhythm; past this the bars are thinner than the gap. */
const BAR_COUNT = 56;

/** A silent bar still needs to be visible as a bar. */
const MIN_BAR = 0.06;

interface WaveformProps {
  /** The playable audio URL. Decoded once to measure the envelope. */
  src: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}

/**
 * RMS per bucket rather than peak: peak picks out single samples and produces a
 * spiky, uniform-looking wall, while RMS follows the loudness the ear tracks.
 */
async function measureEnvelope(url: string, count: number): Promise<number[]> {
  // Read the bytes without a network call. The CSP's connect-src does not list
  // blob:, so fetching the player's own object URL fails outright — and the
  // audio arrives as a base64 data: URL anyway, which decodes here directly.
  let bytes: ArrayBuffer;
  if (url.startsWith("data:")) {
    const binary = atob(url.slice(url.indexOf(",") + 1));
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    bytes = buffer.buffer;
  } else {
    bytes = await (await fetch(url)).arrayBuffer();
  }

  const ctx = new OfflineAudioContext(1, 1, 44100);
  const decoded = await ctx.decodeAudioData(bytes);
  const samples = decoded.getChannelData(0);
  const bucket = Math.floor(samples.length / count) || 1;

  const levels: number[] = [];
  for (let i = 0; i < count; i++) {
    let sum = 0;
    const start = i * bucket;
    for (let j = 0; j < bucket; j++) {
      const v = samples[start + j] || 0;
      sum += v * v;
    }
    levels.push(Math.sqrt(sum / bucket));
  }

  // Normalise to the loudest moment, so a quietly recorded clip still fills the
  // panel instead of hugging the axis.
  const loudest = Math.max(...levels) || 1;
  return levels.map((level) => Math.max(MIN_BAR, level / loudest));
}

export default function Waveform({ src, audioRef, isPlaying }: WaveformProps) {
  const [levels, setLevels] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) {
      setLevels([]);
      return;
    }
    let current = true;
    measureEnvelope(src, BAR_COUNT)
      .then((measured) => {
        if (current) setLevels(measured);
      })
      .catch(() => {
        // An undecodable clip should leave the panel empty, not crash the page.
        if (current) setLevels([]);
      });
    return () => {
      current = false;
    };
  }, [src]);

  useEffect(() => {
    setProgress(0);
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const read = () => {
      setProgress(el.duration > 0 ? el.currentTime / el.duration : 0);
    };

    if (!isPlaying) {
      cancelAnimationFrame(frameRef.current);
      read();
      return;
    }

    const tick = () => {
      read();
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frameRef.current);
  }, [isPlaying, audioRef]);

  const seek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const el = audioRef.current;
      const box = containerRef.current?.getBoundingClientRect();
      if (!el || !box || !(el.duration > 0)) return;
      const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      el.currentTime = fraction * el.duration;
      setProgress(fraction);
    },
    [audioRef]
  );

  if (levels.length === 0) {
    // Reserve the space so the card does not jump once the envelope lands.
    return <div className="clip-wave clip-wave--empty" aria-hidden="true" />;
  }

  const head = Math.round(progress * levels.length);

  return (
    <div
      ref={containerRef}
      className="clip-wave"
      onClick={seek}
      // The panel's range input remains the real control; this is the picture
      // of it, and a shortcut for pointer users.
      aria-hidden="true"
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className={
            i < head
              ? "clip-wave-bar clip-wave-bar--played"
              : i === head
                ? "clip-wave-bar clip-wave-bar--head"
                : "clip-wave-bar"
          }
          style={{ height: `${(level * 100).toFixed(1)}%` }}
        />
      ))}
    </div>
  );
}
