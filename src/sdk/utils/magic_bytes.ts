const MAGIC_SIGNATURES = [
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { ext: "zip", mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

function looksBase64(value: string) {
  const trimmed = value.trim();
  return trimmed.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(trimmed);
}

function toBytes(value: string) {
  if (looksBase64(value)) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length > 0) {
      return decoded;
    }
  }
  return Buffer.from(value, "utf8");
}

function startsWith(data: Uint8Array, bytes: number[]) {
  if (data.length < bytes.length) {
    return false;
  }
  for (let i = 0; i < bytes.length; i += 1) {
    if (data[i] !== bytes[i]) {
      return false;
    }
  }
  return true;
}

function isWebp(data: Uint8Array) {
  if (data.length < 12) {
    return false;
  }
  return (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  );
}

function isMp4(data: Uint8Array) {
  if (data.length < 12) {
    return false;
  }
  return data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
}

export function readMagicBytes(chunk: string) {
  const data = toBytes(chunk);
  for (const sig of MAGIC_SIGNATURES) {
    if (startsWith(data, sig.bytes)) {
      return { ext: sig.ext, mime: sig.mime };
    }
  }
  if (isWebp(data)) {
    return { ext: "webp", mime: "image/webp" };
  }
  if (isMp4(data)) {
    return { ext: "mp4", mime: "video/mp4" };
  }
  return { ext: "bin", mime: "application/octet-stream" };
}
