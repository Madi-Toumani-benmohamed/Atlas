import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoot } from '../dist/atlas.js';
test('React bootstrap is available in the production artifact', () => {
 assert.equal(typeof createRoot, 'function');
});
