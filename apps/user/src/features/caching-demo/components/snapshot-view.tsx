interface SnapshotViewProps {
  title: string;
  hint: string;
  generatedAtLabel: string;
  generatedAt: string;
  /** `id` cho thẻ <time> → curl/E2E chọn được đúng mốc (cached vs live). */
  timeId: string;
}

/**
 * View THUẦN (sync, không hook) hiển thị 1 "mốc thời gian" + nhãn. Tách riêng để:
 *  - **unit-test được bằng RTL** (component async/`use cache`/`connection()` thì không test
 *    được trực tiếp → mẫu giống `HomeView` folder 09);
 *  - **dùng chung** cho cả panel CACHED lẫn panel LIVE (chỉ khác data + `timeId` truyền vào).
 *
 * i18n đã giải ở orchestrator rồi truyền string xuống → view không phụ thuộc request-scope.
 */
export function SnapshotView({
  title,
  hint,
  generatedAtLabel,
  generatedAt,
  timeId,
}: SnapshotViewProps) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{hint}</p>
      <p>
        {generatedAtLabel}{' '}
        <time id={timeId} dateTime={generatedAt}>
          {generatedAt}
        </time>
      </p>
    </section>
  );
}
