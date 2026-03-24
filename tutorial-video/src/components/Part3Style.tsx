import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { Caption } from "./Caption";
import { PartHeader } from "./PartHeader";

const FPS = 30;
const SECONDS = (s: number) => s * FPS;

export const Part3Style: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f0f" }}>
      {/* パートヘッダー */}
      <Sequence from={0} durationInFrames={SECONDS(3)}>
        <PartHeader
          partNumber={3}
          title="話し方を調整する"
          subtitle="スタイル＋自律性＋感情の調整"
        />
      </Sequence>

      {/* スタイルスライダー説明 */}
      <Sequence from={SECONDS(3)} durationInFrames={SECONDS(60)}>
        <StyleSlidersExplanation />
      </Sequence>

      {/* ★ Before/After デモ（メイン） */}
      <Sequence from={SECONDS(63)} durationInFrames={SECONDS(90)}>
        <BeforeAfterDemo />
      </Sequence>

      {/* シグネチャフレーズ説明 */}
      <Sequence from={SECONDS(153)} durationInFrames={SECONDS(30)}>
        <SignaturePhrasesExplanation />
      </Sequence>

      {/* 自律性説明 */}
      <Sequence from={SECONDS(183)} durationInFrames={SECONDS(30)}>
        <AutonomyExplanation />
      </Sequence>

      {/* 感情ベースライン説明 */}
      <Sequence from={SECONDS(213)} durationInFrames={SECONDS(27)}>
        <EmotionExplanation />
      </Sequence>
    </AbsoluteFill>
  );
};

// スタイルスライダー説明
const StyleSlidersExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const sliders = [
    {
      name: "簡潔さ",
      left: "丁寧に説明",
      right: "短く端的に",
      value: 40,
      color: "#f472b6",
    },
    {
      name: "遊び心",
      left: "真面目に",
      right: "冗談を交えて",
      value: 30,
      color: "#60a5fa",
    },
    {
      name: "からかい",
      left: "からかわない",
      right: "よくからかう",
      value: 10,
      color: "#4ade80",
    },
    {
      name: "感情表現",
      left: "控えめ",
      right: "豊か",
      value: 60,
      color: "#fbbf24",
    },
    {
      name: "フォーマル度",
      left: "カジュアル",
      right: "フォーマル",
      value: 25,
      color: "#a78bfa",
    },
    {
      name: "絵文字使用",
      left: "使わない",
      right: "よく使う",
      value: 50,
      color: "#f87171",
    },
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
          color: "#f472b6",
          marginBottom: 16,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        Style（スタイル）
      </h2>
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        = 話し方のトーン（6つのスライダーで調整）
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          width: "90%",
        }}
      >
        {sliders.map((slider, i) => {
          const delay = i * 10;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={slider.name}
              style={{
                backgroundColor: "#18181b",
                padding: 20,
                borderRadius: 12,
                opacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    color: slider.color,
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {slider.name}
                </span>
                <span
                  style={{
                    color: "#a1a1aa",
                    fontSize: 16,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {slider.value}%
                </span>
              </div>

              {/* スライダー */}
              <div
                style={{
                  height: 8,
                  backgroundColor: "#27272a",
                  borderRadius: 4,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${slider.value}%`,
                    backgroundColor: slider.color,
                    borderRadius: 4,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${slider.value}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 16,
                    height: 16,
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                />
              </div>

              {/* ラベル */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    color: "#71717a",
                    fontSize: 12,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {slider.left}
                </span>
                <span
                  style={{
                    color: "#71717a",
                    fontSize: 12,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {slider.right}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ★ Before/After デモ（最重要パート）
const BeforeAfterDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // フェーズ
  const BEFORE_END = 60 * 30; // 60秒
  const TRANSITION_END = 70 * 30; // 70秒
  const AFTER_END = 90 * 30; // 90秒

  const showBefore = frame < BEFORE_END;
  const showTransition = frame >= BEFORE_END && frame < TRANSITION_END;
  const showAfter = frame >= TRANSITION_END;

  // スライダー値のアニメーション
  const playfulness = showAfter ? 80 : 30;
  const teasing = showAfter ? 60 : 10;
  const conciseness = showAfter ? 90 : 40;

  // トランジション中のスライダーアニメーション
  const animatedPlayfulness = showTransition
    ? interpolate(frame - BEFORE_END, [0, TRANSITION_END - BEFORE_END], [30, 80], {
        extrapolateRight: "clamp",
      })
    : playfulness;

  const animatedTeasing = showTransition
    ? interpolate(frame - BEFORE_END, [0, TRANSITION_END - BEFORE_END], [10, 60], {
        extrapolateRight: "clamp",
      })
    : teasing;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
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
        {showAfter ? "AFTER" : showTransition ? "変更中..." : "BEFORE"}
      </h2>

      <div style={{ display: "flex", gap: 48, width: "95%" }}>
        {/* 左：スライダー設定 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            padding: 24,
            borderRadius: 16,
          }}
        >
          <h3
            style={{
              fontSize: 24,
              color: "#f472b6",
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            スタイル設定
          </h3>

          {/* 遊び心 */}
          <SliderDisplay
            name="遊び心"
            value={showTransition ? animatedPlayfulness : playfulness}
            color="#60a5fa"
          />

          {/* からかい */}
          <SliderDisplay
            name="からかい"
            value={showTransition ? animatedTeasing : teasing}
            color="#4ade80"
            style={{ marginTop: 24 }}
          />

          {/* 簡潔さ */}
          <SliderDisplay
            name="簡潔さ"
            value={conciseness}
            color="#fbbf24"
            style={{ marginTop: 24 }}
          />
        </div>

        {/* 右：会話結果 */}
        <div
          style={{
            flex: 1.5,
            backgroundColor: "#18181b",
            padding: 24,
            borderRadius: 16,
          }}
        >
          <h3
            style={{
              fontSize: 24,
              color: "#60a5fa",
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            テスト会話
          </h3>

          {/* ユーザーメッセージ */}
          <div
            style={{
              alignSelf: "flex-end",
              padding: "12px 16px",
              backgroundColor: "#3b82f6",
              borderRadius: "16px 16px 4px 16px",
              color: "#ffffff",
              fontSize: 18,
              marginBottom: 16,
              marginLeft: "auto",
              maxWidth: "70%",
              textAlign: "right",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            今日の調子どう？
          </div>

          {/* キャラ応答 */}
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: showAfter ? "#f472b6" : "#27272a",
              borderRadius: "16px 16px 16px 4px",
              color: "#ffffff",
              fontSize: 18,
              maxWidth: "85%",
              lineHeight: 1.6,
              fontFamily: "'Noto Sans JP', sans-serif",
              transition: "background-color 0.3s",
            }}
          >
            {showAfter
              ? "えへへ、絶好調ですっ！○○さんこそどうなの〜？♡"
              : "今日は調子いいですよ。練習頑張ってます。"}
          </div>
        </div>
      </div>

      <Caption
        text={
          showAfter
            ? "同じ質問でも、スライダーで応答のトーンが変わる！"
            : "スライダーを動かすと、話し方が変わる"
        }
      />
    </AbsoluteFill>
  );
};

// スライダー表示コンポーネント
const SliderDisplay: React.FC<{
  name: string;
  value: number;
  color: string;
  style?: React.CSSProperties;
}> = ({ name, value, color, style }) => {
  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: color,
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          {name}
        </span>
        <span
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          {Math.round(value)}%
        </span>
      </div>
      <div
        style={{
          height: 12,
          backgroundColor: "#27272a",
          borderRadius: 6,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${value}%`,
            backgroundColor: color,
            borderRadius: 6,
            transition: "width 0.3s",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${value}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 20,
            height: 20,
            backgroundColor: "#ffffff",
            borderRadius: "50%",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "left 0.3s",
          }}
        />
      </div>
    </div>
  );
};

// シグネチャフレーズ説明
const SignaturePhrasesExplanation: React.FC = () => {
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
      <div style={{ display: "flex", gap: 48, width: "90%" }}>
        {/* シグネチャフレーズ */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            padding: 32,
            borderRadius: 16,
          }}
        >
          <h3
            style={{
              fontSize: 28,
              color: "#4ade80",
              marginBottom: 16,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            シグネチャフレーズ
          </h3>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: 18,
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            = キャラがよく使う口癖
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["〜ですっ！", "えへへ♪", "がんばるね！"].map((phrase, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#27272a",
                  borderRadius: 6,
                  color: "#e4e4e7",
                  fontSize: 18,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                「{phrase}」
              </div>
            ))}
          </div>
        </div>

        {/* タブーフレーズ */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            padding: 32,
            borderRadius: 16,
          }}
        >
          <h3
            style={{
              fontSize: 28,
              color: "#f87171",
              marginBottom: 16,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            タブーフレーズ
          </h3>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: 18,
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            = 絶対に言わない言葉
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["ご主人様", "命令してください"].map((phrase, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b1a1a",
                  borderRadius: 6,
                  color: "#fca5a5",
                  fontSize: 18,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  textDecoration: "line-through",
                }}
              >
                「{phrase}」
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 自律性説明
const AutonomyExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const items = [
    {
      name: "反論しやすさ",
      desc: "反論する傾向",
      color: "#f472b6",
    },
    {
      name: "断りやすさ",
      desc: "要求を断る傾向",
      color: "#60a5fa",
    },
    {
      name: "仲直りしやすさ",
      desc: "関係修復しようとする傾向",
      color: "#4ade80",
    },
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
          color: "#f472b6",
          marginBottom: 16,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        Autonomy（自律性）
      </h2>
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        = ユーザーへの反応傾向
      </p>

      <div style={{ display: "flex", gap: 32 }}>
        {items.map((item, i) => {
          const delay = i * 20;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={item.name}
              style={{
                backgroundColor: "#18181b",
                padding: 24,
                borderRadius: 16,
                width: 200,
                opacity,
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  color: item.color,
                  marginBottom: 12,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {item.name}
              </h3>
              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: 16,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 48,
          padding: "16px 32px",
          backgroundColor: "#27272a",
          borderRadius: 12,
          borderLeft: "4px solid #fbbf24",
        }}
      >
        <p
          style={{
            color: "#fbbf24",
            fontSize: 20,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          高くすると「言いなりにならない」キャラになる
        </p>
      </div>
    </AbsoluteFill>
  );
};

// 感情ベースライン説明
const EmotionExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const padItems = [
    {
      letter: "P",
      name: "Pleasure",
      desc: "快楽度",
      low: "暗い",
      high: "明るい",
      color: "#f472b6",
    },
    {
      letter: "A",
      name: "Arousal",
      desc: "覚醒度",
      low: "落ち着き",
      high: "活発",
      color: "#60a5fa",
    },
    {
      letter: "D",
      name: "Dominance",
      desc: "支配度",
      low: "控えめ",
      high: "強気",
      color: "#4ade80",
    },
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
          color: "#f472b6",
          marginBottom: 16,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        Emotion Baseline（感情ベースライン）
      </h2>
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        = キャラの基本的な気分（PADモデル）
      </p>

      <div style={{ display: "flex", gap: 32 }}>
        {padItems.map((item, i) => {
          const delay = i * 15;
          const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={item.letter}
              style={{
                backgroundColor: "#18181b",
                padding: 24,
                borderRadius: 16,
                width: 220,
                opacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: item.color,
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {item.letter}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    color: "#a1a1aa",
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {item.name}
                </span>
              </div>
              <p
                style={{
                  fontSize: 20,
                  color: "#ffffff",
                  marginBottom: 12,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {item.desc}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  color: "#71717a",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                <span>-{item.low}</span>
                <span>+{item.high}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
