/**
 * Content schema versions this app can show. A manifest, course or lesson with another
 * `schemaVersion` gives a ContentError with reason `unsupported-version`.
 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

export function isSupportedSchemaVersion(value: unknown): boolean {
  return typeof value === 'number' && SUPPORTED_SCHEMA_VERSIONS.includes(value);
}
