import { ImageResponse } from 'next/og';

import { getTranslations } from 'next-intl/server';

import { siteConfig } from '~/lib/site-config';

// ⭐ Folder 21 — ảnh Open Graph ĐỘNG, ĐA NGÔN NGỮ. Đặt ở `[locale]/` → áp cho MỌI trang con + sinh
// MỘT ảnh / locale (en, vi) lúc BUILD (statically optimized: chỉ đọc `params` tĩnh + getTranslations
// locale tường minh, KHÔNG request-time → vào prerender). Next tự thêm thẻ `og:image` + `twitter:image`
// trỏ tới route này (KHÔNG cần khai `openGraph.images` tay). Chạy Node runtime (mặc định).

export const alt = `${siteConfig.name} — Next.js 16 server-first foundation`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
        color: '#f8fafc',
        padding: 80,
      }}
    >
      {/* Thương hiệu — dùng KHỐI MÀU làm logo (không phụ thuộc glyph ◆ → tránh tofu trong ImageResponse). */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: '#38bdf8',
            marginRight: 24,
          }}
        />
        <div style={{ fontSize: 40, fontWeight: 700 }}>{siteConfig.name}</div>
      </div>
      {/* Tagline ĐÃ DỊCH (vi có dấu) + dòng kỹ thuật. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.1 }}>{t('ogImageTagline')}</div>
        <div style={{ fontSize: 30, color: '#94a3b8', marginTop: 24 }}>
          Next.js 16 · App Router · RSC
        </div>
      </div>
    </div>,
    { ...size },
  );
}
