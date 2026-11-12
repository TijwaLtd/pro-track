import { migration001 } from './001_init';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  { version: 1, name: '001_init', sql: migration001 },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;
