/**
 * Re-encoding audio to Ogg Opus in the browser, with no library.
 *
 * The other two strategies in lib/audioSplit make a long file *fit* by cutting
 * it up; this one makes it small. Speech at 24 kbps mono is around 3 KB per
 * second, so a ten-minute recording lands near 1.4 MB and goes up in a single
 * request instead of three or five. Whisper resamples everything to 16 kHz
 * anyway, so what Opus discards at this bitrate is mostly what Whisper was
 * going to throw away.
 *
 * WebCodecs gives us an Opus *encoder* but not a container: `AudioEncoder`
 * emits bare Opus packets, and Whisper needs a file. So the packets are muxed
 * into Ogg here — page headers, lacing, granule positions and the checksum.
 *
 * Availability is not assumed. `AudioEncoder` is absent in some browsers and
 * the Opus config can be refused even where it exists, which is why
 * `canEncodeOpus()` asks rather than sniffs the user agent.
 */

/** Opus is defined at 48 kHz; granule positions are counted there whatever the input rate. */
const OPUS_RATE = 48000;

/** 20 ms frames — libopus's default, and what the browser encoder emits. */
const SAMPLES_PER_FRAME = OPUS_RATE / 50;

/** Speech-rate mono Opus. Well above what Whisper needs, still tiny. */
export const OPUS_BITRATE = 24000;

/** Ogg caps a page at 255 segments; each packet costs at least one. */
const MAX_SEGMENTS_PER_PAGE = 248;

/* ------------------------------------------------------------------ CRC -- */

/**
 * Ogg's CRC32: polynomial 0x04c11db7, no reflection and no final inversion.
 * That is not the zlib/PNG variant, and using that one instead produces files
 * that look right and every decoder rejects.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80000000 ? ((crc << 1) ^ 0x04c11db7) >>> 0 : (crc << 1) >>> 0;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function oggCrc32(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

/* ----------------------------------------------------------------- page -- */

export interface OggPageOptions {
  packets: Uint8Array[];
  granulePosition: number;
  serial: number;
  sequence: number;
  /** First page of the stream. */
  begin?: boolean;
  /** Last page of the stream. */
  end?: boolean;
}

/**
 * Lacing values for a packet: as many 255s as fit, then the remainder. A
 * packet whose length is an exact multiple of 255 needs a trailing zero, or
 * the decoder reads it as continuing into the next page.
 */
function lacing(length: number): number[] {
  const values: number[] = [];
  let left = length;
  while (left >= 255) {
    values.push(255);
    left -= 255;
  }
  values.push(left);
  return values;
}

/** One complete Ogg page, checksum included. */
export function buildOggPage({
  packets,
  granulePosition,
  serial,
  sequence,
  begin = false,
  end = false,
}: OggPageOptions): Uint8Array {
  const segments: number[] = [];
  for (const packet of packets) segments.push(...lacing(packet.length));

  const payloadLength = packets.reduce((n, p) => n + p.length, 0);
  const page = new Uint8Array(27 + segments.length + payloadLength);
  const view = new DataView(page.buffer);

  page.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  page[4] = 0; // stream structure version
  page[5] = (begin ? 0x02 : 0) | (end ? 0x04 : 0);

  // Granule position is 64-bit; a page count that large is not reachable here,
  // but the field still has to be written in full.
  view.setUint32(6, granulePosition >>> 0, true);
  view.setUint32(10, Math.floor(granulePosition / 0x100000000), true);

  view.setUint32(14, serial, true);
  view.setUint32(18, sequence, true);
  view.setUint32(22, 0, true); // checksum, filled in below
  page[26] = segments.length;
  page.set(segments, 27);

  let at = 27 + segments.length;
  for (const packet of packets) {
    page.set(packet, at);
    at += packet.length;
  }

  view.setUint32(22, oggCrc32(page), true);
  return page;
}

/* --------------------------------------------------------------- headers -- */

/** The OpusHead identification packet, when the encoder does not supply one. */
export function buildOpusHead(channels: number, preSkip: number, inputRate: number): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  head[8] = 1; // version
  head[9] = channels;
  view.setUint16(10, preSkip, true);
  view.setUint32(12, inputRate, true);
  view.setInt16(16, 0, true); // output gain
  head[18] = 0; // channel mapping family: mono/stereo
  return head;
}

/** The OpusTags comment packet. Required by the spec even when empty. */
export function buildOpusTags(vendor = "TransTTS"): Uint8Array {
  const vendorBytes = new TextEncoder().encode(vendor);
  const tags = new Uint8Array(8 + 4 + vendorBytes.length + 4);
  const view = new DataView(tags.buffer);
  tags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // "OpusTags"
  view.setUint32(8, vendorBytes.length, true);
  tags.set(vendorBytes, 12);
  view.setUint32(12 + vendorBytes.length, 0, true); // zero user comments
  return tags;
}

/* ------------------------------------------------------------------ mux -- */

export interface OpusPacket {
  data: Uint8Array;
  /** Samples this packet represents, at 48 kHz. */
  samples: number;
}

/**
 * Wrap Opus packets in an Ogg stream.
 *
 * The two header packets each get a page of their own — the spec requires the
 * identification header to be alone on the first page — and the audio is then
 * packed until the segment table fills.
 */
export function muxOggOpus(packets: OpusPacket[], opusHead: Uint8Array, serial: number): Blob {
  const pages: Uint8Array[] = [];
  let sequence = 0;

  pages.push(buildOggPage({ packets: [opusHead], granulePosition: 0, serial, sequence: sequence++, begin: true }));
  pages.push(buildOggPage({ packets: [buildOpusTags()], granulePosition: 0, serial, sequence: sequence++ }));

  let granule = 0;
  let batch: Uint8Array[] = [];
  let segments = 0;

  const flush = (isLast: boolean) => {
    if (batch.length === 0) return;
    pages.push(
      buildOggPage({ packets: batch, granulePosition: granule, serial, sequence: sequence++, end: isLast })
    );
    batch = [];
    segments = 0;
  };

  for (let i = 0; i < packets.length; i++) {
    const needed = lacing(packets[i].data.length).length;
    if (segments + needed > MAX_SEGMENTS_PER_PAGE) flush(false);
    batch.push(packets[i].data);
    segments += needed;
    granule += packets[i].samples;
  }
  flush(true);

  // An empty stream still needs a terminating page, or decoders report it as
  // truncated rather than as zero-length.
  if (packets.length === 0) {
    pages.push(buildOggPage({ packets: [new Uint8Array(0)], granulePosition: 0, serial, sequence, end: true }));
  }

  return new Blob(pages as BlobPart[], { type: "audio/ogg" });
}

/* -------------------------------------------------------------- encoding -- */

type AudioEncoderCtor = typeof AudioEncoder;

function encoderCtor(): AudioEncoderCtor | null {
  return typeof AudioEncoder === "undefined" ? null : AudioEncoder;
}

/** Whether this browser will actually encode Opus for us. */
export async function canEncodeOpus(): Promise<boolean> {
  const Encoder = encoderCtor();
  if (!Encoder) return false;
  try {
    const support = await Encoder.isConfigSupported({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: 1,
      bitrate: OPUS_BITRATE,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Encode mono 48 kHz PCM to an Ogg Opus file.
 *
 * `serial` identifies the logical bitstream. It is a parameter rather than a
 * random value so a given input always produces identical bytes, which keeps
 * this testable.
 */
export async function encodeOggOpus(pcm48: Float32Array, serial = 0x5472_616e): Promise<Blob> {
  const Encoder = encoderCtor();
  if (!Encoder) throw new Error("AudioEncoder is unavailable in this browser");

  const packets: OpusPacket[] = [];
  let headerFromEncoder: Uint8Array | null = null;

  let failure: Error | null = null;
  const encoder = new Encoder({
    output: (chunk, metadata) => {
      // Chrome hands back a decoderConfig whose description is a ready-made
      // OpusHead, carrying the encoder's real pre-skip. Preferred over ours.
      const description = metadata?.decoderConfig?.description;
      if (!headerFromEncoder && description) {
        const bytes = ArrayBuffer.isView(description)
          ? new Uint8Array(description.buffer as ArrayBuffer, description.byteOffset, description.byteLength)
          : new Uint8Array(description as ArrayBuffer);
        if (bytes.length >= 19) headerFromEncoder = bytes.slice();
      }

      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const samples = chunk.duration ? Math.round((chunk.duration * OPUS_RATE) / 1_000_000) : SAMPLES_PER_FRAME;
      packets.push({ data, samples });
    },
    error: (err: DOMException) => {
      failure = new Error(`Opus encoding failed: ${err.message}`);
    },
  });

  encoder.configure({
    codec: "opus",
    sampleRate: OPUS_RATE,
    numberOfChannels: 1,
    bitrate: OPUS_BITRATE,
  });

  // Feed whole frames; a short final frame is zero-padded, which costs at most
  // 20 ms of silence at the end.
  for (let offset = 0; offset < pcm48.length; offset += SAMPLES_PER_FRAME) {
    if (failure) break;
    const frame = new Float32Array(SAMPLES_PER_FRAME);
    frame.set(pcm48.subarray(offset, Math.min(offset + SAMPLES_PER_FRAME, pcm48.length)));
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: OPUS_RATE,
      numberOfFrames: SAMPLES_PER_FRAME,
      numberOfChannels: 1,
      timestamp: Math.round((offset / OPUS_RATE) * 1_000_000),
      data: frame,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
  if (failure) throw failure;

  // 312 samples is libopus's lookahead at 48 kHz, used only when the browser
  // did not tell us the real figure.
  const head = headerFromEncoder ?? buildOpusHead(1, 312, OPUS_RATE);
  return muxOggOpus(packets, head, serial);
}
