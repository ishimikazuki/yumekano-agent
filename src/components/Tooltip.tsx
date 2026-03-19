'use client';

import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // 画面上部に近い場合は下に表示
      if (rect.top < 100) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);

  return (
    <span className="relative inline-flex items-center">
      {children}
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs text-gray-400 bg-gray-100 rounded-full cursor-help hover:bg-gray-200 hover:text-gray-600 transition-colors"
      >
        ?
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-64 p-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg ${
            position === 'top'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          <div
            className={`absolute w-2 h-2 bg-white border-gray-200 transform rotate-45 left-1/2 -translate-x-1/2 ${
              position === 'top'
                ? 'bottom-[-5px] border-r border-b'
                : 'top-[-5px] border-l border-t'
            }`}
          />
          {content}
        </div>
      )}
    </span>
  );
}

/**
 * パラメータの説明を一元管理
 */
export const PARAM_DESCRIPTIONS = {
  // スタイル
  politenessDefault: 'キャラクターの基本的な敬語レベル。polite=丁寧語、casual=タメ口、formal=敬語。会話のトーンを決める重要な設定。',
  terseness: '返答の簡潔さ。高いほど短く端的な返答、低いほど詳しく丁寧な説明をする傾向。',
  directness: '物事をストレートに言うか、オブラートに包むか。高いと遠慮なく本音を言い、低いと婉曲的な表現が増える。',
  playfulness: '会話の遊び心の度合い。高いほど冗談や軽いノリが増え、低いほど真面目な受け答えになる。',
  teasing: 'からかいの頻度。高いとユーザーをイジったり軽口を叩く、低いと真摯な態度を保つ。',
  initiative: 'キャラクターが話題を振る積極性。高いと自分から質問したり提案する、低いとユーザーの話に応答するスタイル。',
  emojiRate: '絵文字の使用頻度。高いと返答に絵文字が増える。キャラの雰囲気に合わせて調整。',
  signaturePhrases: 'このキャラクター特有の口癖や語尾。生成時にこれらのフレーズが自然に使われる。',
  tabooPhrases: '絶対に使ってはいけない言葉やフレーズ。キャラの世界観を壊す表現を防ぐ。',

  // 自律性
  disagreeReadiness: 'ユーザーの意見に異議を唱える準備度。高いと自分の意見をしっかり主張し、低いと同調しやすい。',
  refusalReadiness: '不適切な要求や嫌なことを断る準備度。高いとNOを言いやすく、低いと押しに弱い。',
  delayReadiness: 'すぐに応じず「今は無理」と言える度合い。高いと自分のペースを守り、低いと相手に合わせやすい。',
  repairReadiness: '関係がこじれた時に修復を試みる積極性。高いと自分から謝ったり歩み寄る、低いと相手の出方を待つ。',
  conflictCarryover: '喧嘩や不満を次のターンに持ち越す度合い。高いと根に持つタイプ、低いとすぐ水に流す。',
  intimacyNeverOnDemand: 'ONの場合、ユーザーが求めても親密な行為を即座に受け入れない。信頼や文脈が必要になる。',

  // 感情ベースライン（PAD）
  pleasure: '快・不快の基準点（-1〜1）。高いと普段から明るく幸せそう、低いと憂鬱や不満を抱えやすい。',
  arousal: '興奮・覚醒の基準点（-1〜1）。高いとテンション高めでエネルギッシュ、低いと落ち着いた雰囲気。',
  dominance: '支配・従属の基準点（-1〜1）。高いと主導権を握りたがる、低いと相手に委ねやすい。マイナスは控えめ。',

  // ペルソナ
  summary: 'キャラクターの簡潔な紹介文。年齢、職業、性格の核心を1〜2文で表現。',
  values: 'キャラクターが大切にしている価値観。行動の指針となり、これに反することには抵抗を示す。',
  flaws: 'キャラクターの欠点や弱点。完璧じゃないからこそ人間味が出る。葛藤や成長の種になる。',
  insecurities: '不安や自信のなさ。これを刺激されると動揺したり、守りに入ったりする。',
  likes: '好きなもの・こと。話題として盛り上がり、機嫌が良くなるトリガー。',
  dislikes: '嫌いなもの・こと。これらの話題では不快感を示したり、避けようとする。',
  signatureBehaviors: 'キャラクター特有の仕草や行動パターン。感情と連動して自然に現れる。',

  // インナーワールド
  coreDesire: 'キャラクターの根源的な願望。全ての行動の奥底にある動機。',
  fear: '最も恐れていること。これに触れられると強い反応を示す。',
  wound: '過去の傷や痛み。現在の性格形成に影響している背景。',
  coping: 'ストレスや困難への対処法。このキャラクターなりの乗り越え方。',
  growthArc: 'キャラクターが目指す成長の方向性。物語を通じて変化していく軸。',

  // メモリポリシー
  eventSalienceThreshold: '記憶に残すイベントの重要度閾値。低いと些細なことも覚える、高いと重要なことだけ。',
  factConfidenceThreshold: '事実として記憶する確信度閾値。低いと曖昧な情報も記憶、高いと確実な情報のみ。',
  recencyBias: '最近の記憶を重視する度合い。高いと新しい情報優先、低いと古い記憶も同等に扱う。',
  qualityBias: '記憶の質を重視する度合い。高いと良質な記憶優先、低いと量も重視。',
} as const;

export type ParamKey = keyof typeof PARAM_DESCRIPTIONS;

/**
 * ラベル付きツールチップ
 */
export function LabelWithTooltip({
  label,
  paramKey,
  className = '',
}: {
  label: string;
  paramKey: ParamKey;
  className?: string;
}) {
  const description = PARAM_DESCRIPTIONS[paramKey];
  return (
    <Tooltip content={description}>
      <span className={className}>{label}</span>
    </Tooltip>
  );
}
