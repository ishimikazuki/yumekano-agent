import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, 30], [0.95, 1], {
    easing: Easing.out(Easing.cubic),
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
      <h1
        style={{
          fontSize: 56,
          fontWeight: 700,
          color: "#ffffff",
          marginBottom: 24,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        お疲れさまでした！
      </h1>

      <p
        style={{
          fontSize: 28,
          color: "#a1a1aa",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        これでキャラクターの編集ができるようになりました
      </p>

      {/* まとめ */}
      <div style={{ display: "flex", gap: 24 }}>
        {[
          { num: 1, text: "Identity で基本情報" },
          { num: 2, text: "Persona で内面" },
          { num: 3, text: "Style で話し方" },
          { num: 4, text: "テスト → 公開" },
        ].map((item) => (
          <div
            key={item.num}
            style={{
              backgroundColor: "#18181b",
              padding: "16px 24px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#f472b6",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 600,
                color: "#ffffff",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              {item.num}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#e4e4e7",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Yumekanoロゴ */}
      <div
        style={{
          marginTop: 64,
          opacity: 0.6,
        }}
      >
        <span
          style={{
            fontSize: 24,
            color: "#f472b6",
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          Yumekano
        </span>
      </div>
    </AbsoluteFill>
  );
};
