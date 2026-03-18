import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { Caption } from "./Caption";
import { PartHeader } from "./PartHeader";

const FPS = 30;
const SECONDS = (s: number) => s * FPS;

export const Part4Publish: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f0f" }}>
      {/* パートヘッダー */}
      <Sequence from={0} durationInFrames={SECONDS(3)}>
        <PartHeader
          partNumber={4}
          title="完成したら公開する"
          subtitle="テスト → 保存 → 公開の流れ"
        />
      </Sequence>

      {/* テスト→保存フロー */}
      <Sequence from={SECONDS(3)} durationInFrames={SECONDS(60)}>
        <SaveFlow />
      </Sequence>

      {/* 公開フロー */}
      <Sequence from={SECONDS(63)} durationInFrames={SECONDS(30)}>
        <PublishFlow />
      </Sequence>

      {/* ロールバック説明 */}
      <Sequence from={SECONDS(93)} durationInFrames={SECONDS(27)}>
        <RollbackExplanation />
      </Sequence>
    </AbsoluteFill>
  );
};

// テスト→保存フロー
const SaveFlow: React.FC = () => {
  const frame = useCurrentFrame();

  const steps = [
    { num: 1, text: "左パネルでテスト会話", icon: "💬" },
    { num: 2, text: "納得いくまで調整を繰り返す", icon: "🔄" },
    { num: 3, text: "「保存」ボタンをクリック", icon: "💾" },
  ];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <h2
        style={{
          fontSize: 40,
          color: "#ffffff",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        テスト & 保存の流れ
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {steps.map((step, i) => {
          const delay = i * 30;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [delay, delay + 20], [-50, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={step.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  backgroundColor: "#f472b6",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#ffffff",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {step.num}
              </div>
              <div
                style={{
                  backgroundColor: "#18181b",
                  padding: "16px 32px",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 32 }}>{step.icon}</span>
                <span
                  style={{
                    fontSize: 24,
                    color: "#ffffff",
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {step.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 48,
          padding: "16px 32px",
          backgroundColor: "#3b1a1a",
          borderRadius: 12,
          borderLeft: "4px solid #f87171",
        }}
      >
        <p
          style={{
            color: "#fca5a5",
            fontSize: 18,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          ⚠️ 未保存の変更は失われます
        </p>
      </div>
    </AbsoluteFill>
  );
};

// 公開フロー
const PublishFlow: React.FC = () => {
  const frame = useCurrentFrame();

  const steps = [
    { text: "保存済み", highlight: false },
    { text: "キャラ詳細に戻る", highlight: false },
    { text: "「公開」ボタン", highlight: true },
    { text: "本番環境に即時反映！", highlight: true },
  ];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <h2
        style={{
          fontSize: 40,
          color: "#ffffff",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        公開の流れ
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {steps.map((step, i) => {
          const delay = i * 20;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  padding: "16px 24px",
                  backgroundColor: step.highlight ? "#4ade80" : "#27272a",
                  borderRadius: 12,
                  color: step.highlight ? "#052e16" : "#ffffff",
                  fontSize: 20,
                  fontWeight: step.highlight ? 600 : 400,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity,
                }}
              >
                {step.text}
              </div>
              {i < steps.length - 1 && (
                <span
                  style={{
                    color: "#f472b6",
                    fontSize: 24,
                    margin: "0 8px",
                    opacity,
                  }}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      <Caption text="公開ボタンを押すと、すぐに本番に反映されるよ！" delay={60} />
    </AbsoluteFill>
  );
};

// ロールバック説明
const RollbackExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: "#18181b",
          padding: 48,
          borderRadius: 24,
          maxWidth: 800,
        }}
      >
        <h2
          style={{
            fontSize: 36,
            color: "#fbbf24",
            marginBottom: 24,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          ロールバック機能
        </h2>

        <p
          style={{
            fontSize: 24,
            color: "#ffffff",
            lineHeight: 1.8,
            marginBottom: 32,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          「リリース」ページで過去のバージョンに戻すこともできます
        </p>

        {/* バージョン履歴のイメージ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { version: "v3", date: "2024-03-18", current: true },
            { version: "v2", date: "2024-03-15", current: false },
            { version: "v1", date: "2024-03-10", current: false },
          ].map((v, i) => (
            <div
              key={v.version}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                backgroundColor: v.current ? "#27272a" : "#1f1f23",
                borderRadius: 8,
                border: v.current ? "2px solid #4ade80" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {v.version}
                </span>
                <span
                  style={{
                    color: "#71717a",
                    fontSize: 14,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {v.date}
                </span>
                {v.current && (
                  <span
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#4ade80",
                      borderRadius: 4,
                      color: "#052e16",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    現在公開中
                  </span>
                )}
              </div>
              {!v.current && (
                <button
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    color: "#e4e4e7",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  このバージョンに戻す
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
