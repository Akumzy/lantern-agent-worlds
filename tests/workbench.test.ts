import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CurrentBuild from '../components/CurrentBuild';
import LanternArcade from '../components/LanternArcade';
import { arcadeToolDefinitions, blankAgentProject } from '../lib/arcade';
import { exampleRequest, isExampleRequest, resumedBuildPhase, toolActivityLabels } from '../lib/workbench-state';

const game = blankAgentProject({
  id: 'bunny-letter-garden', title: 'Bunny’s Letter Garden',
  description: 'Grow a flower for each matched letter.', learningGoal: 'Recognise and type A, S, and D.',
  subject: 'Typing', ageBand: 'Age 6', durationMinutes: 5,
});

test('setup starts empty and offers the demo only as a labelled example', () => {
  const markup = renderToStaticMarkup(createElement(LanternArcade));
  assert.match(markup, /placeholder="Example: A colorful harbor adventure/);
  assert.match(markup, /<textarea[^>]*><\/textarea>/);
  assert.match(markup, />Use example<\/button>/);
  assert.match(markup, /class="workbench-copy"[^>]*disabled/);
  assert.doesNotMatch(markup, /Agent connected/);
});

test('active game summary uses only the draft metadata, never the setup example', () => {
  const markup = renderToStaticMarkup(createElement(CurrentBuild, { project: game, onStartFresh: () => {} }));
  for (const text of [game.title, game.learningGoal, game.ageBand, game.subject, game.description]) {
    assert.ok(markup.includes(text), `Missing ${text}`);
  }
  assert.doesNotMatch(markup, /harbor|textarea|Copy for my browser agent|Build brief/);
  assert.match(markup, /<details[^>]*><summary>Game details<\/summary>/);
  assert.match(markup, />Start another game<\/button>/);
});

test('saved prefilled examples remain distinguishable from custom requests', () => {
  assert.equal(isExampleRequest(exampleRequest), true);
  assert.equal(isExampleRequest('A multiplication adventure for an 8-year-old who loves space. Practise the 6 times table with three short levels.'), true);
  assert.equal(isExampleRequest('A bridge-building adventure for an 8-year-old. Practise equivalent fractions by repairing three sections of a sky bridge.'), true);
  assert.equal(isExampleRequest('Build a typing game with a bunny.'), false);
  assert.equal(isExampleRequest(''), false);
});

test('resume distinguishes unfinished placeholders, playable revisions, and review', () => {
  assert.equal(resumedBuildPhase(game), 'drafting');
  assert.equal(resumedBuildPhase({ ...game, revision: 2 }), 'preview');
  assert.equal(resumedBuildPhase({ ...game, revision: 3, status: 'review' }), 'review');
});

test('every agent tool has an activity label that does not promise a live connection', () => {
  for (const tool of arcadeToolDefinitions) {
    assert.ok(toolActivityLabels[tool.name], `Missing activity label for ${tool.name}`);
    assert.doesNotMatch(toolActivityLabels[tool.name], /connected|building|ready/i);
  }
});
