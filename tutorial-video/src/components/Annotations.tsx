import { useCurrentFrame, interpolate, Easing } from "remotion";

// 矢印コンポーネント
interface ArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  delay?: number;
  label?: string;
}

export const Arrow: React.FC<ArrowProps> = ({
  from,
  to,
  color = "#f472b6",
  delay = 0,
  label,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const progress = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // 矢印の角度を計算
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));

  // 矢印の先端
  const arrowSize = 12;
  const currentLength = length * progress;
  const currentEndX = from.x + Math.cos(angle) * currentLength;
  const currentEndY = from.y + Math.sin(angle) * currentLength;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* 矢印の線 */}
      <line
        x1={from.x}
        y1={from.y}
        x2={currentEndX}
        y2={currentEndY}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* 矢印の先端 */}
      {progress > 0.5 && (
        <polygon
          points={`
            ${currentEndX},${currentEndY}
            ${currentEndX - arrowSize * Math.cos(angle - Math.PI / 6)},${currentEndY - arrowSize * Math.sin(angle - Math.PI / 6)}
            ${currentEndX - arrowSize * Math.cos(angle + Math.PI / 6)},${currentEndY - arrowSize * Math.sin(angle + Math.PI / 6)}
          `}
          fill={color}
        />
      )}

      {/* ラベル */}
      {label && progress > 0.8 && (
        <text
          x={from.x}
          y={from.y - 10}
          fill={color}
          fontSize={18}
          fontFamily="'Noto Sans JP', sans-serif"
          fontWeight={600}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </svg>
  );
};

// ハイライトボックス
interface HighlightBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  delay?: number;
  label?: string;
  pulse?: boolean;
}

export const HighlightBox: React.FC<HighlightBoxProps> = ({
  x,
  y,
  width,
  height,
  color = "#f472b6",
  delay = 0,
  label,
  pulse = true,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [delay, delay + 20], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // パルスアニメーション
  const pulseOpacity = pulse
    ? interpolate(
        (frame - delay) % 60,
        [0, 30, 60],
        [0.8, 0.4, 0.8],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0.6;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        border: `3px solid ${color}`,
        borderRadius: 8,
        backgroundColor: `${color}20`,
        opacity: opacity * pulseOpacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        pointerEvents: "none",
      }}
    >
      {label && (
        <div
          style={{
            position: "absolute",
            top: -32,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: color,
            color: "#ffffff",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// 円形ハイライト（クリック位置を示す）
interface CircleHighlightProps {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  delay?: number;
  label?: string;
}

export const CircleHighlight: React.FC<CircleHighlightProps> = ({
  x,
  y,
  radius = 30,
  color = "#f472b6",
  delay = 0,
  label,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringScale = interpolate(
    (frame - delay) % 45,
    [0, 45],
    [1, 1.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const ringOpacity = interpolate(
    (frame - delay) % 45,
    [0, 45],
    [0.8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* 外側のリング（アニメーション） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: `2px solid ${color}`,
          borderRadius: "50%",
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />

      {/* 内側の円 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: `3px solid ${color}`,
          borderRadius: "50%",
          backgroundColor: `${color}30`,
        }}
      />

      {/* ラベル */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: radius * 2 + 8,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: color,
            color: "#ffffff",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// 吹き出しコメント
interface CalloutProps {
  x: number;
  y: number;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
  color?: string;
  delay?: number;
}

export const Callout: React.FC<CalloutProps> = ({
  x,
  y,
  text,
  position = "top",
  color = "#18181b",
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [delay, delay + 20], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 12 },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 12 },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: 12 },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 12 },
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          ...positionStyles[position],
          backgroundColor: color,
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 12,
          fontSize: 18,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 500,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
