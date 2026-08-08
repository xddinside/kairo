type SparkProps = {
  className?: string;
  strokeWidth?: number;
};

export function Spark({ className, strokeWidth = 6 }: SparkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      className={className}
    >
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <path key={deg} d="M0-24V-7" transform={`rotate(${deg}) translate(32 32)`} />
      ))}
    </svg>
  );
}

export function SparkDoodle({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style}>
      <path
        d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
