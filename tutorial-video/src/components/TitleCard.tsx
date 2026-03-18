import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  // フェードイン
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // タイトルのスライドイン
  const titleY = interpolate(frame, [0, 45], [50, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  // サブタイトルの遅延フェードイン
  const subtitleOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0f0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Noto Sans JP', sans-serif",
        opacity,
      }}
    >
      {/* メインタイトル */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
        }}
      >
        Yumekano
      </h1>
      <h2
        style={{
          fontSize: 48,
          fontWeight: 500,
          color: "#f472b6",
          margin: "16px 0 0 0",
          transform: `translateY(${titleY}px)`,
        }}
      >
        キャラクター編集ガイド
      </h2>

      {/* サブタイトル */}
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginTop: 48,
          opacity: subtitleOpacity,
        }}
      >
        このガイドを見れば、キャラクターを自分で調整できるようになります
      </p>

      {/* 機能リスト */}
      <div
        style={{
          display: "flex",
          gap: 32,
          marginTop: 48,
          opacity: subtitleOpacity,
        }}
      >
        {["性格を作る", "話し方を調整", "テスト会話", "本番公開"].map(
          (item, i) => (
            <div
              key={i}
              style={{
                padding: "12px 24px",
                backgroundColor: "#27272a",
                borderRadius: 8,
                color: "#e4e4e7",
                fontSize: 18,
              }}
            >
              {item}
            </div>
          )
        )}
      </div>
    </AbsoluteFill>
  );
};
