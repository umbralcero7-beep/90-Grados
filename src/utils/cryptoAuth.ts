/**
 * Módulo Criptográfico de Autenticación de PINs - 90 Grados POS
 * Implementa derivación PBKDF2-HMAC-SHA256 con 100.000 iteraciones y sal criptográfica de 16 bytes.
 * Es 100% interoperable con el backend FastAPI (backend/security/security_config.py).
 * NUNCA almacena ni transmite contraseñas o PINs en texto plano.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deriva un hash seguro a partir de un PIN numérico y una sal única.
 */
export async function hashPinPBKDF2(
  pin: string,
  customSaltHex?: string
): Promise<{ pinHash: string; pinSalt: string }> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('El PIN debe ser estrictamente numérico de 4 a 6 dígitos.');
  }

  let saltBytes: Uint8Array;
  let pinSalt: string;

  if (customSaltHex && customSaltHex.length >= 32) {
    pinSalt = customSaltHex;
    saltBytes = hexToBytes(pinSalt);
  } else {
    saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes as unknown as Uint8Array<ArrayBuffer>);
    pinSalt = bytesToHex(saltBytes);
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const pinHash = bytesToHex(new Uint8Array(derivedBits));
  return { pinHash, pinSalt };
}

/**
 * Verifica si un PIN ingresado coincide con el hash derivado y su sal.
 * Utiliza comparación de longitud constante para mitigar ataques de temporización.
 */
export async function verifyPinPBKDF2(
  pin: string,
  pinHash: string,
  pinSalt: string
): Promise<boolean> {
  if (!pin || !pinHash || !pinSalt) return false;
  if (!/^\d{4,6}$/.test(pin)) return false;

  try {
    const { pinHash: computedHash } = await hashPinPBKDF2(pin, pinSalt);

    // Comparación de tiempo constante
    if (computedHash.length !== pinHash.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computedHash.length; i++) {
      mismatch |= computedHash.charCodeAt(i) ^ pinHash.charCodeAt(i);
    }
    return mismatch === 0;
  } catch (err) {
    console.error('Error al verificar PIN criptográficamente:', err);
    return false;
  }
}
