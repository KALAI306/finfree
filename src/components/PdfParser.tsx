import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import { addTransaction } from "../lib/db";
import { parseStatementWithAI } from "../lib/openai";
import { FileText, Upload, Check, Clipboard, Sparkles, RefreshCw, Bot, AlertCircle, Zap } from "lucide-react";

interface ParsedTx {
  date: string;
  note: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  account_id: string;
  approved: boolean;
}

const SAMPLE_SBI_TEXT = `2026-06-02  UPI/DR/ZOMATO/FOOD/948291  120.00
2026-06-04  AURAGOLD SAVINGS GOLD VAULT  1500.00
2026-06-05  VS REDDY FUEL BENGALURU  1000.00
2026-06-08  NEFT/SALARY/INFOSYS TECH  20000.00
2026-06-10  ATM WDL CASH HSR SEC 2  2000.00
2026-06-12  SUNTV DTH DIRECT PAY  350.00`;

const SAMPLE_IOB_TEXT = `03-Jun-26  SWIGGY IN/FOOD ORDER  380.00  DR
05-Jun-26  TRAYA HEALTH HAIR CLINIC  1200.00  DR
08-Jun-26  UPI/CR/RAJASHAKER WAGES  1500.00  CR
10-Jun-26  AMAZON IN SELLER DEALS  850.00  DR
12-Jun-26  GURUSAMY MASON WORK  2200.00  DR`;

const CATEGORIES = [
  "Food 🍕","Fuel ⛽","Rent/PG 🏠","EMI 💳","Healthcare 🏥",
  "Shopping 🛍️","Recharges 📱","Gold Investment 🥇","Daily Workers 👷",
  "Salary 💼","Other Income 🎁","Transfer 💸","Cash Withdrawal 💸","Miscellaneous 🎯",
];

// ── Regex-based fallback parser ──────────────────────────────────────────────

function autoCategorize(note: string): { category: string; type: "income" | "expense" } {
  const n = note.toUpperCase();
  if (n.includes("AURAGOLD")) return { category: "Gold Investment 🥇", type: "expense" };
  if (n.includes("ZOMATO") || n.includes("SWIGGY") || n.includes("BLINKIT") || n.includes("FOOD"))
    return { category: "Food 🍕", type: "expense" };
  if (n.includes("FUEL") || n.includes("PETROL") || n.includes("TVS"))
    return { category: "Fuel ⛽", type: "expense" };
  if (n.includes("TRAYA") || n.includes("HEALTH") || n.includes("CLINIC") || n.includes("PHARMA"))
    return { category: "Healthcare 🏥", type: "expense" };
  if (n.includes("DTH") || n.includes("AIRTEL") || n.includes("JIO") || n.includes("RECHARGE") || n.includes("SUNTV"))
    return { category: "Recharges 📱", type: "expense" };
  if (n.includes("AMAZON") || n.includes("FLIPKART") || n.includes("LENSKART") || n.includes("SHOPPING"))
    return { category: "Shopping 🛍️", type: "expense" };
  if (n.includes("ATM") || n.includes("WDL") || n.includes("WITHDRAW"))
    return { category: "Cash Withdrawal 💸", type: "expense" };
  if (n.includes("EMI") || n.includes("LOAN"))
    return { category: "EMI 💳", type: "expense" };
  if (n.includes("NEFT") || n.includes("UPI/CR") || n.includes("SALARY") || n.includes("CREDIT"))
    return { category: "Salary 💼", type: "income" };
  if (n.match(/\b(MASON|WORKER|WAGES|LABOUR)\b/))
    return { category: "Daily Workers 👷", type: "expense" };
  if (n.includes("UPI/DR") || n.includes("DR"))
    return { category: "Miscellaneous 🎯", type: "expense" };
  return { category: "Miscellaneous 🎯", type: "expense" };
}

function parseWithRegex(text: string, accountId: string): ParsedTx[] {
  const results: ParsedTx[] = [];
  const sbiRe = /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\d+(?:\.\d{1,2})?)$/;
  const iobRe = /^(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+(.+?)\s+(\d+(?:\.\d{1,2})?)\s+(DR|CR)$/i;
  const hdRe  = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d+(?:\.\d{1,2})?)\s+(Dr|Cr)$/i;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const sbi = line.match(sbiRe);
    const iob = line.match(iobRe);
    const hd  = line.match(hdRe);

    if (sbi) {
      const { category, type } = autoCategorize(sbi[2]);
      results.push({ date: sbi[1], note: sbi[2], amount: +sbi[3], type, category, account_id: accountId, approved: true });
    } else if (iob) {
      const crDr = iob[4].toUpperCase();
      const type: "income" | "expense" = crDr === "CR" ? "income" : "expense";
      const { category } = autoCategorize(iob[2]);
      let date = new Date().toISOString().split("T")[0];
      try { const d = new Date(iob[1]); if (!isNaN(d.getTime())) date = d.toISOString().split("T")[0]; } catch {}
      results.push({ date, note: iob[2], amount: +iob[3], type, category: crDr === "CR" ? "Other Income 🎁" : category, account_id: accountId, approved: true });
    } else if (hd) {
      const crDr = hd[4].toLowerCase();
      const type: "income" | "expense" = crDr === "cr" ? "income" : "expense";
      const parts = hd[1].split("/");
      const date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      const { category } = autoCategorize(hd[2]);
      results.push({ date, note: hd[2], amount: +hd[3], type, category: type === "income" ? "Other Income 🎁" : category, account_id: accountId, approved: true });
    }
  }
  return results;
}

// ── Local (API-free) deterministic parser ────────────────────────────────────
// Parses real Indian bank statement tables entirely in-browser — no network,
// no LLM, no truncation limits. Handles multiple layouts (SBI, IOB, Axis, HDFC,
// ICICI…) by grouping each transaction's wrapped lines into one date-anchored
// "block", then deciding income vs expense by priority:
//   1. Debit/Credit column with a "-" placeholder  (order-independent)
//   2. explicit DR/CR marker
//   3. running-balance delta (needs chronological rows)
//   4. keyword fallback

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad2 = (n: number) => String(n).padStart(2, "0");

const AMOUNT_G = /\d[\d,]*\.\d{2}/g;                                  // all amounts (match-all)
const AMOUNT_1 = /\d[\d,]*\.\d{2}/;                                   // presence test
// Debit | Credit | Balance triple, where the empty money column shows as "-".
const COLS_G = /(-|\d[\d,]*\.\d{2})\s+(-|\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})/g;
const toNum = (s: string) => +s.replace(/,/g, "");

// End-of-statement markers (halt collecting) and pure-noise lines (drop).
const STOP = /\b(transaction total|closing balance|effective available|computer generated|does not require|constituent notifies|statement summary|registered office|branch address)\b/i;
const SKIP = /^(balance|wdl tfr|dep tfr|withdrawal|deposit|page no\.?.*|page \d+ of.*)$/i;

// Match a date at the START of a line; return ISO date + remaining text, or null.
function matchLeadingDate(line: string): { iso: string; rest: string } | null {
  let m: RegExpMatchArray | null;

  // YYYY-MM-DD
  m = line.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, rest: line.slice(m[0].length) };

  // DD/MM/YYYY or DD-MM-YYYY (2- or 4-digit year)
  m = line.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m) {
    const d = +m[1], mo = +m[2]; let y = +m[3];
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12)
      return { iso: `${y}-${pad2(mo)}-${pad2(d)}`, rest: line.slice(m[0].length) };
  }

  // DD MMM YYYY / DD-MMM-YY  (e.g. "03 Jun 2026", "03-Jun-26")
  m = line.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{2,4})\b/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const d = +m[1]; let y = +m[3];
    if (y < 100) y += 2000;
    if (mo && d >= 1 && d <= 31)
      return { iso: `${y}-${pad2(mo)}-${pad2(d)}`, rest: line.slice(m[0].length) };
  }

  return null;
}

// Strip amounts, columns, ref/branch codes and boilerplate to a readable note.
function cleanNote(text: string): string {
  return text
    .replace(COLS_G, " ").replace(AMOUNT_G, " ")
    .replace(/\bAT \d{3,} .*/i, " ")             // "AT 07589 ACB CHITTAR…" branch tail
    .replace(/\bS\d{6,}\b/g, " ").replace(/\b\d{6,}\b/g, " ")
    .replace(/\bTransfer\b|\bWDL\b|\bTFR\b|\bDEP\b|\bDR\b|\bCR\b/gi, " ")
    .replace(/\(\s*\)/g, " ").replace(/[|]+/g, " ").replace(/\s[-\/]\s/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 80);
}

function parseStatementLocal(text: string, accountId: string): ParsedTx[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Seed the opening balance if present anywhere (it may be 0 / ".00" and off a date row).
  let prevBalance: number | null = null;
  for (const line of lines) {
    if (/\bopening balance\b/i.test(line)) {
      const nn = line.match(AMOUNT_G)?.map(toNum);
      prevBalance = nn && nn.length ? nn[0] : 0;
      break;
    }
  }

  // Group wrapped lines into date-anchored blocks.
  const blocks: { iso: string; text: string }[] = [];
  for (const line of lines) {
    if (STOP.test(line)) { if (blocks.length) break; else continue; }
    if (SKIP.test(line)) continue;
    // Column-header row ("Date … Debit Credit Balance") with no amounts.
    if (/\bdate\b/i.test(line)
      && /\b(balance|debit|credit|withdrawal|deposit|particulars|narration|description)\b/i.test(line)
      && !AMOUNT_1.test(line)) continue;

    const dm = matchLeadingDate(line);
    if (dm) {
      let rest = dm.rest.trim();
      const vd = matchLeadingDate(rest); // drop a second (value) date
      if (vd) rest = vd.rest.trim();
      blocks.push({ iso: dm.iso, text: rest });
    } else if (blocks.length) {
      blocks[blocks.length - 1].text += " " + line; // wrapped continuation
    }
  }

  const out: ParsedTx[] = [];
  for (const b of blocks) {
    const blockText = b.text.replace(/\s+/g, " ").trim();
    const nums = blockText.match(AMOUNT_G)?.map(toNum) ?? [];
    if (!nums.length) continue;
    const balance = nums[nums.length - 1];

    // Last Debit|Credit|Balance triple on the row (dash = the empty column).
    let colMatch: RegExpExecArray | null = null, m: RegExpExecArray | null;
    COLS_G.lastIndex = 0;
    while ((m = COLS_G.exec(blockText)) !== null) colMatch = m;
    const colDash = !!colMatch && ((colMatch[1] === "-") !== (colMatch[2] === "-"));

    const drcr = blockText.match(/\b(DR|CR)\b/i)?.[1]?.toUpperCase();

    let type: "income" | "expense" | null = null;
    let colAmount: number | null = null;
    if (colDash && colMatch) {
      if (colMatch[2] === "-") { type = "expense"; colAmount = toNum(colMatch[1]); }
      else { type = "income"; colAmount = toNum(colMatch[2]); }
    } else if (drcr) {
      type = drcr === "CR" ? "income" : "expense";
    }

    let amount: number;
    if (colAmount != null) {
      amount = colAmount;
    } else if (prevBalance !== null && nums.length >= 2) {
      const delta = +(balance - prevBalance).toFixed(2);
      if (type === null) type = delta >= 0 ? "income" : "expense";
      amount = Math.abs(delta) || nums[nums.length - 2];
    } else {
      amount = nums.length >= 2 ? nums[nums.length - 2] : nums[0];
      if (type === null) type = autoCategorize(blockText).type;
    }
    prevBalance = balance;
    if (!(amount > 0)) continue;

    const finalType: "income" | "expense" = type ?? autoCategorize(blockText).type;
    const note = cleanNote(blockText) || "Bank transaction";
    const cat = autoCategorize(note);
    const category = finalType === "income"
      ? (cat.type === "income" ? cat.category : "Other Income 🎁")
      : cat.category;

    out.push({ date: b.iso, note, amount, type: finalType, category, account_id: accountId, approved: true });
  }

  return out;
}

// ── PDF text extraction ──────────────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruct visual table rows from item geometry instead of flattening the
    // whole page into one blob. Each item's transform is [a,b,c,d,x,y]; group by y
    // (page top = larger y), then order left→right by x. This keeps each statement
    // row on its own line — the prerequisite for reliable parsing.
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      const s = (it.str ?? "").trim();
      if (!s || !it.transform) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5); // tolerate line wobble
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const line = r.items.map((it) => it.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    }
  }
  return lines.join("\n");
}

// ── Friendly OpenAI error ────────────────────────────────────────────────────

function openAiErrorMsg(e: any): string {
  const msg: string = e?.message || "";
  if (msg.includes("insufficient_quota"))
    return "OpenAI quota exhausted — add credits at platform.openai.com/billing, then try again.";
  if (msg.includes("429"))
    return "Rate limit hit. Wait a moment and try again.";
  if (msg.includes("401"))
    return "Invalid API key — check VITE_OPENAI_API_KEY in .env.";
  return `AI error: ${msg}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PdfParser: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, accounts, showToast, refreshData, fmt: formatIndianCurrency } = useApp();

  const [mode, setMode] = useState<"pdf" | "paste">("pdf");
  const [pasteText, setPasteText] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || "");
  const [parsedList, setParsedList] = useState<ParsedTx[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = async (text: string) => {
    if (!selectedAccount) { showToast("Select a target account first", "warning"); return; }
    if (!text.trim()) { showToast("No text to parse", "warning"); return; }

    setIsProcessing(true);
    setUsedFallback(false);
    setStatusMsg("Parsing statement on your device…");

    // 1. Local, API-free parser first — deterministic, offline, private, no limits.
    let results = parseStatementLocal(text, selectedAccount);

    // 2. Safety net: the older idealized single-line formats.
    if (!results.length) results = parseWithRegex(text, selectedAccount);

    // 3. Only if local parsing finds nothing, optionally try the AI worker.
    let viaAI = false;
    if (!results.length) {
      try {
        setStatusMsg("Trying AI parser…");
        const aiTxs = await parseStatementWithAI(text);
        if (aiTxs.length > 0) {
          viaAI = true;
          results = aiTxs.map(r => ({ ...r, account_id: selectedAccount, approved: true }));
        }
      } catch (e: any) {
        // AI is optional and off the critical path — surface but don't block.
        showToast(openAiErrorMsg(e), "warning");
      }
    }

    setUsedFallback(viaAI);
    setIsProcessing(false);
    setStatusMsg("");

    if (!results.length) {
      showToast("Could not find any transactions. Try the Paste Text tab with the transaction rows.", "error");
      return;
    }
    setParsedList(results);
    setStep(2);
    showToast(`Found ${results.length} transactions${viaAI ? " (AI)" : " · parsed locally"}`, "success");
  };

  const handlePdfUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { showToast("Please upload a PDF file", "error"); return; }
    setPdfFile(file);
    setIsProcessing(true);
    setStatusMsg("Extracting text from PDF…");
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) { showToast("No text found — PDF may be scanned/image-only", "error"); setIsProcessing(false); setStatusMsg(""); return; }
      setStatusMsg("Text extracted. Parsing with AI…");
      await processText(text);
    } catch (e: any) {
      showToast(`PDF error: ${e.message}`, "error");
      setIsProcessing(false);
      setStatusMsg("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePdfUpload(file);
  };

  const handleImport = async () => {
    const approved = parsedList.filter(tx => tx.approved);
    if (!approved.length) { showToast("No transactions selected", "warning"); return; }
    setIsProcessing(true);
    setStatusMsg(`Importing ${approved.length}…`);
    try {
      for (const tx of approved) {
        await addTransaction({ user_id: user!.id, account_id: tx.account_id, type: tx.type, amount: tx.amount, category: tx.category, note: tx.note, date: tx.date, is_recurring: false });
      }
      await refreshData();
      showToast(`Imported ${approved.length} transactions!`, "success");
      onClose();
    } catch {
      showToast("Import failed", "error");
    } finally {
      setIsProcessing(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="space-y-4 text-foreground">
      {step === 1 ? (
        <div className="space-y-4">
          {/* Banner */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/8 border border-primary/20">
            <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">On-device parsing</span> — upload a PDF or paste text. Transactions are read locally on your device (offline, private, no limits) for SBI, HDFC, ICICI, IOB & most Indian banks. AI is only tried if local parsing finds nothing.
            </p>
          </div>

          {/* Account */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Account</label>
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-sm focus:outline-none focus:border-primary/50">
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatIndianCurrency(a.balance)})</option>)}
            </select>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
            {(["pdf", "paste"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${mode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "pdf" ? "Upload PDF" : "Paste Text"}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop} onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all ${
                dragOver ? "border-primary bg-primary/8 scale-[1.01]"
                : isProcessing ? "border-border bg-muted/20 cursor-not-allowed"
                : "border-border/60 hover:border-primary/40 hover:bg-muted/20 cursor-pointer"}`}>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }} disabled={isProcessing} />

              {isProcessing ? (
                <>
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-foreground text-center">{statusMsg}</p>
                  <p className="text-[11px] text-muted-foreground">Reading transactions on your device…</p>
                </>
              ) : pdfFile ? (
                <>
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{pdfFile.name}</p>
                  <p className="text-[11px] text-muted-foreground">Click to change file</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Drop PDF here or click to browse</p>
                    <p className="text-[11px] text-muted-foreground mt-1">SBI, HDFC, ICICI, IOB, Axis, Kotak — any bank</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea rows={7} value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your bank statement text here…"
                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-foreground text-xs font-mono focus:outline-none focus:border-primary/50 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setPasteText(SAMPLE_SBI_TEXT)}
                  className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer">
                  <Clipboard className="w-3.5 h-3.5" /> SBI Sample
                </button>
                <button onClick={() => setPasteText(SAMPLE_IOB_TEXT)}
                  className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer">
                  <Clipboard className="w-3.5 h-3.5" /> IOB Sample
                </button>
              </div>
              <button onClick={() => processText(pasteText)} disabled={isProcessing || !pasteText.trim()}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
                {isProcessing
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />{statusMsg}</>
                  : <><Sparkles className="w-4 h-4" />Parse Statement</>}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Step 2: Review */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Review Transactions</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] text-muted-foreground">{parsedList.filter(t => t.approved).length} of {parsedList.length} selected</p>
                {usedFallback && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                    <Zap className="w-2.5 h-2.5" />AI parser
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={() => setParsedList(prev => prev.map(t => ({ ...t, approved: true })))} className="text-primary hover:text-primary/80 font-semibold cursor-pointer">All</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setParsedList(prev => prev.map(t => ({ ...t, approved: false })))} className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer">None</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => { setStep(1); setPdfFile(null); }} className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer">← Back</button>
            </div>
          </div>

          {usedFallback && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300/80 leading-relaxed">
                Local parsing found no rows for this layout, so the AI parser was used. Please double-check the amounts and income/expense direction below before importing.
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
            {parsedList.map((tx, idx) => (
              <div key={idx}
                className={`border rounded-xl p-3 flex gap-3 items-center transition-all ${tx.approved ? "bg-muted/30 border-border" : "bg-muted/10 border-border/40 opacity-50"}`}>
                <input type="checkbox" checked={tx.approved}
                  onChange={e => { const n = [...parsedList]; n[idx].approved = e.target.checked; setParsedList(n); }}
                  className="w-4 h-4 rounded cursor-pointer accent-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate m-0">{tx.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 m-0">{tx.date}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={tx.category}
                    onChange={e => {
                      const n = [...parsedList]; n[idx].category = e.target.value;
                      const incomes = ["Salary 💼","Other Income 🎁"];
                      n[idx].type = incomes.includes(e.target.value) ? "income" : "expense";
                      setParsedList(n);
                    }}
                    className="bg-background border border-border rounded-lg py-0.5 px-1 text-[10px] text-foreground focus:outline-none max-w-[100px]">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className={`text-xs font-bold tabular-nums ${tx.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatIndianCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button onClick={() => { setStep(1); setPdfFile(null); }}
              className="flex-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold py-2.5 rounded-xl text-sm cursor-pointer">
              Cancel
            </button>
            <button onClick={handleImport} disabled={isProcessing || !parsedList.some(t => t.approved)}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 cursor-pointer">
              {isProcessing
                ? <><RefreshCw className="w-4 h-4 animate-spin" />{statusMsg}</>
                : <><Check className="w-4 h-4" />Import {parsedList.filter(t => t.approved).length}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
