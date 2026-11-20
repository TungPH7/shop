<!--
Template for the `plan` artifact in contract/policies.yaml: the plan of one Epic, saved as docs/specs/<EPIC-KEY>/plan.md.
Sections follow the plan template of agent-skills' planning-and-task-breakdown, plus an API Contract section.
Tasks live in Jira instead of tasks/todo.md, so the Task List is an ordered index of Jira keys (the skill's external
tracker convention). Keep headings in English and write the content in Vietnamese.
Delete the guidance comments and the Example section when you are done.
-->

# Implementation Plan: <Epic name>

> **Epic:** <EPIC-KEY> · **Jira:** <link to the Epic> · **Spec:** [spec.md](spec.md) · **Tasks:** tracked in Jira under <EPIC-KEY>

## Overview

<!-- One paragraph: what the Epic delivers, and in which order. -->

## Architecture Decisions

<!-- Each key decision with its reason. A decision that is expensive to reverse also gets an ADR (templates/adr.md). -->

## API Contract

<!-- For every Story that has both FE and BE Sub-tasks: the endpoints, the request and response types, and the errors.
The BE Sub-task puts the types in the shared types package of the monorepo, so a mismatch fails the type check. -->

## Task List

<!-- Ordered index of the Jira Stories and Tasks this plan creates, grouped by phase, with a checkpoint after each phase.
Shared groundwork, such as the auth module or the schema of the Epic, is an independent Task that comes first. So is the
design system of an app, when design.md has a Design System item marked "mới" or the app has no
docs/design-system/<app>.md: a Task fe-dev "Design system của <app>" before every Story with a screen of that app.
The details of each item live in Jira, written from templates/story.md or templates/task.md.
After each title: the dev roles that build the item (be-dev, fe-dev, devops), with "(Sub-task)" when each role gets a
Sub-task of a Story; the level of the item, light, standard or heavy (C1 spec section 2), with the reason when it is not
standard; only for a hard item, its effort xhigh or max with the reason; and, when the item touches a screen of the
section ## SEO of the SPEC, "seo:" with the codes of those screens (C1 spec 6.6). An item with no "seo:" has no SEO
part, such as a Task of an admin page. You approve the levels, the efforts and the SEO at gate ② plan-approval, and ba
turns roles, levels, efforts and "seo:" into labels.
Levels: light for an item whose mistake costs little, such as a docs Task or a change of copy, with no logic: one
review at high, no security, and the main session checks it in place of a qa run. heavy where a mistake costs much:
money, security, data that exists: reviewer at xhigh, security at max, fixes until no Critical or High. standard for
the rest. A PR on a critical path makes its item heavy whatever its label. -->

### Phase 1: <name>
- [ ] <KEY>: <Story or Task title> · <roles> · level <light | standard | heavy>: <reason, unless standard> · effort <xhigh | max>: <reason, only for a hard item> · seo: <S codes of the section ## SEO it touches>

### Checkpoint: <name>
- [ ] <What must work before the next phase>

## New Libraries

<!-- Each library the plan needs that dependencies.approved of .ai-orchestrator/project.yaml does not list yet, one line
each: the ecosystem, the name, the exact version to check, and why no library already there will do (C1 spec section 5).
/ao-plan runs dep-check on each line before gate ②, and the main session adds those that pass to the approved list on
the docs branch, so that you approve them with the plan. Write "Không có." when there is none. -->

- <npm | maven> <name>@<version>: <why it is needed>

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| <...> | High / Medium / Low | <...> |

## Open Questions

<!-- What still needs your decision before gate ② plan-approval. -->

## Example

<details>
<summary>Ví dụ: plan của Epic "Đăng nhập" (DEMO-10)</summary>

````markdown
# Implementation Plan: Đăng nhập

> **Epic:** DEMO-10 · **Jira:** https://example.atlassian.net/browse/DEMO-10 · **Spec:** [spec.md](spec.md) · **Tasks:** tracked in Jira under DEMO-10

## Overview
Làm module auth dùng chung trước, rồi đăng nhập bằng email và mật khẩu, cuối cùng là khóa tài khoản khi nhập sai nhiều lần.

## Architecture Decisions
- JWT nằm trong cookie httpOnly, không để ở localStorage, để lỗi XSS không lấy được token (ADR-0003).

## API Contract
`POST /auth/login` (DEMO-12)
- Request: `{ email: string; password: string }`
- 200: `{ user: { id: string; email: string } }`, kèm cookie `access_token`
- 401: `{ code: "INVALID_CREDENTIALS" }`; 423: `{ code: "ACCOUNT_LOCKED", retryAfterSeconds: number }`

## Task List
### Phase 1: Nền
- [ ] DEMO-11: Module auth dùng chung: băm mật khẩu, phát JWT · be-dev · level heavy: băm mật khẩu và ký JWT
### Checkpoint: Nền
- [ ] Unit test của module auth xanh
### Phase 2: Đăng nhập
- [ ] DEMO-12: Đăng nhập bằng email và mật khẩu (Sub-task BE DEMO-13, FE DEMO-14) · be-dev, fe-dev (Sub-task) · level heavy: kiểm mật khẩu và đặt cookie · effort xhigh: kiểm mật khẩu và đặt cookie
- [ ] DEMO-15: Khóa tài khoản 15 phút sau 5 lần nhập sai · be-dev · level standard
### Checkpoint: Đăng nhập
- [ ] E2E test của DEMO-12 và DEMO-15 pass trên Development

## New Libraries
- npm argon2@0.44.0: băm mật khẩu bằng Argon2id; Node không có sẵn hàm này

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Bị dò mật khẩu hàng loạt | High | DEMO-15 khóa tài khoản; API giới hạn số request |

## Open Questions
- Không có.
````

</details>
