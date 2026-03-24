import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// 画像サイズの定義
const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  "04-edit-identity.png": { width: 756, height: 826 },
  "05-edit-persona.png": { width: 756, height: 826 },
  "06-edit-style.png": { width: 756, height: 826 },
  "07-edit-autonomy.png": { width: 756, height: 826 },
  "09-style-changed.png": { width: 756, height: 826 },
  "10-sandbox-input.png": { width: 1512, height: 861 },
  "11-sandbox-chat.png": { width: 1512, height: 861 },
  "12-releases-page.png": { width: 1512, height: 861 },
};

// 動画サイズ
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

// 画像の表示サイズを計算
function getDisplaySize(imageName: string) {
  const size = IMAGE_SIZES[imageName] || { width: 1280, height: 720 };
  const scaleX = (VIDEO_WIDTH - 80) / size.width;
  const scaleY = (VIDEO_HEIGHT - 100) / size.height;
  const scale = Math.min(scaleX, scaleY);
  return {
    width: size.width * scale,
    height: size.height * scale,
    scale,
    originalWidth: size.width,
    originalHeight: size.height,
  };
}

// ハイライトボックス（相対位置版）
interface RelativeHighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  delay?: number;
  label?: string;
  labelPosition?: "top" | "bottom" | "left" | "right";
  imageSize: { width: number; height: number; scale: number };
  imageOffset: { x: number; y: number };
}

const RelativeHighlight: React.FC<RelativeHighlightProps> = ({
  x,
  y,
  width,
  height,
  color = "#f472b6",
  delay = 0,
  label,
  labelPosition = "top",
  imageSize,
  imageOffset,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const displayX = imageOffset.x + x * imageSize.scale;
  const displayY = imageOffset.y + y * imageSize.scale;
  const displayWidth = width * imageSize.scale;
  const displayHeight = height * imageSize.scale;

  const pulseScale = interpolate(
    (frame - delay) % 60,
    [0, 30, 60],
    [1, 1.02, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const labelStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8 },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8 },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: 8 },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 8 },
  };

  return (
    <div
      style={{
        position: "absolute",
        left: displayX,
        top: displayY,
        width: displayWidth,
        height: displayHeight,
        border: `3px solid ${color}`,
        borderRadius: 8,
        backgroundColor: `${color}20`,
        opacity,
        transform: `scale(${pulseScale})`,
        transformOrigin: "center",
        pointerEvents: "none",
      }}
    >
      {label && (
        <div
          style={{
            position: "absolute",
            ...labelStyles[labelPosition],
            backgroundColor: color,
            color: "#ffffff",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Noto Sans JP', sans-serif",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// 吹き出し（相対位置版）
interface RelativeCalloutProps {
  x: number;
  y: number;
  text: string;
  delay?: number;
  imageSize: { width: number; height: number; scale: number };
  imageOffset: { x: number; y: number };
}

const RelativeCallout: React.FC<RelativeCalloutProps> = ({
  x,
  y,
  text,
  delay = 0,
  imageSize,
  imageOffset,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const displayX = imageOffset.x + x * imageSize.scale;
  const displayY = imageOffset.y + y * imageSize.scale;

  return (
    <div
      style={{
        position: "absolute",
        left: displayX,
        top: displayY,
        transform: "translate(-50%, -50%)",
        backgroundColor: "#18181b",
        color: "#ffffff",
        padding: "10px 18px",
        borderRadius: 10,
        fontSize: 16,
        fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: 500,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        border: "2px solid #f472b6",
        opacity,
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};

// スクショシーンのベースコンポーネント
interface ScreenshotSceneProps {
  image: string;
  title?: string;
  children?: (props: {
    imageSize: { width: number; height: number; scale: number; originalWidth: number; originalHeight: number };
    imageOffset: { x: number; y: number };
  }) => React.ReactNode;
}

export const ScreenshotScene: React.FC<ScreenshotSceneProps> = ({
  image,
  title,
  children,
}) => {
  const frame = useCurrentFrame();

  const imageOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = interpolate(frame, [0, 20], [1.02, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const displaySize = getDisplaySize(image);
  const imageOffset = {
    x: (VIDEO_WIDTH - displaySize.width) / 2,
    y: title ? 70 + (VIDEO_HEIGHT - 70 - 30 - displaySize.height) / 2 : (VIDEO_HEIGHT - displaySize.height) / 2,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {title && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              color: "#ffffff",
              fontFamily: "'Noto Sans JP', sans-serif",
              fontWeight: 600,
              backgroundColor: "rgba(244, 114, 182, 0.9)",
              padding: "6px 20px",
              borderRadius: 8,
            }}
          >
            {title}
          </h2>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: imageOffset.x,
          top: imageOffset.y,
          width: displaySize.width,
          height: displaySize.height,
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
          transformOrigin: "center",
        }}
      >
        <Img
          src={staticFile(image)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {children && children({ imageSize: displaySize, imageOffset })}
    </AbsoluteFill>
  );
};

// =====================================
// 各画面用のシーン（正確な座標）
// =====================================

// Identity編集画面（756x826）
export const IdentityScene: React.FC = () => {
  return (
    <ScreenshotScene image="04-edit-identity.png" title="Identity - 基本情報">
      {({ imageSize, imageOffset }) => (
        <>
          {/* 表示名フィールド */}
          <RelativeHighlight
            x={365}
            y={250}
            width={148}
            height={40}
            color="#f472b6"
            delay={20}
            label="表示名"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 一人称フィールド */}
          <RelativeHighlight
            x={365}
            y={320}
            width={148}
            height={40}
            color="#60a5fa"
            delay={50}
            label="一人称"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 二人称フィールド */}
          <RelativeHighlight
            x={543}
            y={320}
            width={163}
            height={40}
            color="#4ade80"
            delay={80}
            label="二人称"
            labelPosition="right"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 職業フィールド */}
          <RelativeHighlight
            x={365}
            y={393}
            width={340}
            height={40}
            color="#fbbf24"
            delay={110}
            label="職業・役割"
            labelPosition="bottom"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// Persona編集画面（756x826）
export const PersonaScene: React.FC = () => {
  return (
    <ScreenshotScene image="05-edit-persona.png" title="Persona - キャラの内面">
      {({ imageSize, imageOffset }) => (
        <>
          {/* サマリー */}
          <RelativeHighlight
            x={375}
            y={285}
            width={325}
            height={75}
            color="#f472b6"
            delay={20}
            label="サマリー"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 価値観 */}
          <RelativeHighlight
            x={375}
            y={380}
            width={325}
            height={65}
            color="#60a5fa"
            delay={50}
            label="価値観"
            labelPosition="right"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 好きなもの */}
          <RelativeHighlight
            x={375}
            y={740}
            width={325}
            height={80}
            color="#4ade80"
            delay={80}
            label="好きなもの"
            labelPosition="bottom"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// Style編集画面（756x826）
export const StyleScene: React.FC = () => {
  return (
    <ScreenshotScene image="06-edit-style.png" title="Style - 話し方のトーン">
      {({ imageSize, imageOffset }) => (
        <>
          {/* 簡潔さ */}
          <RelativeHighlight
            x={365}
            y={305}
            width={345}
            height={45}
            color="#f472b6"
            delay={20}
            label="簡潔さ"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 遊び心 */}
          <RelativeHighlight
            x={365}
            y={420}
            width={345}
            height={45}
            color="#60a5fa"
            delay={50}
            label="遊び心"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* からかい */}
          <RelativeHighlight
            x={365}
            y={475}
            width={345}
            height={45}
            color="#4ade80"
            delay={80}
            label="からかい"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* シグネチャフレーズ */}
          <RelativeHighlight
            x={365}
            y={650}
            width={345}
            height={80}
            color="#fbbf24"
            delay={110}
            label="シグネチャフレーズ（口癖）"
            labelPosition="right"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// Style変更後（756x826）
export const StyleChangedScene: React.FC = () => {
  return (
    <ScreenshotScene image="09-style-changed.png" title="スライダーを変更すると...">
      {({ imageSize, imageOffset }) => (
        <>
          <RelativeHighlight
            x={365}
            y={310}
            width={345}
            height={220}
            color="#4ade80"
            delay={20}
            label="スライダーを調整"
            labelPosition="right"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          <RelativeCallout
            x={540}
            y={600}
            text="話し方のトーンが変わる！"
            delay={60}
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// Autonomy編集画面（756x826）
export const AutonomyScene: React.FC = () => {
  return (
    <ScreenshotScene image="07-edit-autonomy.png" title="Autonomy - 自律性">
      {({ imageSize, imageOffset }) => (
        <>
          {/* 断りやすさ */}
          <RelativeHighlight
            x={365}
            y={305}
            width={345}
            height={50}
            color="#f472b6"
            delay={20}
            label="断りやすさ"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 仲直りしやすさ */}
          <RelativeHighlight
            x={365}
            y={415}
            width={345}
            height={50}
            color="#60a5fa"
            delay={50}
            label="仲直りしやすさ"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          <RelativeCallout
            x={540}
            y={550}
            text="高くすると言いなりにならない"
            delay={90}
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// サンドボックス入力画面（1512x861）
export const SandboxInputScene: React.FC = () => {
  return (
    <ScreenshotScene image="10-sandbox-input.png" title="サンドボックス - テスト会話">
      {({ imageSize, imageOffset }) => (
        <>
          {/* 左側：会話エリア */}
          <RelativeHighlight
            x={145}
            y={125}
            width={520}
            height={655}
            color="#60a5fa"
            delay={20}
            label="左：テスト会話"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* 右側：編集エリア */}
          <RelativeHighlight
            x={680}
            y={125}
            width={620}
            height={680}
            color="#f472b6"
            delay={50}
            label="右：設定を編集"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* メッセージ入力 */}
          <RelativeHighlight
            x={145}
            y={800}
            width={420}
            height={45}
            color="#4ade80"
            delay={80}
            label="メッセージ入力"
            labelPosition="left"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// サンドボックス会話画面（1512x861）
export const SandboxChatScene: React.FC = () => {
  return (
    <ScreenshotScene image="11-sandbox-chat.png" title="テスト会話の結果">
      {({ imageSize, imageOffset }) => (
        <>
          {/* キャラの応答 */}
          <RelativeHighlight
            x={165}
            y={185}
            width={430}
            height={105}
            color="#4ade80"
            delay={20}
            label="キャラの応答"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* PAD値 */}
          <RelativeHighlight
            x={168}
            y={262}
            width={210}
            height={22}
            color="#fbbf24"
            delay={50}
            label="感情状態（PAD値）"
            labelPosition="bottom"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          <RelativeCallout
            x={400}
            y={380}
            text="設定を変えて応答の変化を確認！"
            delay={90}
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};

// リリースページ（1512x861）
export const ReleasesScene: React.FC = () => {
  return (
    <ScreenshotScene image="12-releases-page.png" title="リリース管理">
      {({ imageSize, imageOffset }) => (
        <>
          {/* リリース履歴セクション */}
          <RelativeHighlight
            x={140}
            y={250}
            width={1180}
            height={135}
            color="#60a5fa"
            delay={20}
            label="リリース履歴"
            labelPosition="top"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          {/* リリース管理について */}
          <RelativeHighlight
            x={140}
            y={400}
            width={1180}
            height={135}
            color="#4ade80"
            delay={50}
            label="リリース管理について"
            labelPosition="bottom"
            imageSize={imageSize}
            imageOffset={imageOffset}
          />

          <RelativeCallout
            x={756}
            y={600}
            text="過去バージョンに戻すこともできる"
            delay={90}
            imageSize={imageSize}
            imageOffset={imageOffset}
          />
        </>
      )}
    </ScreenshotScene>
  );
};
