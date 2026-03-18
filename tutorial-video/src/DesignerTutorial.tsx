import { AbsoluteFill, Sequence } from "remotion";
import { TitleCard } from "./components/TitleCard";
import { Outro } from "./components/Outro";
import {
  ScreenshotScene,
  IdentityScene,
  PersonaScene,
  StyleScene,
  StyleChangedScene,
  AutonomyScene,
  SandboxInputScene,
  SandboxChatScene,
  ReleasesScene,
} from "./components/ScreenshotScene";
import { PartHeader } from "./components/PartHeader";

// フレーム計算（30fps）
const FPS = 30;
const SECONDS = (s: number) => s * FPS;

// 各シーンの長さ
const TITLE_DURATION = SECONDS(5);
const PART_HEADER_DURATION = SECONDS(3);
const SCENE_DURATION = SECONDS(5); // 各スクショシーン5秒

export const DesignerTutorial: React.FC = () => {
  let currentFrame = 0;

  // シーケンスを追加するヘルパー
  const addScene = (duration: number) => {
    const start = currentFrame;
    currentFrame += duration;
    return { from: start, duration };
  };

  // タイトル
  const title = addScene(TITLE_DURATION);

  // Part 1: 基本を知る
  const part1Header = addScene(PART_HEADER_DURATION);

  // Part 2: キャラの性格を作る
  const part2Header = addScene(PART_HEADER_DURATION);
  const identityScene = addScene(SCENE_DURATION);
  const personaScene = addScene(SCENE_DURATION);

  // Part 3: 話し方を調整する
  const part3Header = addScene(PART_HEADER_DURATION);
  const styleScene = addScene(SCENE_DURATION);
  const styleChangedScene = addScene(SCENE_DURATION);
  const autonomyScene = addScene(SCENE_DURATION);

  // Part 4: テスト & 公開
  const part4Header = addScene(PART_HEADER_DURATION);
  const sandboxInputScene = addScene(SCENE_DURATION);
  const sandboxChatScene = addScene(SCENE_DURATION);
  const releasesScene = addScene(SCENE_DURATION);

  // アウトロ
  const outro = addScene(SECONDS(5));

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* タイトルカード */}
      <Sequence from={title.from} durationInFrames={title.duration}>
        <TitleCard />
      </Sequence>

      {/* Part 1 ヘッダー */}
      <Sequence from={part1Header.from} durationInFrames={part1Header.duration}>
        <PartHeader
          partNumber={1}
          title="基本を知る"
          subtitle="このツールは何か？何ができるか？"
        />
      </Sequence>

      {/* Part 2 ヘッダー */}
      <Sequence from={part2Header.from} durationInFrames={part2Header.duration}>
        <PartHeader
          partNumber={2}
          title="キャラの性格を作る"
          subtitle="Identity + Persona の設定"
        />
      </Sequence>

      {/* Identity */}
      <Sequence from={identityScene.from} durationInFrames={identityScene.duration}>
        <IdentityScene />
      </Sequence>

      {/* Persona */}
      <Sequence from={personaScene.from} durationInFrames={personaScene.duration}>
        <PersonaScene />
      </Sequence>

      {/* Part 3 ヘッダー */}
      <Sequence from={part3Header.from} durationInFrames={part3Header.duration}>
        <PartHeader
          partNumber={3}
          title="話し方を調整する"
          subtitle="Style + Autonomy の設定"
        />
      </Sequence>

      {/* Style */}
      <Sequence from={styleScene.from} durationInFrames={styleScene.duration}>
        <StyleScene />
      </Sequence>

      {/* Style Changed */}
      <Sequence from={styleChangedScene.from} durationInFrames={styleChangedScene.duration}>
        <StyleChangedScene />
      </Sequence>

      {/* Autonomy */}
      <Sequence from={autonomyScene.from} durationInFrames={autonomyScene.duration}>
        <AutonomyScene />
      </Sequence>

      {/* Part 4 ヘッダー */}
      <Sequence from={part4Header.from} durationInFrames={part4Header.duration}>
        <PartHeader
          partNumber={4}
          title="テスト & 公開"
          subtitle="サンドボックスでテスト → 公開"
        />
      </Sequence>

      {/* Sandbox Input */}
      <Sequence from={sandboxInputScene.from} durationInFrames={sandboxInputScene.duration}>
        <SandboxInputScene />
      </Sequence>

      {/* Sandbox Chat */}
      <Sequence from={sandboxChatScene.from} durationInFrames={sandboxChatScene.duration}>
        <SandboxChatScene />
      </Sequence>

      {/* Releases */}
      <Sequence from={releasesScene.from} durationInFrames={releasesScene.duration}>
        <ReleasesScene />
      </Sequence>

      {/* アウトロ */}
      <Sequence from={outro.from} durationInFrames={outro.duration}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
