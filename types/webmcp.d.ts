interface LanternModelContext {
  registerTool(tool:{name:string;description:string;inputSchema?:Record<string,unknown>;annotations?:Record<string,unknown>;execute:(input:Record<string,unknown>)=>unknown|Promise<unknown>},options?:{signal?:AbortSignal}):Promise<void>|void;
}
interface Document { modelContext?:LanternModelContext }
interface Navigator { modelContext?:LanternModelContext }
