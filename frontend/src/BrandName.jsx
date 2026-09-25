/** Marca SICOM (logo completo o emblema + wordmark). */
export const SICOM_FULL_NAME =
  'Sistema de Comunicaciones para Operaciones Militares';

export default function BrandName({
  className = '',
  withLogo = false,
  size = 'md',
  showFullName = false,
  wordmark = true,
}) {
  const logoPx = size === 'lg' ? 280 : size === 'sm' ? 32 : 160;
  return (
    <span className={`brand-name brand-name--${size} ${className}`.trim()}>
      {withLogo ? (
        <img
          className="brand-logo"
          src="/brand/sicom.png?v=5"
          alt="SICOM"
          width={logoPx}
          height={Math.round(logoPx * 0.33)}
          style={{ width: logoPx, height: 'auto', objectFit: 'contain', background: 'transparent' }}
        />
      ) : null}
      {wordmark && !withLogo ? (
        <span className="brand-wordmark" aria-label="SICOM">
          <span className="brand-sicom">SICOM</span>
        </span>
      ) : null}
      {showFullName ? (
        <span className="brand-fullname">{SICOM_FULL_NAME}</span>
      ) : null}
    </span>
  );
}
