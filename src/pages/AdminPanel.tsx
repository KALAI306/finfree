import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  adminGetAllProfiles,
  adminGetUserSummary,
  adminResetUser,
  adminDeleteUserProfile,
  type Profile,
} from "../lib/db";
import { formatIndianCurrency } from "../lib/utils";
import {
  Shield,
  Users,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  CreditCard,
  Target,
  Landmark,
  CircleDollarSign,
  AlertTriangle,
} from "lucide-react";

interface UserSummary {
  accounts: any[];
  transactions: any[];
  investments: any[];
  emis: any[];
  goals: any[];
}

interface UserRow {
  profile: Profile;
  summary: UserSummary | null;
  expanded: boolean;
  loading: boolean;
}

export const AdminPanel: React.FC = () => {
  const { isAdmin, showToast } = useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ type: "reset" | "delete"; userId: string; name: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    loadProfiles();
  }, [isAdmin]);

  const loadProfiles = async () => {
    setFetching(true);
    try {
      const profiles = await adminGetAllProfiles();
      setRows(profiles.map((p) => ({ profile: p, summary: null, expanded: false, loading: false })));
    } catch (err) {
      showToast("Failed to load users", "error");
    } finally {
      setFetching(false);
    }
  };

  const toggleExpand = async (userId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.profile.id !== userId) return r;
        if (r.expanded) return { ...r, expanded: false };
        return { ...r, expanded: true };
      })
    );

    const row = rows.find((r) => r.profile.id === userId);
    if (!row?.summary) {
      setRows((prev) => prev.map((r) => r.profile.id === userId ? { ...r, loading: true } : r));
      try {
        const summary = await adminGetUserSummary(userId);
        setRows((prev) => prev.map((r) => r.profile.id === userId ? { ...r, summary, loading: false } : r));
      } catch {
        setRows((prev) => prev.map((r) => r.profile.id === userId ? { ...r, loading: false } : r));
      }
    }
  };

  const handleReset = async () => {
    if (!confirmAction || confirmAction.type !== "reset") return;
    try {
      await adminResetUser(confirmAction.userId);
      showToast(`Reset ${confirmAction.name}'s data`, "success");
      setRows((prev) => prev.map((r) =>
        r.profile.id === confirmAction.userId
          ? { ...r, summary: null, profile: { ...r.profile, monthly_salary: 0, family_debt: 0 } }
          : r
      ));
    } catch {
      showToast("Reset failed", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    try {
      await adminDeleteUserProfile(confirmAction.userId);
      showToast(`Deleted ${confirmAction.name}'s profile`, "success");
      setRows((prev) => prev.filter((r) => r.profile.id !== confirmAction.userId));
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setConfirmAction(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Shield className="w-12 h-12 opacity-30" />
        <p className="text-sm">Admin access required.</p>
      </div>
    );
  }

  const totalUsers = rows.length;
  const totalSalary = rows.reduce((s, r) => s + Number(r.profile.monthly_salary), 0);
  const totalDebt = rows.reduce((s, r) => s + Number(r.profile.family_debt), 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Full control over all users &amp; data</p>
        </div>
        <button
          onClick={loadProfiles}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Total Users", value: totalUsers.toString(), color: "text-blue-400" },
          { icon: CircleDollarSign, label: "Total Monthly Income", value: formatIndianCurrency(totalSalary), color: "text-emerald-400" },
          { icon: AlertTriangle, label: "Total Debt Tracked", value: formatIndianCurrency(totalDebt), color: "text-rose-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="hero-card p-4">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="hero-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">All Users</span>
          <span className="ml-auto text-xs text-muted-foreground">{totalUsers} accounts</span>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading users…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No users yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const isAdminUser = row.profile.is_admin;
              const totalIncome = row.summary?.transactions
                .filter((t) => t.type === "income")
                .reduce((s: number, t: any) => s + Number(t.amount), 0) ?? null;
              const totalExpense = row.summary?.transactions
                .filter((t) => t.type === "expense")
                .reduce((s: number, t: any) => s + Number(t.amount), 0) ?? null;

              return (
                <div key={row.profile.id}>
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {row.profile.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{row.profile.name}</span>
                        {isAdminUser && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Age {row.profile.age} · Salary {formatIndianCurrency(row.profile.monthly_salary)}/mo · Debt {formatIndianCurrency(row.profile.family_debt)}
                      </p>
                    </div>

                    {/* Action buttons */}
                    {!isAdminUser && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmAction({ type: "reset", userId: row.profile.id, name: row.profile.name })}
                          className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: "delete", userId: row.profile.id, name: row.profile.name })}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400/50 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpand(row.profile.id)}
                      className="ml-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {row.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {row.expanded && (
                    <div className="px-5 pb-4 bg-white/[0.02]">
                      {row.loading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading data…
                        </div>
                      ) : row.summary ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          {[
                            { icon: Landmark, label: "Accounts", value: row.summary.accounts.length.toString() },
                            { icon: CreditCard, label: "Transactions", value: row.summary.transactions.length.toString() },
                            { icon: TrendingUp, label: "Investments", value: row.summary.investments.length.toString() },
                            { icon: Target, label: "Goals", value: row.summary.goals.length.toString() },
                          ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="bg-muted/30 rounded-xl p-3 flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-sm font-bold text-foreground">{value}</p>
                                <p className="text-[10px] text-muted-foreground">{label}</p>
                              </div>
                            </div>
                          ))}
                          {totalIncome !== null && (
                            <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                              <p className="text-xs text-muted-foreground">Total Income</p>
                              <p className="text-sm font-bold text-emerald-400">{formatIndianCurrency(totalIncome)}</p>
                            </div>
                          )}
                          {totalExpense !== null && (
                            <div className="col-span-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                              <p className="text-xs text-muted-foreground">Total Expenses</p>
                              <p className="text-sm font-bold text-rose-400">{formatIndianCurrency(totalExpense)}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-2">Failed to load summary.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="hero-card p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction.type === "delete" ? "bg-rose-500/10" : "bg-amber-500/10"}`}>
                {confirmAction.type === "delete"
                  ? <Trash2 className="w-5 h-5 text-rose-400" />
                  : <RefreshCw className="w-5 h-5 text-amber-400" />
                }
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {confirmAction.type === "delete" ? "Delete User?" : "Reset User Data?"}
                </p>
                <p className="text-xs text-muted-foreground">{confirmAction.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction.type === "delete"
                ? "This will permanently delete their profile and all financial data. Cannot be undone."
                : "This will wipe all their transactions, accounts, investments, goals, and EMIs. Profile stays but resets to zero."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 text-sm font-semibold border border-border rounded-xl text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.type === "delete" ? handleDelete : handleReset}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white transition-colors cursor-pointer ${
                  confirmAction.type === "delete" ? "bg-rose-500 hover:bg-rose-600" : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {confirmAction.type === "delete" ? "Delete" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
