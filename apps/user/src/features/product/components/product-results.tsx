import { getTranslations } from 'next-intl/server';

import { Can } from '~/components/can';
import { DensityScope } from '~/components/density-scope';
import { DensityToggle } from '~/components/density-toggle';
import { JsonLd } from '~/components/seo/json-ld';
import { DeleteProductButton } from '~/features/product/components/delete-product-button';
import { ProductCountBadge } from '~/features/product/components/product-count-badge';
import { ProductFilters } from '~/features/product/components/product-filters';
import { ProductImageZoomButton } from '~/features/product/components/product-image-zoom-button';
import { ProductList } from '~/features/product/components/product-list';
import { ProductPagination } from '~/features/product/components/product-pagination';
import { ProductProviders } from '~/features/product/components/product-providers';
import { ViewScope } from '~/features/product/components/view-scope';
import { ViewToggle } from '~/features/product/components/view-toggle';
import { DELETE_PRODUCT_PERMISSION } from '~/features/product/model/product-actions';
import { productImageSrc } from '~/features/product/model/product';
import { productListQuerySchema } from '~/features/product/model/product-query';
import { getProducts } from '~/features/product/server/get-products';
import { RateLimitError } from '~/lib/errors/app-error';
import { normalizeError } from '~/lib/errors/normalize-error';
import { err, ok, type Result } from '~/lib/errors/result';
import { itemListLd } from '~/lib/seo/structured-data';
import { parseSearchParams } from '~/lib/validation/parse-search-params';

/**
 * Phần ĐỘNG của trang products — đọc `searchParams` (request-time) → bọc `<Suspense>` ở page (PPR, mẫu
 * folder 10). Cũng là nơi gắn SEAM state (folder 14): gom trong `ProductProviders` (Redux S1 + TanStack
 * S2 + nuqs) ĐẶT trong dynamic-hole (KHÔNG root — cacheComponents cấm provider request-time ở static
 * shell, bài học Stage A). 429 (lỗi DỰ KIẾN) mô hình hoá bằng `Result` (folder 17) → dịu tại chỗ; lỗi
 * THẬT khác ném cho `[locale]/error.tsx`.
 *
 * ⚠️ `view` (nuqs, URL) KHÔNG sống sót qua form-GET filter / `<Link>` phân trang (chúng dựng lại query
 * → mất param ngoài tầm chúng). Đây là trade-off MIX paradigm (server-nav × client URL-state); muốn giữ
 * thì hoặc carry `view` tường minh, hoặc nuqs-hoá cả filter. Giữ tối thiểu để demo nuqs rõ.
 */
export async function ProductResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('Products');
  const tv = await getTranslations('Validation');
  const query = parseSearchParams(productListQuerySchema, await searchParams);

  // ⭐ Lỗi DỰ KIẾN (429 rate-limit) → mô hình hoá bằng `Result` (folder 17), KHÔNG để sập trang. `catch`
  // đặt NGOÀI `use cache` (nằm trong getProducts) để tránh CACHE NHẦM trạng thái lỗi. `normalizeError`
  // map `ApiError(429)` → `RateLimitError` (ngữ nghĩa, thay cho magic `status === 429`); lỗi THẬT khác
  // (network/5xx/lệch schema) ⇒ `throw` cho `[locale]/error.tsx`.
  let result: Result<Awaited<ReturnType<typeof getProducts>>, RateLimitError>;
  try {
    result = ok(await getProducts(query));
  } catch (caught: unknown) {
    const error = normalizeError(caught);
    if (!(error instanceof RateLimitError)) throw error;
    result = err(error);
  }

  return (
    <ProductProviders>
      <DensityToggle
        labels={{
          label: t('density'),
          comfortable: t('densityComfortable'),
          compact: t('densityCompact'),
        }}
      />
      <ProductCountBadge
        labels={{
          total: t('countTotal'),
          loading: t('countLoading'),
          error: t('countError'),
          refresh: t('countRefresh'),
        }}
      />
      <ViewToggle labels={{ label: t('view'), list: t('viewList'), grid: t('viewGrid') }} />
      <ProductFilters
        current={query}
        labels={{
          search: t('searchLabel'),
          searchPlaceholder: t('searchPlaceholder'),
          sort: t('sortLabel'),
          order: t('orderLabel'),
          apply: t('applyLabel'),
          sortOptions: {
            createdAt: t('sortCreatedAt'),
            price: t('sortPrice'),
            sale: t('sortSale'),
          },
          orderOptions: { asc: t('orderAsc'), desc: t('orderDesc') },
        }}
        errorMessages={{ too_short: tv('too_short') }}
      />
      {result.ok ? (
        <>
          {/* ItemList JSON-LD (folder 21) từ DATA THẬT đã fetch — nằm trong dynamic-hole (Suspense) nên
              STREAM theo kết quả (bot chạy JS đọc được). url bỏ qua vì chưa có trang chi tiết (§22). */}
          <JsonLd
            data={itemListLd(
              result.value.items.map((p) => ({ name: p.name })),
              t('title'),
            )}
          />
          <DensityScope>
            <ViewScope>
              <ProductList
                products={result.value.items}
                emptyLabel={t('empty')}
                renderItemActions={(product) => (
                  <>
                    {/* ⭐ Folder 20 — island next/dynamic (zoom ảnh): cho MỌI người, đặt NGOÀI <Can>. */}
                    <ProductImageZoomButton
                      src={productImageSrc(product)}
                      alt={product.name}
                      label={t('zoom')}
                      closeLabel={t('zoomClose')}
                    />
                    {/* ⭐ Authz element-level: nút Xoá CHỈ hiện nếu user có quyền DELETE sản phẩm (ADMIN/
                        SELLER). CLIENT/anon → ẩn. Backend vẫn chặn 401/403 độc lập (defense-in-depth). */}
                    <Can
                      method={DELETE_PRODUCT_PERMISSION.method}
                      path={DELETE_PRODUCT_PERMISSION.path}
                    >
                      <DeleteProductButton
                        productId={product.id}
                        label={t('delete')}
                        messages={{
                          validation: t('deleteValidationError'),
                          auth: t('deleteAuthError'),
                          unknown: t('deleteUnknownError'),
                        }}
                      />
                    </Can>
                  </>
                )}
              />
            </ViewScope>
          </DensityScope>
          <ProductPagination
            page={result.value.page}
            totalPages={result.value.totalPages}
            query={query}
            labels={{
              prev: t('prev'),
              next: t('next'),
              info: t('pageInfo', { page: result.value.page, total: result.value.totalPages }),
            }}
          />
        </>
      ) : (
        <p role="status">{t('rateLimited')}</p>
      )}
    </ProductProviders>
  );
}
