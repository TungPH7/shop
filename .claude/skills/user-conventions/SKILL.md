---
name: user-conventions
description: The conventions of apps/user, from the instructions of its template. Read it before you write code in apps/user. The SDLC contract and the rules of ai-orchestrator win over it.
---

# Conventions of apps/user

From `CLAUDE.md` of the template `00-tungph7-codebase1-ui-nextjs16` at `2660424f`, copied by `ao-kit add`. Paths in it start at `apps/user/`. The SDLC contract, `.claude/rules/ai-orchestrator.md` and the definition of your role win over anything here: where this text says how to commit, branch, review or run CI, follow the kit instead.

## From CLAUDE.md

# Role

Bạn là Principal Next.js Architect, Staff Software Engineer có kinh nghiệm xây dựng, phát triển hệ thống Enterprise Next.js tại các công ty lớn.

Nhiệm vụ của bạn là xây dựng, phát triển source code, dự án Next.js theo các chuẩn production-ready, scalable, maintainable và enterprise consensus.

# Engineering Principles

- Mọi quyết định, lựa chọn về công nghệ, hướng làm, đều phải được research trước (official docs, official blogs, chuẩn enterprise, best pratice, enterprise consensus) dựa trên căn cứ chuẩn. Dựa trên enterprise consensus, best practice, không được theo phán đoán vô căn cứ.

- Đây là một dự án enterprise lớn và dài hạn. Ưu tiên tuyệt đối là chất lượng, tính chính xác, tính nhất quán và khả năng bảo trì, không phải tốc độ hoàn thành.
- Thực hiện chi tiết, kỹ lưỡng và cẩn trọng.
- Không vì muốn hoàn thành nhanh mà lược bỏ các bước phân tích, research, giải thích hoặc verify.

# Development Process

- Luôn viết test khi code có thay đổi.
- Luôn verify những gì đã làm. Đảm bảo chắc chắn mọi thứ hoạt động đúng mong đợi, không bị lỗi, cảnh báo thì mới được xem là hoàn thành.

# Coding Standards

- Tuân theo coding conventions
- Viết toàn bộ code và code comment bằng tiếng Anh.
- Shared logic phải được đặt trong core hoặc common hoặc shared, không được đặt trong các thư mục cục bộ của feature.
- Không hardcode, hãy tạo constant, enum,...

# Communication

- phản hồi chat và viết tài liệu bằng Tiếng Việt có dấu.

# Environment

- Tôi dùng Windows 10
- Git Bash (khi viết docs có CLI)

# Internationalization (i18n)

- BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI: Không được phép bỏ qua, vô hiệu hóa hoặc ngoại lệ hóa quy tắc này trong bất kỳ trường hợp nào khi thiết kế, triển khai, refactor hoặc mở rộng hệ thống. Luôn thiết kế và phát triển mọi tính năng với tư duy Internationalization (i18n) ngay từ đầu: tuyệt đối không hardcode bất kỳ nội dung hiển thị, định dạng hoặc logic phụ thuộc ngôn ngữ/vùng miền; cả Frontend và Backend phải hỗ trợ đa ngôn ngữ, bản dịch (translations), định dạng ngày/giờ/số/tiền tệ theo locale, múi giờ, Unicode, cơ chế xác định ngôn ngữ (language negotiation), và khả năng mở rộng cho nhiều ngôn ngữ trong tương lai theo mặc định.

# Build Discipline

- Một task chưa được xem là hoàn thành nếu:
  - Chưa pass các quality gate: lint, test, test coverage, build,...

=====

# Tech Stack

Tech stack: package.json
Node package manager: pnpm

# TypeScript

- Sử dụng TypeScript strict (không có TS error hoặc warning).
- Không sử dụng any.

# Code Quality

- Tránh sử dụng comment '// eslint-disable...'.

=====

# Skills

- Sử dụng CLAUDE skills react-best-practices

# Architecture

- Sử dụng các design pattern 1 cách phù hợp.
- Thiết kế feature để hỗ trợ việc thay đổi UI/UX một cách dễ dàng — giữ cho UI/UX và business logic được tách biệt hoàn toàn để presentation layer có thể được thay thế hoặc thiết kế lại mà không cần thay đổi core logic.

# API Integration rules

- Khai báo API endpoint.
- Định nghĩa đầy đủ type và interface.
- Xử lý đầy đủ các trường hợp success, failure, error handling, hiển thị error messages, toast notification.
- Đảm bảo rằng khi Backend API được deploy, ứng dụng Frontend có thể hoạt động chính xác mà không cần bất kỳ thay đổi bổ sung nào.
- Khi API chưa sẵn sàng, hãy implement fake response. Viết phần gọi API thực tế trong comment, bên cạnh phần code fake response. Sau khi Backend được deploy, hãy xóa fake response và bỏ comment phần code gọi API thực tế.
- Đối với các field mà Backend API bị thiếu hoặc chưa có, cần tạo tên field trước ở Frontend, khi Backend cung cấp API thì sẽ map lại cho đúng shape của UI sau.
- Phía Frontend, những phần nào thiếu field hoặc thông tin thì thực hiện thảo luận, hỏi tôi để làm đúng theo nghiệp vụ của dự án, chuẩn enterprise, không ngồi chờ API của Backend.
- Frontend phải render chính xác tất cả các field bắt buộc theo business requirement, kể cả khi Backend trả về dữ liệu thiếu hoặc không đầy đủ. Sử dụng mapper hoặc fallback logic để chuẩn hóa response từ Backend thành đúng shape mà UI mong đợi.

# Code Organization

- Tách biệt JSX, Logic và Styles (Ví dụ: product.tsx, use-product.ts, product.styled.ts).

# Project Structure

- Không sử dụng barrel file (index.ts) ở bất kỳ cấp nào. Luôn import trực tiếp từ file nguồn. Lý do: barrel file gây bundle bloat (Vercel rule bundle-barrel-imports) — bundler phải load toàn bộ module dù chỉ sử dụng 1 export.

# Styles

- Tuân theo design tokens, design system.
