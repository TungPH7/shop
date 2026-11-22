---
name: ao-spec
description: Do stage spec of an Epic in Specifying with ba, ux, sa, then seo last on the docs PR, up to gate ①; with text after the key, change the SPEC as the human asks before the gate; the word seo or no-seo [reason] turns seo on or off.
argument-hint: <EPIC> [change | seo | no-seo [reason]]
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs spec $0`

## What the human wrote

$ARGUMENTS

## What to do

- The first word above is the Epic key. When more text follows it, that text is a change the human asks for in the
  SPEC: write it, as it is, to `.ai/runs/<KEY>/note.md`, where KEY is the Epic, and add
  `--note .ai/runs/<KEY>/note.md` to the command below. Never put that text in a shell command. With such text, run the
  command below whatever the check said: ao-step decides with the change.
- The word `seo` alone, or `no-seo` with an optional reason, after the key is not a change: it turns `seo` on or off for
  this Epic (C1 spec 6.1). Pass it the same way, in `.ai/runs/<KEY>/note.md` with `--note`: ao-step tells the word from
  a change. Tell the human, in Vietnamese, the line of the check that starts with `seo`, which says what the word did,
  such as why `seo` does not run when no screen of `design.md` belongs to an app with `seo: true`.
- On STOP with Questions, show the human each question in Vietnamese, one list, and ask for the answers. When they
  answer, copy their reply word for word to `.ai/runs/<KEY>/answers.md`, where KEY is the Epic: add nothing, and do
  not restate the questions or the proposals. Then run the command below with `--answers .ai/runs/<KEY>/answers.md`
  added. Never put the answers in a shell command.
- When their reply refers to advice you gave in this session, such as "đồng ý theo khuyên của Claude", copy that advice
  too, word for word, after their reply, under the line `Lời khuyên được nhắc tới:` and quoted with `> `: the agents
  never saw it, and the reply means nothing without it (T14 of C2).
- On any other STOP, and no text after the key, tell the human the reason and the command or clicks it names, in
  Vietnamese, and stop.
- On GO, run `node .ai-orchestrator/scripts/ao-step.mjs spec $0 --go` with the Bash tool in the background, with a
  timeout of 7200000 ms, and wait for its notification. Do not poll.
  Do not run any agent yourself, and do not change Jira or GitHub yourself.
- Then read `.ai/runs/<KEY>/last.md` and report in Vietnamese: what each agent did and cost, what changed in the SPEC
  when the human asked for a change, the questions left (as above), what the human must do at gate ① (numbered
  clicks: read the docs PR, then Approve spec on the Epic), and the next command.
