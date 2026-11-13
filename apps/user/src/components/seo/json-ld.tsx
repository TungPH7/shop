import { type Thing, type WithContext } from 'schema-dts';

/**
 * Render MỘT khối structured data: `<script type="application/ld+json">`.
 *
 * ⭐⭐ NGOẠI LỆ DUY NHẤT của rule cấm `dangerouslySetInnerHTML` (folder 19, block 2d). File này được
 * thêm vào `ignores` của block đó — đúng cơ chế folder 19 đã định ("chỗ DUY NHẤT được phép", giống
 * `<SafeHtml>`). Vì sao BẮT BUỘC dangerouslySetInnerHTML (không có cách khác):
 *  - JSON-LD là CÁCH CHÍNH THỐNG của Next để nhúng structured data (docs Next "JSON-LD").
 *  - Nếu đặt JSON làm children: `<script>{json}</script>` → React escape `<`→`&lt;`, `&`→`&amp;`
 *    trong text node → JSON HỎNG với crawler.
 *
 * AN TOÀN dù dùng dangerouslySetInnerHTML vì:
 *  - `data` do TA dựng (typed `schema-dts`), KHÔNG phải HTML/đầu vào người dùng;
 *  - vẫn chốt XSS: `.replace(/</g, '\\u003c')` chặn chuỗi con `</script>` thoát khỏi thẻ
 *    (khuyến nghị của Next/OWASP cho mọi dữ liệu nhúng vào `<script>`).
 */
export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
