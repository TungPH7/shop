import { type RequestHandler } from 'msw';

// CHƯA có API thật (folder 07 mới dựng api layer) -> để mảng rỗng CÓ KIỂU sẵn.
// Từ folder 07+ thêm handler happy-path mặc định vào đây; mỗi test override theo
// ca riêng bằng `server.use(...)`. Triết lý: MSW mock ở BOUNDARY network (chặn
// request thật), KHÔNG mock `fetch` bằng tay.
export const handlers: RequestHandler[] = [];
