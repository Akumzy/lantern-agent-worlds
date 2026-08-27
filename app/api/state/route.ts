import { env } from 'cloudflare:workers';
import { createSeedState, hydrateLanternState, mutateTool, readTool, recordLearnerAction, type LanternState } from '../../../lib/lantern';

export const dynamic = 'force-dynamic';
const WORKSPACE_ID = 'default';

async function ensureWorkspace() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lantern_workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  const row = await env.DB.prepare('SELECT payload FROM lantern_workspaces WHERE id = ?').bind(WORKSPACE_ID).first<{payload:string}>();
  if (row) return hydrateLanternState(JSON.parse(row.payload) as LanternState);
  const seed = createSeedState();
  await env.DB.prepare('INSERT OR IGNORE INTO lantern_workspaces (id, revision, payload, updated_at) VALUES (?, ?, ?, ?)')
    .bind(WORKSPACE_ID, seed.revision, JSON.stringify(seed), new Date().toISOString()).run();
  const saved = await env.DB.prepare('SELECT payload FROM lantern_workspaces WHERE id = ?').bind(WORKSPACE_ID).first<{payload:string}>();
  return saved ? JSON.parse(saved.payload) as LanternState : seed;
}

async function saveState(previousRevision:number, state:LanternState) {
  const result = await env.DB.prepare('UPDATE lantern_workspaces SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?')
    .bind(state.revision, JSON.stringify(state), new Date().toISOString(), WORKSPACE_ID, previousRevision).run();
  return Number(result.meta.changes || 0) === 1;
}

export async function GET() {
  try { return Response.json(await ensureWorkspace(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ ok:false, code:'storage_unavailable', summary:error instanceof Error?error.message:'Lantern state is unavailable.' }, { status:500 }); }
}

export async function POST(request:Request) {
  try {
    const body = await request.json() as {kind:'tool'|'learner';name?:string;args:Record<string,unknown>};
    const current = await ensureWorkspace();
    if (body.kind === 'tool' && body.name?.startsWith('get_') || body.kind === 'tool' && body.name === 'list_courses') return Response.json(readTool(current, body.name!, body.args || {}));
    const operation = body.kind === 'learner' ? recordLearnerAction(current, body.args || {}) : mutateTool(current, body.name || '', body.args || {});
    if (!operation.state) return Response.json(operation.result, { status: operation.result.code === 'revision_conflict' ? 409 : 400 });
    if (!await saveState(current.revision, operation.state)) return Response.json({ ok:false, code:'revision_conflict', summary:'The course changed while this request was being saved. Read fresh context before retrying.' }, { status:409 });
    return Response.json(operation.result);
  } catch (error) { return Response.json({ ok:false, code:'invalid_component_data', summary:error instanceof Error?error.message:'The request could not be processed.' }, { status:400 }); }
}
