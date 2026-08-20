interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className="brand-mark" aria-label="MeterMesh">
      <span className="mesh-symbol" aria-hidden="true">
        <span className="mesh-line mesh-line-horizontal mesh-line-top" />
        <span className="mesh-line mesh-line-horizontal mesh-line-bottom" />
        <span className="mesh-line mesh-line-vertical mesh-line-left" />
        <span className="mesh-line mesh-line-vertical mesh-line-right" />
        <span className="mesh-node mesh-node-top-left" />
        <span className="mesh-node mesh-node-top-right" />
        <span className="mesh-node mesh-node-bottom-left" />
        <span className="mesh-node mesh-node-bottom-right" />
      </span>
      {!compact && <span className="brand-wordmark">MeterMesh</span>}
    </span>
  );
}
