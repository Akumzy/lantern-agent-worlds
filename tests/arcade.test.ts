import assert from 'node:assert/strict';
import test from 'node:test';
import { arcadeCapabilities, arcadeToolDefinitions, blankAgentProject, demoGames, validateGameSource } from '../lib/arcade';
import { normalizeRuntimeErrors } from '../lib/browser-workspace';

test('advertises only renderers available inside agent game frames', () => {
  assert.deepEqual(arcadeCapabilities.renderers, ['dom', 'canvas_2d', 'webgl']);
  assert.equal(arcadeCapabilities.features.includes('glsl_shaders'), true);
});

test('marks every inspection tool as read-only', () => {
  const readTools = ['get_game_canvas_capabilities', 'list_saved_game_drafts', 'get_game_runtime_diagnostics'];
  for (const name of readTools) {
    const tool = arcadeToolDefinitions.find((candidate) => candidate.name === name);
    assert.equal(tool && 'annotations' in tool && tool.annotations.readOnlyHint, true, `${name} should be read-only`);
  }
});

test('rejects unsafe APIs and obvious unbounded loops', () => {
  const base = { html: '<main>Game</main>', css: '', javascript: '' };
  assert.deepEqual(validateGameSource(base), []);
  assert.match(validateGameSource({ ...base, javascript: 'fetch("/secret")' })[0], /Network requests/);
  assert.match(validateGameSource({ ...base, javascript: 'while(true){}' })[0], /Unbounded while loops/);
  assert.match(validateGameSource({ ...base, javascript: 'for(;;){}' })[0], /Unbounded for loops/);
});

test('creates a safe, playable first revision', () => {
  const game = blankAgentProject({
    id: 'fraction-world-test', title: 'Fraction World', description: 'Repair a bridge with fractions.',
    learningGoal: 'Recognise equivalent fractions.', subject: 'Maths', ageBand: 'Age 8', durationMinutes: 10,
  });
  assert.equal(game.revision, 1);
  assert.equal(game.source, 'agent');
  assert.deepEqual(validateGameSource(game), []);
});

test('ships five distinct, safe six-year-old learning demos', () => {
  assert.deepEqual(demoGames.map((game) => game.id), [
    'number-harbor', 'phonics-forest', 'shape-city-builders', 'tiny-ecosystem-rescue', 'pattern-planet',
  ]);
  for (const game of demoGames) {
    assert.equal(game.ageBand, 'Age 6');
    assert.deepEqual(validateGameSource(game), [], `${game.title} should satisfy the sandbox contract`);
    assert.match(game.javascript, /lantern\.evidence/);
    assert.match(game.javascript, /lantern\.complete/);
  }
});

test('scopes runtime errors by game and migrates the legacy list', () => {
  assert.deepEqual(normalizeRuntimeErrors(['old error'], 'game-a'), { 'game-a': ['old error'] });
  assert.deepEqual(normalizeRuntimeErrors({ 'game-a': ['a'], 'game-b': ['b'] }, 'game-a'), { 'game-a': ['a'], 'game-b': ['b'] });
  assert.deepEqual(normalizeRuntimeErrors(['orphaned'], null), {});
});
