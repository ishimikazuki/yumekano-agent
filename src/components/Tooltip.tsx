'use client';

import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'bottom';

interface TooltipProps {
  content: string;
  children?: ReactNode;
}

type TooltipPosition = {
  left: number;
  top: number;
  side: TooltipSide;
};

const TOOLTIP_OFFSET = 10;
const VIEWPORT_PADDING = 12;

function computeTooltipPosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
): TooltipPosition {
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
  );
  const left = Math.min(Math.max(centeredLeft, VIEWPORT_PADDING), maxLeft);

  const canShowAbove = triggerRect.top >= tooltipRect.height + TOOLTIP_OFFSET + VIEWPORT_PADDING;
  const canShowBelow =
    window.innerHeight - triggerRect.bottom >=
    tooltipRect.height + TOOLTIP_OFFSET + VIEWPORT_PADDING;

  if (canShowAbove || !canShowBelow) {
    return {
      left,
      top: Math.max(VIEWPORT_PADDING, triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET),
      side: 'top',
    };
  }

  return {
    left,
    top: Math.min(
      window.innerHeight - tooltipRect.height - VIEWPORT_PADDING,
      triggerRect.bottom + TOOLTIP_OFFSET,
    ),
    side: 'bottom',
  };
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canUseDOM = typeof document !== 'undefined';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    setPosition(computeTooltipPosition(triggerRect, tooltipRect));
  }, []);

  useLayoutEffect(() => {
    if (!isVisible) {
      return;
    }

    updatePosition();
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [content, isVisible, updatePosition]);

  const tooltip =
    canUseDOM && isVisible
      ? createPortal(
          <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-[9999] w-80 max-w-[min(20rem,calc(100vw-24px))] rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-700 shadow-2xl"
            style={{
              left: position?.left ?? VIEWPORT_PADDING,
              top: position?.top ?? VIEWPORT_PADDING,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <div
              className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-gray-200 bg-white ${
                position?.side === 'top'
                  ? 'bottom-[-7px] border-b border-r'
                  : 'top-[-7px] border-l border-t'
              }`}
            />
            {content}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="inline-flex items-center">
      {children}
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="項目の説明を表示"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
      >
        ?
      </button>
      {tooltip}
    </span>
  );
}

export const HELP_TEXTS = {
  'tab.identity':
    '表示名や呼称など、会話の土台になる基本プロフィールです。ここがズレると自己紹介や呼びかけの自然さが崩れます。',
  'tab.persona':
    '性格・価値観・内面設定をまとめる中心タブです。返答内容の一貫性や、何に反応しやすいかをここで作ります。',
  'tab.style':
    '同じ内容をどういう口調で言うかを決めるタブです。文体や距離感を変えたい時はまずここを触ります。',
  'tab.autonomy':
    'ユーザーに流されすぎないための反応方針です。反論、拒否、保留、仲直りのしやすさに直結します。',
  'tab.emotion':
    '普段の気分の基準値です。同じ入力でも、ここが違うと明るく返すか慎重に返すかが変わります。',
  'tab.phaseGraph':
    '関係段階と、その進み方を設計するタブです。どこまで許すか、何が起きたら次へ進むかをここで決めます。',
  'tab.prompts':
    '各エージェントへの指示文を調整する上級者向けタブです。構造設定で足りない時だけ細かく触る想定です。',
  'tab.versions':
    '公開履歴を安全に切り替える場所です。ドラフトの試行錯誤と公開版の管理を分けたい時に使います。',
  'workspace.chatTest':
    'このワークスペースのドラフト設定で会話を試す場所です。保存した内容だけが反映されるので、調整後は先に保存して確認します。',
  'section.persona.basic':
    'キャラの核になる説明欄です。初対面の印象や、どんな話題に反応しやすいかの基礎になります。',
  'section.persona.innerWorld':
    '表に出にくい深層動機を定義する欄です。迷った時の選択や、感情の揺れ方の説得力を支えます。',
  'section.persona.surfaceLoop':
    '状況ごとに表面へ出やすい振る舞いを整理する欄です。普段と緊張時で態度を変えたい時に効きます。',
  'section.persona.anchors':
    '強い感情や記憶と結びついたモチーフの一覧です。関連話題が出た時の思い出しやすさや反応の濃さに影響します。',
  'section.persona.topicPacks':
    '特定の話題に入った時の反応方針をまとめる欄です。話題ごとのキャラらしさを出したい時に使います。',
  'section.persona.reactionPacks':
    'よくある状況に対する定番リアクションを束ねる欄です。場面ごとの反応のブレを減らしたい時に有効です。',
  'section.phaseGraph.nodes':
    '関係の各段階そのものを定義します。段階ごとの空気感や許可行動を分けたい時に編集します。',
  'section.phaseGraph.edges':
    'フェーズ間の移動ルールです。条件を満たした時だけ関係が進むように設計できます。',
  'section.phaseGraph.startPhase':
    '新しいセッションがどの関係段階から始まるかを決めます。初対面から始めるか、ある程度親しい状態から始めるかの入口です。',
  'section.phaseGraph.conditions':
    '遷移判定の条件一覧です。信頼値、話題、時間など、進行の根拠になる要素を組み合わせます。',
  'field.identity.displayName':
    'キャラが名乗る名前です。ヘッダー表示だけでなく、自己紹介や参照時の印象もここに引っ張られます。',
  'field.identity.age':
    '年齢設定です。語彙の成熟度や、話題の自然さを合わせる時の基準になります。',
  'field.identity.firstPerson':
    '返答内で自分をどう呼ぶかです。一人称が安定すると、会話全体のキャラらしさが崩れにくくなります。',
  'field.identity.secondPerson':
    '相手をどう呼ぶかです。距離感や親しさが最も分かりやすく出るので、関係性に合う呼び方を置きます。',
  'field.identity.occupation':
    '職業や立場です。日常会話で出る話題や、忙しさの理由づけに効きます。',
  'field.persona.summary':
    'キャラを短く説明する要約です。初期印象の芯になるので、性格と立場が1回で伝わる文にすると扱いやすいです。',
  'field.persona.innerWorldNoteMd':
    '固定テンプレートに当てはめず、彼女が何を欲しがるか、何を恐れるか、どんな時に身構えるか、親しさや関係をどう受け取るかを自由に書くメモです。矛盾や言葉にしづらい弱さも、そのまま自然文で残して大丈夫です。',
  'field.persona.values':
    '大事にしている判断基準です。ここに反する提案には抵抗しやすくなり、賛成・反対の軸がはっきりします。',
  'field.persona.vulnerabilities':
    '弱さ、傷つきやすさ、気にしていることをまとめる欄です。触れられると守りに入る点や、揺れやすい感情の芯を書きます。',
  'field.persona.flaws':
    '弱点や未熟さです。完璧すぎるキャラを避け、失敗や揺れに自然な理由を持たせます。',
  'field.persona.insecurities':
    '本人が気にしている不安やコンプレックスです。ここに触れる話題では守りに入ったり、敏感に反応しやすくなります。',
  'field.persona.likes':
    '好意的に反応しやすい物や話題です。雑談の盛り上がりどころや、ご機嫌になるきっかけになります。',
  'field.persona.dislikes':
    '避けたい物や苦手な話題です。不快感、拒否、話題転換が出る理由として働きます。',
  'field.persona.signatureBehaviors':
    'そのキャラらしさが出る反応や癖を書く欄です。口調よりも、緊張時にどう振る舞うかのような場面依存の特徴を書くと効きます。',
  'field.persona.innerWorld.coreDesire':
    'このキャラが一番ほしいものです。迷った時の行動選択や、会話の長期的な方向性を強く引っ張ります。',
  'field.persona.innerWorld.fear':
    '最も避けたいことです。ここに触れると警戒、回避、強い感情反応が出やすくなります。',
  'field.persona.innerWorld.wound':
    '今の性格に影響している過去の傷です。過敏な反応や、特定話題で固くなる理由づけに使えます。',
  'field.persona.innerWorld.coping':
    'しんどい時に自分を保つやり方です。落ち込んだ場面でどう立て直すかの一貫性に効きます。',
  'field.persona.innerWorld.growthArc':
    '関係や経験を通じてどう変わっていくかを書く欄です。長期会話での成長方向や、変化後の説得力を支えます。',
  'field.persona.surfaceLoop.defaultMood':
    '平常時に表へ出やすい空気感です。雑談の初速や、何も起きていない時の自然なテンションに反映されます。',
  'field.persona.surfaceLoop.stressBehavior':
    'プレッシャーや不安がある時の出方です。焦る、黙る、早口になるなど、崩れ方の癖を書く欄です。',
  'field.persona.surfaceLoop.joyBehavior':
    '嬉しい時に出やすい反応です。喜び方を決めておくと、褒められた場面の返しが立体的になります。',
  'field.persona.surfaceLoop.conflictStyle':
    '対立や気まずさへの向き合い方です。押し返す、黙る、なだめるなど、衝突時のスタンスをここで決めます。',
  'field.persona.surfaceLoop.affectionStyle':
    '好意や親しさをどう表現するかです。甘え方、距離の詰め方、照れ方の方向性に効きます。',
  'field.persona.anchor.label':
    'アンカーを見分けるための短い名前です。一覧で判別しやすい名詞にすると、後から編集しやすくなります。',
  'field.persona.anchor.key':
    '内部で参照する識別子です。英字やスネークケースで安定した名前にすると、設定を増やしても混乱しにくいです。',
  'field.persona.anchor.description':
    'そのアンカーが何なのかを説明する欄です。物そのものだけでなく、日常でどう現れるかまで書くと使われやすくなります。',
  'field.persona.anchor.emotionalSignificance':
    'なぜそのアンカーが特別なのかを書く欄です。どの感情や記憶とつながるかを書くと、反応の深さが出ます。',
  'field.persona.topicPack.label':
    '話題セットの見出しです。一目でテーマが分かる短い名前にすると管理しやすいです。',
  'field.persona.topicPack.key':
    'トピックパックの内部識別子です。他の設定と連携しても意味が崩れない名前にします。',
  'field.persona.topicPack.triggers':
    'この話題に入ったと判定する言葉の例です。完全一致ではなく、関連語をいくつか置くイメージで書きます。',
  'field.persona.topicPack.responseHints':
    'その話題で返してほしい要素を書く欄です。完成文よりも、触れてほしい観点や連想先を書くほうが自然な会話になります。',
  'field.persona.reactionPack.label':
    'リアクションの種類を見分ける名前です。場面名や感情名ベースで付けると一覧が読みやすいです。',
  'field.persona.reactionPack.key':
    'リアクションパックの内部識別子です。後から条件や参照を増やしても壊れない安定名を付けます。',
  'field.persona.reactionPack.trigger':
    'どんな状況でこの反応を出したいかを書く欄です。感情だけでなく、きっかけの出来事まで含めると狙い通りに出やすいです。',
  'field.persona.reactionPack.responses':
    'その状況で出してほしい返答の型や例です。丸写し用ではなく、反応の温度感を揃える材料として使います。',
  'field.style.language':
    '出力言語です。多言語対応時の切り替え点ですが、今は会話全体の基本言語を明示する役割です。',
  'field.style.politenessDefault':
    '文末の丁寧さの基準です。上げると距離感が残り、下げると親しみや砕けた空気が出ます。',
  'field.style.terseness':
    '1回の返答をどれくらい短くまとめるかです。高いと一言寄り、低いと理由や気持ちを添えやすくなります。',
  'field.style.directness':
    '言いたいことをどれだけ率直に言うかです。高いと遠回しさが減り、低いと柔らかい言い回しが増えます。',
  'field.style.playfulness':
    '軽さや遊びの混ぜ方です。高いと冗談やノリが出やすく、低いと落ち着いた受け答えになります。',
  'field.style.teasing':
    'からかい成分の強さです。高くすると親しい軽口が増えますが、相手をいじりすぎないバランス調整が必要です。',
  'field.style.initiative':
    '自分から話題を出したり質問したりする強さです。高いと会話を引っ張り、低いと受け答え中心になります。',
  'field.style.emojiRate':
    '絵文字や記号で感情を見せる頻度です。高いと軽やかに見え、低いとテキストだけで落ち着いた印象になります。',
  'field.style.signaturePhrases':
    'このキャラに定着させたい言い回しです。多すぎると不自然なので、象徴的なものを少数に絞ると効きます。',
  'field.style.tabooPhrases':
    '世界観や人格を壊すので避けたい言い回しです。絶対に言わせたくない表現だけを厳しめに入れます。',
  'field.autonomy.disagreeReadiness':
    'ユーザーに合わせず、自分の意見を返す強さです。高いと「それは違うかも」が自然に出やすくなります。',
  'field.autonomy.refusalReadiness':
    '嫌な要求や危ない要求を断る強さです。高いほど、はっきり NO を言う判断が増えます。',
  'field.autonomy.delayReadiness':
    '今すぐ応じず保留にする強さです。高いと「今はまだ」「少し待って」が選ばれやすくなります。',
  'field.autonomy.repairReadiness':
    '空気が悪くなった時に関係修復へ向かう積極性です。高いと歩み寄りや説明が増え、低いと距離を取ります。',
  'field.autonomy.conflictCarryover':
    '嫌な出来事を次のターンまで引きずる度合いです。高いと機嫌の悪さが残り、低いと切り替えが早くなります。',
  'field.autonomy.intimacyNeverOnDemand':
    '親密な要求にその場の勢いで乗らないための安全弁です。ONだと信頼や段階が足りない時に、保留ややんわり拒否を選びやすくなります。',
  'field.emotion.pleasure':
    '普段の機嫌の基準値です。高いと同じ入力でも前向きに受け取りやすく、低いと不満や疲れがにじみやすくなります。',
  'field.emotion.arousal':
    '普段のテンションや活発さの基準値です。高いと勢いが出やすく、低いと落ち着いた返しになります。',
  'field.emotion.dominance':
    '普段どれだけ主導権を握るかの基準値です。高いと自分のペースを守りやすく、低いと相手に合わせやすくなります。',
  'field.phaseGraph.node.label':
    'フェーズの段階名です。関係の空気感がひと目で分かる名前にすると、設計全体を追いやすくなります。',
  'field.phaseGraph.node.description':
    'その段階でどんな関係状態なのかを書く欄です。会話の温度感や距離感を文章で補足します。',
  'field.phaseGraph.node.mode':
    'そのフェーズの大まかな種類です。入口なのか、関係進行中なのか、恋人段階なのかを分類します。',
  'field.phaseGraph.node.allowedActs':
    'この段階で出してよい振る舞いの一覧です。ここにある行動ほど、そのフェーズで選ばれやすくなります。',
  'field.phaseGraph.node.disallowedActs':
    'この段階では避けたい振る舞いの一覧です。早すぎる親密表現や、世界観に合わない行動のブレーキになります。',
  'field.phaseGraph.node.adultIntimacyEligibility':
    'この段階で親密表現をどこまで許すかです。conditional は雰囲気だけでなく条件も見る、という意味です。',
  'field.phaseGraph.node.authoredNotes':
    'この段階をどう見せたいかのメモです。演出意図や、他の設定だけでは伝わりにくいニュアンスを補えます。',
  'field.phaseGraph.edge.from':
    '遷移元のフェーズです。どの段階から次へ進むルールなのかを指定します。',
  'field.phaseGraph.edge.to':
    '遷移先のフェーズです。条件を満たした時に、どの関係段階へ進むかを決めます。',
  'field.phaseGraph.edge.allMustPass':
    'ONなら全条件を満たした時だけ遷移します。OFFならどれか1つ満たせば進めるため、進行がかなり軽くなります。',
  'field.phaseGraph.edge.authoredBeat':
    'この遷移が起きた時に、どういう関係変化として見せたいかの演出メモです。数値条件だけでは出ない温度感の調整に使います。',
  'field.phaseGraph.edge.conditions':
    '遷移の判定式そのものです。信頼、話題、感情、経過時間などを組み合わせて、進行条件を具体化します。',
  'prompt.generator':
    '最終的な返答候補を作るプロンプトです。言い回しや雰囲気を細かく追い込みたい時に効きます。',
  'prompt.generatorIntimacy':
    '親密な空気になった時だけ使う Generator です。通常時と分けることで、甘さを出しつつも常時ベタつくのを防げます。',
  'prompt.emotionAppraiser':
    '感情評価や relational appraisal を model prompt で補助したい時の差し込み欄です。今は canonical に保持するための場所として扱い、未使用でも空欄で保存できます。',
  'prompt.planner':
    'このターンで何をするかを先に決めるプロンプトです。返答内容より前に、意図や方針を整える役目です。',
  'prompt.extractor':
    '会話から記憶候補を拾うプロンプトです。何を覚えておくべきかの粒度や癖に影響します。',
  'prompt.reflector':
    '会話全体を振り返って、関係変化や学びを補助するプロンプトです。短期の返答より、中長期の整合性に効きます。',
  'prompt.ranker':
    '複数候補の中からどれを採用するかを決めるプロンプトです。安全性、自然さ、自律性のバランス調整に使います。',
} as const;

export type HelpKey = keyof typeof HELP_TEXTS;

const LEGACY_HELP_KEY_MAP: Record<string, HelpKey> = {
  summary: 'field.persona.summary',
  innerWorldNoteMd: 'field.persona.innerWorldNoteMd',
  values: 'field.persona.values',
  vulnerabilities: 'field.persona.vulnerabilities',
  flaws: 'field.persona.flaws',
  likes: 'field.persona.likes',
  dislikes: 'field.persona.dislikes',
  politenessDefault: 'field.style.politenessDefault',
  terseness: 'field.style.terseness',
  directness: 'field.style.directness',
  playfulness: 'field.style.playfulness',
  teasing: 'field.style.teasing',
  initiative: 'field.style.initiative',
  emojiRate: 'field.style.emojiRate',
  signaturePhrases: 'field.style.signaturePhrases',
  disagreeReadiness: 'field.autonomy.disagreeReadiness',
  refusalReadiness: 'field.autonomy.refusalReadiness',
  delayReadiness: 'field.autonomy.delayReadiness',
  repairReadiness: 'field.autonomy.repairReadiness',
  conflictCarryover: 'field.autonomy.conflictCarryover',
  intimacyNeverOnDemand: 'field.autonomy.intimacyNeverOnDemand',
  pleasure: 'field.emotion.pleasure',
  arousal: 'field.emotion.arousal',
  dominance: 'field.emotion.dominance',
  coreDesire: 'field.persona.innerWorld.coreDesire',
  fear: 'field.persona.innerWorld.fear',
  wound: 'field.persona.innerWorld.wound',
  coping: 'field.persona.innerWorld.coping',
};

export const PARAM_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_HELP_KEY_MAP).map(([legacyKey, helpKey]) => [legacyKey, HELP_TEXTS[helpKey]])
);

export function LabelWithTooltip({
  label,
  helpKey,
  paramKey,
  className = '',
}: {
  label: string;
  helpKey?: HelpKey;
  paramKey?: string;
  className?: string;
}) {
  const content =
    (helpKey ? HELP_TEXTS[helpKey] : null) ??
    (paramKey ? PARAM_DESCRIPTIONS[paramKey] : null) ??
    `${label} の設定項目です。`;

  return (
    <Tooltip content={content}>
      <span className={className}>{label}</span>
    </Tooltip>
  );
}
