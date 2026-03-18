'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type DraftState = {
  identity: {
    displayName: string;
    firstPerson: string;
    secondPerson: string;
    age?: number;
    occupation?: string;
  };
  persona: {
    summary: string;
    values: string[];
    flaws: string[];
    insecurities: string[];
    likes: string[];
    dislikes: string[];
    signatureBehaviors: string[];
    authoredExamples?: Record<string, string[]>;
    innerWorld?: {
      coreDesire: string;
      fear: string;
      wound?: string;
      coping?: string;
      growthArc?: string;
    };
    surfaceLoop?: {
      defaultMood: string;
      stressBehavior: string;
      joyBehavior: string;
      conflictStyle: string;
      affectionStyle: string;
    };
    anchors?: Array<{
      key: string;
      label: string;
      description: string;
      emotionalSignificance: string;
    }>;
    topicPacks?: Array<{
      key: string;
      label: string;
      triggers: string[];
      responseHints: string[];
      moodBias?: { pleasure?: number; arousal?: number; dominance?: number };
    }>;
    reactionPacks?: Array<{
      key: string;
      label: string;
      trigger: string;
      responses: string[];
    }>;
  };
  style: {
    language: string;
    politenessDefault: string;
    terseness: number;
    directness: number;
    playfulness: number;
    teasing: number;
    initiative: number;
    emojiRate: number;
    sentenceLengthBias: string;
    tabooPhrases: string[];
    signaturePhrases: string[];
  };
  autonomy: {
    disagreementReadiness: number;
    refusalReadiness: number;
    delayReadiness: number;
    repairReadiness: number;
    conflictSustain: number;
    intimacyNotOnDemand: boolean;
  };
  emotion: {
    baseline: { pleasure: number; arousal: number; dominance: number };
    reactivity: number;
    recoveryRate: number;
    volatility: number;
  };
  prompts: {
    plannerMd: string;
    generatorMd: string;
    extractorMd: string;
    reflectorMd: string;
    rankerMd: string;
  };
};

type WorkspaceWithDraft = {
  id: string;
  characterId: string;
  name: string;
  draft: DraftState;
};

const TABS = [
  { id: 'identity', label: 'アイデンティティ' },
  { id: 'persona', label: 'ペルソナ' },
  { id: 'style', label: 'スタイル' },
  { id: 'autonomy', label: '自律性' },
  { id: 'emotion', label: '感情' },
  { id: 'prompts', label: 'プロンプト' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function WorkspaceEditPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;
  const workspaceId = params.workspaceId as string;

  const [data, setData] = useState<WorkspaceWithDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`);
        if (!res.ok) throw new Error('Failed to fetch workspace');
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch workspace:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, [workspaceId]);

  const updateSection = useCallback(
    async (section: TabId, value: unknown) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) throw new Error('Failed to save');
        const updated = await res.json();
        setData((prev) =>
          prev ? { ...prev, draft: { ...prev.draft, [section]: updated[section] } } : null
        );
        setHasChanges(false);
      } catch (error) {
        console.error('Save error:', error);
        alert('保存に失敗しました');
      } finally {
        setSaving(false);
      }
    },
    [workspaceId]
  );

  const handleChange = useCallback(
    <K extends keyof DraftState>(section: K, key: keyof DraftState[K], value: unknown) => {
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            [section]: {
              ...prev.draft[section],
              [key]: value,
            },
          },
        };
      });
      setHasChanges(true);
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">ワークスペースが見つかりません</p>
        <Link href={`/characters/${characterId}`} className="text-pink-500 hover:underline mt-4 inline-block">
          キャラクターに戻る
        </Link>
      </div>
    );
  }

  const { draft } = data;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{draft.identity.displayName}</h1>
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
              編集中
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{data.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/playground?workspaceId=${workspaceId}`}
            className="px-4 py-2 text-sm font-medium text-pink-600 bg-pink-50 rounded-lg hover:bg-pink-100"
          >
            サンドボックス
          </Link>
          <Link
            href={`/characters/${characterId}`}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            戻る
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'identity' && (
          <IdentityEditor
            data={draft.identity}
            onChange={(key, value) => handleChange('identity', key, value)}
          />
        )}
        {activeTab === 'persona' && (
          <PersonaEditor
            data={draft.persona}
            onChange={(key, value) => handleChange('persona', key, value)}
          />
        )}
        {activeTab === 'style' && (
          <StyleEditor
            data={draft.style}
            onChange={(key, value) => handleChange('style', key, value)}
          />
        )}
        {activeTab === 'autonomy' && (
          <AutonomyEditor
            data={draft.autonomy}
            onChange={(key, value) => handleChange('autonomy', key, value)}
          />
        )}
        {activeTab === 'emotion' && (
          <EmotionEditor
            data={draft.emotion}
            onChange={(key, value) => handleChange('emotion', key, value)}
          />
        )}
        {activeTab === 'prompts' && (
          <PromptsEditor
            data={draft.prompts}
            onChange={(key, value) => handleChange('prompts', key, value)}
          />
        )}

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t flex justify-end gap-3">
          {hasChanges && (
            <span className="text-sm text-amber-600 self-center">未保存の変更があります</span>
          )}
          <button
            onClick={() => updateSection(activeTab, draft[activeTab])}
            disabled={saving || !hasChanges}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              saving || !hasChanges
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-pink-500 text-white hover:bg-pink-600'
            }`}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Editor Components ============

function IdentityEditor({
  data,
  onChange,
}: {
  data: DraftState['identity'];
  onChange: (key: keyof DraftState['identity'], value: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">アイデンティティ</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
          <input
            type="text"
            value={data.displayName}
            onChange={(e) => onChange('displayName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">年齢</label>
          <input
            type="number"
            value={data.age || ''}
            onChange={(e) => onChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">一人称</label>
          <input
            type="text"
            value={data.firstPerson}
            onChange={(e) => onChange('firstPerson', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">二人称（ユーザーの呼び方）</label>
          <input
            type="text"
            value={data.secondPerson}
            onChange={(e) => onChange('secondPerson', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">職業・役割</label>
          <input
            type="text"
            value={data.occupation || ''}
            onChange={(e) => onChange('occupation', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function PersonaEditor({
  data,
  onChange,
}: {
  data: DraftState['persona'];
  onChange: (key: keyof DraftState['persona'], value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">ペルソナ</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">サマリー</label>
        <textarea
          value={data.summary}
          onChange={(e) => onChange('summary', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
      </div>

      <ArrayEditor
        label="価値観"
        values={data.values}
        onChange={(v) => onChange('values', v)}
      />

      <ArrayEditor
        label="欠点"
        values={data.flaws}
        onChange={(v) => onChange('flaws', v)}
      />

      <ArrayEditor
        label="不安・弱み"
        values={data.insecurities}
        onChange={(v) => onChange('insecurities', v)}
      />

      <ArrayEditor
        label="好きなもの"
        values={data.likes}
        onChange={(v) => onChange('likes', v)}
      />

      <ArrayEditor
        label="嫌いなもの"
        values={data.dislikes}
        onChange={(v) => onChange('dislikes', v)}
      />

      <ArrayEditor
        label="シグネチャ行動"
        values={data.signatureBehaviors}
        onChange={(v) => onChange('signatureBehaviors', v)}
      />
    </div>
  );
}

function StyleEditor({
  data,
  onChange,
}: {
  data: DraftState['style'];
  onChange: (key: keyof DraftState['style'], value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">スタイル</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">言語</label>
          <select
            value={data.language}
            onChange={(e) => onChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">敬語レベル</label>
          <select
            value={data.politenessDefault}
            onChange={(e) => onChange('politenessDefault', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="casual">カジュアル</option>
            <option value="polite">丁寧</option>
            <option value="formal">フォーマル</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <SliderField label="簡潔さ" value={data.terseness} onChange={(v) => onChange('terseness', v)} />
        <SliderField label="直接性" value={data.directness} onChange={(v) => onChange('directness', v)} />
        <SliderField label="遊び心" value={data.playfulness} onChange={(v) => onChange('playfulness', v)} />
        <SliderField label="からかい" value={data.teasing} onChange={(v) => onChange('teasing', v)} />
        <SliderField label="主導性" value={data.initiative} onChange={(v) => onChange('initiative', v)} />
        <SliderField label="絵文字率" value={data.emojiRate} onChange={(v) => onChange('emojiRate', v)} />
      </div>

      <ArrayEditor
        label="シグネチャフレーズ"
        values={data.signaturePhrases}
        onChange={(v) => onChange('signaturePhrases', v)}
      />

      <ArrayEditor
        label="タブーフレーズ（禁止）"
        values={data.tabooPhrases}
        onChange={(v) => onChange('tabooPhrases', v)}
      />
    </div>
  );
}

function AutonomyEditor({
  data,
  onChange,
}: {
  data: DraftState['autonomy'];
  onChange: (key: keyof DraftState['autonomy'], value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">自律性</h2>
      <p className="text-sm text-gray-500">キャラクターがユーザーの要求に対してどれだけ自律的に振る舞うかを設定します。</p>

      <div className="space-y-4">
        <SliderField
          label="異議準備度"
          description="意見が違うときに異議を唱える傾向"
          value={data.disagreementReadiness}
          onChange={(v) => onChange('disagreementReadiness', v)}
        />
        <SliderField
          label="拒否準備度"
          description="不快な要求を断る傾向"
          value={data.refusalReadiness}
          onChange={(v) => onChange('refusalReadiness', v)}
        />
        <SliderField
          label="遅延準備度"
          description="すぐに応じず様子を見る傾向"
          value={data.delayReadiness}
          onChange={(v) => onChange('delayReadiness', v)}
        />
        <SliderField
          label="修復準備度"
          description="関係修復を試みる傾向"
          value={data.repairReadiness}
          onChange={(v) => onChange('repairReadiness', v)}
        />
        <SliderField
          label="葛藤持続度"
          description="気持ちを引きずる傾向"
          value={data.conflictSustain}
          onChange={(v) => onChange('conflictSustain', v)}
        />
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <input
          type="checkbox"
          id="intimacyNotOnDemand"
          checked={data.intimacyNotOnDemand}
          onChange={(e) => onChange('intimacyNotOnDemand', e.target.checked)}
          className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
        />
        <label htmlFor="intimacyNotOnDemand" className="text-sm font-medium text-gray-700">
          親密さはオンデマンド不可
          <span className="block text-xs text-gray-500">急な親密行動を要求されても応じない</span>
        </label>
      </div>
    </div>
  );
}

function EmotionEditor({
  data,
  onChange,
}: {
  data: DraftState['emotion'];
  onChange: (key: keyof DraftState['emotion'], value: unknown) => void;
}) {
  const updateBaseline = (key: 'pleasure' | 'arousal' | 'dominance', value: number) => {
    onChange('baseline', { ...data.baseline, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">感情ベースライン</h2>

      <div className="space-y-4">
        <SliderField
          label="Pleasure（快楽）"
          value={(data.baseline.pleasure + 1) / 2}
          onChange={(v) => updateBaseline('pleasure', v * 2 - 1)}
          showValue={data.baseline.pleasure.toFixed(2)}
        />
        <SliderField
          label="Arousal（覚醒）"
          value={(data.baseline.arousal + 1) / 2}
          onChange={(v) => updateBaseline('arousal', v * 2 - 1)}
          showValue={data.baseline.arousal.toFixed(2)}
        />
        <SliderField
          label="Dominance（支配）"
          value={(data.baseline.dominance + 1) / 2}
          onChange={(v) => updateBaseline('dominance', v * 2 - 1)}
          showValue={data.baseline.dominance.toFixed(2)}
        />
      </div>

      <div className="pt-4 border-t space-y-4">
        <SliderField
          label="反応性"
          description="感情の変化しやすさ"
          value={data.reactivity}
          onChange={(v) => onChange('reactivity', v)}
        />
        <SliderField
          label="回復率"
          description="感情が基準に戻る速さ"
          value={data.recoveryRate}
          onChange={(v) => onChange('recoveryRate', v)}
        />
        <SliderField
          label="変動性"
          description="感情の振れ幅"
          value={data.volatility}
          onChange={(v) => onChange('volatility', v)}
        />
      </div>
    </div>
  );
}

function PromptsEditor({
  data,
  onChange,
}: {
  data: DraftState['prompts'];
  onChange: (key: keyof DraftState['prompts'], value: unknown) => void;
}) {
  const [activePrompt, setActivePrompt] = useState<keyof DraftState['prompts']>('generatorMd');

  const prompts: { key: keyof DraftState['prompts']; label: string }[] = [
    { key: 'generatorMd', label: 'Generator' },
    { key: 'plannerMd', label: 'Planner' },
    { key: 'extractorMd', label: 'Extractor' },
    { key: 'reflectorMd', label: 'Reflector' },
    { key: 'rankerMd', label: 'Ranker' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">プロンプト</h2>
      <p className="text-sm text-gray-500">各ステップで使用されるプロンプトを編集できます。</p>

      <div className="flex gap-2 border-b pb-2">
        {prompts.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePrompt(p.key)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              activePrompt === p.key
                ? 'bg-pink-100 text-pink-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={data[activePrompt]}
        onChange={(e) => onChange(activePrompt, e.target.value)}
        rows={20}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        placeholder={`${activePrompt} プロンプトを入力...`}
      />
    </div>
  );
}

// ============ Utility Components ============

function ArrayEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [newValue, setNewValue] = useState('');

  const addValue = () => {
    if (newValue.trim()) {
      onChange([...values, newValue.trim()]);
      setNewValue('');
    }
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-sm"
          >
            {v}
            <button
              onClick={() => removeValue(i)}
              className="text-pink-400 hover:text-pink-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
          placeholder="追加..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
        <button
          onClick={addValue}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
        >
          追加
        </button>
      </div>
    </div>
  );
}

function SliderField({
  label,
  description,
  value,
  onChange,
  showValue,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  showValue?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm text-gray-500">{showValue ?? `${Math.round(value * 100)}%`}</span>
      </div>
      {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
      />
    </div>
  );
}
