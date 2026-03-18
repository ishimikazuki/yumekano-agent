import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { Caption } from "./Caption";
import { PartHeader } from "./PartHeader";

const FPS = 30;
const SECONDS = (s: number) => s * FPS;

export const Part2Persona: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f0f" }}>
      {/* パートヘッダー */}
      <Sequence from={0} durationInFrames={SECONDS(3)}>
        <PartHeader
          partNumber={2}
          title="キャラの性格を作る"
          subtitle="アイデンティティ＋ペルソナの設定"
        />
      </Sequence>

      {/* アイデンティティ説明 */}
      <Sequence from={SECONDS(3)} durationInFrames={SECONDS(60)}>
        <IdentityExplanation />
      </Sequence>

      {/* ペルソナ説明 */}
      <Sequence from={SECONDS(63)} durationInFrames={SECONDS(90)}>
        <PersonaExplanation />
      </Sequence>

      {/* 実演：好きなもの追加 */}
      <Sequence from={SECONDS(153)} durationInFrames={SECONDS(87)}>
        <LikesDemo />
      </Sequence>
    </AbsoluteFill>
  );
};

// アイデンティティ説明
const IdentityExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const items = [
    { label: "表示名", desc: "会話で使われる名前", example: "「美咲」" },
    { label: "一人称", desc: "自分の呼び方", example: "「わたし」「僕」" },
    { label: "二人称", desc: "ユーザーの呼び方", example: "「○○さん」「○○くん」" },
    { label: "職業", desc: "キャラの立場", example: "「アイドル」「学生」" },
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 64,
          width: "90%",
        }}
      >
        {/* 左：説明 */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 40,
              color: "#f472b6",
              marginBottom: 32,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            Identity（アイデンティティ）
          </h2>
          <p
            style={{
              fontSize: 24,
              color: "#a1a1aa",
              marginBottom: 32,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            = キャラの基本情報
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((item, i) => {
              const delay = i * 20;
              const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    opacity,
                    padding: 16,
                    backgroundColor: "#18181b",
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      color: "#ffffff",
                      fontWeight: 600,
                      minWidth: 100,
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      color: "#a1a1aa",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {item.desc}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      color: "#f472b6",
                      marginLeft: "auto",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {item.example}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：スクリーンショット（プレースホルダー） */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#27272a",
            borderRadius: 16,
            height: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "#71717a",
              fontSize: 18,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            [Identity編集画面]
          </span>
        </div>
      </div>

      <Caption text="二人称を変えると、会話での呼び方が変わるよ！" delay={60} />
    </AbsoluteFill>
  );
};

// ペルソナ説明
const PersonaExplanation: React.FC = () => {
  const frame = useCurrentFrame();

  const basicItems = [
    { label: "サマリー", desc: "キャラの概要説明" },
    { label: "価値観", desc: "大切にしていること" },
    { label: "欠点", desc: "弱点や苦手なこと" },
    { label: "好き/嫌い", desc: "反応が変わるトピック" },
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
        Persona（ペルソナ）
      </h2>
      <p
        style={{
          fontSize: 24,
          color: "#a1a1aa",
          marginBottom: 48,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        = キャラの内面
      </p>

      <div style={{ display: "flex", gap: 48, width: "90%" }}>
        {/* 基本 */}
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
              color: "#60a5fa",
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            基本
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {basicItems.map((item, i) => {
              const delay = i * 15;
              const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity,
                  }}
                >
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: 500,
                      minWidth: 90,
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {item.label}
                  </span>
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
        </div>

        {/* シグネチャ行動 */}
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
              color: "#4ade80",
              marginBottom: 24,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            シグネチャ行動
          </h3>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: 18,
              lineHeight: 1.8,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            キャラらしい特徴的な振る舞い
            <br />
            <br />
            例：
            <br />
            ・嬉しいとき手を叩く
            <br />
            ・困ると頭をかく
            <br />
            ・照れると目をそらす
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 「好き」追加デモ
const LikesDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // アニメーションのフェーズ
  const phase1End = 90; // 「猫」を追加
  const phase2End = 180; // テスト会話

  const isPhase1 = frame < phase1End;
  const isPhase2 = frame >= phase1End;

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
          fontSize: 32,
          color: "#ffffff",
          marginBottom: 32,
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        実演：「好きなもの」を追加してみよう
      </h2>

      <div style={{ display: "flex", gap: 48, width: "90%" }}>
        {/* 設定変更 */}
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
              fontSize: 20,
              color: "#f472b6",
              marginBottom: 16,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            好きなものリスト
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                padding: "8px 16px",
                backgroundColor: "#27272a",
                borderRadius: 6,
                color: "#e4e4e7",
                fontSize: 16,
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              音楽
            </div>
            <div
              style={{
                padding: "8px 16px",
                backgroundColor: "#27272a",
                borderRadius: 6,
                color: "#e4e4e7",
                fontSize: 16,
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              ダンス
            </div>

            {/* 追加される「猫」 */}
            {isPhase1 && (
              <div
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#27272a",
                  borderRadius: 6,
                  border: "2px dashed #f472b6",
                  color: "#f472b6",
                  fontSize: 16,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity: interpolate(frame, [30, 60], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                + 猫
              </div>
            )}

            {isPhase2 && (
              <div
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f472b6",
                  borderRadius: 6,
                  color: "#ffffff",
                  fontSize: 16,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                猫
              </div>
            )}
          </div>
        </div>

        {/* テスト会話 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            padding: 24,
            borderRadius: 16,
            opacity: isPhase2 ? 1 : 0.3,
          }}
        >
          <h3
            style={{
              fontSize: 20,
              color: "#60a5fa",
              marginBottom: 16,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            テスト会話
          </h3>

          {isPhase2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* ユーザーメッセージ */}
              <div
                style={{
                  alignSelf: "flex-end",
                  padding: "12px 16px",
                  backgroundColor: "#3b82f6",
                  borderRadius: "16px 16px 4px 16px",
                  color: "#ffffff",
                  fontSize: 16,
                  maxWidth: "80%",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity: interpolate(frame - phase1End, [0, 30], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                猫好き？
              </div>

              {/* キャラ応答 */}
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 16px",
                  backgroundColor: "#27272a",
                  borderRadius: "16px 16px 16px 4px",
                  color: "#ffffff",
                  fontSize: 16,
                  maxWidth: "80%",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity: interpolate(frame - phase1End, [30, 60], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                うん！猫大好きだよ〜！もふもふしたい♡
              </div>
            </div>
          )}
        </div>
      </div>

      <Caption
        text={
          isPhase2
            ? "追加した「猫」に反応するようになった！"
            : "「好きなもの」に「猫」を追加"
        }
        delay={0}
      />
    </AbsoluteFill>
  );
};
