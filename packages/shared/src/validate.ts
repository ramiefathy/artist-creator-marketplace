import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

export function validateWithSchema<T>(schema: object, data: unknown): { ok: true; data: T } | { ok: false; errors: any } {
  const validate = ajv.compile(schema as any);
  const ok = validate(data);
  if (!ok) return { ok: false, errors: validate.errors ?? [] };
  return { ok: true, data: data as T };
}
