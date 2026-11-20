---
name: ao-intake
description: Turn a rough description into one Jira item of the SDLC contract, an Epic, a Task or a Bug, after an interview with the human. Start spec stays the human's click.
argument-hint: <rough description>
disable-model-invocation: true
---

## Check

!`node .ai-orchestrator/scripts/ao-step.mjs intake`

## What the human wrote

$ARGUMENTS

## What to do

No agent runs here: you, the main session, do the intake with the human (human-loop spec 3.1). Speak Vietnamese with
them. Write no code, and change nothing in the repository but the draft below.

1. **Interview.** Follow the interview-me skill: one question at a time, until you could write the item without
   guessing who it is for, what problem it solves, what done looks like, what is out of scope, and its constraints.
   When the idea is still vague, or the human asks for options, use the thinking steps of the idea-refine skill; do not
   run its script, and write nothing in `docs/ideas/`. Stop asking when the human says it is enough. Look at the Epics
   the check printed: when the description repeats one, say so before going on.
2. **Sort it** with the rule the check printed:
   - an Epic: a result the end user sees, which needs a SPEC and a plan;
   - a Task: technical work whose result the end user does not see;
   - a Bug: behaviour that is wrong against a requirement that exists already.

   You never make a Story: a Story needs acceptance criteria in a SPEC, screens and an API contract, which only stage
   spec and plan write. Work the size of one Story, and a new capability for an Epic past gate ②, become a small Epic
   of their own; say so, and link the new Epic to the old one with "relates to" in its header.
3. **Draft.** Write `.ai/intake/<YYYYMMDD-HHmm>-<slug>.md` from `.ai-orchestrator/templates/epic.md`, `task.md` or
   `bug.md`. Put in it only what the human said or approved. What is not settled goes under Open Points of an Epic, or
   you ask it. Copy the human's first description word for word under Original Request. Delete the template's guidance
   comments and its Example section.
   - **SEO** (C1 spec 6.6): a Task or a Bug that touches a page of an app the check names under "Apps with seo: true"
     gets the label `ao-seo`. When nobody has written its SEO part yet, end the draft with a line `---` and one
     paragraph that starts `Cần seo:` and says what seo must write, such as the title, the meta description, the copy
     or the structured data of which page. A Bug that is wrong against the section `## SEO` of an older SPEC needs no
     `Cần seo:`: its draft points to that section, with the path of the SPEC and the screen code.
   - **An Epic of a blog** (C1 spec 6.7): its draft also asks for posts in draft that only the admin sees, a preview link
     that people outside cannot open, and a tool that publishes a post through the API of the admin, such as
     `scripts/post-publish.mjs <post file>`, reviewed once. The workflow that writes posts (row D2) needs all three.
4. **Summary.** Show the human, in Vietnamese: the type and why, the title, the scope, the open points, and the path of
   the draft. For a Task or a Bug, also the level you propose, light, standard or heavy, with the reason (C1 spec
   section 2): light where a mistake costs little and there is no logic, such as a docs Task or a change of copy; heavy
   where a mistake costs much: money, security, data that exists; standard for the rest. Their OK approves it. Say
   whether it gets the label `ao-seo`, and show the `Cần seo:` paragraph when there is one. For a
   Bug, also Found in, and the Severity and Affects Version you propose, which the human approves. Ask
   them to answer OK or say what to change. Change the draft and show the summary again until they say OK.
5. **Create.** Only after the human's OK, create the item once with the createJiraIssue tool of the atlassian server:
   the cloud id of `.claude/rules/ai-orchestrator.md`, the space the check printed, the type, the summary from the
   draft's first line, and the rest of the draft as the description, in markdown. For a Task or a Bug, also set the
   label `ao-level-<level>` of the level they approved, and `ao-seo` when they approved it, in the field `labels`.
   For a Bug, also set Found in, Severity and Affects Version, with the field ids the check printed; leave Fix Version
   empty. The `Cần seo:` paragraph is not part of the description: once the item exists, add it as one comment on
   the item with addOrEditJiraIssueComment, word for word as in the draft, starting with `Cần seo:`. These are the
   only Jira writes you make: the item, and that comment when there is one; no transition, no other comment, no edit
   of another item. If a call fails, show the error and stop: do not try another way.
6. **Report.** Run `node .ai-orchestrator/scripts/ao-step.mjs status <KEY>` with the key Jira gave, and show its output.
   Then tell the human, in Vietnamese, the key, its link, and the next step as numbered clicks: for an Epic, Start spec
   on it, then `/ao-spec <KEY>`; for a Task or a Bug, read it on Jira, then Refine. With a `Cần seo:` comment, first
   `/ao-request <KEY>`, which runs seo; read the SEO part seo comments on the item, then Refine.
