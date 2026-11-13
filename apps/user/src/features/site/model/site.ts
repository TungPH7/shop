/**
 * Model của feature `site` — tầng THẤP NHẤT trong một feature.
 *
 * Quy ước `model/`: chỉ chứa **type/schema + logic THUẦN** (no React, no UI, no I/O).
 * Vì sao tách ra: hàm thuần là nơi **dễ test nhất** và **bug hay nằm** → đẩy logic
 * xuống đây, giữ component "mỏng" (chiến lược test server-first, folder 05).
 */

export type SiteIdentity = {
  /** Tên thương hiệu hiển thị cho người dùng. */
  name: string;
};

/**
 * Tạo dòng bản quyền cho footer.
 *
 * HÀM THUẦN: cùng input → cùng output, không I/O, không phụ thuộc React →
 * **unit-test trực tiếp** (không cần render, không cần MSW).
 */
export function buildCopyrightNotice(identity: SiteIdentity, year: number): string {
  return `© ${year} ${identity.name}. All rights reserved.`;
}
