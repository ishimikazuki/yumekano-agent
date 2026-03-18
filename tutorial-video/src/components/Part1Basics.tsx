import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { Caption } from "./Caption";
import { PartHeader } from "./PartHeader";

const FPS = 30;
const SECONDS = (s: number) => s * FPS;

export const Part1Basics: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f0f" }}>
      {/* パートヘッダー */}
      <Sequence from={0} durationInFrames={SECONDS(3)}>
        <PartHeader
          partNumber={1}
          title="基本を知る"
          subtitle="このツールは何か？何ができるか？"
        />
      </Sequence>

      {/* 全体の流れ説明 */}
      <Sequence from={SECONDS(3)} durationInFrames={SECONDS(30)}>
        <WorkflowExplanation />
      </Sequence>

      {/* 画面の見方 */}
      <Sequence from={SECONDS(33)} durationInFrames={SECONDS(60)}>
        <ScreenLayout />
      </Sequence>

      {/* ナビゲーション説明 */}
      <Sequence from={SECONDS(93)} durationInFrames={SECONDS(27)}>
        <NavigationGuide />
      </Sequence>
    </AbsoluteFill>
  );
};

// ワークフロー説明コンポーネント
const WorkflowExplanation: React.FC = () => {
  const frame = useCurrentFrame();
  const FPS = 30;

  const steps = [
    { label: "キャラ一覧", delay: 0 },
    { label: "詳細を見る", delay: 15 },
    { label: "編集画面へ", delay: 30 },
    { label: "各タブで設定", delay: 45 },
    { label: "サンドボックスでテスト", delay: 60 },
    { label: "保存 → 公開", delay: 75 },
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
          fontSize: 36,
          color: "#ffffff",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        全体の流れ
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {steps.map((step, i) => {
          const opacity = interpolate(
            frame,
            [step.delay, step.delay + 15],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const scale = interpolate(
            frame,
            [step.delay, step.delay + 15],
            [0.8, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  padding: "16px 24px",
                  backgroundColor: "#27272a",
                  borderRadius: 12,
                  color: "#ffffff",
                  fontSize: 20,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                {step.label}
              </div>
              {i < steps.length - 1 && (
                <span
                  style={{
                    color: "#f472b6",
                    fontSize: 24,
                    marginLeft: 24,
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
    </AbsoluteFill>
  );
};

// 画面レイアウト説明
const ScreenLayout: React.FC = () => {
  const frame = useCurrentFrame();

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
          fontSize: 36,
          color: "#ffffff",
          marginBottom: 32,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        エディタ画面の構造
      </h2>

      {/* 画面構造の図解 */}
      <div
        style={{
          display: "flex",
          width: "80%",
          height: 400,
          border: "2px solid #3f3f46",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* 左パネル */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "2px solid #3f3f46",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "#f472b6",
              fontFamily: "'Noto Sans JP', sans-serif",
              marginBottom: 16,
            }}
          >
            左パネル
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#a1a1aa",
              textAlign: "center",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            テスト会話
            <br />
            （サンドボックス）
          </div>
        </div>

        {/* 右パネル */}
        <div
          style={{
            flex: 1.5,
            backgroundColor: "#1f1f23",
            padding: 24,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "#f472b6",
              fontFamily: "'Noto Sans JP', sans-serif",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            右パネル
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 16,
              justifyContent: "center",
            }}
          >
            {["Identity", "Persona", "Style", "Autonomy", "Prompts"].map(
              (tab) => (
                <div
                  key={tab}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#27272a",
                    borderRadius: 6,
                    color: "#e4e4e7",
                    fontSize: 14,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {tab}
                </div>
              )
            )}
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#27272a",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#71717a",
              fontSize: 16,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            各タブの編集エリア
          </div>
        </div>
      </div>

      <Caption text="左でテスト、右で編集。変更したらすぐテストできる！" />
    </AbsoluteFill>
  );
};

// ナビゲーション説明
const NavigationGuide: React.FC = () => {
  const frame = useCurrentFrame();

  const navItems = [
    { name: "Characters", desc: "キャラクター一覧", color: "#f472b6" },
    { name: "Playground", desc: "テスト会話", color: "#60a5fa" },
    { name: "Evals", desc: "評価テスト", color: "#4ade80" },
    { name: "Releases", desc: "公開管理", color: "#fbbf24" },
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
          fontSize: 36,
          color: "#ffffff",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        メインナビゲーション
      </h2>

      <div style={{ display: "flex", gap: 32 }}>
        {navItems.map((item, i) => {
          const delay = i * 20;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={item.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity,
              }}
            >
              <div
                style={{
                  padding: "16px 32px",
                  backgroundColor: "#27272a",
                  borderRadius: 12,
                  borderLeft: `4px solid ${item.color}`,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {item.name}
                </span>
              </div>
              <span
                style={{
                  color: "#a1a1aa",
                  fontSize: 16,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {item.desc}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
