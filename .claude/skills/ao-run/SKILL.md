---
name: ao-run
description: Run a whole Epic, or the items named, with the dispatcher of the kit - several ao-step commands at once within runs.lanes_max - until everything waits for the human.
argument-hint: "<EPIC> | <KEY>… (up to four) | --stop"
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs run $0 $1 $2 $3`

## What to do

- The check above is the plan of one round: what the dispatcher would start now, what waits for the human, and what
  waits for something else. Tell the human, in Vietnamese, what it would start, what waits for them (numbered clicks
  for each), and the budget it printed. When the check answered `--stop`, say what it answered, and stop.
- When it says every item is done, or it would start nothing and only the human can move the items on, say so, and
  stop: there is nothing to run.
- Otherwise run `node .ai-orchestrator/scripts/ao-step.mjs run $0 $1 $2 $3 --go` with the Bash tool in the background,
  and do not wait for it to end: it runs for hours. Do not run any command it runs yourself, no agent, and no change to
  Jira or GitHub.
- Then run `node .ai-orchestrator/scripts/ao-step.mjs watch` with the Bash tool in the background. It reads files only
  and runs no model: the locks, the agent logs and the event log of the dispatcher, `.ai/runs/_run/<YYYY-MM-DD>.log`,
  every 2 minutes, and the board every 10.
  It ends with a report only when there is something new to tell: a line `waiting for you: …` or `needs a fix: …`, an
  `end … STOP`, a command whose process is gone, an agent silent 20 minutes, an item flagged Needs you, or the end of
  the dispatcher. While all is well it says nothing, so it costs no tokens.
- When it reports, tell the human, in Vietnamese, each line that waits for them, with numbered clicks or the command
  they type, and each other line with its reason and what would fix it. Read `.ai/runs/<KEY>/last.md` of an item whose
  command ended to say what its agents did and cost. Then start the watcher again, while the dispatcher still runs.
- When the human clicks a gate, approves a PR or answers a question, the dispatcher sees it at its next round, within 2
  minutes, and goes on by itself: do not start the next command yourself.
- To end it, run `node .ai-orchestrator/scripts/ao-step.mjs run --stop`: the commands that run go on to their end, and
  then it ends. Never kill its process: on Windows its commands would go on, with nobody to watch them.
- When its last line says it ends, report in Vietnamese why (done, idle, budget, usage limit or --stop), what it spent,
  and what still waits for the human.
