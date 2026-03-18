import { Composition } from "remotion";
import { DesignerTutorial } from "./DesignerTutorial";

// 30fps、720p、約62秒（1860フレーム）
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DesignerTutorial"
        component={DesignerTutorial}
        durationInFrames={1860}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
