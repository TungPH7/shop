---
name: ao-qa
description: QA an item in Ready for QA with the qa agent, on the environment that runs its merge, and attach the evidence to Jira; with "fail:" and a defect the human found, qa reproduces it and fails the item; with "retest", QA again an item In QA after a NOT TESTED report.
argument-hint: "<KEY> [fail: <defect, steps, expected result>] [retest]"
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs qa $0`

## What the human wrote

$ARGUMENTS

## What to do

- The first word above is the item key. When the text after it starts with `fail:`, the rest is a defect the human
  found (human-loop spec 5.1): write it, as it is, to `.ai/runs/<KEY>/note.md`, where KEY is the item, and add
  `--note .ai/runs/<KEY>/note.md` to the command below. Never put that text in a shell command.
- With such a defect, before you run anything, ask the human one question in Vietnamese, with your proposal, after
  reading the acceptance criteria of the item (`getJiraIssue`):
  - `none`: it breaks an acceptance criterion of the item (say which);
  - `ac`: it is a new expectation no criterion covers; `ba` adds the criterion on Jira first, and qa then fails it;
  - outside the item: say so and stop; the human reports it as a Bug with `/ao-intake`.

  Add `--change none` or `--change ac` with the human's answer to the command below, then run it whatever the check
  said: ao-step decides with the defect.
- When the text after the key is `retest`, the item is In QA after a NOT TESTED report whose cause the human fixed,
  such as a Bug of the environment. Check that the item carries no Needs you flag any more; if it does, ask the human
  to clear it first, and stop. Otherwise run `node .ai-orchestrator/scripts/ao-step.mjs qa <KEY> --retest`, and treat
  its GO or STOP as below, with `--retest` on the run command too. Never use `--note` for this: it is the road of a
  defect the human found.
- **An item of level light** (C1 spec section 2) has no qa run: the check prints GO with the action `qa-light-start`,
  then, once that ran, a STOP that says "is at level light" with the lines "To check:". That one is yours to do:
  1. Run the GO as below: it moves the item to In QA with the CI token. Then run the check again.
  2. Check each line under "To check:" on the environment and the URLs the STOP names, with `playwright-cli` or by
     reading the pages. Check only those lines; add nothing the item does not ask for.
  3. Write a short report from `.ai-orchestrator/templates/qa-report.md` to `.ai/runs/<KEY>/light-report.md`: its
     heading `# QA report: <KEY> <title>`, its Result PASS or FAIL (NOT TESTED when a line could not be checked for a
     reason outside the code), one row per line checked with what you saw, and "Kiểm bởi phiên chính, mức light".
  4. Run `node .ai-orchestrator/scripts/ao-step.mjs qa <KEY> --light-report .ai/runs/<KEY>/light-report.md --go`. It
     posts the report with the CI token, and on a FAIL moves the item through QA fail.
  5. Tell the human, in Vietnamese, the result, each line and what you saw, and the next step: on PASS, Accept on the
     item is their click; on FAIL, `/ao-build <KEY>`.
- On STOP, and no defect, tell the human the reason and the command or clicks it names, in Vietnamese, and stop.
- On GO, or with a defect, run `node .ai-orchestrator/scripts/ao-step.mjs qa $0 --go` with the Bash tool in the
  background, with a timeout of 7200000 ms, and wait for its notification. Do not poll.
  Do not run any agent yourself, and do not change Jira or GitHub yourself.
- Then read `.ai/runs/<KEY>/last.md`, where KEY is the item the check printed, and report in Vietnamese: the QA result
  and the verdict of each criterion, the files attached to the item, whether a deploy came during the run, what the
  run cost, and the next step: on PASS, that Accept on the item is the human's click (numbered clicks); on FAIL, that
  `/ao-build <KEY>` builds the fix on a new branch; when qa could not reproduce the defect, what it tried.
