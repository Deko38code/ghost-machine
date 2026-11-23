/**
 * PHANTOM AGENTIC LAYER — separate execution path
 * Handles: capabilities / agents / usage / config / --agent-code / --agent-general
 * Returns true if handled (caller should skip existing routing).
 * Returns false if not a new command (existing 54-agent system continues unchanged).
 */
'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function _flags(argv) {
  const f = { tier:'free', provider:'ollama', modelName:null,
              userId: process.env.PHANTOM_USER||'default',
              agentCode:false, agentGeneral:false, verbose:false };
  for (let i=0; i<argv.length; i++) {
    if (argv[i]==='--tier'     && argv[i+1]) f.tier      = argv[++i];
    if (argv[i]==='--provider' && argv[i+1]) f.provider  = argv[++i];
    if (argv[i]==='--model'    && argv[i+1]) f.modelName = argv[++i];
    if (argv[i]==='--user'     && argv[i+1]) f.userId    = argv[++i];
    if (argv[i]==='--agent-code')    f.agentCode    = true;
    if (argv[i]==='--agent-general') f.agentGeneral = true;
    if (argv[i]==='--verbose')       f.verbose      = true;
  }
  return f;
}

function handleAgenticLayer(argv) {
  const cmd  = argv[2];
  const sub  = argv[3];
  const f    = _flags(argv.slice(2));

  // ── phantom personas — ALL agent wrappers through ONE unified path ──
  if (cmd === 'personas') {
    const personas = require('./commands/personas');
    if (sub === 'list') { personas.list(); return true; }
    if (sub === 'run')  { personas.run(argv[4], argv.slice(5).join(' '), { userId:f.userId, tier:f.tier, verbose:f.verbose }); return true; }
    personas.help();
    return true;
  }

  // phantom capabilities
  if (cmd === 'capabilities') {
    require('./commands/capabilities').runCapabilities();
    return true;
  }

  // phantom agents list
  if (cmd === 'agents' && sub === 'list') {
    require('./commands/agents').agentsList();
    return true;
  }

  // phantom agents run <id> "<prompt>"
  if (cmd === 'agents' && sub === 'run') {
    require('./commands/agents').agentsRun(argv[4], argv[5], { userId:f.userId, tier:f.tier, verbose:f.verbose });
    return true;
  }

  // phantom usage show [user_id]
  if (cmd === 'usage' && sub === 'show') {
    require('./commands/usage_cmd').usageShow(argv[4] || f.userId);
    return true;
  }

  // phantom config agents
  if (cmd === 'config' && sub === 'agents') {
    require('./commands/config_agents').configAgents();
    return true;
  }

  // ── phantom boost — system status, skills, routes ───────────
  if (cmd === 'boost') {
    const { execSync } = require('child_process');
    const boostArgs = process.argv.slice(4);
    execSync('node ' + require('path').join(__dirname, 'commands', 'boost.js') + ' ' + (boostArgs.join(' ') || 'status'), { stdio: 'inherit' });
    return true;
  }

  // ── phantom hivemind — all brains, one answer ───────────────
  if (cmd === 'hivemind' || cmd === 'hive') {
    const hiveArgs = process.argv.slice(3);
    const { execSync } = require('child_process');
    execSync('node ' + require('path').join(__dirname, 'commands', 'hivemind.js') + ' ' + hiveArgs.join(' '), { stdio: 'inherit' });
    return true;
  }

  // ── phantom mcp ────────────────────────────────────────────
  const mcp = require('./commands/mcp');
  if (cmd === 'mcp') {
    const action = sub; // list, call, skills, skill, status, tools
    if (action === 'list' || action === 'servers') {
      mcp.listServers();
    } else if (action === 'status') {
      mcp.status();
    } else if (action === 'skills') {
      mcp.listSkills();
    } else if (action === 'skill') {
      mcp.showSkill(argv[4] || '');
    } else if (action === 'call') {
      mcp.callTool(argv[4] || '', argv[5] || '', argv[6] || '{}');
    } else if (action === 'tools') {
      mcp.listTools(argv[4] || '');
    } else {
      console.log(`
  \x1b[95m🔌 phantom mcp — MCP & Skills Bridge\x1b[0m

  \x1b[1mUsage:\x1b[0m
    phantom mcp list            List all MCP servers
    phantom mcp status          Health check all servers
    phantom mcp tools <server>  List tools from an MCP server
    phantom mcp call <s> <t> <args>  Call an MCP tool
    phantom mcp skills          List HaksterAI skills
    phantom mcp skill <name>    Show a skill's full content
`);
    }
    return true;
  }

  // --agent-code or --agent-general flag → route to phantom-agent-all.js
  if (f.agentCode || f.agentGeneral) {
    let phantomAgent;
    try { phantomAgent = require('/home/ghost/phantom-agent-all.js'); }
    catch(e) { console.error('[agentic] phantom-agent-all.js not found:', e.message); return true; }

    const skip = new Set(['--agent-code','--agent-general','--tier','--provider','--model','--user','--verbose']);
    const taskParts = [];
    for (let i=2; i<argv.length; i++) {
      if (skip.has(argv[i])) { i++; continue; }
      taskParts.push(argv[i]);
    }

    async function modelCall(prompt) {
      const { spawnSync } = require('child_process');
      const r = spawnSync('python3',[path.join(ROOT,'core','run_model_call.py'), f.provider, f.modelName||'reflex', prompt],
        { encoding:'utf8', cwd:ROOT });
      return r.stdout || '';
    }

    phantomAgent.runPhantomAgent({
      mode:      f.agentCode ? 'code' : 'general',
      task:      taskParts.join(' '),
      modelCall,
      workspace: process.cwd(),
      userTier:  f.tier,
      userId:    f.userId,
      provider:  f.provider,
      modelName: f.modelName
    });
    return true;
  }

  return false; // not handled — existing CLI continues
}

module.exports = { handleAgenticLayer };
