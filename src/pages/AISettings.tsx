import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  fetchAISettings,
  updateAISetting,
  fetchAILogs,
  fetchAIMemory,
  clearAIMemory,
  fetchAIHealth,
  type AISettings as AISettingsData,
  type AIUsageLog,
  type AIMemoryItem,
} from '../lib/openai';
import {
  Bot,
  Cpu,
  Key,
  BarChart3,
  Brain,
  RefreshCw,
  Save,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Activity,
  Clock,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ── Types & Constants ───────────────────────────────────────────────────────

const PROVIDERS = ['Gemini', 'Groq', 'HuggingFace', 'OpenRouter'] as const;
type Provider = typeof PROVIDERS[number];

const PROVIDER_COLORS: Record<Provider, string> = {
  Gemini:      'hsl(var(--primary))',
  Groq:        '#10b981',
  HuggingFace: '#f59e0b',
  OpenRouter:  '#8b5cf6',
};

const GEMINI_MODELS     = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const GROQ_MODELS       = ['llama3-70b-8192', 'llama3-8b-8192', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma-7b-it'];
const HF_MODELS         = ['mistralai/Mistral-7B-Instruct-v0.3', 'Qwen/Qwen2.5-7B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct'];
const OPENROUTER_MODELS = ['google/gemma-3-27b-it:free', 'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'google/gemini-2.0-flash-exp:free'];

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
  <div className={`glass-card rounded-2xl p-5 border border-border ${className}`}>
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
    {children}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isOk = status === 'running';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isOk ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
      {status === 'running' ? 'Online' : status === 'unconfigured' ? 'Not Configured' : 'Offline'}
    </span>
  );
};

const ModelSelect: React.FC<{
  label: string;
  settingKey: string;
  value: string;
  options: string[];
  onSave: (key: string, value: string) => Promise<void>;
}> = ({ label, settingKey, value, options, onSave }) => {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);

  useEffect(() => setCurrent(value), [value]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(settingKey, current);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className="w-full appearance-none bg-background border border-border rounded-xl py-2.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:border-primary/60 cursor-pointer"
          >
            {options.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all disabled:opacity-50 shrink-0"
        >
          {saved ? <CheckCircle className="w-3.5 h-3.5" /> : saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
};

const KeyInput: React.FC<{
  label: string;
  settingKey: string;
  maskedValue: string;
  onSave: (key: string, value: string) => Promise<void>;
}> = ({ label, settingKey, maskedValue, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [newVal,  setNewVal]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const hasKey = maskedValue && maskedValue !== '';

  const handleSave = async () => {
    if (!newVal.trim()) return;
    setSaving(true);
    await onSave(settingKey, newVal.trim());
    setSaving(false);
    setSaved(true);
    setNewVal('');
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {hasKey ? maskedValue : 'Not configured'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {editing ? (
          <>
            <input
              type="password"
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              placeholder="Paste new key..."
              className="w-40 bg-background border border-border rounded-lg py-1.5 px-2.5 text-xs text-foreground focus:outline-none focus:border-primary/60"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
              {saving ? '...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${hasKey ? 'bg-muted text-muted-foreground hover:text-foreground' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'}`}
          >
            {saved ? '✓ Saved' : hasKey ? 'Rotate' : 'Add Key'}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────

export const AISettings: React.FC = () => {
  const { user, isAdmin, showToast } = useApp();

  // Only admin can access this page
  if (!isAdmin) return <Navigate to="/" replace />;

  const [settings,    setSettings]    = useState<Partial<AISettingsData>>({});
  const [logs,        setLogs]        = useState<AIUsageLog[]>([]);
  const [memory,      setMemory]      = useState<AIMemoryItem[]>([]);
  const [health,      setHealth]      = useState<{ status: string; total_ai_calls: number; keys_configured: number }>({ status: 'checking', total_ai_calls: 0, keys_configured: 0 });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingLogs,     setLoadingLogs]     = useState(true);
  const [clearingMemory,  setClearingMemory]  = useState(false);
  const [savingProvider,  setSavingProvider]  = useState(false);
  const [editingPersona,  setEditingPersona]  = useState(false);
  const [personaDraft,    setPersonaDraft]    = useState('');
  const [savingPersona,   setSavingPersona]   = useState(false);

  const workerUrl = import.meta.env.VITE_AI_WORKER_URL || '';

  // Load all data
  const loadData = useCallback(async () => {
    setLoadingSettings(true);
    setLoadingLogs(true);
    try {
      const [s, l, h] = await Promise.all([
        fetchAISettings(),
        fetchAILogs(100),
        fetchAIHealth(),
      ]);
      setSettings(s);
      setPersonaDraft(s.ai_persona || '');
      setLogs(l);
      setHealth(h);
    } catch (e: any) {
      showToast(e.message || 'Failed to load AI settings', 'error');
    } finally {
      setLoadingSettings(false);
      setLoadingLogs(false);
    }
    if (user?.id) {
      const m = await fetchAIMemory(user.id);
      setMemory(m);
    }
  }, [user, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await updateAISetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
      showToast(`${key} updated`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save setting', 'error');
    }
  };

  const handleProviderChange = async (provider: string) => {
    setSavingProvider(true);
    await handleSaveSetting('ai_provider', provider);
    setSavingProvider(false);
  };

  const handleClearMemory = async () => {
    if (!user?.id) return;
    if (!window.confirm('Clear all AI chat memory? This cannot be undone.')) return;
    setClearingMemory(true);
    try {
      await clearAIMemory(user.id);
      setMemory([]);
      showToast('Chat memory cleared', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to clear memory', 'error');
    } finally {
      setClearingMemory(false);
    }
  };

  const handleSavePersona = async () => {
    setSavingPersona(true);
    await handleSaveSetting('ai_persona', personaDraft);
    setSavingPersona(false);
    setEditingPersona(false);
  };

  // Compute stats from logs
  const last7Days = logs.filter(l => {
    const d = new Date(l.created_at);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const totalTokens  = last7Days.reduce((s, l) => s + l.total_tokens, 0);
  const avgLatency   = last7Days.length > 0 ? Math.round(last7Days.reduce((s, l) => s + l.latency_ms, 0) / last7Days.length) : 0;
  const successRate  = last7Days.length > 0 ? Math.round((last7Days.filter(l => l.success === 1).length / last7Days.length) * 100) : 100;

  // Provider breakdown for chart
  const providerBreakdown = PROVIDERS.map(p => ({
    name: p,
    calls: last7Days.filter(l => l.provider === p).length,
    color: PROVIDER_COLORS[p],
  })).filter(p => p.calls > 0);

  // Endpoint breakdown
  const chatLogs      = last7Days.filter(l => l.endpoint === 'chat');
  const parseLogs     = last7Days.filter(l => l.endpoint === 'parse-statement');

  if (!workerUrl) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">AI Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure and monitor your FinFree AI</p>
        </div>
        <div className="glass-card rounded-2xl p-8 border border-amber-500/20 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground mb-2">Worker Not Configured</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Add <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">VITE_AI_WORKER_URL=https://your-worker.workers.dev</code> to your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file and restart the dev server.
          </p>
          <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open Cloudflare Dashboard →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">AI Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure providers, models, keys and monitor usage</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Health banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center gap-3">
          <StatusBadge status={health.status} />
          <span className="text-xs text-muted-foreground font-mono truncate">{workerUrl}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>🔑 {health.keys_configured} keys configured</span>
          <span>📊 {health.total_ai_calls.toLocaleString('en-IN')} total calls</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Calls (7d)',      value: last7Days.length,                    icon: <Activity className="w-4 h-4" />,   color: 'text-primary' },
          { label: 'Tokens (7d)',     value: totalTokens.toLocaleString('en-IN'), icon: <Zap className="w-4 h-4" />,        color: 'text-amber-400' },
          { label: 'Avg Latency',     value: `${avgLatency}ms`,                   icon: <Clock className="w-4 h-4" />,      color: 'text-blue-400' },
          { label: 'Success Rate',    value: `${successRate}%`,                   icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="glass-card rounded-xl p-4 border border-border">
            <div className={`${color} mb-2`}>{icon}</div>
            <div className="text-lg font-extrabold text-foreground">{value}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Provider Control */}
        <SectionCard title="AI Provider" icon={<Cpu className="w-4 h-4" />}>
          {loadingSettings ? (
            <div className="space-y-2">
              {PROVIDERS.map(p => <div key={p} className="h-10 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {PROVIDERS.map(p => {
                const isActive = (settings.ai_provider || 'Gemini') === p;
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    disabled={savingProvider}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${isActive ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
                      <span className="text-sm font-semibold">{p}</span>
                      {p === 'Gemini' && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">Recommended</span>}
                      {p === 'OpenRouter' && <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded font-bold">Free</span>}
                    </div>
                    {isActive && <CheckCircle className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Model Selectors */}
        <SectionCard title="Models" icon={<Bot className="w-4 h-4" />}>
          {loadingSettings ? (
            <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4">
              <ModelSelect label="Gemini Model"      settingKey="ai_gemini_model"     value={settings.ai_gemini_model     || 'gemini-2.0-flash'}           options={GEMINI_MODELS}     onSave={handleSaveSetting} />
              <ModelSelect label="Groq Model"        settingKey="ai_groq_model"       value={settings.ai_groq_model       || 'llama3-70b-8192'}             options={GROQ_MODELS}       onSave={handleSaveSetting} />
              <ModelSelect label="HuggingFace Model" settingKey="ai_hf_model"         value={settings.ai_hf_model         || 'mistralai/Mistral-7B-Instruct-v0.3'} options={HF_MODELS} onSave={handleSaveSetting} />
              <ModelSelect label="OpenRouter Model"  settingKey="ai_openrouter_model" value={settings.ai_openrouter_model || 'google/gemma-3-27b-it:free'}  options={OPENROUTER_MODELS} onSave={handleSaveSetting} />
            </div>
          )}
        </SectionCard>

        {/* API Key Manager */}
        <SectionCard title="API Keys" icon={<Key className="w-4 h-4" />}>
          {loadingSettings ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1">
              <KeyInput label="Gemini Key 1"      settingKey="ai_key_gemini_1"     maskedValue={settings.ai_key_gemini_1     || ''} onSave={handleSaveSetting} />
              <KeyInput label="Gemini Key 2"      settingKey="ai_key_gemini_2"     maskedValue={settings.ai_key_gemini_2     || ''} onSave={handleSaveSetting} />
              <KeyInput label="Gemini Key 3"      settingKey="ai_key_gemini_3"     maskedValue={settings.ai_key_gemini_3     || ''} onSave={handleSaveSetting} />
              <KeyInput label="Groq Key"          settingKey="ai_key_groq_1"       maskedValue={settings.ai_key_groq_1       || ''} onSave={handleSaveSetting} />
              <KeyInput label="HuggingFace Token" settingKey="ai_key_hf_1"         maskedValue={settings.ai_key_hf_1         || ''} onSave={handleSaveSetting} />
              <KeyInput label="OpenRouter Key"    settingKey="ai_key_openrouter_1" maskedValue={settings.ai_key_openrouter_1 || ''} onSave={handleSaveSetting} />
              <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/40">
                Keys are masked after saving. They are stored securely in Cloudflare D1 and never exposed to the browser.
              </p>
            </div>
          )}
        </SectionCard>

        {/* Usage Chart */}
        <SectionCard title="Usage (Last 7 Days)" icon={<BarChart3 className="w-4 h-4" />}>
          {loadingLogs ? (
            <div className="h-40 bg-muted rounded-xl animate-pulse" />
          ) : last7Days.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No AI calls yet</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="text-lg font-extrabold text-foreground">{chatLogs.length}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Chat calls</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <div className="text-lg font-extrabold text-foreground">{parseLogs.length}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Statement parses</div>
                </div>
              </div>
              {providerBreakdown.length > 0 && (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={providerBreakdown} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: any) => [`${v} calls`, 'Calls']}
                    />
                    <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                      {providerBreakdown.map(p => <Cell key={p.name} fill={p.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </SectionCard>

      </div>

      {/* Recent Logs Table */}
      <SectionCard title="Recent AI Calls" icon={<Activity className="w-4 h-4" />}>
        {loadingLogs ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No logs yet. Start using the AI assistant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {['Time', 'Endpoint', 'Provider', 'Model', 'Tokens', 'Latency', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(log => (
                  <tr key={log.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-2 text-muted-foreground font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${log.endpoint === 'chat' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-400'}`}>
                        {log.endpoint === 'chat' ? 'Chat' : 'Parse'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-foreground font-medium">{log.provider}</td>
                    <td className="py-2 px-2 text-muted-foreground font-mono text-[10px] max-w-[120px] truncate">{log.model}</td>
                    <td className="py-2 px-2 text-foreground">{log.total_tokens.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2 text-muted-foreground">{log.latency_ms}ms</td>
                    <td className="py-2 px-2">
                      {log.success === 1
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Memory Manager + Persona Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <SectionCard title="Chat Memory" icon={<Brain className="w-4 h-4" />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{memory.length} snippets stored (last 30 days)</span>
              {memory.length > 0 && (
                <button
                  onClick={handleClearMemory}
                  disabled={clearingMemory}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {clearingMemory ? 'Clearing...' : 'Clear All'}
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {memory.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-4">No memory stored yet</p>
              ) : (
                memory.map(m => (
                  <div key={m.id} className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      {new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-foreground leading-relaxed">{m.memory}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="AI Persona" icon={<Bot className="w-4 h-4" />}>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Customize the AI's system prompt. Use <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">{'{{name}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">{'{{salary}}'}</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">{'{{goals}}'}</code> etc. as placeholders.
            </p>
            {editingPersona ? (
              <>
                <textarea
                  value={personaDraft}
                  onChange={e => setPersonaDraft(e.target.value)}
                  rows={8}
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-xs text-foreground font-mono focus:outline-none focus:border-primary/60 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePersona}
                    disabled={savingPersona}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                  >
                    {savingPersona ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {savingPersona ? 'Saving...' : 'Save Persona'}
                  </button>
                  <button onClick={() => setEditingPersona(false)} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-muted/30 rounded-xl p-3 max-h-36 overflow-y-auto">
                  <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                    {settings.ai_persona?.slice(0, 400) || 'No persona set'}
                    {(settings.ai_persona?.length || 0) > 400 ? '...' : ''}
                  </pre>
                </div>
                <button
                  onClick={() => setEditingPersona(true)}
                  className="w-full py-2 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                >
                  Edit Persona
                </button>
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
