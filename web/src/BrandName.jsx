/** Marca TacticalPtx (texto partido + logo opcional). */
export default function BrandName({ className = '', withLogo = false, size = 'md' }) {
  return (
    <span className={`brand-name brand-name--${size} ${className}`.trim()}>
      {withLogo ? (
        <img
          className="brand-logo"
          src="/brand/tacticalptx.png"
          alt=""
          width={size === 'lg' ? 72 : size === 'sm' ? 28 : 40}
          height={size === 'lg' ? 72 : size === 'sm' ? 28 : 40}
        />
      ) : null}
      <span className="brand-wordmark" aria-label="TacticalPtx">
        <span className="brand-tactical">Tactical</span>
        <span className="brand-ptx">Ptx</span>
      </span>
    </span>
  );
}
