import { Inter } from 'next/font/google';

// ⭐ Folder 20 — next/font: TỰ HOST font lúc BUILD (Next tải CSS + file font về, phục vụ cùng static
// assets) → KHÔNG có request runtime tới Google (riêng tư + nhanh) và **0 layout-shift** (next/font tự
// tính metric fallback khớp). Vì font phục vụ từ origin của ta ('self'), CSP `font-src 'self'` (folder 19)
// đã đủ — KHÔNG phải nới `fonts.googleapis.com`/`fonts.gstatic.com`. Đây là một "thắng lợi self-host"
// song song với image-optimizer (Stage D) và BFF/`connect-src` (folder 19).
//
// Dùng VARIABLE FONT (Inter) → một file phủ MỌI weight (nhẹ + linh hoạt) nên KHÔNG cần khai `weight`.
// `display:'swap'` (mặc định, khai tường minh để dạy): hiện fallback NGAY rồi tráo sang font thật khi tải
// xong → tránh "văn bản vô hình" (FOIT). `variable` xuất CSS var `--font-sans` để globals.css tham chiếu
// (tách định nghĩa font khỏi nơi áp style — hợp Tailwind v4 ở Phase 1.2). `subsets:['latin']` để preload
// đúng tập ký tự (thiếu subsets khi preload=true sẽ cảnh báo).
export const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
