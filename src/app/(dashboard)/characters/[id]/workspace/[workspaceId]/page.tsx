'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CoEExplanationCard } from '@/components/CoEExplanationCard';
import type { CoEExplanation } from '@/lib/rules/coe';
import { LabelWithTooltip, type HelpKey } from '@/components/Tooltip';

// ============ Types ============

type Message = {
  role: 'user' | 'assistant';
  content: string;
  turnId?: string;
  phaseId?: string;
  coe?: CoEExplanation;
  emotion?: { pleasure: number; arousal: number; dominance: number };
};

type InnerWorld = {
  coreDesire: string;
  fear: string;
  wound?: string;
  coping?: string;
  growthArc?: string;
};

type SurfaceLoop = {
  defaultMood: string;
  stressBehavior: string;
  joyBehavior: string;
  conflictStyle: string;
  affectionStyle: string;
};

type Anchor = {
  key: string;
  label: string;
  description: string;
  emotionalSignificance: string;
};

type TopicPack = {
  key: string;
  label: string;
  triggers: string[];
  responseHints: string[];
  moodBias?: { pleasure?: number; arousal?: number; dominance?: number };
};

type ReactionPack = {
  key: string;
  label: string;
  trigger: string;
  responses: string[];
  conditions?: { phaseMode?: string; minTrust?: number; maxConflict?: number };
};

type PhaseNode = {
  id: string;
  label: string;
  description: string;
  mode: 'entry' | 'relationship' | 'girlfriend';
  authoredNotes?: string;
  acceptanceProfile: {
    warmthFloor?: number;
    trustFloor?: number;
    intimacyFloor?: number;
    conflictCeiling?: number;
  };
  allowedActs: string[];
  disallowedActs: string[];
  adultIntimacyEligibility?: 'never' | 'conditional' | 'allowed';
};

type TransitionCondition = {
  type: 'metric' | 'topic' | 'event' | 'emotion' | 'openThread' | 'time';
  field?: string;
  op?: string;
  value?: number;
  topicKey?: string;
  minCount?: number;
  eventKey?: string;
  exists?: boolean;
  threadKey?: string;
  status?: string;
};

type PhaseEdge = {
  id: string;
  from: string;
  to: string;
  conditions: TransitionCondition[];
  allMustPass: boolean;
  authoredBeat?: string;
};

type PhaseGraph = {
  nodes: PhaseNode[];
  edges: PhaseEdge[];
  entryPhaseId: string;
};

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
    innerWorldNoteMd?: string;
    values: string[];
    vulnerabilities: string[];
    likes?: string[];
    dislikes?: string[];
    signatureBehaviors?: string[];
    authoredExamples: {
      warm?: string[];
      playful?: string[];
      guarded?: string[];
      conflict?: string[];
    };
    legacyAuthoring?: {
      innerWorld?: InnerWorld;
      surfaceLoop?: SurfaceLoop;
      anchors?: Anchor[];
      topicPacks?: TopicPack[];
      reactionPacks?: ReactionPack[];
    };
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
    disagreeReadiness: number;
    refusalReadiness: number;
    delayReadiness: number;
    repairReadiness: number;
    conflictCarryover: number;
    intimacyNeverOnDemand: boolean;
  };
  emotion: {
    baselinePAD: { pleasure: number; arousal: number; dominance: number };
    recovery: {
      pleasureHalfLifeTurns: number;
      arousalHalfLifeTurns: number;
      dominanceHalfLifeTurns: number;
    };
    appraisalSensitivity: {
      goalCongruence: number;
      controllability: number;
      certainty: number;
      normAlignment: number;
      attachmentSecurity: number;
      reciprocity: number;
      pressureIntrusiveness: number;
      novelty: number;
      selfRelevance: number;
    };
    externalization: {
      warmthWeight: number;
      tersenessWeight: number;
      directnessWeight: number;
      teasingWeight: number;
    };
  };
  phaseGraph: PhaseGraph;
  prompts: {
    plannerMd: string;
    generatorMd: string;
    generatorIntimacyMd: string;
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
  { id: 'identity', label: 'アイデンティティ', helpKey: 'tab.identity' },
  { id: 'persona', label: 'ペルソナ', helpKey: 'tab.persona' },
  { id: 'style', label: 'スタイル', helpKey: 'tab.style' },
  { id: 'autonomy', label: '自律性', helpKey: 'tab.autonomy' },
  { id: 'emotion', label: '感情', helpKey: 'tab.emotion' },
  { id: 'phaseGraph', label: 'フェーズ', helpKey: 'tab.phaseGraph' },
  { id: 'prompts', label: 'プロンプト', helpKey: 'tab.prompts' },
  { id: 'versions', label: 'バージョン', helpKey: 'tab.versions' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function HelpLabel({
  label,
  helpKey,
  className = 'text-xs font-medium text-gray-700',
}: {
  label: string;
  helpKey?: HelpKey;
  className?: string;
}) {
  return (
    <LabelWithTooltip label={label} helpKey={helpKey} className={className} />
  );
}

// ============ Main Component ============

export default function WorkspaceSandboxPage() {
  const params = useParams();
  const characterId = params.id as string;
  const workspaceId = params.workspaceId as string;

  const [data, setData] = useState<WorkspaceWithDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [hasChanges, setHasChanges] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState('test-user-1');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [rightPanelWidth, setRightPanelWidth] = useState(55);
  const [isResizing, setIsResizing] = useState(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const saveEditorContext = useCallback(async (context: { playgroundSessionId?: string }) => {
    const response = await fetch(`/api/workspaces/${workspaceId}/editor-context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });

    if (!response.ok) {
      throw new Error('Failed to save editor context');
    }
  }, [workspaceId]);

  useEffect(() => {
    const fetchWorkspace = async () => {
      setLoading(true);
      setMessages([]);
      setSessionId(null);

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`);
        if (!res.ok) throw new Error('Failed to fetch workspace');
        setData(await res.json());

        const contextRes = await fetch(`/api/workspaces/${workspaceId}/editor-context`);
        if (!contextRes.ok) {
          console.error('Failed to fetch editor context');
          return;
        }

        const contextData = await contextRes.json() as {
          playgroundSessionId?: string;
        };

        if (!contextData.playgroundSessionId) return;

        const sessionRes = await fetch(
          `/api/workspaces/${workspaceId}/playground-session?sessionId=${encodeURIComponent(contextData.playgroundSessionId)}`
        );

        if (sessionRes.status === 404) {
          await saveEditorContext({});
          return;
        }

        if (!sessionRes.ok) {
          throw new Error('Failed to restore playground session');
        }

        const sessionData = await sessionRes.json() as {
          sessionId: string;
          messages: Message[];
        };

        setSessionId(sessionData.sessionId);
        setMessages(sessionData.messages);
      } catch (error) {
        console.error('Failed to fetch workspace:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, [saveEditorContext, workspaceId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById('split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setRightPanelWidth(Math.min(Math.max(((rect.right - e.clientX) / rect.width) * 100, 30), 70));
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const updateSection = useCallback(async (section: string, value: unknown) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, value }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const updated = await res.json();
      setData((prev) => prev ? { ...prev, draft: { ...prev.draft, [section]: updated[section] } } : null);
      setHasChanges(false);
    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [workspaceId]);

  const saveDraftSnapshot = useCallback(async (draftToSave: DraftState) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToSave),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to save draft'
        );
      }

      setData((prev) => prev ? { ...prev, draft: payload as DraftState } : null);
      setHasChanges(false);
      return payload as DraftState;
    } finally {
      setSaving(false);
    }
  }, [workspaceId]);

  const handleChange = useCallback(<K extends keyof DraftState>(section: K, key: keyof DraftState[K], value: unknown) => {
    setData((prev) => {
      if (!prev) return null;
      return { ...prev, draft: { ...prev.draft, [section]: { ...prev.draft[section], [key]: value } } };
    });
    setHasChanges(true);
  }, []);

  const handleSectionChange = useCallback(<K extends keyof DraftState>(section: K, value: DraftState[K]) => {
    setData((prev) => {
      if (!prev) return null;
      return { ...prev, draft: { ...prev.draft, [section]: value } };
    });
    setHasChanges(true);
  }, []);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !data) return;
    const userMessage = input.trim();
    setIsLoading(true);
    try {
      try {
        await saveDraftSnapshot(data.draft);
      } catch (saveError) {
        console.error('Conversation autosave failed:', saveError);
        alert(`会話前の自動保存に失敗しました\n${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
        return;
      }

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      const response = await fetch('/api/draft-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, sessionId: sessionId || undefined, userId, message: userMessage }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Draft chat failed');
      const responseData = await response.json();
      if (!sessionId && responseData.sessionId) {
        setSessionId(responseData.sessionId);
        try {
          await saveEditorContext({ playgroundSessionId: responseData.sessionId });
        } catch (contextError) {
          console.error('Failed to persist playground session:', contextError);
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: responseData.text,
          turnId: responseData.turnId,
          phaseId: responseData.phaseId,
          emotion: responseData.emotion,
          coe: responseData.coe,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setMessages([]);
    setSessionId(null);

    try {
      await saveEditorContext({});
    } catch (error) {
      console.error('Failed to reset editor context:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  if (!data) return <div className="text-center py-12"><p className="text-red-500">ワークスペースが見つかりません</p><Link href={`/characters/${characterId}`} className="text-pink-500 hover:underline mt-4 inline-block">キャラクターに戻る</Link></div>;

  const { draft } = data;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">{draft.identity.displayName}</h1>
          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">サンドボックス</span>
          <span className="text-sm text-gray-500">{data.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && activeTab !== 'versions' && <span className="text-xs text-amber-600">未保存</span>}
          {activeTab !== 'versions' && (
            <button onClick={() => updateSection(activeTab, draft[activeTab as keyof DraftState])} disabled={saving || !hasChanges} className={`px-3 py-1.5 text-sm rounded-lg font-medium ${saving || !hasChanges ? 'bg-gray-100 text-gray-400' : 'bg-pink-500 text-white hover:bg-pink-600'}`}>{saving ? '保存中...' : '保存'}</button>
          )}
          <Link href={`/characters/${characterId}`} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">戻る</Link>
        </div>
      </div>

      {/* Split Panel */}
      <div id="split-container" className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex flex-col bg-gray-50" style={{ width: `${100 - rightPanelWidth}%` }}>
          <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
            <HelpLabel
              label="会話テスト"
              helpKey="workspace.chatTest"
              className="text-sm font-medium text-gray-700"
            />
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700">リセット</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <div className="text-center text-gray-400 py-8 text-sm"><p>編集した内容でテストできるよ</p><p className="mt-1 text-xs">送信時に自動保存されるよ</p></div>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-pink-500 text-white' : 'bg-white text-gray-900 shadow-sm'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && msg.phaseId && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-xs text-gray-400">
                      <span>Phase: {msg.phaseId}</span>
                      {msg.emotion && <span className="ml-2">P:{msg.emotion.pleasure.toFixed(1)} A:{msg.emotion.arousal.toFixed(1)} D:{msg.emotion.dominance.toFixed(1)}</span>}
                      {msg.coe && <CoEExplanationCard coe={msg.coe} className="mt-2" />}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && <div className="flex justify-start"><div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-400 shadow-sm">考え中...</div></div>}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力..." disabled={isLoading} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:bg-gray-50" />
              <button type="submit" disabled={isLoading || !input.trim()} className="px-4 py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 disabled:opacity-50">送信</button>
            </div>
          </form>
        </div>

        {/* Resizer */}
        <div className="w-1 bg-gray-200 hover:bg-pink-300 cursor-col-resize shrink-0" onMouseDown={() => setIsResizing(true)} />

        {/* Right: Editor */}
        <div className="flex flex-col bg-white overflow-hidden" style={{ width: `${rightPanelWidth}%` }}>
          <div className="border-b shrink-0 px-2 overflow-x-auto">
            <nav className="flex gap-1 py-1.5">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-2 py-1 text-xs font-medium whitespace-nowrap rounded transition-colors ${activeTab === tab.id ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <HelpLabel label={tab.label} helpKey={tab.helpKey} className="text-inherit" />
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'identity' && <IdentityEditor data={draft.identity} onChange={(k, v) => handleChange('identity', k, v)} />}
            {activeTab === 'persona' && <PersonaEditor data={draft.persona} onChange={(k, v) => handleChange('persona', k, v)} />}
            {activeTab === 'style' && <StyleEditor data={draft.style} onChange={(k, v) => handleChange('style', k, v)} />}
            {activeTab === 'autonomy' && <AutonomyEditor data={draft.autonomy} onChange={(k, v) => handleChange('autonomy', k, v)} />}
            {activeTab === 'emotion' && <EmotionEditor data={draft.emotion} onChange={(k, v) => handleChange('emotion', k, v)} />}
            {activeTab === 'phaseGraph' && <PhaseGraphEditor data={draft.phaseGraph} onChange={(v) => handleSectionChange('phaseGraph', v)} />}
            {activeTab === 'prompts' && <PromptsEditor data={draft.prompts} onChange={(k, v) => handleChange('prompts', k, v)} />}
            {activeTab === 'versions' && <VersionsEditor characterId={characterId} workspaceId={workspaceId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Identity Editor ============
function IdentityEditor({ data, onChange }: { data: DraftState['identity']; onChange: (k: keyof DraftState['identity'], v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">アイデンティティ</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="表示名" helpKey="field.identity.displayName" value={data.displayName} onChange={(v) => onChange('displayName', v)} />
        <Field label="年齢" helpKey="field.identity.age" type="number" value={data.age ?? ''} onChange={(v) => onChange('age', v ? parseInt(v) : undefined)} />
        <Field label="一人称" helpKey="field.identity.firstPerson" value={data.firstPerson} onChange={(v) => onChange('firstPerson', v)} />
        <Field label="二人称" helpKey="field.identity.secondPerson" value={data.secondPerson} onChange={(v) => onChange('secondPerson', v)} />
        <div className="col-span-2"><Field label="職業・役割" helpKey="field.identity.occupation" value={data.occupation ?? ''} onChange={(v) => onChange('occupation', v || undefined)} /></div>
      </div>
    </div>
  );
}

// ============ Persona Editor ============
function PersonaEditor({ data, onChange }: { data: DraftState['persona']; onChange: (k: keyof DraftState['persona'], v: unknown) => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ basic: true, examples: true });
  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">ペルソナ</h2>

      {/* Basic */}
      <Section title="基本情報" helpKey="section.persona.basic" expanded={expandedSections.basic} onToggle={() => toggle('basic')}>
        <TextArea label="サマリー" helpKey="field.persona.summary" value={data.summary} onChange={(v) => onChange('summary', v)} rows={2} />
        <TextArea
          label="内面メモ"
          helpKey="field.persona.innerWorldNoteMd"
          value={data.innerWorldNoteMd ?? ''}
          onChange={(v) => onChange('innerWorldNoteMd', v || undefined)}
          rows={6}
          placeholder="彼女が本当に欲しいもの、恐れていること、防御的になるきっかけ、親しさや関係をどう受け取るかを自由に書いてね"
        />
        <ArrayEditor label="価値観" helpKey="field.persona.values" values={data.values} onChange={(v) => onChange('values', v)} />
        <ArrayEditor label="弱さ・傷つきやすさ" helpKey="field.persona.vulnerabilities" values={data.vulnerabilities} onChange={(v) => onChange('vulnerabilities', v)} />
        <ArrayEditor label="好きなもの" helpKey="field.persona.likes" values={data.likes ?? []} onChange={(v) => onChange('likes', v)} />
        <ArrayEditor label="嫌いなもの" helpKey="field.persona.dislikes" values={data.dislikes ?? []} onChange={(v) => onChange('dislikes', v)} />
        <ArrayEditor label="シグネチャ行動" helpKey="field.persona.signatureBehaviors" values={data.signatureBehaviors ?? []} onChange={(v) => onChange('signatureBehaviors', v)} />
      </Section>

      <Section title="発話例" expanded={expandedSections.examples} onToggle={() => toggle('examples')}>
        <AuthoredExamplesEditor
          data={data.authoredExamples}
          onChange={(v) => onChange('authoredExamples', v)}
        />
      </Section>
    </div>
  );
}

function AuthoredExamplesEditor({
  data,
  onChange,
}: {
  data: DraftState['persona']['authoredExamples'];
  onChange: (v: DraftState['persona']['authoredExamples']) => void;
}) {
  const update = (
    key: keyof DraftState['persona']['authoredExamples'],
    values: string[]
  ) => onChange({ ...data, [key]: values.length > 0 ? values : undefined });

  return (
    <div className="space-y-3">
      <ArrayEditor label="優しい時" values={data.warm ?? []} onChange={(v) => update('warm', v)} />
      <ArrayEditor label="じゃれた時" values={data.playful ?? []} onChange={(v) => update('playful', v)} />
      <ArrayEditor label="警戒している時" values={data.guarded ?? []} onChange={(v) => update('guarded', v)} />
      <ArrayEditor label="ぶつかった時" values={data.conflict ?? []} onChange={(v) => update('conflict', v)} />
    </div>
  );
}

// ============ Style Editor ============
function StyleEditor({ data, onChange }: { data: DraftState['style']; onChange: (k: keyof DraftState['style'], v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">スタイル</h2>
      <div className="grid grid-cols-2 gap-3">
        <Select label="言語" helpKey="field.style.language" value={data.language} onChange={(v) => onChange('language', v)} options={[{ value: 'ja', label: '日本語' }]} />
        <Select label="敬語レベル" helpKey="field.style.politenessDefault" value={data.politenessDefault} onChange={(v) => onChange('politenessDefault', v)} options={[{ value: 'casual', label: 'カジュアル' }, { value: 'mixed', label: 'ミックス' }, { value: 'polite', label: '丁寧' }]} />
      </div>
      <div className="space-y-3">
        <SliderField label="簡潔さ" helpKey="field.style.terseness" value={data.terseness} onChange={(v) => onChange('terseness', v)} />
        <SliderField label="直接性" helpKey="field.style.directness" value={data.directness} onChange={(v) => onChange('directness', v)} />
        <SliderField label="遊び心" helpKey="field.style.playfulness" value={data.playfulness} onChange={(v) => onChange('playfulness', v)} />
        <SliderField label="からかい" helpKey="field.style.teasing" value={data.teasing} onChange={(v) => onChange('teasing', v)} />
        <SliderField label="主導性" helpKey="field.style.initiative" value={data.initiative} onChange={(v) => onChange('initiative', v)} />
        <SliderField label="絵文字率" helpKey="field.style.emojiRate" value={data.emojiRate} onChange={(v) => onChange('emojiRate', v)} />
      </div>
      <ArrayEditor label="シグネチャフレーズ" helpKey="field.style.signaturePhrases" values={data.signaturePhrases} onChange={(v) => onChange('signaturePhrases', v)} />
      <ArrayEditor label="タブーフレーズ" helpKey="field.style.tabooPhrases" values={data.tabooPhrases} onChange={(v) => onChange('tabooPhrases', v)} />
    </div>
  );
}

// ============ Autonomy Editor ============
function AutonomyEditor({ data, onChange }: { data: DraftState['autonomy']; onChange: (k: keyof DraftState['autonomy'], v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-base font-semibold text-gray-900">自律性</h2><p className="text-xs text-gray-500 mt-1">ユーザーの要求に対する反応傾向</p></div>
      <div className="space-y-3">
        <SliderField label="反論しやすさ" helpKey="field.autonomy.disagreeReadiness" value={data.disagreeReadiness} onChange={(v) => onChange('disagreeReadiness', v)} />
        <SliderField label="断りやすさ" helpKey="field.autonomy.refusalReadiness" value={data.refusalReadiness} onChange={(v) => onChange('refusalReadiness', v)} />
        <SliderField label="待たせやすさ" helpKey="field.autonomy.delayReadiness" value={data.delayReadiness} onChange={(v) => onChange('delayReadiness', v)} />
        <SliderField label="仲直りしやすさ" helpKey="field.autonomy.repairReadiness" value={data.repairReadiness} onChange={(v) => onChange('repairReadiness', v)} />
        <SliderField label="引きずりやすさ" helpKey="field.autonomy.conflictCarryover" value={data.conflictCarryover} onChange={(v) => onChange('conflictCarryover', v)} />
      </div>
      <div className="flex items-center gap-2 pt-3 border-t">
        <input type="checkbox" id="intimacy" checked={data.intimacyNeverOnDemand} onChange={(e) => onChange('intimacyNeverOnDemand', e.target.checked)} className="w-4 h-4 text-pink-500 rounded" />
        <label htmlFor="intimacy">
          <HelpLabel label="甘えさせない" helpKey="field.autonomy.intimacyNeverOnDemand" className="text-sm text-gray-700" />
        </label>
      </div>
    </div>
  );
}

// ============ Emotion Editor ============
function EmotionEditor({ data, onChange }: { data: DraftState['emotion']; onChange: (k: keyof DraftState['emotion'], v: unknown) => void }) {
  const baseline = data?.baselinePAD ?? { pleasure: 0, arousal: 0, dominance: 0 };
  const updateBaseline = (k: 'pleasure' | 'arousal' | 'dominance', v: number) =>
    onChange('baselinePAD', { ...baseline, [k]: v });
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">感情ベースライン</h2>
      <div className="space-y-3">
        <SliderField
          label="快"
          helpKey="field.emotion.pleasure"
          value={(baseline.pleasure + 1) / 2}
          onChange={(v) => updateBaseline('pleasure', v * 2 - 1)}
          showValue={baseline.pleasure.toFixed(2)}
        />
        <SliderField
          label="覚醒"
          helpKey="field.emotion.arousal"
          value={(baseline.arousal + 1) / 2}
          onChange={(v) => updateBaseline('arousal', v * 2 - 1)}
          showValue={baseline.arousal.toFixed(2)}
        />
        <SliderField
          label="支配感"
          helpKey="field.emotion.dominance"
          value={(baseline.dominance + 1) / 2}
          onChange={(v) => updateBaseline('dominance', v * 2 - 1)}
          showValue={baseline.dominance.toFixed(2)}
        />
      </div>
    </div>
  );
}

// ============ Phase Graph Editor ============
function PhaseGraphEditor({ data, onChange }: { data: PhaseGraph; onChange: (v: PhaseGraph) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = data.edges.find(e => e.id === selectedEdgeId);

  const addNode = () => {
    const newNode: PhaseNode = {
      id: `phase_${Date.now()}`,
      label: '新しいフェーズ',
      description: 'このフェーズの説明',
      mode: 'relationship',
      acceptanceProfile: { warmthFloor: 0.3, trustFloor: 0.3 },
      allowedActs: ['greet', 'chat', 'comfort'],
      disallowedActs: ['flirt', 'express_affection'],
    };
    onChange({ ...data, nodes: [...data.nodes, newNode] });
    setSelectedNodeId(newNode.id);
  };

  const updateNode = (nodeId: string, updates: Partial<PhaseNode>) => {
    onChange({ ...data, nodes: data.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n) });
  };

  const deleteNode = (nodeId: string) => {
    if (data.entryPhaseId === nodeId) { alert('開始フェーズは削除できません'); return; }
    onChange({ ...data, nodes: data.nodes.filter(n => n.id !== nodeId), edges: data.edges.filter(e => e.from !== nodeId && e.to !== nodeId) });
    setSelectedNodeId(null);
  };

  const addEdge = () => {
    if (data.nodes.length < 2) return;
    const newEdge: PhaseEdge = { id: `edge_${Date.now()}`, from: data.nodes[0].id, to: data.nodes[1].id, conditions: [{ type: 'metric', field: 'trust', op: '>=', value: 0.5 }], allMustPass: true, authoredBeat: '信頼が深まり、次の段階へ' };
    onChange({ ...data, edges: [...data.edges, newEdge] });
    setSelectedEdgeId(newEdge.id);
  };

  const updateEdge = (edgeId: string, updates: Partial<PhaseEdge>) => {
    onChange({ ...data, edges: data.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e) });
  };

  const deleteEdge = (edgeId: string) => {
    onChange({ ...data, edges: data.edges.filter(e => e.id !== edgeId) });
    setSelectedEdgeId(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">フェーズグラフ</h2>

      {/* Nodes List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3>
            <HelpLabel label="フェーズノード" helpKey="section.phaseGraph.nodes" className="text-sm font-medium text-gray-700" />
          </h3>
          <button onClick={addNode} className="text-xs text-pink-600 hover:text-pink-700">+ 追加</button>
        </div>
        <div className="space-y-1">
          {data.nodes.map(node => (
            <button key={node.id} onClick={() => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedNodeId === node.id ? 'bg-pink-100 text-pink-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
              <span>{node.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${node.mode === 'entry' ? 'bg-green-100 text-green-700' : node.mode === 'relationship' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{node.mode}</span>
                {data.entryPhaseId === node.id && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">開始</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Edges List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3>
            <HelpLabel label="遷移" helpKey="section.phaseGraph.edges" className="text-sm font-medium text-gray-700" />
          </h3>
          <button onClick={addEdge} disabled={data.nodes.length < 2} className="text-xs text-pink-600 hover:text-pink-700 disabled:text-gray-400">+ 追加</button>
        </div>
        <div className="space-y-1">
          {data.edges.map(edge => {
            const fromNode = data.nodes.find(n => n.id === edge.from);
            const toNode = data.nodes.find(n => n.id === edge.to);
            return (
              <button key={edge.id} onClick={() => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedEdgeId === edge.id ? 'bg-pink-100 text-pink-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
                {fromNode?.label || edge.from} → {toNode?.label || edge.to}
                <span className="text-xs text-gray-500 ml-2">({edge.conditions.length}条件)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry Phase */}
      <div>
        <label className="block mb-1">
          <HelpLabel label="開始フェーズ" helpKey="section.phaseGraph.startPhase" />
        </label>
        <select value={data.entryPhaseId} onChange={(e) => onChange({ ...data, entryPhaseId: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg">
          {data.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </div>

      {/* Node Editor */}
      {selectedNode && (
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">フェーズ編集: {selectedNode.label}</h3>
            <button onClick={() => deleteNode(selectedNode.id)} className="text-xs text-red-500 hover:text-red-700">削除</button>
          </div>
          <Field label="ラベル" helpKey="field.phaseGraph.node.label" value={selectedNode.label} onChange={(v) => updateNode(selectedNode.id, { label: v })} />
          <TextArea label="説明" helpKey="field.phaseGraph.node.description" value={selectedNode.description} onChange={(v) => updateNode(selectedNode.id, { description: v })} rows={2} />
          <Select label="モード" helpKey="field.phaseGraph.node.mode" value={selectedNode.mode} onChange={(v) => updateNode(selectedNode.id, { mode: v as PhaseNode['mode'] })} options={[{ value: 'entry', label: 'Entry' }, { value: 'relationship', label: 'Relationship' }, { value: 'girlfriend', label: 'Girlfriend' }]} />
          <ArrayEditor label="許可アクト" helpKey="field.phaseGraph.node.allowedActs" values={selectedNode.allowedActs} onChange={(v) => updateNode(selectedNode.id, { allowedActs: v })} />
          <ArrayEditor label="禁止アクト" helpKey="field.phaseGraph.node.disallowedActs" values={selectedNode.disallowedActs} onChange={(v) => updateNode(selectedNode.id, { disallowedActs: v })} />
          <Select label="親密性" helpKey="field.phaseGraph.node.adultIntimacyEligibility" value={selectedNode.adultIntimacyEligibility || 'never'} onChange={(v) => updateNode(selectedNode.id, { adultIntimacyEligibility: v as PhaseNode['adultIntimacyEligibility'] })} options={[{ value: 'never', label: '不可' }, { value: 'conditional', label: '条件付き' }, { value: 'allowed', label: '許可' }]} />
          <TextArea label="ノート" helpKey="field.phaseGraph.node.authoredNotes" value={selectedNode.authoredNotes || ''} onChange={(v) => updateNode(selectedNode.id, { authoredNotes: v || undefined })} rows={2} />
        </div>
      )}

      {/* Edge Editor */}
      {selectedEdge && (
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">遷移編集</h3>
            <button onClick={() => deleteEdge(selectedEdge.id)} className="text-xs text-red-500 hover:text-red-700">削除</button>
          </div>
          <Select label="From" helpKey="field.phaseGraph.edge.from" value={selectedEdge.from} onChange={(v) => updateEdge(selectedEdge.id, { from: v })} options={data.nodes.map(n => ({ value: n.id, label: n.label }))} />
          <Select label="To" helpKey="field.phaseGraph.edge.to" value={selectedEdge.to} onChange={(v) => updateEdge(selectedEdge.id, { to: v })} options={data.nodes.map(n => ({ value: n.id, label: n.label }))} />
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={selectedEdge.allMustPass} onChange={(e) => updateEdge(selectedEdge.id, { allMustPass: e.target.checked })} className="w-4 h-4 text-pink-500 rounded" />
            <HelpLabel label="すべての条件を満たす必要あり" helpKey="field.phaseGraph.edge.allMustPass" className="text-sm text-gray-700" />
          </div>
          <TextArea label="ビート（演出ノート）" helpKey="field.phaseGraph.edge.authoredBeat" value={selectedEdge.authoredBeat || ''} onChange={(v) => updateEdge(selectedEdge.id, { authoredBeat: v || undefined })} rows={2} />

          {/* Conditions Editor */}
          <ConditionsEditor
            conditions={selectedEdge.conditions}
            onChange={(conditions) => updateEdge(selectedEdge.id, { conditions })}
          />
        </div>
      )}
    </div>
  );
}

// ============ Conditions Editor ============
function ConditionsEditor({ conditions, onChange }: { conditions: TransitionCondition[]; onChange: (c: TransitionCondition[]) => void }) {
  const addCondition = (type: TransitionCondition['type']) => {
    let newCondition: TransitionCondition;
    switch (type) {
      case 'metric':
        newCondition = { type: 'metric', field: 'trust', op: '>=', value: 0.5 };
        break;
      case 'topic':
        newCondition = { type: 'topic', topicKey: 'dream', minCount: 1 };
        break;
      case 'event':
        newCondition = { type: 'event', eventKey: 'first_meeting', exists: true };
        break;
      case 'emotion':
        newCondition = { type: 'emotion', field: 'pleasure', op: '>=', value: 0.3 };
        break;
      case 'openThread':
        newCondition = { type: 'openThread', threadKey: 'conflict', status: 'resolved' };
        break;
      case 'time':
        newCondition = { type: 'time', field: 'turnsSinceLastTransition', op: '>=', value: 5 };
        break;
      default:
        return;
    }
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<TransitionCondition>) => {
    onChange(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label>
          <HelpLabel label="遷移条件" helpKey="field.phaseGraph.edge.conditions" />
        </label>
        <div className="flex gap-1">
          <button onClick={() => addCondition('metric')} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">+数値</button>
          <button onClick={() => addCondition('topic')} className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">+トピック</button>
          <button onClick={() => addCondition('emotion')} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">+感情</button>
          <button onClick={() => addCondition('time')} className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">+時間</button>
        </div>
      </div>

      {conditions.length === 0 && (
        <div className="text-xs text-gray-400 py-2">条件がありません（常に遷移可能）</div>
      )}

      {conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border text-xs">
          {cond.type === 'metric' && (
            <>
              <select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value="trust">trust</option>
                <option value="affinity">affinity</option>
                <option value="intimacy_readiness">intimacy</option>
                <option value="conflict">conflict</option>
              </select>
              <select value={cond.op} onChange={(e) => updateCondition(i, { op: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value=">=">≥</option>
                <option value="<=">≤</option>
              </select>
              <input type="number" step="0.1" min="0" max="1" value={cond.value} onChange={(e) => updateCondition(i, { value: parseFloat(e.target.value) })} className="w-16 px-1 py-0.5 border rounded" />
            </>
          )}

          {cond.type === 'topic' && (
            <>
              <span className="text-gray-500">トピック</span>
              <input type="text" value={cond.topicKey} onChange={(e) => updateCondition(i, { topicKey: e.target.value })} className="flex-1 px-1 py-0.5 border rounded" placeholder="topicKey" />
              <span>≥</span>
              <input type="number" min="1" value={cond.minCount ?? 1} onChange={(e) => updateCondition(i, { minCount: parseInt(e.target.value) })} className="w-12 px-1 py-0.5 border rounded" />
              <span className="text-gray-500">回</span>
            </>
          )}

          {cond.type === 'event' && (
            <>
              <span className="text-gray-500">イベント</span>
              <input type="text" value={cond.eventKey} onChange={(e) => updateCondition(i, { eventKey: e.target.value })} className="flex-1 px-1 py-0.5 border rounded" placeholder="eventKey" />
              <select value={cond.exists ? 'true' : 'false'} onChange={(e) => updateCondition(i, { exists: e.target.value === 'true' })} className="px-1 py-0.5 border rounded">
                <option value="true">発生済み</option>
                <option value="false">未発生</option>
              </select>
            </>
          )}

          {cond.type === 'emotion' && (
            <>
              <select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value="pleasure">pleasure</option>
                <option value="arousal">arousal</option>
                <option value="dominance">dominance</option>
              </select>
              <select value={cond.op} onChange={(e) => updateCondition(i, { op: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value=">=">≥</option>
                <option value="<=">≤</option>
              </select>
              <input type="number" step="0.1" min="-1" max="1" value={cond.value} onChange={(e) => updateCondition(i, { value: parseFloat(e.target.value) })} className="w-16 px-1 py-0.5 border rounded" />
            </>
          )}

          {cond.type === 'openThread' && (
            <>
              <span className="text-gray-500">スレッド</span>
              <input type="text" value={cond.threadKey} onChange={(e) => updateCondition(i, { threadKey: e.target.value })} className="flex-1 px-1 py-0.5 border rounded" placeholder="threadKey" />
              <select value={cond.status} onChange={(e) => updateCondition(i, { status: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value="open">open</option>
                <option value="resolved">resolved</option>
              </select>
            </>
          )}

          {cond.type === 'time' && (
            <>
              <select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className="px-1 py-0.5 border rounded">
                <option value="turnsSinceLastTransition">ターン経過</option>
                <option value="daysSinceEntry">日数経過</option>
              </select>
              <span>≥</span>
              <input type="number" min="1" value={cond.value} onChange={(e) => updateCondition(i, { value: parseInt(e.target.value) })} className="w-16 px-1 py-0.5 border rounded" />
            </>
          )}

          <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 ml-auto">×</button>
        </div>
      ))}
    </div>
  );
}

// ============ Prompts Editor ============
function PromptsEditor({ data, onChange }: { data: DraftState['prompts']; onChange: (k: keyof DraftState['prompts'], v: unknown) => void }) {
  const [activePrompt, setActivePrompt] = useState<keyof DraftState['prompts']>('generatorMd');
  const prompts: { key: keyof DraftState['prompts']; label: string; helpKey: HelpKey }[] = [
    { key: 'generatorMd', label: 'Generator', helpKey: 'prompt.generator' },
    { key: 'generatorIntimacyMd', label: 'Generator (Intimacy)', helpKey: 'prompt.generatorIntimacy' },
    { key: 'plannerMd', label: 'Planner', helpKey: 'prompt.planner' },
    { key: 'extractorMd', label: 'Extractor', helpKey: 'prompt.extractor' },
    { key: 'reflectorMd', label: 'Reflector', helpKey: 'prompt.reflector' },
    { key: 'rankerMd', label: 'Ranker', helpKey: 'prompt.ranker' },
  ];
  return (
    <div className="space-y-3 h-full flex flex-col">
      <h2 className="text-base font-semibold text-gray-900">プロンプト</h2>
      <div className="flex gap-1 flex-wrap">
        {prompts.map((p) => (
          <button key={p.key} onClick={() => setActivePrompt(p.key)} className={`px-2 py-1 text-xs rounded ${activePrompt === p.key ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <HelpLabel label={p.label} helpKey={p.helpKey} className="text-inherit" />
          </button>
        ))}
      </div>
      <textarea value={data[activePrompt]} onChange={(e) => onChange(activePrompt, e.target.value)} className="flex-1 w-full px-3 py-2 border rounded-lg font-mono text-xs focus:ring-2 focus:ring-pink-500 resize-none min-h-[300px]" />
    </div>
  );
}

// ============ Versions Editor ============
type VersionInfo = {
  id: string;
  versionNumber: number;
  label: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  parentVersionId: string | null;
  release: { publishedAt: string; channel: string } | null;
};

function VersionsEditor({ characterId, workspaceId }: { characterId: string; workspaceId: string }) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [publishLabel, setPublishLabel] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/characters/${characterId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handlePublish = async () => {
    if (!publishLabel.trim()) {
      alert('バージョン名を入力してください');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: publishLabel.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Publish failed');
      }
      const result = await res.json();
      alert(`v${result.version.versionNumber} "${result.version.label}" を公開しました！`);
      setPublishLabel('');
      setShowPublishDialog(false);
      fetchVersions();
    } catch (error) {
      alert(`公開失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (versionId: string, versionNumber: number) => {
    if (!confirm(`v${versionNumber} にロールバックしますか？\n新しいバージョンとして公開されます。`)) return;
    setRollingBack(versionId);
    try {
      const res = await fetch(`/api/characters/${characterId}/versions/${versionId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Rollback failed');
      }
      const result = await res.json();
      alert(`v${result.rolledBackFromVersion.versionNumber} にロールバックしました！\n→ v${result.version.versionNumber} として公開`);
      fetchVersions();
    } catch (error) {
      alert(`ロールバック失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">バージョン管理</h2>
        <button
          onClick={() => setShowPublishDialog(true)}
          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex items-center gap-1"
        >
          <span>📦</span> 新バージョンを公開
        </button>
      </div>

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <p className="text-sm text-green-800 font-medium">現在のドラフトを新バージョンとして公開します</p>
          <input
            type="text"
            value={publishLabel}
            onChange={(e) => setPublishLabel(e.target.value)}
            placeholder="バージョン名（例: 口癖調整版）"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handlePublish}
              disabled={publishing || !publishLabel.trim()}
              className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {publishing ? '公開中...' : '公開する'}
            </button>
            <button
              onClick={() => { setShowPublishDialog(false); setPublishLabel(''); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Version History */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">バージョン履歴</h3>
        {versions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">まだバージョンがありません</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 rounded-lg border ${
                  version.status === 'published'
                    ? 'bg-green-50 border-green-200'
                    : version.status === 'archived'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-900">v{version.versionNumber}</span>
                    {version.label && (
                      <span className="text-sm text-gray-700">{version.label}</span>
                    )}
                    {version.status === 'published' && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">公開中</span>
                    )}
                    {version.status === 'archived' && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">アーカイブ</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDate(version.createdAt)}</span>
                    {version.status !== 'published' && (
                      <button
                        onClick={() => handleRollback(version.id, version.versionNumber)}
                        disabled={rollingBack === version.id}
                        className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
                      >
                        {rollingBack === version.id ? '処理中...' : 'ロールバック'}
                      </button>
                    )}
                  </div>
                </div>
                {version.parentVersionId && (
                  <p className="text-xs text-gray-500 mt-1">
                    ← v{versions.find((v) => v.id === version.parentVersionId)?.versionNumber ?? '?'} から派生
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Utility Components ============
function Section({
  title,
  helpKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  helpKey?: HelpKey;
  expanded?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <button onClick={onToggle} className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50">
        <HelpLabel label={title} helpKey={helpKey} className="text-sm font-medium text-gray-700" />
        <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function Field({
  label,
  helpKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
}: {
  label: string;
  helpKey?: HelpKey;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block mb-1">
        <HelpLabel label={label} helpKey={helpKey} />
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" />
    </div>
  );
}

function TextArea({
  label,
  helpKey,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  helpKey?: HelpKey;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block mb-1">
        <HelpLabel label={label} helpKey={helpKey} />
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" />
    </div>
  );
}

function Select({
  label,
  helpKey,
  value,
  onChange,
  options,
}: {
  label: string;
  helpKey?: HelpKey;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block mb-1">
        <HelpLabel label={label} helpKey={helpKey} />
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500">{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </div>
  );
}

function ArrayEditor({
  label,
  helpKey,
  values,
  onChange,
}: {
  label: string;
  helpKey?: HelpKey;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [newValue, setNewValue] = useState('');
  const addValue = () => { if (newValue.trim()) { onChange([...values, newValue.trim()]); setNewValue(''); } };
  return (
    <div>
      <label className="block mb-1.5">
        <HelpLabel label={label} helpKey={helpKey} />
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full text-xs">{v}<button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-pink-400 hover:text-pink-600">×</button></span>)}
      </div>
      <div className="flex gap-1.5">
        <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())} placeholder="追加..." className="flex-1 px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-pink-500" />
        <button onClick={addValue} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">追加</button>
      </div>
    </div>
  );
}

function SliderField({
  label,
  helpKey,
  value,
  onChange,
  showValue,
}: {
  label: string;
  helpKey?: HelpKey;
  value: number;
  onChange: (v: number) => void;
  showValue?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1"><label><HelpLabel label={label} helpKey={helpKey} /></label><span className="text-xs text-gray-500">{showValue ?? `${Math.round(value * 100)}%`}</span></div>
      <input type="range" min="0" max="1" step="0.01" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg accent-pink-500" />
    </div>
  );
}
