export function BrandMark({ size = "client" }) {
  return (
    <span className={`brand-mark brand-mark--${size}`} aria-hidden="true">
      <img src="/assets/cloudbridge-logo.png" alt="" />
    </span>
  );
}
