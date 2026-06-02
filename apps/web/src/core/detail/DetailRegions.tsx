/**
 * Zwei-Regionen-Layout fürs Detail (Master-Layout-Standard §5.2): links =
 * primär/handlungsrelevant (3/5), rechts = Kontext/Status/Verknüpfungen (2/5).
 * Auf kleinen Screens stapelt es einspaltig (Mobile-Regel). Ohne rechte Region
 * nimmt links die volle Breite.
 */
export interface DetailRegionsProps {
  left: React.ReactNode;
  right?: React.ReactNode;
}

export function DetailRegions({ left, right }: DetailRegionsProps) {
  const hasRight = Boolean(right);
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
      <div className={hasRight ? 'flex flex-col gap-3 lg:w-3/5' : 'flex flex-col gap-3 lg:w-full'}>
        {left}
      </div>
      {hasRight && (
        <div className="flex flex-col gap-3 lg:w-2/5 lg:border-l lg:border-zinc-800 lg:pl-4">
          {right}
        </div>
      )}
    </div>
  );
}
