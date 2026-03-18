import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

interface PartHeaderProps {
  partNumber: number;
  title: string;
  subtitle: string;
}

export const PartHeader: React.FC<PartHeaderProps> = ({
  partNumber,
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();

  // アニメーション
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, 30], [0.9, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f0f0f",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* パート番号 */}
      <div
        style={{
          fontSize: 20,
          color: "#f472b6",
          fontFamily: "'Noto Sans JP', sans-serif",
          marginBottom: 16,
          letterSpacing: 4,
        }}
      >
        PART {partNumber}
      </div>

      {/* タイトル */}
      <h1
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        {title}
      </h1>

      {/* サブタイトル */}
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginTop: 24,
          opacity: subtitleOpacity,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};
