---
name: ao-request
description: Run the open requests "Cần ba:", "Cần ux:", "Cần sa:", "Cần security:" or "Cần seo:" on an item with the role each one asks, oldest first.
argument-hint: <KEY>
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs request $0`

## What to do

- On STOP, tell the human the reason and the command or clicks it names, in Vietnamese, and stop.
- On GO, run `node .ai-orchestrator/scripts/ao-step.mjs request $0 --go` with the Bash tool in the background, with a
  timeout of 7200000 ms, and wait for its notification. Do not poll.
  Do not run any agent yourself, and do not change Jira or GitHub yourself.
- While it runs, also run `node .ai-orchestrator/scripts/ao-step.mjs watch` with the Bash tool in the background. It
  reads files only and runs no model, and ends with a report only when something is wrong: a process gone with its
  lock, an agent silent 20 minutes, a stop that waits for the human, an item flagged Needs you. Tell the human its
  report in Vietnamese, then start it again while the command still runs. It ends by itself once nothing of the kit
  has run for 10 minutes.
- Then read `.ai/runs/<KEY>/last.md`, where KEY is the item the check printed, and report in Vietnamese: each request
  that ran, what the role did and what it cost, the requests still open, and the next command. A request on an item
  past stage plan is answered on Jira only: when the role says a merged document must change, tell the human.
