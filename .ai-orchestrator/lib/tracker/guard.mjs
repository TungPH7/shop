// The logic of the Jira hooks (tracker-integration spec section 2.6): whether an agent may make a transition
// (jira-guard), whether a tool call goes around the guard (block-atlassian), and whether a rework must be flagged
// (jira-rework). The hook scripts in kit/.claude/hooks/ only read stdin, build the clients and print the decision.
import { NON_AGENT_ROLES, WEB_ROLES } from '../rules/references.mjs';
import { checkTransition } from '../transitions.mjs';
import { extractKeys } from './conventions.mjs';
import { githubGuards, jiraGuards, jiraTime, qaReportResult, readItem } from './facts.mjs';
import { literalComment } from './stored-text.mjs';
import { countRework, reworkStatus } from './rework.mjs';

// input: the PreToolUse input of mcp__atlassian__transitionJiraIssue. Returns { allow: true } or { allow: false, reason }.
// Any error while reading the facts refuses the call.
// agentsPerRole: runs.agents_per_role of the project, for the guard wip-available (C2 spec section 6).
export async function decide(input, { contract, mapping, jira, github, approvers = [], agentsPerRole = {} }) {
  const role = input.agent_type;
  const deny = (reason) => ({ allow: false, reason: `jira-guard: ${reason}` });
  if (!role) return deny('only an agent may move a Jira item; this call does not come from a subagent named after a role of the contract');
  if (NON_AGENT_ROLES.includes(role) || !contract.roles.some(({ id }) => id === role)) return deny(`"${role}" is not an agent role of the contract`);

  const { issueIdOrKey: key, transitionId, transitionName } = input.tool_input ?? {};
  try {
    const item = await readItem(jira, key);
    if (item.labels.includes(mapping.needs_you_label)) return deny(`${key} has the label ${mapping.needs_you_label} and waits for you`);

    const workType = contract.work_types.find(({ jira_issue_type: type }) => type === item.type)?.id;
    if (!workType) return deny(`${key} is a ${item.type}, which the contract does not know`);
    const workflowId = Object.keys(contract.workflows).find((id) => contract.workflows[id].applies_to.includes(workType));
    const workflow = contract.workflows[workflowId];
    const mapped = mapping.workflows[workflowId];

    let name = transitionName;
    if (!name) {
      // An id only means something on this item; the agent's token lists the transitions it may make here.
      const { transitions } = await jira.get(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
      name = transitions.find(({ id }) => id === String(transitionId))?.name;
      if (!name) return deny(`transition ${transitionId} is not available on ${key}`);
    }
    // The role first, so a role that may never make this transition hears that, whatever the item's status.
    const named = workflow.transitions.filter(({ id }) => mapped.transitions[id].name === name);
    if (named.length === 0) return deny(`the contract has no transition "${name}" for a ${item.type}`);
    if (!named.some(({ actors }) => actors.includes(role))) {
      return deny(`${role} may not make "${name}" on ${key}; it is for ${[...new Set(named.flatMap(({ actors }) => actors))].join(', ')}`);
    }
    const state = Object.keys(mapped.states).find((id) => mapped.states[id].status === item.status);
    const transition = named.find(({ from }) => [from].flat().includes(state));
    if (!transition) return deny(`the contract has no transition "${name}" from "${item.status}" for a ${item.type}`);

    const needed = transition.guards ?? [];
    const guards = [
      ...(await jiraGuards(jira, { item, actor: role, needed, contract, mapping, agentsPerRole })),
      ...(github ? await githubGuards(github, { item, needed, contract, mapping, approvers }) : []),
    ];
    const result = checkTransition(contract, workType, transition.id, { actor: role, facts: { guards } });
    if (!result.ok) return deny(`"${name}" on ${key} needs ${result.missingGuards.join(', ')}`);
    return { allow: true };
  } catch (error) {
    return deny(`could not check ${key}: ${error.message}`);
  }
}

const SERVER = 'mcp__atlassian__';
// The write tools agents use; each touches one work item, or creates one in a space.
const WRITE_TOOLS = ['createJiraIssue', 'editJiraIssue', 'addOrEditJiraIssueComment', 'transitionJiraIssue'];
// Generic tools that run any operation by name: a way around transitionJiraIssue and jira-guard.
const ANY_WRITE = ['executeWrite', 'executeDestructive'];

// A link to one work item, as a PR body or a ledger has it: it ends at the key, before a space, the end of a line, a
// closing bracket or quote, or punctuation that ends a sentence. A link that goes on (a path, a query, ";", ".json")
// is not one of these.
const WORK_ITEM_LINK = /https?:\/\/[a-z0-9-]+\.atlassian\.net\/browse\/[a-z][a-z0-9_]*-\d+(?=$|[\s)\]>"'`]|[.,:!?](?:$|[\s)\]>"'`]))/gim;
const NETWORK_CLIENT = /\b(?:curl|wget|iwr|irm|axios|urllib|httpie|openssl|ncat|nc|telnet|socat)\b|\bhttp\.client\b|Invoke-(?:WebRequest|RestMethod)|WebClient|HttpClient|\bfetch\s*\(|\brequests\.(?:get|post|put|patch|delete|request|Session)\b|\bhttps?\.(?:get|request)\b/i;

// The first line of a heredoc whose body is data: cat or tee writing to a file, after simple commands only, with the
// delimiter quoted so the shell expands nothing in the body, and nothing after it on the line but where it writes.
// Returns { dash, delimiter }, or null.
const PATH = String.raw`(?:[^\s"'\`$()<>;&|]+|"[^"\`$\n]*"|'[^'\n]*')`;
const SIMPLE = String.raw`(?:[^"'\`$()\n;&|]|"[^"\`$\n]*"|'[^'\n]*')*`;
// The spaces after a separator are SIMPLE's to read, not a \s* of their own: two ways to read them made the regex
// backtrack exponentially on "a; a; a; …" (second review of ao-sample PR #13).
const HEAD = new RegExp(String.raw`^(?:${SIMPLE}(?:&&|;))*\s*(cat|tee)\b(.*)$`);
const REDIRECT = new RegExp(String.raw`^\s*(>>?\s*${PATH})?\s*$`);
const TEE_FILE = new RegExp(String.raw`^\s+(?:-a\s+)?${PATH}\s*$`);

function dataHeredoc(line) {
  const operator = line.match(/<<(-?)\s*(['"])(\w+)\2/);
  if (!operator) return null;
  const head = line.slice(0, operator.index).match(HEAD);
  const after = line.slice(operator.index + operator[0].length);
  if (!head) return null;
  const [, tool, args] = head;
  if (tool === 'cat') {
    const [before, behind] = [args.match(REDIRECT), after.match(REDIRECT)];
    if (!before || !behind || !(before[1] || behind[1])) return null;
  } else if (!TEE_FILE.test(args) || !/^\s*(?:>\s*\/dev\/null)?\s*$/.test(after)) return null;
  return { dash: operator[1] === '-', delimiter: operator[3] };
}

// The command without the body of the data heredoc that opens it, when there is one and it is closed.
function withoutDataBody(command) {
  const lines = command.split('\n');
  const heredoc = dataHeredoc(lines[0]);
  if (!heredoc) return command;
  const end = lines.findIndex((line, i) => i > 0 && (heredoc.dash ? line.replace(/^\t+/, '') : line) === heredoc.delimiter);
  return end < 0 ? command : [lines[0], ...lines.slice(end)].join('\n');
}

// A Bash command reaches Atlassian when it says "atlassian" anywhere, as in $ATLASSIAN_AGENT_TOKEN or a site, but for
// two kinds of text: the body of a data heredoc (cat or tee to a file, its delimiter quoted), and links to one work item
// in a command that runs no network client. block-atlassian refused four such writes in Pilot 1 (SMP-2, SMP-5, SMP-6);
// the review of ao-sample PR #13 showed that cutting links out before looking for a network client, or letting the
// word through elsewhere, let a link reach the REST API and the token be printed.
export function reachesAtlassian(command) {
  if (NETWORK_CLIENT.test(command)) return /atlassian/i.test(command);
  return /atlassian/i.test(withoutDataBody(command).replace(WORK_ITEM_LINK, ''));
}

// The site of the project: its cloud id, or its host name alone or in a URL. A text that only contains the host name,
// as in a query, is not (review of ao-sample PR #13).
function isProjectSite(cloudId, mapping) {
  const text = String(cloudId ?? '');
  if (text === mapping.cloud_id) return true;
  try {
    return Boolean(mapping.site) && new URL(text.includes('://') ? text : `https://${text}`).hostname === mapping.site.toLowerCase();
  } catch {
    return false;
  }
}

// The block-atlassian hook (spec section 2.6, plan task T14): no Atlassian call from Bash, no Atlassian tool of another
// server, no generic write tool, and writes only on the project space (Jira Free has no permission scheme, so the
// agent token could write to every space of the site). space is AO_JIRA_SPACE, set per project.
// Returns { allow: true }, { allow: true, input } when the hook sends the call with that input instead, or
// { allow: false, reason }.
export function checkToolCall(input, { mapping, space }) {
  const deny = (reason) => ({ allow: false, reason: `jira: ${reason}` });
  const allow = { allow: true };
  const { tool_name: tool, tool_input: args = {} } = input;
  if (tool === 'Bash') return reachesAtlassian(args.command ?? '') ? deny('do not call Atlassian from Bash; use the tools of the atlassian MCP server') : allow;
  if (!tool.startsWith('mcp__')) return allow;
  if (!tool.startsWith(SERVER)) return /atlassian/i.test(tool) ? deny(`use the atlassian MCP server of the project, not ${tool}`) : allow;

  const name = tool.slice(SERVER.length);
  if (name === 'executeWrite' && args.name === LINK_OPERATION) return checkLink(args, { mapping, space, deny, allow });
  if (ANY_WRITE.includes(name)) return deny(`${name} can run any write; use ${WRITE_TOOLS.slice(0, -1).join(', ')} or ${WRITE_TOOLS.at(-1)}`);
  if (!WRITE_TOOLS.includes(name)) return allow;
  if (!space) return deny('set AO_JIRA_SPACE to the project space key in .claude/settings.json');
  if (args.cloudId && !isProjectSite(args.cloudId, mapping)) return deny(`${args.cloudId} is not the Jira site of the project`);
  // The label that gives devops the basic auth on an ops Task is yours to put (kit followups, batch 4 item 14).
  const envAuth = mapping.work_labels.env_auth;
  // A transition takes fields and update too (review of shop PR #78).
  if (input.agent_type && ['createJiraIssue', 'editJiraIssue', 'transitionJiraIssue'].includes(name) && namesLabel(args, envAuth)) {
    return deny(`only you put the label ${envAuth} on an item: it gives devops the basic auth of Development and Staging`);
  }
  // The level label sets how much review and QA an item gets, and only you lower it (review of shop PR #79): ba puts it
  // when it creates the items of the plan you approved, and no agent adds or removes one afterwards. The whole list an
  // agent writes in fields.labels to flag an item passes, since this hook cannot read the item: ao-step, merge-gate and
  // audit leave out a level the agents' account changed (lib/workflow/levels.mjs).
  const level = mapping.work_labels.level_prefix;
  if (input.agent_type && level) {
    if (name === 'createJiraIssue' && input.agent_type !== 'ba' && namesLabelOf(args, level)) {
      return deny(`only ba, from the plan you approved, and you put a level label (${level}*) on an item: it sets how much review and QA the item gets`);
    }
    if (['editJiraIssue', 'transitionJiraIssue'].includes(name) && updatesLabelOf(args, level)) {
      return deny(`only you change the level label (${level}*) of an item: it sets how much review and QA the item gets`);
    }
  }
  // The comment of an agent other than qa goes as literalComment builds it, as HTML with every sign escaped (second
  // review of shop PR #81): Jira keeps it word for word, so the hook reads what ao-step will read, where it used to guess
  // what Jira makes of markdown and HTML, and guessed wrong. These agents write a comment with the comment tool alone,
  // not in the update of a transition or an edit, whose format the hook cannot set. qa writes its QA report from its
  // template, tables and all, and may make requests: its comment goes as it wrote it.
  let sent = null;
  if (input.agent_type && input.agent_type !== 'qa') {
    if (name !== 'addOrEditJiraIssueComment' && holdsComment(args)) {
      return deny('write a comment with addOrEditJiraIssueComment alone, not in the update of a transition or an edit: the hook sends it as plain text, as Jira then keeps it');
    }
    if (name === 'addOrEditJiraIssueComment') {
      const extra = Object.keys(args).filter((key) => !COMMENT_ARGS.includes(key));
      if (extra.length > 0) return deny(`addOrEditJiraIssueComment takes only ${COMMENT_ARGS.join(', ')} from an agent, not ${extra.join(', ')}`);
      // Every agent writes with one Jira account, so an edit could change the comment of another role: a FAIL report of
      // qa turned into words would leave an older PASS the newest report (threat model of the second review of shop PR
      // #81).
      if (args.commentId !== undefined) return deny('write a new comment: an agent other than qa edits none, since every agent writes with one Jira account and an edit could change the comment of another role');
      if (typeof args.commentBody !== 'string') return deny('commentBody is the text of the comment, as plain text');
      const { html, text } = literalComment(args.commentBody);
      // A QA report is qa's alone (second review of shop PR #79): QA again checks only the criteria the newest one
      // failed, and the guards of QA fail and Accept read it, while every agent writes with the same Jira account.
      if (qaReportResult(text) !== null) return deny('only qa writes a QA report: QA reads the newest one to decide what it checks again, and Accept needs a PASS');
      // A role that reads web pages makes no request (second review of shop PR #79): "Cần <role>:" runs that role, ba or
      // sa with Bash among them, on what a page may have written.
      if (WEB_ROLES.includes(input.agent_type) && holdsRequest(text)) {
        return deny('seo reads web pages, so it asks no other role: a request of "Cần <role>:" would run that role on what a page wrote. Say what you need in your answer, for the human');
      }
      sent = { ...args, commentBody: html, contentFormat: 'html' };
    }
  }
  if (name === 'createJiraIssue') return args.projectKey === space ? allow : deny(`${args.projectKey} is outside the project space ${space}`);
  const [key] = extractKeys(String(args.issueIdOrKey ?? ''));
  if (!key) return deny(`use the work item key, not ${args.issueIdOrKey}, so the project space can be checked`);
  if (!key.startsWith(`${space}-`)) return deny(`${key} is outside the project space ${space}`);
  return sent ? { allow: true, input: sent } : allow;
}

// What an agent passes to the comment tool; the hook sets contentFormat itself.
const COMMENT_ARGS = ['cloudId', 'issueIdOrKey', 'commentId', 'commentBody', 'contentFormat'];

// Whether a tool input writes a comment: a field named comment or comments at any depth, as update.comment of a
// transition or an edit.
function holdsComment(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, inner]) => /^comments?$/i.test(key) || holdsComment(inner));
}

// Whether the text of a comment holds a request to a role (lib/workflow/requests.mjs): a line that starts with
// "Cần <role>:", after an Agent value or not; or, anywhere, "Cần <role>:" to a role other than seo itself, which an
// answer to a request may quote.
const REQUEST = /(?:^|\n)\s*(?:[^\n:]{1,40}:\s*)?Cần\s+[\w-]+\s*:/u;
const ASKING = /Cần\s*(?!seo\b)[\w-]+\s*:/u;
const holdsRequest = (text) => REQUEST.test(text) || ASKING.test(text);

// Whether the input of a tool puts a label on an item, in any field named labels at any depth: fields.labels,
// additional_fields.labels, update.labels with add or set. Words in a description or a comment are not a label.
function namesLabel(value, label) {
  if (!value || typeof value !== 'object') return false;
  // The label as a whole word of the field, in a list or in one string such as "ao-ops ao-env-auth".
  const word = new RegExp(`(?:^|[^a-z0-9-])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9-])`, 'i');
  return Object.entries(value).some(([key, inner]) => (key === 'labels' ? word.test(JSON.stringify(inner)) : namesLabel(inner, label)));
}

// A label that starts with `prefix`, as a whole word of a labels field at any depth.
const prefixWord = (prefix) => new RegExp(`(?:^|[^a-z0-9-])${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z0-9]`, 'i');
function namesLabelOf(value, prefix) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, inner]) => (key === 'labels' ? prefixWord(prefix).test(JSON.stringify(inner)) : namesLabelOf(inner, prefix)));
}

// Whether an update block adds, removes or sets a label that starts with `prefix`: update.labels with add, remove or set.
function updatesLabelOf(value, prefix) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, inner]) => (key === 'update' && inner && typeof inner === 'object' && 'labels' in inner
    ? prefixWord(prefix).test(JSON.stringify(inner.labels))
    : updatesLabelOf(inner, prefix)));
}

// The one operation executeWrite may run: a Blocks link between two items of the project space, which `ba` makes from
// the dependencies of the plan. The server has no tool of its own for it: addGraphContext needs the scope
// write:all:twg, which the agent token does not have (Pilot 1, T10). A link moves no item, so it does not go around
// jira-guard; only the inputs below are let through, since the server routes any other input into the request.
const LINK_OPERATION = 'createJiraIssueLink';
const LINK_ARGS = ['cloudId', 'name', 'inputs', 'responseFields'];
const LINK_INPUTS = ['cloudId', 'linkType', 'inwardIssue', 'outwardIssue'];

function checkLink(args, { mapping, space, deny, allow }) {
  const inputs = args.inputs ?? {};
  const extra = [...Object.keys(args).filter((key) => !LINK_ARGS.includes(key)), ...Object.keys(inputs).filter((key) => !LINK_INPUTS.includes(key))];
  if (extra.length > 0) return deny(`${LINK_OPERATION} takes only ${LINK_INPUTS.join(', ')}, not ${extra.join(', ')}`);
  if (!space) return deny('set AO_JIRA_SPACE to the project space key in .claude/settings.json');
  // The server needs the cloudId of executeWrite itself; the one in the inputs may be left out.
  for (const cloudId of [args.cloudId, ...(inputs.cloudId === undefined ? [] : [inputs.cloudId])]) {
    if (!isProjectSite(cloudId, mapping)) return deny(`${cloudId ?? 'no cloudId'} is not the Jira site of the project`);
  }
  if (!/^blocks$/i.test(String(inputs.linkType ?? ''))) return deny(`${LINK_OPERATION} may only make a Blocks link, not ${inputs.linkType}`);
  const keys = [inputs.inwardIssue, inputs.outwardIssue].map((key) => String(key ?? ''));
  const outside = keys.filter((key) => !new RegExp(`^${space}-\\d+$`).test(key));
  if (outside.length > 0) return deny(`${outside.join(', ')} is not a work item key of the project space ${space}`);
  return keys[0] === keys[1] ? deny(`${keys[0]} cannot block itself`) : allow;
}

// The jira-rework hook, after an agent's transition (plan, decision 2): when that move was a rework and the item has
// now gone back as many times as policies.yaml allows, the agent must flag the item through MCP and stop, since its
// token cannot write over REST. histories: the `values` of GET /issue/{key}/changelog, in any order.
export function reworkDecision({ histories, item, contract, mapping }) {
  const workType = contract.work_types.find(({ jira_issue_type: type }) => type === item.type)?.id;
  if (!workType || item.labels.includes(mapping.needs_you_label)) return { block: false };
  const context = { contract, mapping, workType };
  const ordered = histories.toSorted((a, b) => jiraTime(a.created) - jiraTime(b.created));
  const last = ordered.filter(({ items }) => items.some(({ field }) => field === 'status')).at(-1);
  if (!last || countRework([last], context) === 0) return { block: false };
  const { count, limitReached } = reworkStatus(ordered, context);
  if (!limitReached) return { block: false };
  return {
    block: true,
    reason: `jira-rework: ${item.key} went back ${count} times, the limit in policies.yaml. Through the atlassian MCP server: set Flagged on ${item.key}, add the label ${mapping.needs_you_label}, and comment why it keeps going back. Then stop and wait for the human.`,
  };
}
