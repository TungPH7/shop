---
name: ao-plan
description: Do stage plan of an Epic in Planning with sa and ba, up to gate ②; with text after the key, change the plan as the human asks before the gate; once the plan is approved, have its items refined and its docs PR merged.
argument-hint: <EPIC> [change]
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs plan $0`

## What the human wrote

$ARGUMENTS

## What to do

- The first word above is the Epic key. When more text follows it, that text is a change the human asks for in the
  plan: write it, as it is, to `.ai/runs/<KEY>/note.md`, where KEY is the Epic, and add
  `--note .ai/runs/<KEY>/note.md` to the command below. Never put that text in a shell command. With such text, run the
  command below whatever the check said: ao-step decides with the change.
- On STOP with Questions, show the human each question in Vietnamese, one list, and ask for the answers. When they
  answer, copy their reply word for word to `.ai/runs/<KEY>/answers.md`, where KEY is the Epic: add nothing, and do
  not restate the questions or the proposals. Then run the command below with `--answers .ai/runs/<KEY>/answers.md`
  added. Never put the answers in a shell command.
- When their reply refers to advice you gave in this session, such as "đồng ý theo khuyên của Claude", copy that advice
  too, word for word, after their reply, under the line `Lời khuyên được nhắc tới:` and quoted with `> `: the agents
  never saw it, and the reply means nothing without it (T14 of C2).
- On any other STOP, and no text after the key, tell the human the reason and the command or clicks it names, in
  Vietnamese, and stop. When the reason gives how many items have an effort label, say it: the human approves those
  efforts with the plan.
- When the check prints "New libraries of the plan" at gate ②, run `node .ai-orchestrator/scripts/dep-check.mjs <npm|maven>
  <name>@<version> --dry-run` for each, and tell the human, in Vietnamese, which pass and which are suspicious, with the
  lines dep-check printed (C1 spec section 5). For a suspicious one, the human drops it from the plan with
  `/ao-plan <EPIC> <change>`, or asks security: a comment `Cần security: <library>@<version> …` on the Epic, then
  `/ao-request <EPIC>`. dep-check writes nothing here; the dev agent runs it again, and writes the approval, when it
  installs the library.
- On GO, run `node .ai-orchestrator/scripts/ao-step.mjs plan $0 --go` with the Bash tool in the background, with a
  timeout of 7200000 ms, and wait for its notification. Do not poll. After gate ② this run asks GitHub to run jira-sync
  with the human's gh login, which is expected.
  Do not run any agent yourself, and do not change Jira or GitHub yourself.
- While it runs, also run `node .ai-orchestrator/scripts/ao-step.mjs watch` with the Bash tool in the background. It
  reads files only and runs no model, and ends with a report only when something is wrong: a process gone with its
  lock, an agent silent 20 minutes, a stop that waits for the human, an item flagged Needs you. Tell the human its
  report in Vietnamese, then start it again while the command still runs. It ends by itself once nothing of the kit
  has run for 10 minutes.
- Then read `.ai/runs/<KEY>/last.md` and report in Vietnamese: what each agent did and cost, what changed in the plan
  and the items when the human asked for a change, the items the human must cancel, the questions left, what the
  human must do at gate ② (numbered clicks: read plan.md on the docs PR, then Approve plan on the Epic), and the next
  command.
