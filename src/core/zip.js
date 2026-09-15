/**
 * Tiny dependency-free ZIP writer (store/no-compression) for browser evidence
 * packs. It intentionally supports only the subset needed by this application:
 * UTF-8 file names and in-memory text/blob payloads.
 */
const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
function concat(parts) {
  const size = parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(size);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
async function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return encoder.encode(String(value ?? ""));
}

export async function zipBlob(files = []) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(String(file.name || "file.txt"));
    const data = await bytesOf(file.data);
    const crc = crc32(data), size = data.length;
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(name.length), u16(0), name, data
    ]);
    locals.push(local);
    centrals.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += local.length;
  }
  const central = concat(centrals), body = concat(locals);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(body.length), u16(0)]);
  return new Blob([body, central, end], { type: "application/zip" });
}
