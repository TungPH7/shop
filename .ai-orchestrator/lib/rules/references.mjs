// Rule R3: every id the contract names is declared: roles, guards, effects, work types, severities,
// Fix Version rules, artifacts, gates, environments and the conditions of the runs of a stage. The values of the Agent
// field are agent roles, and so are the roles of those runs.
import { CONDITIONS } from '../workflow/conditions.mjs';

// light-qa: the main session, which checks an item of level light with the CI token (C1 spec section 2).
export const NON_AGENT_ROLES = ['human', 'automation', 'light-qa'];
// The roles that may have WebSearch and WebFetch (C1 spec 6.4). A page of the web can carry orders for an agent, so such
// a role has no Bash, and gh-guard keeps its reads in the project and away from the .env files.
export const WEB_ROLES = ['seo'];

export function checkReferences(contract) {
  const errors = [];
  const roleIds = contract.roles.map(({ id }) => id);
  const declared = {
    role: new Set(roleIds),
    'agent role': new Set(roleIds.filter((id) => !NON_AGENT_ROLES.includes(id))),
    guard: new Set(Object.keys(contract.guards)),
    effect: new Set(Object.keys(contract.effects)),
    'work type': new Set(contract.work_types.map(({ id }) => id)),
    severity: new Set(contract.work_item_fields.find(({ id }) => id === 'severity')?.values.map(({ id }) => id)),
    'fix version': new Set(Object.keys(contract.fix_versions)),
    artifact: new Set(contract.artifacts.map(({ id }) => id)),
    gate: new Set(contract.gates.map(({ id }) => id)),
    environment: new Set(contract.environments.map(({ id }) => id)),
    condition: new Set(Object.keys(CONDITIONS)),
  };
  const check = (kind, ids = [], path) => {
    for (const id of ids.filter((i) => !declared[kind].has(i))) errors.push({ rule: 'R3', path, message: `unknown ${kind} '${id}'` });
  };

  // workflows.yaml
  for (const [name, workflow] of Object.entries(contract.workflows)) {
    check('work type', workflow.applies_to, `workflows.${name}.applies_to`);
    for (const { id, actors, guards, effects } of workflow.transitions) {
      const at = `workflows.${name}.transitions[id=${id}]`;
      check('role', actors, `${at}.actors`);
      check('guard', guards, `${at}.guards`);
      check('effect', effects, `${at}.effects`);
    }
  }
  for (const [id, { evidence }] of Object.entries(contract.guards)) {
    if (evidence.artifact) check('artifact', [evidence.artifact], `guards.${id}.evidence.artifact`);
  }

  // work-items.yaml
  for (const { id, applies_to: types } of contract.work_item_fields) check('work type', types, `work_item_fields[id=${id}].applies_to`);
  const agentField = contract.work_item_fields.find(({ id }) => id === 'agent');
  if (agentField) check('agent role', agentField.values?.map(({ id }) => id), 'work_item_fields[id=agent].values');
  check('work type', contract.dod_common.applies_to, 'dod_common.applies_to');

  // routing.yaml: bug locations are environments too.
  check('work type', contract.new_work_route.applies_to, 'new_work_route.applies_to');
  check('environment', contract.new_work_route.qa_environments, 'new_work_route.qa_environments');
  for (const { id, routes } of contract.bug_routing) {
    check('environment', [id], `bug_routing[id=${id}]`);
    routes.forEach(({ severities, fix_version: fixVersion, qa_environments: qa }, index) => {
      const at = `bug_routing[id=${id}].routes[${index}]`;
      check('severity', severities, `${at}.severities`);
      check('fix version', [fixVersion], `${at}.fix_version`);
      check('environment', qa, `${at}.qa_environments`);
    });
  }

  // policies.yaml: `reporter` and `assignee` stand for whoever reports the bug or works on the item, not a role.
  check('effect', [contract.rework.on_limit], 'rework.on_limit');
  for (const { id, created_by: createdBy } of contract.artifacts) {
    if (Array.isArray(createdBy)) check('role', createdBy, `artifacts[id=${id}].created_by`);
  }

  // stages.yaml
  for (const { id, approvers } of contract.gates) check('role', approvers, `gates[id=${id}].approvers`);
  for (const { id, roles, lead, guards, outputs, gate, runs = [] } of contract.stages) {
    const at = `stages[id=${id}]`;
    check('role', roles, `${at}.roles`);
    if (lead) check('role', [lead], `${at}.lead`);
    check('guard', guards, `${at}.guards`);
    check('artifact', outputs.artifacts, `${at}.outputs.artifacts`);
    if (gate) check('gate', [gate], `${at}.gate`);
    // The runs of the stage's command (C1 spec section 6): agents only, and conditions lib/workflow/conditions.mjs has.
    runs.forEach(({ role, when, done }, index) => {
      check('agent role', [role], `${at}.runs[${index}].role`);
      if (when) check('condition', [when], `${at}.runs[${index}].when`);
      if (done) check('condition', [done], `${at}.runs[${index}].done`);
    });
  }
  contract.cadence.schedule.forEach(({ gates }, index) => check('gate', gates, `cadence.schedule[${index}].gates`));
  return errors;
}
