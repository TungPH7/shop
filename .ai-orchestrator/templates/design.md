<!--
Template for the `design` artifact in contract/policies.yaml: the screens of one Epic, saved as docs/specs/<EPIC-KEY>/design.md
by `ux` when the Epic touches the UI. The images of Figma and Image screens go to docs/specs/<EPIC-KEY>/design/.
Keep headings and YAML keys in English and write the content in Vietnamese.
Run `node .ai-orchestrator/scripts/check-design.mjs <this file>` until it reports no error, then commit.
Delete the guidance comments and the Example section when you are done.
-->

# Design: <Epic name>

> **Epic:** <EPIC-KEY> · **Jira:** <link to the Epic> · **Spec:** docs/specs/<EPIC-KEY>/spec.md · **Status:** Draft | Approved <YYYY-MM-DD>
>
> **Figma version:** <name of the approved version in Figma's version history, or "none" when no screen is a Figma screen>

## Screens

<!-- One row per screen. Codes S1, S2… never change after the SPEC is approved: a removed screen leaves its code unused.
Kind is ASCII when the screen has no design yet, Figma when it has a Figma design, and Image when the human gave a
screenshot or a mockup made with another tool. -->

| Code | Name | Route | User story | Kind |
|---|---|---|---|---|
| S1 | <name> | <route> | <user story of the SPEC> | ASCII |
| S2 | <name> | <route> | <user story of the SPEC> | Figma |
| S3 | <name> | <route> | <user story of the SPEC> | Image |

## Flow

<!-- Screen codes are the node names; write the block that triggers each move on its arrow. -->

```mermaid
flowchart LR
  S1[S1 <name>] -->|"[n] <action>"| S2[S2 <name>]
  S2 -->|"[n] <action>"| S3[S3 <name>]
```

## Screen Details

<!-- One subsection per screen, in code order. Each screen has exactly one kind:
- ASCII: a ```text drawing whose first line is "S<n> · <name> · <screen size>". Draw frames with + - | [ ] _ only, no
  Unicode box characters or emoji, at most 100 columns per line. Number blocks [1], [2]… in reading order (top to bottom,
  left to right), which is also the expected Tab order. Inside the frame put only numbers and short labels; [ ] and [___]
  are input boxes, not block codes. Draw another screen size only when the layout changes, for example on mobile.
- Figma: the exported images, desktop and mobile when there is one, as ![S<n> · <name> · <screen size>](design/S<n>-<size>.png).
  Export at 1x as PNG or JPG; each image at most 1 MB and at most 2,000 px on its long side; slice a long frame.
  Commit only approved images, with the SPEC.
- Image: a screenshot or a mockup the human put in .ai/design-inbox/<EPIC-KEY>/, shown the same way and with the same
  limits. An image over them goes back to the human: never edit one.
Right under the drawing or the images comes one ```yaml block with `screen`, `route`, `blocks`, and for a Figma screen
`figma`, the link of the frame with its node-id, or for an Image screen `screenshot`, where the screenshot or mockup
comes from. Each block has `name` and `type`, and when needed `content`, `behavior`,
`validation`, `states`, `a11y`, `ac` (AC<n> codes of the SPEC) and `figma` (node id of the layer). Elsewhere, point to a
block by its full code, for example S1.4. After approval a removed block leaves its number unused, and a new block takes
the next number. -->

### S1 · <name>

```text
S1 · <name> · desktop
+--------------------------------------+
| [1] <label>                          |
| [2] <label>                          |
+--------------------------------------+
```

```yaml
screen: S1
route: <route>
blocks:
  1:
    name: <name>
    type: <heading | text | input | button | link | list | image | ...>
  2:
    name: <name>
    type: <type>
    behavior: <what happens>
    ac: [AC1]
```

### S2 · <name>

![S2 · <name> · desktop](design/S2-desktop.png)

```yaml
screen: S2
route: <route>
figma: https://www.figma.com/design/<file-key>/<file-name>?node-id=<frame-id>
blocks:
  1:
    name: <name as seen in the image>
    type: <type>
    figma: "<layer node id>"
```

### S3 · <name>

![S3 · <name> · desktop](design/S3-desktop.png)

```yaml
screen: S3
route: <route>
screenshot: <where it comes from, such as "ảnh bạn gửi ngày <date>, chụp trang <page>">
blocks:
  1:
    name: <name as seen in the image>
    type: <type>
```

## Design System

<!-- When a screen is Figma or Image: the tokens and components read from its images, so every screen of the Epic is
built the same way. Compare each with docs/design-system/<app>.md when the app has one: "có" when it has the item,
"mới" when it does not. Values read from an image are estimates: write what the image does not settle under Open
Questions. When an item is "mới", or the app has no docs/design-system/<app>.md, sa puts a Task "Design system của
<app>" first in the plan. -->

**App:** <app in apps/, such as user> · **Design system của app:** docs/design-system/<app>.md | chưa có

| Loại | Tên | Giá trị | Có hay mới |
|---|---|---|---|
| Màu | <name, such as primary> | <hex and where it is used> | <có / mới> |
| Font | <name, such as body> | <family size/line height, weight> | <có / mới> |
| Khoảng cách | spacing | <the steps, such as 4, 8, 12, 16, 24, 32 px> | <có / mới> |
| Bo góc, bóng | <name> | <value> | <có / mới> |
| Điểm ngắt | <name> | <width> | <có / mới> |
| Component | <name, such as Button> | <variants and states> | <có / mới> |

## Open Questions

<!-- What the design does not settle yet. For a Figma or Image screen, also what the images lack: error states, the
mobile layout, message texts, values the image does not show clearly. -->

## Example

<details>
<summary>Ví dụ: Epic "Mã giảm giá cho giỏ hàng" (DEMO-20)</summary>

````markdown
# Design: Mã giảm giá cho giỏ hàng

> **Epic:** DEMO-20 · **Jira:** https://example.atlassian.net/browse/DEMO-20 · **Spec:** docs/specs/DEMO-20/spec.md · **Status:** Approved 2026-11-05
>
> **Figma version:** Checkout v3, duyệt ngày 2026-11-04

## Screens
| Code | Name | Route | User story | Kind |
|---|---|---|---|---|
| S1 | Giỏ hàng | /cart | Là khách, tôi muốn nhập mã giảm giá để trả ít hơn | ASCII |
| S2 | Thanh toán | /checkout | Là khách, tôi muốn thấy số tiền đã giảm trước khi trả | Figma |

## Flow
```mermaid
flowchart LR
  S1[S1 Giỏ hàng] -->|"[6] Thanh toán"| S2[S2 Thanh toán]
  S2 -->|"[1] Quay lại"| S1
```

## Screen Details

### S1 · Giỏ hàng

```text
S1 · Giỏ hàng · desktop
+--------------------------------------------------+
| [1] Danh sách sản phẩm                           |
+--------------------------------------------------+
| [2] Mã giảm giá [______________]  [3] (Áp dụng)  |
| [4] Thông báo của mã                             |
| [5] Tổng tiền                                    |
|                                [6] (Thanh toán)  |
+--------------------------------------------------+
```

```yaml
screen: S1
route: /cart
blocks:
  1:
    name: Danh sách sản phẩm
    type: list
    content: Tên, đơn giá, số lượng và thành tiền của từng sản phẩm
  2:
    name: Ô nhập mã giảm giá
    type: input
    validation: 6–12 ký tự chữ và số; sai định dạng thì hiện [4]
    a11y: Nhãn "Mã giảm giá" gắn với ô nhập
    ac: [AC1, AC3]
  3:
    name: Nút Áp dụng
    type: button
    behavior: Kiểm mã. Hợp lệ thì trừ vào [5] và hiện [4] màu xanh; không hợp lệ thì hiện [4] màu đỏ
    states:
      checking: Khóa nút, hiện vòng xoay
    ac: [AC1, AC2]
  4:
    name: Thông báo của mã
    type: text
    content: '"Đã giảm 10%", hoặc "Mã không hợp lệ hoặc đã hết hạn"'
    a11y: Vùng aria-live, để trình đọc màn hình đọc thông báo
    ac: [AC2]
  5:
    name: Tổng tiền
    type: text
    content: Tạm tính, giảm giá, phí vận chuyển và tổng cộng
    ac: [AC1]
  6:
    name: Nút Thanh toán
    type: button
    behavior: Sang S2, giữ mã đã áp dụng
```

### S2 · Thanh toán

![S2 · Thanh toán · desktop](design/S2-desktop.png)
![S2 · Thanh toán · mobile](design/S2-mobile.png)

```yaml
screen: S2
route: /checkout
figma: https://www.figma.com/design/AbCdEf123/Shop?node-id=12-345
blocks:
  1:
    name: Liên kết Quay lại giỏ hàng
    type: link
    behavior: Về S1
    figma: "12:350"
  2:
    name: Dòng Giảm giá
    type: text
    content: Mã đã áp dụng và số tiền được giảm
    figma: "12:367"
    ac: [AC1]
  3:
    name: Nút Đặt hàng
    type: button
    behavior: Tạo đơn với tổng tiền đã giảm
    figma: "12:372"
```

## Design System

**App:** shop · **Design system của app:** docs/design-system/shop.md

| Loại | Tên | Giá trị | Có hay mới |
|---|---|---|---|
| Màu | primary | #1A73E8, nút Đặt hàng và liên kết | có |
| Màu | success | #188038, dòng Giảm giá ở S2.2 | mới |
| Font | body | Inter 16/24, 400 | có |
| Component | Dòng tiền | nhãn trái, số tiền phải; bản giảm giá có dấu trừ | mới |

## Open Questions
- Figma chưa có trạng thái khi mã hết hạn giữa lúc thanh toán. Đề xuất: quay về S1 và hiện S1.4.
- Màu success đọc từ ảnh xuất của Figma; xin mã màu chính xác trong Figma.
````

</details>
