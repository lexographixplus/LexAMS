import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeMigrationSql } from '../scripts/migration-utils.mjs';

test('migration checksums are stable across platform line endings', () => {
  const windowsSql = 'create table example (\r\n  id bigint primary key\r\n);\r\n';
  const unixSql = windowsSql.replace(/\r\n/g, '\n');
  const checksum = sql => createHash('sha256').update(normalizeMigrationSql(sql)).digest('hex');

  assert.equal(checksum(windowsSql), checksum(unixSql));
  assert.equal(normalizeMigrationSql('select 1;\rselect 2;'), 'select 1;\nselect 2;');
});
