/**
 * Placeholder shapes shown while a screen's data is still in flight. Sizes are
 * given in pixels so a skeleton occupies roughly the space its real content
 * will, which keeps the page from jumping when the data lands.
 */
export function SkeletonLine({ width = '100%', height = 12 }) {
  return <div className="lx-skeleton" style={{ width, height }} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="lx-skeleton-card">
      <SkeletonLine width="42%" height={11} />
      <SkeletonLine width="70%" height={24} />
      {Array.from({ length: Math.max(0, lines - 2) }, (_, index) => (
        <SkeletonLine key={index} width={index % 2 ? '85%' : '60%'} height={11} />
      ))}
    </div>
  );
}

/**
 * A full screen of placeholders. `label` is announced to assistive technology,
 * which sees a live region rather than the shapes themselves.
 */
export default function SkeletonScreen({ cards = 4, label = 'Loading' }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="lx-visually-hidden">{label}</span>
      <div className="lx-skeleton-grid" aria-hidden="true">
        {Array.from({ length: cards }, (_, index) => <SkeletonCard key={index} />)}
      </div>
    </div>
  );
}
