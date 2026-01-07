import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { err } from './errors';

const ajv = new Ajv({ allErrors: true, removeAdditional: false, strict: true });
addFormats(ajv);

export function validateOrThrow<T>(schema: object, data: unknown): T {
  const validate = ajv.compile(schema as any);
  const ok = validate(data);
  if (!ok) {
    err('INVALID_ARGUMENT', 'VALIDATION_FAILED', { errors: validate.errors ?? [] });
  }
  return data as T;
}
