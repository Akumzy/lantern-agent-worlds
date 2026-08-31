import type { GameProject } from './arcade';
import type { StoredBuildPhase } from './browser-workspace';

export const exampleRequest = 'A colorful harbor adventure for a 6-year-old learning addition and subtraction within 20. Pilot a small boat between three islands and load the correct number of cargo crates to complete each equation.';

const exampleRequests = new Set([
  exampleRequest,
  'A multiplication adventure for an 8-year-old who loves space. Practise the 6 times table with three short levels.',
  'A bridge-building adventure for an 8-year-old. Practise equivalent fractions by repairing three sections of a sky bridge.',
]);

// Older workspaces saved the prefilled demo as if it were a user's brief.
// Preserve that text, but identify it honestly instead of associating it with a draft.
export function isExampleRequest(request: string) {
  return exampleRequests.has(request.trim());
}

export function resumedBuildPhase(project: GameProject): StoredBuildPhase {
  if (project.status === 'review') return 'review';
  return project.revision === 1 ? 'drafting' : 'preview';
}

export const toolActivityLabels: Record<string, string> = {
  get_game_canvas_capabilities: 'Read canvas capabilities',
  list_saved_game_drafts: 'Listed saved drafts',
  get_game_runtime_diagnostics: 'Read game diagnostics',
  create_game_draft: 'Requested a new draft',
  resume_game_draft: 'Requested a saved draft',
  set_game_source: 'Submitted game source',
  preview_game: 'Requested a playtest',
  request_game_review: 'Requested human review',
};
