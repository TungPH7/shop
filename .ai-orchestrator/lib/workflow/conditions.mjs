// The order of the runs of a stage and their conditions (C1 spec section 6): `runs` of a stage of contract/stages.yaml
// names its roles in order, each with an optional `when` (the run applies) and `done` (its output exists already).
// Both name a condition of CONDITIONS below, a pure function of the facts of the command, so adding a role, such as
// seo, is a change of data. A condition answers true, false, or null when the input it reads does not exist yet, such
// as the screens of a SPEC ba has still to write: the run is then listed with the condition's text, as a forecast, and
// ao-step decides again after each run. Pure.

import { screenApps } from '../quality/design.mjs';

// A SPEC that has screens names design.md, where ux writes them.
export const SCREENS = /design\.md/;
// sa's part of stage spec: the heading it adds under the SPEC's Objective (agents/prompts/sa.md).
export const NFR = /^#{2,4}\s+Non-functional requirements\s*$/im;
// seo's part of stage spec (agents/prompts/seo.md), and the line ba writes when you turn seo off (C1 spec 6.1).
export const SEO_SECTION = /^##\s+SEO\s*$/m;
export const SEO_OFF = /^SEO:\s*không\b/im;

// The word you give /ao-spec after the Epic key to turn seo on or off (C1 spec 6.1): { word: 'seo' }, { word: 'no-seo',
// reason }, with reason null when you gave none, or null when the text is a change to the SPEC instead.
export function seoWord(text) {
  const words = String(text ?? '').trim();
  if (/^seo$/i.test(words)) return { word: 'seo' };
  const off = /^no-seo(?:\s+([\s\S]*))?$/i.exec(words);
  return off ? { word: 'no-seo', reason: off[1]?.trim() || null } : null;
}

// The screens of design.md that seo writes for: those of an app with seo: true. A screen whose app the table does not
// give, as in a design.md written before C1, counts: a page left without SEO is found only once it is in production.
// seo: { apps, word }, apps the names of the apps with seo: true.
export function seoScreens(design, seo = {}) {
  const apps = seo.apps ?? [];
  return screenApps(design).filter(({ app }) => app === null || apps.includes(app));
}

// Whether seo writes the SEO of the SPEC, by the steps of C1 spec 6.1 (point 4): no screen of an app with seo: true,
// no run; the word no-seo, no run; the word seo, a run; no word, a run unless the SPEC has the line "SEO: không" of an
// earlier run. Step 5, a SPEC with its section ## SEO, is the condition spec-has-seo. null while ba or ux has still to
// write what it reads. no-seo is a no before ba or ux writes anything: there is no forecast to make.
function seoApplies({ docs, seo = {} }) {
  if ((seo.apps ?? []).length === 0 || seo.word === 'no-seo') return false;
  if (!docs?.spec) return null;
  if (!SCREENS.test(docs.spec)) return false;
  if (!docs.design) return null;
  if (seoScreens(docs.design, seo).length === 0) return false;
  if (seo.word === 'seo') return true;
  return !SEO_OFF.test(docs.spec);
}

// text: how a forecast names the condition when its answer is still null.
export const CONDITIONS = {
  'spec-written': { test: ({ docs }) => Boolean(docs?.spec) },
  'spec-has-screens': { text: 'the SPEC has screens', test: ({ docs }) => (docs?.spec ? SCREENS.test(docs.spec) : null) },
  'design-written': { test: ({ docs }) => Boolean(docs?.design) },
  'spec-has-seo-screens': { text: 'design.md has screens of an app with seo: true', test: seoApplies },
  'spec-has-seo': { test: ({ docs }) => Boolean(docs?.spec) && SEO_SECTION.test(docs.spec) },
  // A SPEC still to write has no requirements yet: sa runs after ba.
  'spec-has-nfr': { test: ({ docs }) => Boolean(docs?.spec) && NFR.test(docs.spec) },
  'plan-written': { test: ({ docs }) => Boolean(docs?.plan) },
  // ba creates the items from plan.md: without a plan, items of the Epic are not those of the plan.
  'plan-items-created': { test: ({ docs, item }) => Boolean(docs?.plan) && (item?.children?.length ?? 0) > 0 },
};

// The runs of stage `id` in contract/stages.yaml, in order: [{ role, purpose?, when?, done? }].
export function stageRuns(contract, id) {
  const stage = contract.stages.find((s) => s.id === id);
  if (!stage?.runs) throw new Error(`stage ${id} of contract/stages.yaml has no runs`);
  return stage.runs;
}

// The roles of stage `id`, in order: the order of the dev agents of a Story, for one.
export const stageRoles = (contract, id) => stageRuns(contract, id).map(({ role }) => role);

function answer(name, facts) {
  const condition = CONDITIONS[name];
  if (!condition) throw new Error(`unknown condition ${name}; use one of ${Object.keys(CONDITIONS).join(', ')}`);
  return condition.test(facts);
}

// The runs of stage `id` still to make on these facts, in order: those not done whose `when` is not false. A run whose
// `when` cannot be answered yet carries the condition's text in `when`. Returns [{ role, purpose, when? }].
export function pendingRuns(contract, id, facts) {
  const pending = [];
  for (const { role, purpose, when, done } of stageRuns(contract, id)) {
    if (done && answer(done, facts) === true) continue;
    const applies = when ? answer(when, facts) : true;
    if (applies === false) continue;
    pending.push({ role, purpose, ...(applies === null && { when: CONDITIONS[when].text ?? when }) });
  }
  return pending;
}
