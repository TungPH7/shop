package com.tungph7.learnpostgres.common.domain;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * UUIDv7 generator (RFC 9562 §5.7).
 *
 * <p>Layout: bytes 0..5 = {@code unix_ts_ms} (48-bit big-endian); byte 6 = {@code (ver=0111) << 4 |
 * random nibble}; byte 8 = {@code (var=10) << 6 | random 6-bit}; remaining bytes are random.
 *
 * <p>Mirrors the {@code app.gen_uuid_v7()} function defined in the database migration scripts —
 * same RFC, so UUIDs minted from Java or from the database are both valid and time-ordered.
 *
 * <p>Trade-off: NOT monotonic within the same millisecond (if multiple UUIDs are generated in the
 * same millisecond, their order inside that millisecond is random). For app traffic on the order of
 * ~1k INSERT/s, collisions within a millisecond still preserve ms-level ordering, which is enough
 * to be B-tree friendly.
 */
public final class UuidV7 {

  private static final SecureRandom RANDOM = new SecureRandom();

  private UuidV7() {
    // utility class — not instantiable
  }

  public static UUID generate() {
    long timestampMs = System.currentTimeMillis();
    byte[] bytes = new byte[16];
    RANDOM.nextBytes(bytes);

    // First 6 bytes = unix_ts_ms (big-endian)
    bytes[0] = (byte) (timestampMs >>> 40);
    bytes[1] = (byte) (timestampMs >>> 32);
    bytes[2] = (byte) (timestampMs >>> 24);
    bytes[3] = (byte) (timestampMs >>> 16);
    bytes[4] = (byte) (timestampMs >>> 8);
    bytes[5] = (byte) timestampMs;

    // Byte 6: high 4 bits = version 7 (0111), low 4 bits stay random
    bytes[6] = (byte) ((bytes[6] & 0x0F) | 0x70);

    // Byte 8: high 2 bits = variant '10' (RFC 4122), low 6 bits stay random
    bytes[8] = (byte) ((bytes[8] & 0x3F) | 0x80);

    return toUuid(bytes);
  }

  private static UUID toUuid(byte[] bytes) {
    long msb = 0L;
    long lsb = 0L;
    for (int i = 0; i < 8; i++) {
      msb = (msb << 8) | (bytes[i] & 0xFFL);
    }
    for (int i = 8; i < 16; i++) {
      lsb = (lsb << 8) | (bytes[i] & 0xFFL);
    }
    return new UUID(msb, lsb);
  }
}
