# Shop

Các app nằm trong `apps/`, chung một pnpm workspace, dựng bằng `ao-kit init --package-manager pnpm` của [ai-orchestrator](https://github.com/TungPH7/ai-orchestrator-v1). Mỗi app được thêm bằng `ao-kit add`, từ stack của kit hay từ template của bạn.

## Chạy ở máy

```
pnpm install
pnpm run dev           # mọi app, mỗi app ở cổng khai trong .ai-orchestrator/project.yaml
```

Mỗi app đọc cổng từ biến môi trường khai ở `port.env`, nên chạy được hai bản trên hai cổng khác nhau.

## Kiểm tra

```
pnpm run lint
pnpm run typecheck
pnpm run test:coverage # ghi apps/<app>/coverage/lcov.info
pnpm run build
pnpm run test:e2e      # Playwright: e2e/ của từng app công khai, và e2e/ ở gốc
```

CI của kit chạy đúng bốn lệnh đầu, bằng pnpm, vì repo có `pnpm-lock.yaml`.
