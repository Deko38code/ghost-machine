#!/usr/bin/env node
/**
 * brain_inject.js — Node.js wrapper for Sonnet Brain Auto-Injection
 * 
 * Called by Phantom IDE and haksterAi CLI to inject relevant past knowledge into prompts.
 * Spawns the Python brain_recall.py module via subprocess.
 * 
 * Features:
 *   --project <name>   Filter/prioritize by project (cinevault, haksterai, phantom, miniforge)
 *   --inspect          Show what would be injected without modifying prompt
 *   --json             Output as JSON
 *   --stdin            Read prompt from stdin
 * 
 * Usage:
 *   echo "fix port 8084" | node brain_inject.js --stdin --agent haksterai
 *   node brain_inject.js --prompt "fix port 8084" --agent phantom --json
 *   node brain_inject.js --prompt "deploy cinevault" --project cinevault --inspect
 */

const { spawn } = require('child_process');
const path = require('path');

const PYTHON_SCRIPT = path.join('/home/ghost/claude-code-proxy', 'brain_recall.py');
const PYTHON_BIN = 'python3';

function injectRecall(prompt, agent = 'phantom', project = null, inspect = false) {
  return new Promise((resolve, reject) => {
    const args = [PYTHON_SCRIPT, prompt, '--json'];
    if (project) args.push('--project', project);
    if (inspect) args.push('--inspect');
    
    const proc = spawn(PYTHON_BIN, args, {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);

    proc.on('close', (code) => {
      if (code !== 0) {
        // Non-blocking: return original prompt if brain fails
        resolve({
          injected: false,
          recall_results: [],
          augmented_prompt: prompt,
          error: stderr || `exit code ${code}`
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const results = parsed.results || [];
        const augmented = parsed.augmented_prompt || '';
        
        resolve({
          injected: results.length > 0,
          recall_results: results,
          augmented_prompt: augmented ? augmented + '\n\n' + prompt : prompt,
          inspect_report: inspect ? parsed : null,
          project: project,
          result_count: results.length,
          estimated_tokens: parsed.total_estimated_tokens || 0,
        });
      } catch (e) {
        resolve({
          injected: false,
          recall_results: [],
          augmented_prompt: prompt,
          error: `JSON parse error: ${e.message}`
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        injected: false,
        recall_results: [],
        augmented_prompt: prompt,
        error: err.message
      });
    });
  });
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  let prompt = '';
  let agent = 'phantom';
  let project = null;
  let asJson = false;
  let inspect = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[++i];
    } else if (args[i] === '--agent' && args[i + 1]) {
      agent = args[++i];
    } else if (args[i] === '--project' && args[i + 1]) {
      project = args[++i];
    } else if (args[i] === '--json') {
      asJson = true;
    } else if (args[i] === '--inspect') {
      inspect = true;
    } else if (args[i] === '--stdin') {
      prompt = await new Promise(resolve => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data.trim()));
        // Timeout after 3s if no stdin
        setTimeout(() => resolve(data.trim() || ''), 3000);
      });
    }
  }

  if (!prompt) {
    console.error('Usage: node brain_inject.js --prompt "your task" | --stdin [--project NAME] [--inspect] [--json] [--agent NAME]');
    process.exit(1);
  }

  const result = await injectRecall(prompt, agent, project, inspect);

  if (inspect) {
    // Inspect mode: show what would be injected
    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.inspect_report) {
        console.log(`## 🔍 Brain Injection Inspection`);
        console.log(`_Prompt: "${prompt}"_`);
        console.log(`_Project: ${project || 'none'}_`);
        console.log('');
        console.log(`Would inject ${result.result_count} memories (~${result.estimated_tokens} tokens)`);
        console.log('');
        if (result.recall_results.length > 0) {
          result.recall_results.forEach((r, i) => {
            console.log(`${i + 1}. [${r.score?.toFixed(4) || '?'}] [${r.agent}] ${r.text?.substring(0, 100) || ''}`);
          });
        } else {
          console.log('❌ No matching memories found.');
        }
      } else {
        console.log('❌ Inspection failed:', result.error || 'unknown error');
      }
    }
  } else if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Normal mode: output augmented prompt
    console.log(result.augmented_prompt);
  }
}

// Export for require()
module.exports = { injectRecall };

// Run CLI if called directly
if (require.main === module) {
  main().catch(e => {
    console.error('Brain inject error:', e.message);
    process.exit(1);
  });
}