import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, X, Sparkles, RefreshCw, Plus, Target, ArrowUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { chatWithAI, buildContextStr } from '../../lib/openai';
import {
  addTransaction, updateTransaction, deleteTransaction,
  addGoal, updateGoal, deleteGoal,
  addAccount, updateAccount, deleteAccount,
  addInvestment, updateInvestment, deleteInvestment,
  addEmi, updateEmi, deleteEmi,
} from '../../lib/db';

const QUICK_PROMPTS = [
  'How is my net worth trending?',
  'Am I on track for freedom?',
  'Review my EMI health',
  'Break down my spending',
  'Top saving tips for me',
  'Add ₹500 food expense today',
];

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isLoading?: boolean;
}

export const FloatingAiAssistant: React.FC = () => {
  const { user, profile, accounts, transactions, investments, emis, goals, refreshData } = useApp();

  const [isOpen,     setIsOpen]     = useState(false);
  const [input,      setInput]      = useState('');
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const chatRef    = useRef<HTMLDivElement>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        if (!(e.target as Element).closest('.ai-fab')) setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userId = user?.id || '';

  // Execute DB tool calls returned by the worker
  const handleToolCall = useCallback(async (name: string, args: Record<string, any>): Promise<string> => {
    if (!user?.id) return 'Error: not logged in';
    const uid = user.id;
    const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

    // ── Transactions ──
    if (name === 'add_transaction') {
      const accountId = args.account_id && accounts.find(a => a.id === args.account_id)
        ? args.account_id : accounts[0]?.id;
      if (!accountId) return 'Error: no account found. Please create an account first.';
      await addTransaction({ user_id: uid, account_id: accountId, type: args.type, amount: Number(args.amount), category: args.category, note: args.note, date: args.date, is_recurring: false });
      await refreshData();
      return `Transaction added: ${args.type === 'income' ? '+' : '-'}${fmt(args.amount)} for "${args.note}" on ${args.date}`;
    }
    if (name === 'update_transaction') {
      await updateTransaction({ id: args.id, ...(args.amount !== undefined && { amount: Number(args.amount) }), ...(args.category && { category: args.category }), ...(args.note && { note: args.note }), ...(args.date && { date: args.date }) });
      await refreshData();
      return `Transaction updated successfully.`;
    }
    if (name === 'delete_transaction') {
      await deleteTransaction(args.id);
      await refreshData();
      return `Transaction deleted successfully.`;
    }

    // ── Goals ──
    if (name === 'add_goal') {
      await addGoal({ user_id: uid, name: args.name, target_amount: Number(args.target_amount), current_amount: Number(args.current_amount || 0), deadline: args.deadline || null });
      await refreshData();
      return `Goal "${args.name}" created with target ${fmt(args.target_amount)}`;
    }
    if (name === 'update_goal_progress') {
      const goal = goals.find(g => g.id === args.goal_id);
      if (!goal) return 'Goal not found';
      const newAmount = Number(goal.current_amount) + Number(args.add_amount);
      await updateGoal({ id: args.goal_id, current_amount: newAmount });
      await refreshData();
      return `Added ${fmt(args.add_amount)} to "${goal.name}". Now ${fmt(newAmount)} / ${fmt(goal.target_amount)}`;
    }
    if (name === 'update_goal') {
      await updateGoal({ id: args.id, ...(args.name && { name: args.name }), ...(args.target_amount !== undefined && { target_amount: Number(args.target_amount) }), ...(args.deadline && { deadline: args.deadline }) });
      await refreshData();
      return `Goal updated successfully.`;
    }
    if (name === 'delete_goal') {
      await deleteGoal(args.id);
      await refreshData();
      return `Goal deleted successfully.`;
    }

    // ── Accounts ──
    if (name === 'create_account') {
      await addAccount({ user_id: uid, name: args.name, type: args.type, balance: Number(args.balance) });
      await refreshData();
      return `Account "${args.name}" created with balance ${fmt(args.balance)}`;
    }
    if (name === 'update_account') {
      await updateAccount({ id: args.id, ...(args.name && { name: args.name }), ...(args.balance !== undefined && { balance: Number(args.balance) }) });
      await refreshData();
      return `Account updated successfully.`;
    }
    if (name === 'delete_account') {
      await deleteAccount(args.id);
      await refreshData();
      return `Account deleted successfully.`;
    }

    // ── Investments ──
    if (name === 'add_investment') {
      await addInvestment({ user_id: uid, name: args.name, type: args.type, quantity: null, invested_amount: Number(args.invested_amount), current_value: Number(args.current_value), return_percent: args.current_value && args.invested_amount ? ((args.current_value - args.invested_amount) / args.invested_amount * 100) : 0 });
      await refreshData();
      return `Investment "${args.name}" added. Invested: ${fmt(args.invested_amount)}, Current value: ${fmt(args.current_value)}`;
    }
    if (name === 'update_investment') {
      await updateInvestment({ id: args.id, ...(args.current_value !== undefined && { current_value: Number(args.current_value) }), ...(args.name && { name: args.name }) });
      await refreshData();
      return `Investment updated successfully.`;
    }
    if (name === 'delete_investment') {
      await deleteInvestment(args.id);
      await refreshData();
      return `Investment deleted successfully.`;
    }

    // ── EMIs ──
    if (name === 'add_emi') {
      await addEmi({ user_id: uid, name: args.name, emi_amount: Number(args.emi_amount), principal: Number(args.principal), interest_rate: Number(args.interest_rate || 0), tenure_months: Number(args.tenure_months), start_date: args.start_date, paid_months: 0 });
      await refreshData();
      return `EMI "${args.name}" added. ${fmt(args.emi_amount)}/month for ${args.tenure_months} months.`;
    }
    if (name === 'update_emi') {
      await updateEmi({ id: args.id, ...(args.name && { name: args.name }), ...(args.emi_amount !== undefined && { emi_amount: Number(args.emi_amount) }), ...(args.paid_months !== undefined && { paid_months: Number(args.paid_months) }) });
      await refreshData();
      return `EMI updated successfully.`;
    }
    if (name === 'delete_emi') {
      await deleteEmi(args.id);
      await refreshData();
      return `EMI deleted successfully.`;
    }

    return `Unknown tool: ${name}`;
  }, [user, accounts, goals, refreshData]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setError(null);
    setInput('');
    setMessages(prev => [
      ...prev,
      { role: 'user',      text: trimmed },
      { role: 'assistant', text: '', isLoading: true },
    ]);
    setIsThinking(true);

    try {
      // Build compact context string from current financial data
      const contextStr = buildContextStr(profile, accounts, transactions, investments, emis, goals);
      const reply = await chatWithAI(trimmed, userId, contextStr, handleToolCall);
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', text: reply }]);
    } catch (e: any) {
      const msg = e.message || '';
      const errMsg =
        msg.includes('VITE_AI_WORKER_URL')       ? 'AI Worker not configured. Contact your admin.' :
        msg.includes('All AI providers failed')   ? 'All AI providers failed — admin needs to add API keys.' :
        msg.includes('429') || msg.includes('Too many') ? 'Rate limit hit. Wait a moment and try again.' :
        `Error: ${msg}`;
      setError(errMsg);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, profile, accounts, transactions, investments, emis, goals, userId, handleToolCall]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => { setMessages([]); setError(null); };

  const formatText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (line.startsWith('## '))              return <p key={i} className="font-bold text-foreground mt-2 mb-0.5 text-xs">{line.slice(3)}</p>;
      if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="pl-2 text-xs leading-relaxed m-0">· {line.slice(2)}</p>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-foreground text-xs m-0">{line.slice(2, -2)}</p>;
      if (line === '')                          return <div key={i} className="h-1" />;
      return <p key={i} className="text-xs leading-relaxed m-0">{line}</p>;
    });

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-50">
      {/* FAB */}
      <button
        className="ai-fab relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer"
        onClick={() => setIsOpen(o => !o)}
        aria-label="FinFree AI"
        style={{
          background:  'linear-gradient(135deg, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.65))',
          boxShadow:   '0 0 20px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.2)',
          border:      '1px solid hsl(var(--primary) / 0.3)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
        <div className="relative z-10 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
          {isOpen ? <X className="w-5 h-5 text-primary-foreground" /> : <Bot className="w-6 h-6 text-primary-foreground" />}
        </div>
        {!isOpen && <div className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: 'hsl(var(--primary))' }} />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={chatRef}
          className="absolute bottom-16 right-0 w-[340px] md:w-[400px] origin-bottom-right"
          style={{ animation: 'popIn 0.22s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
        >
          <div
            className="flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: 'rgba(8,8,20,0.95)', backdropFilter: 'blur(24px)', maxHeight: '520px' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'hsl(var(--primary)/0.15)', border: '1px solid hsl(var(--primary)/0.25)' }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-none">FinFree AI</p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">Your financial assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clearChat} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer" title="Clear chat">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Ask anything or take actions — I can add transactions, create goals, and more.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(p)}
                        className="text-left text-[11px] px-2.5 py-2 rounded-xl border border-white/6 bg-white/3 hover:bg-white/8 hover:border-primary/25 transition-all text-muted-foreground hover:text-foreground leading-tight cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { icon: ArrowUpDown, label: 'Add transactions' },
                      { icon: Target,      label: 'Create goals'     },
                      { icon: Plus,        label: 'Track progress'   },
                    ].map(({ icon: Icon, label }) => (
                      <span key={label} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-primary/8 border border-primary/15 text-primary/70 font-medium">
                        <Icon className="w-2.5 h-2.5" />{label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 border border-white/8 rounded-bl-sm">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(j => (
                              <div key={j} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">Thinking…</span>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl ${
                            m.role === 'user'
                              ? 'text-primary-foreground rounded-br-sm text-xs'
                              : 'bg-white/6 border border-white/8 text-foreground rounded-bl-sm space-y-0.5'
                          }`}
                          style={m.role === 'user' ? { background: 'hsl(var(--primary))' } : {}}
                        >
                          {m.role === 'assistant' ? formatText(m.text) : <p className="text-xs m-0">{m.text}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  {error && (
                    <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                      {error}
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/8 space-y-2 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={isThinking}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-xs text-foreground placeholder-muted-foreground resize-none outline-none focus:border-primary/40 focus:bg-white/8 transition-all disabled:opacity-50"
                  placeholder={isThinking ? 'Thinking…' : 'Ask anything or say "Add ₹500 food expense"…'}
                  style={{ scrollbarWidth: 'none' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isThinking}
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                  style={{ background: 'hsl(var(--primary))', boxShadow: '0 4px 12px hsl(var(--primary)/0.35)' }}
                >
                  {isThinking
                    ? <RefreshCw className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                    : <Send className="w-3.5 h-3.5 text-primary-foreground" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                <kbd className="px-1 py-0.5 bg-white/8 border border-white/10 rounded text-[9px]">Enter</kbd> send ·{' '}
                <kbd className="px-1 py-0.5 bg-white/8 border border-white/10 rounded text-[9px]">Shift+Enter</kbd> new line
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
};
