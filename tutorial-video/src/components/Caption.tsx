import { useCurrentFrame, interpolate } from "remotion";

interface CaptionProps {
  text: string;
  position?: "bottom" | "top" | "center";
  delay?: number;
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  position = "bottom",
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const y = interpolate(frame, [delay, delay + 15], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const positionStyles: Record<string, React.CSSProperties> = {
    bottom: { bottom: 48, left: 0, right: 0 },
    top: { top: 48, left: 0, right: 0 },
    center: { top: "50%", left: 0, right: 0, transform: "translateY(-50%)" },
  };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: "16px 32px",
          borderRadius: 12,
          maxWidth: "80%",
        }}
      >
        <p
          style={{
            color: "#ffffff",
            fontSize: 24,
            margin: 0,
            textAlign: "center",
            fontFamily: "'Noto Sans JP', sans-serif",
            lineHeight: 1.6,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
