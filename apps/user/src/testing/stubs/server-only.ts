// Stub no-op cho Vitest. Package `server-only` (npm) resolve sang `index.js` NÉM lỗi khi import
// trong môi trường KHÔNG có react-server condition (Node/Vitest) → `vitest.config.ts` alias
// `'server-only'` về file này để các module DAL/http (có `import 'server-only'`) test được.
// Next build/dev vẫn dùng package thật (giữ nguyên rào chắn server/client ở production).
export {};
