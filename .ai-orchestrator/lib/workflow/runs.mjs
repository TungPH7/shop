// What one agent run left (dev-workflow spec 2.2): readRun reads the stream-json log of `claude -p`, openQuestions the
// Open Questions section an agent leaves in a SPEC, design or plan. Pure.
//
// A log has a system init event, then a result event when the run ends; a run that waited for a background command has
// one result event per part. num_turns and duration_ms count each part, while total_cost_usd and modelUsage add up the
// whole session, earlier runs of it included when the run is a --resume (agent-roster T18, dev-workflow T1).

const LIMIT_TEXT = /hit your .*limit/i;
const round = (usd) => Math.round(usd * 1e6) / 1e6;

// lines: the log as lines. previous: what readRun gave for the run this one resumed, if any. Returns
//   { outcome, session, model, turns, durationMs, tokens, costUsd, cumulative, denials, text }
// outcome is done, max-turns, usage-limit, error, or unfinished when the log has no result event (the process was
// stopped) or its success result has an empty answer. tokens and costUsd are this run's; cumulative is the session's so
// far, for the run that resumes it.
export function readRun(lines, previous) {
  const events = lines.flatMap((line) => {
    if (!line.startsWith('{')) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const init = events.find(({ type, subtype }) => type === 'system' && subtype === 'init');
  // A result of no turn that answers a task notification says nothing of the run: `--resume` prints one before the
  // prompt for each command the cut-off session left in the background, and a run killed after it is unfinished. A
  // notice that woke the agent for turns after its result still counts (background-two-results).
  const results = events.filter((event) => event.type === 'result' && !(event.origin?.kind === 'task-notification' && !event.num_turns));
  const last = results.at(-1);
  const session = last?.session_id ?? init?.session_id ?? null;
  const usage = Object.values(last?.modelUsage ?? {});
  const sum = (key) => usage.reduce((total, model) => total + (model[key] ?? 0), 0);
  const cumulative = {
    costUsd: round(last?.total_cost_usd ?? 0),
    tokens: { input: sum('inputTokens'), output: sum('outputTokens'), cacheRead: sum('cacheReadInputTokens'), cacheWrite: sum('cacheCreationInputTokens') },
  };
  const before = previous?.session === session && previous.cumulative ? previous.cumulative : { costUsd: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  // The session's cost comes with a result only. A run stopped before its result has no cost to read: unknown (null),
  // not 0 minus the session's cost so far (T18 of Pilot 3: SHOP-39 run 2 read −5.77 USD), and the session's cumulative
  // stays that of the run before, for the run that goes on after it.
  if (!last) return { outcome: 'unfinished', session, model: init?.model ?? null, turns: 0, durationMs: 0, tokens: null, costUsd: null, cumulative: before, denials: [], text: '' };
  return {
    outcome: outcomeOf(last),
    session,
    model: init?.model ?? null,
    turns: results.reduce((total, result) => total + (result.num_turns ?? 0), 0),
    durationMs: results.reduce((total, result) => total + (result.duration_ms ?? 0), 0),
    tokens: Object.fromEntries(Object.entries(cumulative.tokens).map(([key, value]) => [key, value - before.tokens[key]])),
    costUsd: round((last?.total_cost_usd ?? 0) - before.costUsd),
    cumulative,
    denials: results.flatMap(({ permission_denials: denials = [] }) => denials.map(({ tool_name: tool, tool_input: input }) => ({ tool, input }))),
    text: last?.result ?? '',
  };
}

// A run is on record from its start (lib/workflow/runner.mjs). One killed with its shell never got its session, which
// its log holds: readLog(name) gives the lines of a log of the run's folder. It returns the state it was given when
// there is no such run, or the run died before its first line.
export function withLoggedSession(state, readLog) {
  const last = state?.runs.at(-1);
  if (!last || last.session || !last.log) return state;
  const { session } = readRun(readLog(last.log));
  return session ? { ...state, runs: [...state.runs.slice(0, -1), { ...last, session }] } : state;
}

function outcomeOf(result) {
  if (!result) return 'unfinished';
  if (result.subtype === 'error_max_turns') return 'max-turns';
  if (result.is_error && (result.api_error_status === 429 || LIMIT_TEXT.test(result.result ?? ''))) return 'usage-limit';
  if (result.is_error || result.subtype !== 'success') return 'error';
  // An agent always ends with its report: success with nothing to say means it ended its turn while a command it
  // started in the background still ran (QA SHOP-64 of shop, Pilot 3). It goes on in its session, not as done.
  if (!String(result.result ?? '').trim()) return 'unfinished';
  return 'done';
}

// The first line of an Open Questions section that says there is none: alone, or before punctuation such as ":", ",",
// a dash or "(", and asking nothing. A question that begins with the same words ("Không có Figma." of ux on SMP-2, or
// "Không có, hay chỉ một nút xóa?") is still a question (review of ao-sample PR #5).
const NONE = /^(?:Không có|Không còn|None)(?: câu hỏi)?(?: mở)?(?: nào)?(?: cả)?(?: open)?(?: questions?)?\s*(?:$|[.!:;,(–—-])/i;
const saysNone = (line) => NONE.test(line) && !line.includes('?');

// The questions still open in the Open Questions section of a Markdown artifact: the first line of each item of its
// top-level list, or its text when it has no list. None when the section is missing or empty, holds only the template's
// comment, or its first line says there is none ("Không có", "Không còn câu hỏi mở", "None"), even with notes on the
// old answers after that.
export function openQuestions(markdown) {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,6}\s+Open Questions\s*$/i.test(line));
  if (start < 0) return [];
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((line, i) => i > start && new RegExp(`^#{1,${level}}\\s`).test(line));
  const section = lines.slice(start + 1, end < 0 ? undefined : end).filter((line) => line.trim() !== '');
  const plain = (text) => text.replace(/\*\*|__/g, '').trim();
  const unlisted = (line) => plain(line.replace(/^(?:[-*]|\d+[.)])\s+/, ''));
  if (section.length > 0 && saysNone(unlisted(section[0]))) return [];
  // Questions named Q1, Q2… at the start of a line, in a list item or a bold paragraph: the bullets and tables that
  // explain them are not questions (sa on DEMO-20, dev-workflow T17).
  const named = section.filter((line) => /^\S/.test(line) && /^Q\d+\b/.test(unlisted(line))).map(unlisted);
  if (named.length > 0) return named;
  const items = section.filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line)).map(unlisted);
  return items.length > 0 ? items : section.slice(0, 1).map(plain);
}
