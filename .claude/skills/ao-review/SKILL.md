---
name: ao-review
description: Review a PR with CI green on its head, with reviewer and then security, up to both reports at gate ③; a draft PR is marked ready first.
argument-hint: "<PR> [full]"
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs review $0`

## What to do

- When the word after the PR number is `full`, the human wants the reviews even where a waiver of quality/gates.yaml
  would spare them (C1 spec 3.4): run `node .ai-orchestrator/scripts/ao-step.mjs review <PR> --full`, and add `--full` to
  the run command below too.
- When the check prints GO with the action `review-waiver`, every file of the PR is in a waiver and its item is at its
  level: running it posts the trace on the head, and no agent runs. Say so to the human, with the waiver and the files.
- On STOP, tell the human the reason and the command or clicks it names, in Vietnamese, and stop.
- On GO, run `node .ai-orchestrator/scripts/ao-step.mjs review $0 --go` with the Bash tool in the background, with a
  timeout of 7200000 ms, and wait for its notification. Do not poll.
  Do not run any agent yourself, and do not change Jira or GitHub yourself. When the PR is a draft, the first step of
  that command marks it ready, as the ao-dev App: that is expected, and it is how the human ends the preview.
- Then read `.ai/runs/<KEY>/last.md`, where KEY is the item the check printed, and report in Vietnamese: whether the
  PR was marked ready, what each agent did and cost, the findings by severity, whether security reviewed the whole PR
  or only the new part, what the human must do at gate ③ (numbered clicks), and the next command.
- Only Critical and High findings block the merge. With none open, the next step is the approval the command printed:
  do not propose `/ao-fix` for a Medium or a Low. Say that they wait, and that the human can still ask for a fix now
  with `/ao-fix <PR> <what to fix>` (C1 spec section 4).
