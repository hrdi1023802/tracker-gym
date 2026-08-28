/**
 * Codificador mínimo de archivos FIT (protocolo 2.0, little endian).
 *
 * Sólo implementa lo necesario para generar archivos de tipo `workout`
 * (entrenamientos planificados) que Garmin Connect y los relojes Garmin
 * aceptan como importación. Referencia: FIT Protocol / FIT SDK de Garmin.
 */

/** Tipos base FIT usados por este codificador (byte de la definición de campo). */
export const BaseType = {
  enum: 0x00,
  uint8: 0x02,
  uint16: 0x84,
  uint32: 0x86,
  string: 0x07,
  uint32z: 0x8c,
} as const;

export type BaseTypeName = keyof typeof BaseType;

/** Valor "inválido" (campo sin dato) de cada tipo base. */
const INVALID: Record<BaseTypeName, number> = {
  enum: 0xff,
  uint8: 0xff,
  uint16: 0xffff,
  uint32: 0xffffffff,
  string: 0,
  uint32z: 0,
};

export interface FieldDef {
  /** Número de campo dentro del mensaje global. */
  num: number;
  name: string;
  type: BaseTypeName;
  /** Bytes reservados. Para `string` es la longitud fija (incluye el `\0`). */
  size?: number;
}

export interface MessageDef {
  /** Número de mensaje global del perfil FIT (file_id = 0, workout = 26...). */
  globalNum: number;
  localNum: number;
  fields: FieldDef[];
}

export type MessageValues = Record<string, number | string | undefined>;

function fieldSize(f: FieldDef): number {
  if (f.type === 'string') return f.size ?? 16;
  return { enum: 1, uint8: 1, uint16: 2, uint32: 4, uint32z: 4 }[f.type];
}

class ByteWriter {
  private buf = new Uint8Array(4096);
  private len = 0;

  private ensure(extra: number) {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  u8(v: number) {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }

  u16(v: number) {
    this.u8(v);
    this.u8(v >>> 8);
  }

  u32(v: number) {
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }

  bytes(src: Uint8Array) {
    this.ensure(src.length);
    this.buf.set(src, this.len);
    this.len += src.length;
  }

  get length() {
    return this.len;
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** CRC-16 del protocolo FIT. */
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(data: Uint8Array, seed = 0): number {
  let crc = seed;
  for (const byte of data) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc & 0xffff;
}

/** Fecha FIT: segundos desde 1989-12-31T00:00:00Z. */
export const FIT_EPOCH_OFFSET = 631065600;

export function toFitTimestamp(date: Date): number {
  return Math.max(0, Math.floor(date.getTime() / 1000) - FIT_EPOCH_OFFSET);
}

function encodeString(value: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const encoded = new TextEncoder().encode(value);
  // Se reserva siempre el último byte para el terminador nulo.
  out.set(encoded.subarray(0, size - 1));
  return out;
}

/**
 * Construye un archivo FIT a partir de una secuencia de mensajes.
 * Cada mensaje se emite con su definición la primera vez que aparece su
 * `localNum`, y luego sólo como mensaje de datos.
 */
export class FitFileBuilder {
  private records = new ByteWriter();
  private defined = new Map<number, MessageDef>();

  add(def: MessageDef, values: MessageValues) {
    const known = this.defined.get(def.localNum);
    if (known !== def) {
      this.writeDefinition(def);
      this.defined.set(def.localNum, def);
    }
    this.writeData(def, values);
  }

  private writeDefinition(def: MessageDef) {
    this.records.u8(0x40 | (def.localNum & 0x0f)); // cabecera de definición
    this.records.u8(0); // reservado
    this.records.u8(0); // arquitectura: little endian
    this.records.u16(def.globalNum);
    this.records.u8(def.fields.length);
    for (const field of def.fields) {
      this.records.u8(field.num);
      this.records.u8(fieldSize(field));
      this.records.u8(BaseType[field.type]);
    }
  }

  private writeData(def: MessageDef, values: MessageValues) {
    this.records.u8(def.localNum & 0x0f); // cabecera de datos
    for (const field of def.fields) {
      const raw = values[field.name];
      const size = fieldSize(field);
      if (field.type === 'string') {
        this.records.bytes(encodeString(typeof raw === 'string' ? raw : '', size));
        continue;
      }
      const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : INVALID[field.type];
      if (size === 1) this.records.u8(value);
      else if (size === 2) this.records.u16(value);
      else this.records.u32(value);
    }
  }

  /** Devuelve el archivo completo: cabecera + registros + CRC. */
  build(): Uint8Array {
    const body = this.records.toUint8Array();
    const header = new ByteWriter();
    header.u8(14); // tamaño de cabecera
    header.u8(0x20); // versión de protocolo 2.0
    header.u16(2140); // versión de perfil (21.40)
    header.u32(body.length);
    header.bytes(new TextEncoder().encode('.FIT'));
    const headerBytes = header.toUint8Array();
    const headerCrc = fitCrc(headerBytes);

    const out = new Uint8Array(14 + body.length + 2);
    out.set(headerBytes, 0);
    out[12] = headerCrc & 0xff;
    out[13] = (headerCrc >>> 8) & 0xff;
    out.set(body, 14);
    const fileCrc = fitCrc(out.subarray(0, 14 + body.length));
    out[out.length - 2] = fileCrc & 0xff;
    out[out.length - 1] = (fileCrc >>> 8) & 0xff;
    return out;
  }
}
