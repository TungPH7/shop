// Type-safe message keys (next-intl v4): khai báo `Messages` = kiểu của file locale
// MẶC ĐỊNH (en.json) → `useTranslations('Ns')` + `t('key')` được TS kiểm tra; gõ sai
// namespace/key = lỗi BIÊN DỊCH. (resolveJsonModule đã bật; file trong include qua `**/*.ts`.)
//
// ⭐⭐ Top-level `import` BẮT BUỘC: nó biến file thành MODULE → `declare module 'next-intl'`
// là MODULE AUGMENTATION (gộp `AppConfig` vào next-intl THẬT). Nếu file là SCRIPT (không
// import/export), `declare module` thành ambient declaration THAY THẾ 'next-intl' (chỉ còn
// `AppConfig`) → che hết export thật → lỗi TS2305 "has no exported member" khắp nơi.
// Dùng value-import + `typeof` (mẫu chính thức next-intl): JSON default là GIÁ TRỊ nên
// phải `typeof` mới lấy được kiểu (consistent-type-imports tắt cho *.d.ts ở eslint.config).
import messages from './messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages;
  }
}
