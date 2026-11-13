import { http, HttpResponse } from 'msw';
import { useTranslations } from 'next-intl';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { beforeEach, expect, test } from 'vitest';

import { DensityScope } from '~/components/density-scope';
import { DensityToggle } from '~/components/density-toggle';
import { ProductCountBadge } from '~/features/product/components/product-count-badge';
import { ProductList } from '~/features/product/components/product-list';
import { ViewScope } from '~/features/product/components/view-scope';
import { ViewToggle } from '~/features/product/components/view-toggle';
import { type Product } from '~/features/product/model/product';
import { QueryProvider } from '~/lib/query/query-provider';
import { server } from '~/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '~/testing/render';

/**
 * ⭐ TEST TÍCH HỢP (capstone folder 23) — KHÁC unit test từng island.
 *
 * Unit test (đã có) kiểm MỖI island RIÊNG LẺ (density-toggle, view-toggle, product-count-badge…).
 * Test này ghép NHIỀU seam vào MỘT cây — đúng như `ProductResults` ráp trên `/products` — để chứng minh
 * điều unit test KHÔNG với tới được: **các cơ chế state độc lập cùng tồn tại và KHÔNG giao thoa** (Redux
 * S1 density × nuqs view URL × TanStack S2 count), i18n chảy tới mọi island, và render-prop slot chạy
 * đúng cho từng dòng trong composition thật.
 *
 * ⚠️ RSC async (`ProductResults`, `page.tsx`) KHÔNG unit-test được (luật server-first §5/§8) → phần
 * async đó verify bằng build + curl + E2E (folder 24). Ở đây ta test đúng RANH GIỚI test được: cụm
 * island client dưới các provider THẬT.
 */

// Fixture DTO tối thiểu (khớp `product-list.test`): A đang sale (giá gốc > giá bán), B không sale.
const products: Product[] = [
  { id: 1, name: 'Sản phẩm A', priceVnd: 800000, originalPriceVnd: 1200000, images: [] },
  { id: 2, name: 'Sản phẩm B', priceVnd: 50000, originalPriceVnd: 50000, images: [] },
];

// Density (Redux) persist qua localStorage → xoá giữa các test để mỗi test bắt đầu từ mặc định
// 'comfortable' (nếu không, test click 'compact' ở trên sẽ rò sang test dưới qua localStorage).
beforeEach(() => {
  localStorage.clear();
});

/**
 * Harness = tái dựng `ProductProviders` cho jsdom. `renderWithProviders` đã cấp StoreProvider (Redux) +
 * NextIntlClientProvider (i18n); ở đây thêm QueryProvider (TanStack) + NuqsTestingAdapter (nuqs in-memory,
 * không cần router thật — mẫu `view-toggle.test`). i18n giải qua `useTranslations` rồi truyền chuỗi xuống
 * island — GIỐNG page thật (page giải server bằng `getTranslations`, island nhận labels làm prop).
 */
function ProductShellHarness({ products: items }: { products: Product[] }) {
  const t = useTranslations('Products');
  return (
    <QueryProvider>
      <NuqsTestingAdapter>
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
        <DensityScope>
          <ViewScope>
            <ProductList
              products={items}
              emptyLabel={t('empty')}
              renderItemActions={(product) => (
                <button type="button">{`${t('zoom')}: ${product.name}`}</button>
              )}
            />
          </ViewScope>
        </DensityScope>
      </NuqsTestingAdapter>
    </QueryProvider>
  );
}

test('seam state cùng tồn tại & KHÔNG giao thoa (Redux density × nuqs view × TanStack count) + slot mỗi dòng', async () => {
  server.use(http.get('/api/products/count', () => HttpResponse.json({ count: 2 })));

  const { container, user } = renderWithProviders(<ProductShellHarness products={products} />);

  // Danh sách render + render-prop slot chạy CHO TỪNG DÒNG trong composition thật.
  expect(screen.getByText('Sản phẩm A')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zoom: Sản phẩm A' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zoom: Sản phẩm B' })).toBeInTheDocument();

  // TanStack (S2): count fetch qua MSW hiện lên (cùng lúc với Redux/nuqs bên dưới).
  await waitFor(() => expect(screen.getByText(/Total products: 2/)).toBeInTheDocument());

  const densityBox = () => container.querySelector('[data-density]');
  const viewBox = () => container.querySelector('[data-view]');

  // Mặc định: density=comfortable (Redux), view=list (nuqs) — 2 nguồn state độc lập.
  expect(densityBox()).toHaveAttribute('data-density', 'comfortable');
  expect(viewBox()).toHaveAttribute('data-view', 'list');

  // Đổi VIEW (nuqs, URL) → writer `ViewToggle` cập nhật, reader `ViewScope` đồng bộ (data-view=grid).
  // ⭐ density (Redux) KHÔNG đổi → nuqs không đụng vào Redux.
  await user.click(screen.getByRole('button', { name: 'Grid' }));
  await waitFor(() => expect(viewBox()).toHaveAttribute('data-view', 'grid'));
  expect(densityBox()).toHaveAttribute('data-density', 'comfortable');

  // Đổi DENSITY (Redux, localStorage) → data-density=compact.
  // ⭐ view (nuqs) VẪN =grid → Redux không đụng vào nuqs. Hai hệ state chung 1 cây, không giao thoa.
  await user.click(screen.getByRole('button', { name: 'Density: Comfortable' }));
  expect(densityBox()).toHaveAttribute('data-density', 'compact');
  expect(viewBox()).toHaveAttribute('data-view', 'grid');
});

test('i18n xuyên suốt cây ghép — locale vi áp cho MỌI island cùng lúc', async () => {
  server.use(http.get('/api/products/count', () => HttpResponse.json({ count: 5 })));

  renderWithProviders(<ProductShellHarness products={products} />, { locale: 'vi' });

  // Mỗi island lấy chuỗi từ CÙNG một NextIntlClientProvider (locale vi) → dịch nhất quán cả cụm:
  // density (Redux), view (nuqs), zoom-slot (render-prop) đều là bản dịch vi.
  expect(screen.getByRole('button', { name: 'Mật độ: Thoáng' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Danh sách' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưới' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Phóng to: Sản phẩm A' })).toBeInTheDocument();
  // Count badge (TanStack) cũng nhận nhãn vi. Assert theo NHÃN (không theo số) vì QueryClient là singleton
  // trình duyệt → số bị cache chéo test; `toBeEnabled` đợi query settle (tránh cảnh báo act).
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Làm mới số lượng' })).toBeEnabled(),
  );
});
