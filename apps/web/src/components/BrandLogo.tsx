export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  inverted?: boolean;
}

const ICON_SIZES = {
  sm: 28,
  md: 36,
  lg: 46,
};

export function BrandLogo({
  size = 'md',
  showTagline = false,
  inverted = false,
}: BrandLogoProps) {
  const iconSize = ICON_SIZES[size];
  return (
    <span className={`mymeet-brand mymeet-brand-${size} ${inverted ? 'mymeet-brand-inverted' : ''}`}>
      <img
        src="/mymeet-mark.png?v=2"
        alt="MyMeet"
        width={iconSize}
        height={iconSize}
        className="mymeet-brand-icon"
      />
      <span className="mymeet-brand-copy">
        <span className="mymeet-wordmark">
          <span className="mymeet-wordmark-my">My</span>
          <span className="mymeet-wordmark-meet">Meet</span>
        </span>
        {showTagline && (
          <span className="mymeet-tagline">Connect. Collaborate. Together.</span>
        )}
      </span>
    </span>
  );
}
