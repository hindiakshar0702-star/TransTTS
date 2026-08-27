import { test, expect } from "@playwright/test";
import { oggCrc32, buildOggPage, buildOpusHead, buildOpusTags, muxOggOpus } from "../src/lib/oggOpus";

/**
 * The Ogg container written around the browser's Opus packets.
 *
 * Nothing here is negotiable: a decoder either accepts the bytes or rejects the
 * whole stream, and it does so without saying which field was wrong. These
 * tests pin the parts that are easy to get subtly wrong and impossible to
 * notice by listening — the checksum variant, the lacing of a packet whose
 * length is a multiple of 255, and the begin/end flags.
 */

const u32 = (page: Uint8Array, at: number) => new DataView(page.buffer, page.byteOffset).getUint32(at, true);
const ascii = (page: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...page.slice(at, at + len));

/**
 * The same CRC computed the slow way, bit by bit, with no lookup table.
 * If the table in the module were built from the wrong polynomial — the zlib
 * one is the tempting mistake — these two would disagree.
 */
function referenceCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc = (crc ^ (byte << 24)) >>> 0;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80000000 ? ((crc << 1) ^ 0x04c11db7) >>> 0 : (crc << 1) >>> 0;
    }
  }
  return crc >>> 0;
}

test.describe("Ogg checksum", () => {
  test("matches a table-free implementation of the same polynomial", () => {
    for (const sample of [new Uint8Array(0), new Uint8Array([0]), new Uint8Array([1, 2, 3, 250, 255]),
      new Uint8Array(Array.from({ length: 300 }, (_, i) => (i * 37) & 0xff))]) {
      expect(oggCrc32(sample)).toBe(referenceCrc(sample));
    }
  });

  test("depends on order, so a transposition cannot slip through", () => {
    expect(oggCrc32(new Uint8Array([1, 2]))).not.toBe(oggCrc32(new Uint8Array([2, 1])));
  });
});

test.describe("Ogg page", () => {
  test("carries the checksum of its own finished bytes", () => {
    const page = buildOggPage({
      packets: [new Uint8Array([1, 2, 3, 4])],
      granulePosition: 960,
      serial: 0x1234,
      sequence: 7,
    });

    const stored = u32(page, 22);
    // Recompute the way a decoder does: zero the field, checksum the rest.
    const zeroed = page.slice();
    zeroed[22] = zeroed[23] = zeroed[24] = zeroed[25] = 0;
    expect(oggCrc32(zeroed)).toBe(stored);
  });

  test("writes the header fields where the spec puts them", () => {
    const page = buildOggPage({
      packets: [new Uint8Array(10)],
      granulePosition: 48000,
      serial: 0xabcd,
      sequence: 3,
      begin: true,
    });

    expect(ascii(page, 0, 4)).toBe("OggS");
    expect(page[4]).toBe(0); // stream structure version
    expect(page[5]).toBe(0x02); // begin-of-stream
    expect(u32(page, 6)).toBe(48000); // granule, low half
    expect(u32(page, 10)).toBe(0); // granule, high half
    expect(u32(page, 14)).toBe(0xabcd);
    expect(u32(page, 18)).toBe(3);
    expect(page[26]).toBe(1); // one lacing value for a 10-byte packet
    expect(page[27]).toBe(10);
  });

  test("terminates a 255-byte packet with a zero lacing value", () => {
    // Without the trailing zero a decoder reads the packet as continuing into
    // the next page, and the stream desynchronises from there on.
    const page = buildOggPage({
      packets: [new Uint8Array(255)],
      granulePosition: 0,
      serial: 1,
      sequence: 0,
    });
    expect(page[26]).toBe(2);
    expect(page[27]).toBe(255);
    expect(page[28]).toBe(0);
  });

  test("flags end-of-stream separately from begin", () => {
    const end = buildOggPage({ packets: [new Uint8Array(1)], granulePosition: 0, serial: 1, sequence: 9, end: true });
    expect(end[5]).toBe(0x04);
  });
});

test.describe("Opus headers", () => {
  test("OpusHead states version, channels and pre-skip", () => {
    const head = buildOpusHead(1, 312, 48000);
    expect(ascii(head, 0, 8)).toBe("OpusHead");
    expect(head[8]).toBe(1); // version
    expect(head[9]).toBe(1); // mono
    const view = new DataView(head.buffer);
    expect(view.getUint16(10, true)).toBe(312);
    expect(view.getUint32(12, true)).toBe(48000);
    expect(head[18]).toBe(0); // mapping family
  });

  test("OpusTags is present and declares no comments", () => {
    const tags = buildOpusTags("TransTTS");
    expect(ascii(tags, 0, 8)).toBe("OpusTags");
    const view = new DataView(tags.buffer);
    expect(view.getUint32(8, true)).toBe(8); // vendor length
    expect(view.getUint32(20, true)).toBe(0); // comment count
  });
});

test.describe("stream layout", () => {
  const packet = (n: number) => ({ data: new Uint8Array(n).fill(0x7f), samples: 960 });

  async function pages(blob: Blob): Promise<Uint8Array[]> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const found: Uint8Array[] = [];
    let at = 0;
    while (at + 27 <= bytes.length) {
      const segCount = bytes[at + 26];
      const payload = bytes.slice(at + 27, at + 27 + segCount).reduce((s, v) => s + v, 0);
      const size = 27 + segCount + payload;
      found.push(bytes.slice(at, at + size));
      at += size;
    }
    return found;
  }

  test("opens with OpusHead alone, then OpusTags, and closes with end-of-stream", async () => {
    const blob = muxOggOpus([packet(100), packet(120)], buildOpusHead(1, 312, 48000), 42);
    const all = await pages(blob);

    expect(all.length).toBeGreaterThanOrEqual(3);
    // The identification header must be the only packet on the first page.
    expect(all[0][5]).toBe(0x02);
    expect(all[0][26]).toBe(1);
    expect(ascii(all[0], 28, 8)).toBe("OpusHead");
    expect(ascii(all[1], 28, 8)).toBe("OpusTags");
    expect(all[all.length - 1][5]).toBe(0x04);
  });

  test("numbers pages consecutively and shares one serial", async () => {
    const blob = muxOggOpus(Array.from({ length: 5 }, () => packet(80)), buildOpusHead(1, 312, 48000), 99);
    const all = await pages(blob);
    all.forEach((page, i) => {
      expect(u32(page, 14)).toBe(99);
      expect(u32(page, 18)).toBe(i);
    });
  });

  test("granule reaches the total sample count", async () => {
    const count = 50;
    const blob = muxOggOpus(Array.from({ length: count }, () => packet(90)), buildOpusHead(1, 312, 48000), 7);
    const all = await pages(blob);
    // Headers sit at granule 0; the final audio page carries the running total.
    expect(u32(all[all.length - 1], 6)).toBe(count * 960);
    expect(u32(all[0], 6)).toBe(0);
    expect(u32(all[1], 6)).toBe(0);
  });

  test("splits across pages rather than overflowing the 255-segment table", async () => {
    const blob = muxOggOpus(Array.from({ length: 400 }, () => packet(50)), buildOpusHead(1, 312, 48000), 5);
    const all = await pages(blob);
    expect(all.length).toBeGreaterThan(3);
    for (const page of all) expect(page[26]).toBeLessThanOrEqual(255);
  });
});
