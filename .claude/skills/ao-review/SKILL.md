---
name: ao-review
description: Review a PR with CI green on its head, with reviewer and then security, up to both reports at gate ③; a draft PR is marked ready first. With the key of an Epic or an item, review after merge the PRs of its items that skipped review.
argument-hint: "<PR> [full] | <KEY>"
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs review $0`

## What to do

- When the word after the PR number is `full`, the human wants the reviews even where a waiver of quality/gates.yaml
  would spare them (C1 spec 3.4), or where the item skips review (SPEC-review-per-item.md): run
  `node .ai-orchestrator/scripts/ao-step.mjs review <PR> --full`, and add `--full` to the run command below too.
- When the check prints GO with the action `review-waiver`, every file of the PR is in a waiver and its item is at its
  level: running it posts the trace on the head, and no agent runs. Say so to the human, with the waiver and the files.
- When the check prints GO with the action `review-skip`, the item skips review, by its label `ao-review-skip` or by
  `review.default: off` of project.yaml: running it posts the trace of the skip on the head, and no agent runs. Say so,
  and name to the human every critical file the check lists: those take effect as soon as the PR merges, so the human
  reads their diff closely before approving.
- When `$0` is a key, not a PR number, this is the review after merge of an Epic, or of one item: reviewer and security
  review at once what its PRs that skipped review changed on develop. It costs as much as a review of a large PR: when
  /ao-run asked for it, the human typed it, so go on. On GO with the action `after-merge-post`, the runs are done
  already: running it makes the fix Task of the Critical and High, marks the PRs, posts both reports on the key in
  Jira and adds the Medium and Low to the findings Task, with no agent.
- On STOP, tell the human the reason and the command or clicks it names, in Vietnamese, and stop.
- On GO, run `node .ai-orchestrator/scripts/ao-step.mjs review $0 --go` with the Bash tool in the background, with a
  timeout of 7200000 ms, and wait for its notification. Do not poll.
  Do not run any agent yourself, and do not change Jira or GitHub yourself. When the PR is a draft, the first step of
  that command marks it ready, as the ao-dev App: that is expected, and it is how the human ends the preview.
- While it runs, also run `node .ai-orchestrator/scripts/ao-step.mjs watch` with the Bash tool in the background. It
  reads files only and runs no model, and ends with a report only when something is wrong: a process gone with its
  lock, an agent silent 20 minutes, a stop that waits for the human, an item flagged Needs you. Tell the human its
  report in Vietnamese, then start it again while the command still runs. It ends by itself once nothing of the kit
  has run for 10 minutes.
- Then read `.ai/runs/<KEY>/last.md`, where KEY is the item the check printed, and report in Vietnamese: whether the
  PR was marked ready, what each agent did and cost, the findings by severity, whether security reviewed the whole PR
  or only the new part, what the human must do at gate ③ (numbered clicks), and the next command. After a review after
  merge: the PRs it covered, the fix Task it made, if any, and where the reports are.
- Only Critical and High findings block the merge. With none open, the next step is the approval the command printed:
  do not propose `/ao-fix` for a Medium or a Low. Say that they wait, and that the human can still ask for a fix now
  with `/ao-fix <PR> <what to fix>` (C1 spec section 4).
