// PostToolUse hook for WebSearch (C1 spec 6.4, review of shop PR #79): records the pages a search gave an agent, in
// the temp folder, for gh-guard, which lets a role that reads web pages fetch only those and the docs. The logic is in
// lib/quality/web-search.mjs. Prints nothing, and never stops the run: without a record, such a role fetches the docs
// only.
// The kit is in .ai-orchestrator/ of the project, or in AO_KIT_DIR.
import { appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const kit = resolve(process.env.AO_KIT_DIR ?? join(projectDir, '.ai-orchestrator'));

let text = '';
for await (const chunk of process.stdin) text += chunk;

try {
  const input = JSON.parse(text);
  if (input.agent_type) {
    const { resultUrls, searchFile } = await import(pathToFileURL(join(kit, 'lib', 'quality', 'web-search.mjs')).href);
    const file = searchFile(tmpdir(), input.session_id);
    const urls = resultUrls(input.tool_response);
    if (file && urls.length > 0) {
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${urls.join('\n')}\n`);
    }
  }
} catch {
  // A record that could not be written only keeps the role to the docs.
}
