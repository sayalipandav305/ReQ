import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  Search, Upload, X, FileText, ChevronDown, Check, Star, RotateCcw, Loader2, BookOpen, Focus,
  Copy, StickyNote, ChevronLeft, ChevronRight, Trophy, Trash2, Sparkles, LogOut, FilePlus2,
} from "lucide-react";
import {
  comparePapers, getMe, getSubjects, isLoggedIn, login, logout, register, createSubject,
  deleteSubject, askReQAI, type Subject, type User,
} from "./services/api";

/* ---------- types ---------- */
interface NestedItem { item: string; text: string }
interface Question {
  question_number: string; main_question: number; sub_question: string | null;
  question: string; marks: number | null; page_number: number; unit: number | null;
  nested_items?: NestedItem[]; paper_id: string; paper_name: string;
}
interface Occurrence { paper_id: string; paper_name: string; question_number: string; marks: number | null; page_number: number }
interface RepeatedQuestion {
  unit: number | null; question: string; marks: number[]; repeated: number;
  occurrences: Occurrence[]; nested_items?: NestedItem[];
}
interface CompareResponse {
  success: boolean; papers: any[]; total_papers: number; total_questions: number;
  questions: Question[]; repeated_questions: RepeatedQuestion[];
}
type Item = Question & { id: string; count: number; occ: Occurrence[]; papers: Set<string> };

const TABS = [["study", "Study"], ["repeated", "Repeated"], ["matrix", "Matrix"], ["units", "Units"], ["papers", "Papers"]] as const;
type Tab = (typeof TABS)[number][0];
type Status = "todo" | "done" | "starred" | "all";
type Sort = "priority" | "number" | "marks";

type AIAnswerMode = "exam" | "learn" | "revise";

const AI_MODES: {
  id: AIAnswerMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "exam",
    label: "Exam",
    icon: "✍️",
    description: "Write this in your exam",
  },
  {
    id: "learn",
    label: "Learn",
    icon: "🧠",
    description: "Understand the concept",
  },
  {
    id: "revise",
    label: "Revise",
    icon: "⚡",
    description: "Quick points to remember",
  },
];

/* ---------- design tokens ---------- */
// ink #263040 · pen red #b4473f · paper #f5f7fb · rule #dde4f0 · tick green #4f7f6a · marker #e9e4d0
const INK = "text-[#263040]";
const DARK = "bg-[#263040] text-white hover:bg-[#35425a]";
const INPUT = "h-12 w-full rounded-lg border border-slate-200 bg-white px-4 outline-none transition focus:border-[#263040]";
const FD = "fd";

/* ---------- helpers ---------- */
const clean = (n: string) => n.replace(/\.pdf$/i, "").replace(/[-_]/g, " ").trim();
const qid = (q: { unit: number | null; question: string; nested_items?: NestedItem[] }) =>
  `${q.unit}-${q.question.trim().toLowerCase()}-${(q.nested_items || []).map((i) => `${i.item}:${i.text}`).join("|")}`;

function useSavedSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* storage unavailable */ }
  }, [key, set]);
  const toggle = (id: string) =>
    setSet((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return [set, toggle] as const;
}

function useNotes(key = "req-notes") {
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(notes)); } catch { /* storage unavailable */ }
  }, [key, notes]);
  return [notes, (id: string, v: string) => setNotes((c) => ({ ...c, [id]: v }))] as const;
}

const heat = (n: number) => (n >= 3 ? "High" : n === 2 ? "Medium" : null);

/* ---------- signature element: red-pen tally marks (one mark = one paper it appeared in) ---------- */
const Group = ({ k, slash }: { k: number; slash?: boolean }) => (
  <span className="relative inline-flex gap-[3px]">
    {Array.from({ length: k }, (_, i) => <i key={i} className="block h-4 w-[2px] rounded-full bg-[#b4473f]" />)}
    {slash && <i className="absolute -left-[3px] -right-[3px] top-1/2 h-[2px] -rotate-[28deg] rounded-full bg-[#b4473f]" />}
  </span>
);
function Tally({ n, className = "" }: { n: number; className?: string }) {
  const full = Math.min(Math.floor(n / 5), 3), rest = n >= 20 ? 0 : n % 5;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`} aria-label={`Asked ${n} times`}>
      {Array.from({ length: full }, (_, i) => <Group key={i} k={4} slash />)}
      {rest > 0 && <Group k={rest} />}
      {n >= 20 && <b className="text-sm text-[#b4473f]">×{n}</b>}
    </span>
  );
}

/* signature element: one square per uploaded paper, dark when the question appeared in it */
function Strip({ ids, has, className = "" }: { ids: string[]; has: Set<string>; className?: string }) {
  return (
    <span className={`flex flex-wrap gap-[3px] ${className}`} role="img" aria-label={`Appears in ${ids.filter((i) => has.has(i)).length} of ${ids.length} papers`}>
      {ids.map((id, i) => <i key={id} className={`sq block h-2.5 w-2.5 rounded-[3px] ${has.has(id) ? "on bg-[#b4473f]" : "bg-[#e6e9ef]"}`} style={{ animationDelay: `${i * 50}ms` }} />)}
    </span>
  );
}
const Demo = () => {
  const rows = [[1, 1, 0, 1, 1], [0, 1, 0, 0, 1], [1, 0, 0, 0, 0]], w = ["w-11/12", "w-3/4", "w-5/6"];
  return (
    <div aria-hidden className="mt-8 max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex gap-[3px]">{r.map((v, j) => <i key={j} className={`sq block h-2.5 w-2.5 rounded-[3px] ${v ? "bg-[#b4473f]" : "bg-[#e6e9ef]"}`} style={{ animationDelay: `${(i * 5 + j) * 70}ms` }} />)}</div>
          <div className={`h-2 rounded-full bg-[#e6e9ef] ${w[i]}`} />
        </div>
      ))}
      <p className="pt-1 text-xs text-slate-500">One square per paper. Dark means the question appeared in it.</p>
    </div>
  );
};

/* ---------- AI answer formatting ---------- */
function renderAIAnswer(text: string) {
  const inline = (v: string) =>
    v.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") && p.length > 4
        ? <strong key={i} className="font-semibold text-[#263040] [background:linear-gradient(transparent_60%,#e9e4d0_60%)]">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>
    );
  return text.split(/\r?\n/).map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="h-2" />;
    if (/^#{1,3}\s+/.test(t))
      return <h3 key={i} className={`${FD} mb-1 mt-6 border-b-2 border-[#b4473f]/70 pb-1 text-lg font-semibold text-[#263040] first:mt-0`}>{inline(t.replace(/^#{1,3}\s+/, ""))}</h3>;
    const num = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (num)
      return (
        <div key={i} className="my-2 flex gap-3">
          <span className={`${FD} w-6 shrink-0 text-right text-lg font-semibold text-[#b4473f]`}>{num[1]}.</span>
          <p className="min-w-0 flex-1 leading-7 text-slate-700">{inline(num[2])}</p>
        </div>
      );
    const b = t.match(/^[-*•]\s+(.*)$/);
    if (b)
      return (
        <div key={i} className="my-1.5 flex gap-3 pl-1">
          <span className="mt-3 h-[2px] w-3 shrink-0 bg-[#b4473f]" />
          <p className="min-w-0 flex-1 leading-7 text-slate-700">{inline(b[1])}</p>
        </div>
      );
    return <p key={i} className="my-2 leading-7 text-slate-700">{inline(t)}</p>;
  });
}

/* ---------- question card ---------- */
function Card({ q, paperIds, done, starred, note, onDone, onStar, onNote, onAskAI }: {
  paperIds: string[];
  q: Item; done: boolean; starred: boolean; note: string;
  onDone: () => void; onStar: () => void; onNote: (v: string) => void; onAskAI: (q: Item) => void;
}) {
  const [open, setOpen] = useState(false);
  const nested = q.nested_items || [];
  const level = heat(q.count);
  const chip = "rounded-2xl bg-[#eef0f4] px-2 py-0.5 text-xs font-semibold text-slate-600";

  return (
    <article className={`grid grid-cols-[3.5rem_1fr_auto] overflow-hidden rounded-2xl border transition ${done ? "border-[#4f7f6a]/40 bg-[#f1faf5]" : "border-[#263040] bg-white shadow-sm"}`}>
      {/* margin column */}
      <div className="flex flex-col items-center gap-4 border-r border-slate-200 bg-[#f3f5f8] py-4">
        <button
          onClick={onDone} aria-label={done ? "Mark as not done" : "Mark as done"} aria-pressed={done}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#263040] ${done ? "border-[#4f7f6a] bg-[#4f7f6a] text-white" : "border-slate-300 text-transparent hover:border-[#4f7f6a] hover:text-[#4f7f6a]/40"}`}
        >
          <Check size={16} strokeWidth={3} />
        </button>
        <Strip ids={paperIds} has={q.papers} className="w-[2.25rem] justify-center" />
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className={chip}>Q{q.question_number.replace(/^q/i, "")}</span>
          {q.unit !== null && <span className={chip}>Unit {q.unit}</span>}
          {q.marks !== null && <span className={chip}>{q.marks} marks</span>}
          {level && (
            <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${level === "High" ? "border-[#b4473f]/40 bg-[#fbf1f0] text-[#8f3630]" : "border-[#263040]/40 text-[#263040]/60"}`}>
              Asked {q.count}× · {level} priority
            </span>
          )}
        </div>

        <p className={`fd text-[19px] leading-[1.55] ${done ? "text-slate-500 line-through decoration-[#4f7f6a]/50" : INK} ${level === "High" && !done ? "[background:linear-gradient(transparent_62%,#e9e4d0_62%,#e9e4d0_92%,transparent_92%)] [box-decoration-break:clone] inline" : ""}`}>
          {q.question}
        </p>

        {open && (
          <div className="mt-4 space-y-3">
            <textarea
              value={note} onChange={(e) => onNote(e.target.value)} rows={3}
              placeholder="Your notes: formula, hint, answer outline…"
              className="w-full resize-y rounded-2xl border border-dashed border-[#263040]/25 bg-[#f6f4ea] p-3 text-sm outline-none focus:border-[#263040]"
            />
            {nested.length > 0 && (
              <ul className="space-y-1.5 border-l-2 border-[#263040]/20 pl-4 text-[15px] text-slate-600">
                {nested.map((n) => <li key={n.item} className="flex gap-2"><b className="text-[#b4473f]">{n.item})</b>{n.text}</li>)}
              </ul>
            )}
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">{q.count > 1 ? `Found in ${q.count} papers` : "Found in"}</p>
              <ul className="space-y-1">
                {q.occ.map((o, i) => (
                  <li key={i} className="rounded-2xl bg-[#eef0f4] px-3 py-1.5 text-xs text-slate-600">
                    <b className="text-[#263040]">{clean(o.paper_name)}</b> — Q{o.question_number.replace(/^q/i, "")}
                    {o.marks !== null && `, ${o.marks} marks`}, page {o.page_number}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <button
            onClick={() => onAskAI(q)} disabled={q.marks === null}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${DARK}`}
          >
            <Sparkles size={15} /> Ask ReQ{q.marks !== null && <span className="rounded-full bg-white/15 px-2 text-xs">{q.marks} marks</span>}
          </button>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1 font-semibold hover:text-[#263040]">
            <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
            {open ? "Hide details" : nested.length ? `Parts & papers (${nested.length})` : "Papers"}
          </button>
          <span className="truncate">{clean(q.paper_name)}, p.{q.page_number}</span>
          {note && <StickyNote size={13} className="shrink-0 text-amber-500" aria-label="Has notes" />}
        </div>
      </div>

      <button
        onClick={onStar} aria-label={starred ? "Remove from revise list" : "Add to revise list"} aria-pressed={starred}
        className={`m-3 flex h-9 w-9 items-center justify-center rounded-full transition ${starred ? "bg-[#e9e4d0] text-[#263040]" : "text-slate-300 hover:text-[#263040]"}`}
      >
        <Star size={18} fill={starred ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

/* ---------- focus mode ---------- */
function FocusMode({ list, done, starred, onDone, onStar, onExit }: {
  list: Item[]; done: Set<string>; starred: Set<string>;
  onDone: (id: string) => void; onStar: (id: string) => void; onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const q = list[i];
  const go = (d: number) => setI((c) => Math.min(Math.max(c + d, 0), list.length - 1));
  const markDone = () => { if (!q) return; if (!done.has(q.id)) { onDone(q.id); go(1); } else onDone(q.id); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight" || e.key === "j") go(1);
      else if (e.key === "ArrowLeft" || e.key === "k") go(-1);
      else if (e.key === "d") markDone();
      else if (e.key === "s" && q) onStar(q.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!q) return null;
  const isDone = done.has(q.id);
  const btn = "flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30";

  return (
    <div role="dialog" aria-label="Focus mode" className="fixed inset-0 z-50 flex flex-col bg-[#263040] text-white">
      <div className="flex items-center gap-4 px-5 py-4">
        <span className="text-sm font-semibold">{i + 1} / {list.length}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#e9e4d0] transition-all" style={{ width: `${((i + 1) / list.length) * 100}%` }} />
        </div>
        <button onClick={onExit} aria-label="Exit focus mode" className="text-white/70 hover:text-white"><X size={20} /></button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center overflow-y-auto px-6 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-3 text-xs font-semibold">
          {q.unit !== null && <span className="rounded-2xl bg-white/10 px-2 py-1">Unit {q.unit}</span>}
          {q.marks !== null && <span className="rounded-2xl bg-white/10 px-2 py-1">{q.marks} marks</span>}
          {q.count > 1 && <span className="rounded-2xl bg-white/10 px-2 py-1"><Tally n={q.count} /></span>}
        </div>
        <p className={`${FD} text-3xl font-semibold leading-[1.3] sm:text-4xl`}>{q.question}</p>
        {(q.nested_items || []).length > 0 && (
          <ul className="mt-6 space-y-2 border-l-2 border-white/20 pl-4 text-lg text-white/80">
            {q.nested_items!.map((n) => <li key={n.item}><b className="mr-2 text-[#c9d3e6]">{n.item})</b>{n.text}</li>)}
          </ul>
        )}
        <p className="mt-6 text-sm text-white/50">{q.occ.map((o) => clean(o.paper_name)).join(", ")}</p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 pb-4">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous" className={btn}><ChevronLeft /></button>
        <button onClick={markDone} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold transition ${isDone ? "bg-[#4f7f6a]" : "bg-white text-[#263040] hover:bg-slate-100"}`}>
          <Check size={18} strokeWidth={3} /> {isDone ? "Done" : "Mark done & next"}
        </button>
        <button onClick={() => onStar(q.id)} aria-label="Revise later" aria-pressed={starred.has(q.id)} className={`${btn} ${starred.has(q.id) ? "text-[#c9d3e6]" : ""}`}>
          <Star fill={starred.has(q.id) ? "currentColor" : "none"} />
        </button>
        <button onClick={() => go(1)} disabled={i === list.length - 1} aria-label="Next" className={btn}><ChevronRight /></button>
      </div>
      <p className="hidden pb-5 text-center text-xs text-white/40 sm:block">← → move · D done · S revise later · Esc exit</p>
    </div>
  );
}

/* ---------- page shell: ruled notebook paper with one red margin line ---------- */
const Shell = ({ children }: { children: ReactNode }) => (
  <div
    className={`relative min-h-screen ${INK}`}
    style={{ fontFamily: "'Schibsted Grotesk', system-ui, sans-serif", backgroundColor: "#f6f7f9", backgroundImage: "repeating-linear-gradient(transparent 0 31px,#e9ecf2 31px 32px)" }}
  >
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap');
      .fd{font-family:'Literata',Georgia,serif;letter-spacing:-0.01em;font-weight:500}
      @keyframes sq{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}} .sq{animation:sq .45s cubic-bezier(.2,.8,.2,1) both}
      @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`}</style>
    <i className="pointer-events-none fixed inset-y-0 left-[calc(50%-34rem)] hidden w-[2px] bg-[#b4473f]/30 xl:block" />
    {children}
  </div>
);

const Logo = ({ size = "h-9 w-9" }: { size?: string }) => (
  <span className="flex items-center gap-2.5">
    <span className={`${FD} flex ${size} items-center justify-center rounded-lg bg-[#263040] text-lg font-semibold text-white`}>R</span>
    <span className={`${FD} text-xl font-semibold`}>ReQ</span>
  </span>
);

/* ---------- auth ---------- */
function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { const data = mode === "login" ? await login(email, password) : await register(name, email, password); onAuthenticated(data.user); }
    catch (err: any) { setError(err?.message || "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };
  return (
    <Shell>
      <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Logo />
          <h1 className={`${FD} mt-8 text-5xl leading-[1.08] sm:text-6xl`}>Your exam keeps repeating itself.</h1>
          <p className="mt-5 max-w-sm text-lg leading-7 text-slate-600">Upload past papers and see which questions come back, year after year.</p>
          <Demo />
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-[#eef0f4] p-1">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full py-2.5 text-sm font-semibold transition ${mode === m ? "bg-[#263040] text-white" : "text-slate-500"}`}>
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className={INPUT} /></label>
          )}
          <label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={INPUT} /></label>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-50 ${DARK}`}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </main>
    </Shell>
  );
}

/* ---------- subjects: notebook covers ---------- */
const COVERS = ["#8a9bb8", "#6f8f86", "#b4a98a", "#9a8fb0", "#7f9fb5", "#a8b0bd"];

function SubjectScreen({ user, onSelect, onLogout }: { user: User; onSelect: (s: Subject) => void; onLogout: () => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState(""); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    getSubjects().then(setSubjects).catch((e) => setError(e?.message || "Couldn't load subjects.")).finally(() => setLoading(false));
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { setError(""); const s = await createSubject(name.trim()); setSubjects((c) => [s, ...c]); setName(""); onSelect(s); }
    catch (e: any) { setError(e?.message || "Couldn't create subject."); }
  };

  const handleDelete = async (e: MouseEvent, subject: Subject) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${subject.name}"?\n\nThis will permanently delete this subject.`)) return;
    try { setDeletingId(subject.id); setError(""); await deleteSubject(subject.id); setSubjects((c) => c.filter((s) => s.id !== subject.id)); }
    catch (e: any) { setError(e?.message || "Couldn't delete subject."); }
    finally { setDeletingId(null); }
  };

  return (
    <Shell>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">Hi, {user.name}</span>
            <button onClick={onLogout} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ring-slate-200 hover:ring-[#263040]"><LogOut size={14} /> Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className={`${FD} text-4xl font-semibold sm:text-5xl`}>Pick a subject</h1>
        <p className="mt-3 max-w-xl text-slate-600">Each subject keeps its own papers, progress and notes.</p>

        <form onSubmit={add} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New subject, e.g. DBMS" className={`${INPUT} flex-1`} />
          <button disabled={!name.trim()} className={`h-12 rounded-full px-7 font-semibold disabled:opacity-40 ${DARK}`}>Add subject</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="mt-12 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" /></div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s, i) => (
              <div key={s.id} className="group relative overflow-hidden rounded-r-md rounded-l-sm border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="absolute inset-y-0 left-0 w-5" style={{ background: COVERS[i % COVERS.length] }} />
                <button onClick={() => onSelect(s)} className="block w-full py-6 pl-11 pr-14 text-left">
                  <BookOpen size={20} className="text-slate-400" />
                  <h2 className={`${FD} mt-8 text-2xl font-semibold`}>{s.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">Open workspace</p>
                </button>
                <button
                  onClick={(e) => handleDelete(e, s)} disabled={deletingId === s.id} aria-label={`Delete ${s.name}`} title="Delete subject"
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={17} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}

/* ---------- analyzer ---------- */
interface AnalyzerAppProps { user: User; subject: Subject; onLogout: () => void; onBackToSubjects: () => void }

function AnalyzerApp({ user, subject, onLogout, onBackToSubjects }: AnalyzerAppProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const [tab, setTab] = useState<Tab>("study");
  const [status, setStatus] = useState<Status>("todo");
  const [unit, setUnit] = useState<number | "all">("all");
  const [paper, setPaper] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [search, setSearch] = useState("");

  const [done, toggleDone] = useSavedSet(`req-done-${user.id}-${subject.id}`);
  const [starred, toggleStar] = useSavedSet(`req-starred-${user.id}-${subject.id}`);
  const [notes, setNote] = useNotes(`req-notes-${user.id}-${subject.id}`);
  const [focusList, setFocusList] = useState<Item[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [aiQuestion, setAiQuestion] = useState<Item | null>(null);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMode, setAiMode] = useState<AIAnswerMode>("exam");
  const [aiCopied, setAiCopied] = useState(false);

  const aiKey = `req-ai-answers-${user.id}-${subject.id}`;
  const [savedAIAnswers, setSavedAIAnswers] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(aiKey) || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(aiKey, JSON.stringify(savedAIAnswers)); } catch { /* storage unavailable */ }
  }, [savedAIAnswers, aiKey]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    setFiles((cur) => [...cur, ...pdfs].filter((f, i, a) => i === a.findIndex((o) => o.name === f.name && o.size === f.size)));
    setError("");
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

  const analyze = async () => {
    if (files.length < 2) return setError("Add at least 2 papers so repeats can be found.");
    try {
      setLoading(true); setError("");
      setResult((await comparePapers(files, subject.id)) as CompareResponse);
      setTab("study"); setStatus("todo"); setUnit("all"); setPaper("all"); setSearch("");
    } catch (e: any) {
      setError(e?.message || "Couldn't analyze these papers. Check that the PDFs are readable and try again.");
    } finally { setLoading(false); }
  };

 const askAI = async (
  q: Item,
  mode: AIAnswerMode = aiMode
) => {
  if (q.marks === null) {
    setAiError("This question does not have marks information.");
    return;
  }

  setAiQuestion(q);
  setAiMode(mode);
  setAiAnswer("");
  setAiError("");
  setAiCopied(false);
  setAiLoading(true);

  try {
    const nestedItems = q.nested_items || [];

    const nestedText = nestedItems
      .map((n) => `${n.item}) ${n.text}`)
      .join("\n");

    const fullQuestion = nestedItems.length
      ? `${q.question.trim()}

SUBQUESTIONS:
${nestedText}

IMPORTANT:
This question contains multiple subquestions.
Answer EACH subquestion separately.
Do NOT combine the answers.
Use the exact subquestion labels.
`
      : q.question.trim();

    const data = await askReQAI(
      fullQuestion,
      q.marks,
      subject.name,
      q.unit,
      mode
    );

    const answer = data.answer || "";

    setAiAnswer(answer);

    setSavedAIAnswers((c) =>
      c[q.id]
        ? { ...c, [q.id]: answer }
        : c
    );
  } catch (e: any) {
    setAiError(
      e?.message ||
        "Couldn't generate the answer. Make sure Ollama is running."
    );
  } finally {
    setAiLoading(false);
  }
};

  const copyAIAnswer = async () => {
    if (!aiAnswer) return;
    try { await navigator.clipboard.writeText(aiAnswer); setAiCopied(true); setTimeout(() => setAiCopied(false), 1800); }
    catch { setAiError("Couldn't copy the answer. Please try again."); }
  };
  const toggleSaveAIAnswer = () => {
    if (!aiQuestion || !aiAnswer) return;
    setSavedAIAnswers((c) => { const n = { ...c }; if (n[aiQuestion.id]) delete n[aiQuestion.id]; else n[aiQuestion.id] = aiAnswer; return n; });
  };
  const closeAI = () => { if (aiLoading) return; setAiQuestion(null); setAiAnswer(""); setAiError(""); setAiCopied(false); };
  const reset = () => { setFiles([]); setResult(null); setError(""); };

  /* one list of unique questions, with repeat info merged in */
  const items = useMemo<Item[]>(() => {
    if (!result) return [];
    const reps = new Map(result.repeated_questions.map((r) => [qid(r), r]));
    const seen = new Map<string, Item>();
    result.questions.forEach((q) => {
      const id = qid(q);
      if (seen.has(id)) return;
      const r = reps.get(id);
      const occ = r ? r.occurrences : [{ paper_id: q.paper_id, paper_name: q.paper_name, question_number: q.question_number, marks: q.marks, page_number: q.page_number }];
      seen.set(id, { ...q, id, count: r?.repeated ?? 1, occ, papers: new Set(occ.map((o) => o.paper_id)) });
    });
    return [...seen.values()];
  }, [result]);

  const units = useMemo(() => [...new Set(items.map((i) => i.unit).filter((u): u is number => u !== null))].sort((a, b) => a - b), [items]);
  const papers = useMemo(() => { const m = new Map<string, string>(); result?.questions.forEach((q) => m.set(q.paper_id, q.paper_name)); return [...m]; }, [result]);

  const doneCount = items.filter((i) => done.has(i.id)).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items
      .filter((i) =>
        (tab !== "repeated" || i.count > 1) &&
        (unit === "all" || i.unit === unit) &&
        (paper === "all" || i.papers.has(paper)) &&
        (status === "all" || (status === "done" ? done.has(i.id) : status === "starred" ? starred.has(i.id) : !done.has(i.id))) &&
        (!s || `${i.question} ${i.question_number} ${(i.nested_items || []).map((n) => n.text).join(" ")}`.toLowerCase().includes(s))
      )
      .sort((a, b) =>
        sort === "marks" ? (b.marks ?? 0) - (a.marks ?? 0)
        : sort === "number" ? a.main_question - b.main_question || (a.sub_question || "").localeCompare(b.sub_question || "")
        : b.count - a.count || (b.marks ?? 0) - (a.marks ?? 0)
      );
  }, [items, tab, unit, paper, status, search, sort, done, starred]);

  const copyRevise = async () => {
    const text = items.filter((i) => starred.has(i.id)).map((i, n) => `${n + 1}. ${i.question}${i.unit !== null ? ` (Unit ${i.unit})` : ""}`).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const next = items.filter((i) => !done.has(i.id)).sort((a, b) => b.count - a.count)[0];
  const jump = (t: Tab, u?: number, p?: string) => { setTab(t); setUnit(u ?? "all"); setPaper(p ?? "all"); setStatus("all"); };
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? "bg-[#263040] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-[#263040]/40"}`;

  /* ---------- upload screen ---------- */
  if (!result) {
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          <div className="mb-10 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-slate-200">{subject.name}</span>
              <button onClick={onBackToSubjects} className="flex items-center gap-1.5 px-2 py-1.5 font-medium text-slate-500 hover:text-[#263040]"><BookOpen size={14} /> Subjects</button>
              <button onClick={onLogout} className="px-2 py-1.5 font-medium text-slate-500 hover:text-[#263040]">Log out</button>
            </div>
          </div>

          <h1 className={`${FD} text-4xl leading-[1.1] sm:text-6xl`}>Find the questions your exam keeps asking.</h1>
          <p className="mt-4 max-w-lg text-lg leading-7 text-slate-600">Upload past papers. ReQ marks every repeat with a tally, ranks the likely ones first and gives you a checklist.</p>
          <Demo />

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center transition ${dragging ? "border-[#b4473f] bg-[#f3f5f8]" : "border-slate-300 hover:border-[#263040]"}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e4d0]"><Upload size={20} /></span>
              <span className={`${FD} mt-4 text-xl font-semibold`}>Drop PDFs here or click to choose</span>
              <span className="mt-1 text-sm text-slate-500">Add 2 or more papers from {subject.name}</span>
              <input type="file" accept=".pdf" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)} />
            </label>

            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-2xl bg-[#eef0f4] px-3 py-2.5 text-sm">
                    <FileText size={16} className="shrink-0 text-[#b4473f]" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-slate-400 hover:text-slate-900"><X size={16} /></button>
                  </li>
                ))}
              </ul>
            )}

            {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button onClick={analyze} disabled={loading || files.length < 2} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold transition disabled:opacity-40 ${DARK}`}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Reading papers…" : files.length < 2 ? `Add ${2 - files.length} more paper${files.length ? "" : "s"}` : `Find repeats in ${files.length} papers`}
            </button>
          </div>
        </main>
      </Shell>
    );
  }

  /* ---------- results ---------- */
  const stats = [
    { l: "Repeated", v: items.filter((i) => i.count > 1).length },
    { l: "High priority left", v: items.filter((i) => i.count >= 3 && !done.has(i.id)).length },
    { l: "Revise later", v: starred.size },
  ];

  return (
    <Shell>
      {aiQuestion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#263040]/60 p-3 backdrop-blur-sm sm:p-5" onClick={closeAI}>
          <div role="dialog" aria-modal="true" aria-label="ReQ AI answer" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#e9e4d0] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className={`${FD} flex items-center gap-2 text-xl font-semibold`}><Sparkles size={18} /> Ask ReQ</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                  {aiQuestion.marks !== null && <span className="rounded-2xl bg-[#263040] px-2 py-1 text-white">{aiQuestion.marks} marks</span>}
                  {aiQuestion.unit !== null && <span className="rounded-2xl bg-white/70 px-2 py-1">Unit {aiQuestion.unit}</span>}
                  <span className="rounded-2xl bg-white/70 px-2 py-1">{subject.name}</span>
                  {aiQuestion.count > 1 && <span className="rounded-2xl bg-white/70 px-2 py-1">Asked {aiQuestion.count}×</span>}
                </div>
              </div>
              <button onClick={closeAI} disabled={aiLoading} aria-label="Close AI answer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-40"><X size={18} /></button>
            </div>

            <div className="border-b border-slate-200 bg-[#f3f5f8] px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold text-[#b4473f]">Q{aiQuestion.question_number.replace(/^q/i, "")}</p>
              <p className="mt-1 font-semibold leading-6">{aiQuestion.question}</p>
              {aiQuestion.nested_items && aiQuestion.nested_items.length > 0 && (
                <div className="mt-3 space-y-1.5 border-l-2 border-[#b4473f]/40 pl-3">
                  {aiQuestion.nested_items.map((n) => (
                    <div key={n.item} className="flex gap-2 text-sm leading-6 text-slate-700"><b className="shrink-0">{n.item})</b><span>{n.text}</span></div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6a7b9c]">
        How do you want this answer?
      </p>
      <p className="mt-1 text-xs text-slate-400">
        ReQ will change the answer style for you.
      </p>
    </div>

    <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
      AI mode
    </span>
  </div>

  <div className="grid grid-cols-3 gap-2">
    {AI_MODES.map((mode) => {
      const active = aiMode === mode.id;

      return (
        <button
          key={mode.id}
          onClick={() => {
            if (!aiLoading) {
              setAiMode(mode.id);
              askAI(aiQuestion, mode.id);
            }
          }}
          disabled={aiLoading}
          className={`group rounded-2xl border p-3 text-left transition-all ${
            active
              ? "border-[#263040] bg-[#263040] text-white shadow-sm"
              : "border-slate-200 bg-[#f8f9fb] text-[#263040] hover:border-[#6a7b9c]/50 hover:bg-[#f3f5f8]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {mode.icon}
            </span>

            <span className="text-sm font-bold">
              {mode.label}
            </span>

            {active && (
              <Check
                size={14}
                className="ml-auto"
                strokeWidth={3}
              />
            )}
          </div>

          <p
            className={`mt-1 text-[10px] leading-4 ${
              active
                ? "text-white/65"
                : "text-slate-400"
            }`}
          >
            {mode.description}
          </p>
        </button>
      );
    })}
  </div>
</div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {aiLoading ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <Loader2 size={28} className="animate-spin text-[#b4473f]" />
                  <p className={`${FD} mt-4 text-lg font-semibold`}>Writing your {aiQuestion.marks}-mark answer…</p>
                  <p className="mt-1 text-sm text-slate-500">This runs locally, so it can take a moment.</p>
                </div>
              ) : aiError ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                  <p className={`${FD} text-lg font-semibold`}>The answer didn't generate</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{aiError}</p>
                  <button onClick={() => askAI(aiQuestion)} className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${DARK}`}><RotateCcw size={15} /> Try again</button>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm font-semibold text-slate-500">Structured for {aiQuestion.marks} marks</p>
                  <div className="text-[15px]">{renderAIAnswer(aiAnswer)}</div>
                  <p className="mt-6 rounded-2xl bg-[#f6f4ea] px-4 py-3 text-xs leading-5 text-amber-900"><b>Check before you write it.</b> Compare this answer with your class notes or textbook.</p>
                </>
              )}
            </div>

            {!aiLoading && !aiError && aiAnswer && (
              <div className="flex flex-col gap-3 border-t-2 border-[#263040] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <button onClick={copyAIAnswer} className="inline-flex items-center gap-2 rounded-full bg-[#eef0f4] px-4 py-2.5 text-sm font-semibold hover:bg-[#e6e9ef]">
                    {aiCopied ? <><Check size={15} className="text-[#4f7f6a]" /> Copied</> : <><Copy size={15} /> Copy answer</>}
                  </button>
                  <button onClick={toggleSaveAIAnswer} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${savedAIAnswers[aiQuestion.id] ? "bg-[#e9e4d0]" : "bg-[#eef0f4] hover:bg-[#e6e9ef]"}`}>
                    <Star size={15} fill={savedAIAnswers[aiQuestion.id] ? "currentColor" : "none"} /> {savedAIAnswers[aiQuestion.id] ? "Saved" : "Save answer"}
                  </button>
                  <button onClick={() => askAI(aiQuestion)} className="inline-flex items-center gap-2 rounded-full bg-[#eef0f4] px-4 py-2.5 text-sm font-semibold hover:bg-[#e6e9ef]"><RotateCcw size={15} /> Regenerate</button>
                </div>
                <button onClick={() => toggleDone(aiQuestion.id)} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${done.has(aiQuestion.id) ? "bg-[#4f7f6a]/15 text-[#4f7f6a]" : DARK}`}>
                  <Check size={16} strokeWidth={3} /> {done.has(aiQuestion.id) ? "Completed" : "Mark completed"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {focusList && <FocusMode list={focusList} done={done} starred={starred} onDone={toggleDone} onStar={toggleStar} onExit={() => setFocusList(null)} />}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Logo size="h-8 w-8" />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e6e9ef]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#4f7f6a] transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="whitespace-nowrap text-sm font-semibold">{doneCount}/{items.length}</span>
          </div>
          <span className="hidden rounded-full bg-[#eef0f4] px-3 py-1.5 text-xs font-semibold md:inline">{subject.name}</span>
          <button onClick={onBackToSubjects} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#263040]"><BookOpen size={14} /><span className="hidden sm:inline">Subjects</span></button>
          <button onClick={reset} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#263040]"><FilePlus2 size={14} /><span className="hidden sm:inline">New papers</span></button>
          <button onClick={onLogout} aria-label="Log out" className="text-slate-500 hover:text-[#263040]"><LogOut size={15} /></button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {TABS.map(([v, l]) => (
            <button key={v} onClick={() => jump(v)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === v ? "border-[#b4473f] text-[#263040]" : "border-transparent text-slate-500 hover:text-[#263040]"}`}>
              {l}
              {v === "repeated" && <span className="ml-1.5 rounded-full bg-[#e9e4d0] px-1.5 text-xs">{items.filter((i) => i.count > 1).length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        {(tab === "study" || tab === "repeated") && (
          <>
            {tab === "study" && pct === 100 && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-[#4f7f6a] p-5 text-white"><Trophy /><p className={`${FD} text-lg font-semibold`}>Every question done. Nice work.</p></div>
            )}

            {tab === "study" && (
              <section className="mb-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
                <div className="col-span-2 flex items-center gap-4 border-b border-slate-200 p-5 sm:col-span-1 sm:border-b-0">
                  <svg width="60" height="60" viewBox="0 0 36 36" className="shrink-0 -rotate-90" aria-hidden>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e6e9ef" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#4f7f6a" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} className="transition-all duration-700" />
                  </svg>
                  <div><p className={`${FD} text-3xl font-semibold`}>{pct}%</p><p className="text-sm text-slate-500">{doneCount} of {items.length} done</p></div>
                </div>
                {stats.map(({ l, v }, i) => (
                  <div key={l} className={`p-5 ${i === 0 ? "border-r border-slate-200 sm:border-r-0" : ""} ${i === 1 ? "bg-[#f3f5f8]" : ""}`}>
                    <p className={`${FD} text-3xl font-semibold ${i === 1 ? "text-[#b4473f]" : ""}`}>{v}</p>
                    <p className="mt-1 text-sm text-slate-500">{l}</p>
                  </div>
                ))}
              </section>
            )}

            {tab === "study" && next && status === "todo" && !search && unit === "all" && paper === "all" && (
              <section className="mb-6 rounded-2xl bg-[#263040] p-6 text-white shadow-sm">
                <p className="text-sm font-semibold text-[#c9d3e6]">Start here</p>
                <p className={`${FD} mt-2 line-clamp-2 text-2xl font-semibold leading-snug`}>{next.question}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <Strip ids={papers.map(([id]) => id)} has={next.papers} className="max-w-[8rem] [&_i]:!bg-white/20 [&_.on]:!bg-white" />
                  <span>{next.count > 1 ? `Asked in ${next.count} papers` : "Next in your list"}{next.unit !== null && `, Unit ${next.unit}`}</span>
                </div>
                <button onClick={() => setFocusList(list)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e9e4d0] px-5 py-2.5 text-sm font-semibold text-[#263040]"><Focus size={16} /> Focus mode, {list.length} questions</button>
              </section>
            )}

            <div className="relative mb-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by topic or keyword" className={`${INPUT} pl-11 text-sm`} />
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {([["todo", "To study"], ["starred", "Revise later"], ["done", "Done"], ["all", "All"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setStatus(v)} className={chip(status === v)}>{l}</button>
              ))}
            </div>
            <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
              <button onClick={() => setUnit("all")} className={chip(unit === "all")}>All units</button>
              {units.map((u) => <button key={u} onClick={() => setUnit(u)} className={chip(unit === u)}>Unit {u}</button>)}
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort questions" className="ml-auto h-9 rounded-full bg-white px-3 text-sm text-slate-600 ring-1 ring-slate-200">
                <option value="priority">Most repeated first</option>
                <option value="number">Question number</option>
                <option value="marks">Highest marks</option>
              </select>
            </div>

            <p className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Strip ids={papers.slice(0, 3).map(([id]) => id)} has={new Set(papers.slice(0, 2).map(([id]) => id))} /> One square per paper. Dark means the question appeared in it.</p>

            {paper !== "all" && (
              <button onClick={() => setPaper("all")} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#e9e4d0] px-3 py-1.5 text-sm font-semibold">
                {clean(papers.find(([id]) => id === paper)?.[1] || "Paper")} <X size={14} />
              </button>
            )}

            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{list.length} question{list.length === 1 ? "" : "s"}</p>
              <div className="flex gap-2 text-sm font-semibold">
                {status === "starred" && list.length > 0 && (
                  <button onClick={copyRevise} className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ring-1 ring-slate-200 hover:ring-[#263040]"><Copy size={14} /> {copied ? "Copied" : "Copy list"}</button>
                )}
                {list.length > 0 && (
                  <button onClick={() => setFocusList(list)} className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${DARK}`}><Focus size={14} /> Focus</button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {list.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#263040]/25 bg-white px-6 py-14 text-center">
                  <BookOpen className="mx-auto text-slate-400" />
                  <p className={`${FD} mt-3 text-lg font-semibold`}>{status === "todo" && !search && unit === "all" && paper === "all" ? "Everything here is done." : "No questions match."}</p>
                  <button onClick={() => { setStatus("all"); setUnit("all"); setSearch(""); setPaper("all"); }} className="mt-3 text-sm font-semibold text-[#b4473f] hover:underline">Clear filters</button>
                </div>
              ) : (
                list.map((q) => (
                  <Card key={q.id} q={q} paperIds={papers.map(([id]) => id)} done={done.has(q.id)} starred={starred.has(q.id)} note={notes[q.id] || ""}
                    onNote={(v) => setNote(q.id, v)} onDone={() => toggleDone(q.id)} onStar={() => toggleStar(q.id)} onAskAI={askAI} />
                ))
              )}
            </div>
          </>
        )}

        {tab === "matrix" && (
          <>
            <p className="mb-3 text-sm text-slate-500">Each row is a question, each column a paper. A red square means the question appeared in that paper.</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <div className="min-w-max">
                <div className="flex items-end border-b border-slate-200 bg-[#f3f5f8]">
                  <p className="w-[18rem] shrink-0 px-4 py-3 text-xs text-slate-500 sm:w-[26rem]">Most repeated first</p>
                  {papers.map(([id, name]) => (
                    <button key={id} onClick={() => jump("study", undefined, id)} title={clean(name)} className="flex h-32 w-8 shrink-0 items-end justify-center pb-2 text-xs font-semibold text-slate-600 hover:text-[#b4473f]">
                      <span className="max-h-28 truncate [writing-mode:vertical-rl] rotate-180">{clean(name)}</span>
                    </button>
                  ))}
                  <span className="w-12 shrink-0 pb-2 text-center text-xs text-slate-500">Total</span>
                </div>
                <div style={{ backgroundImage: "repeating-linear-gradient(transparent 0 31px,#eef0f5 31px 32px)" }}>
                  {[...items].sort((a, b) => b.count - a.count || a.main_question - b.main_question).map((q) => (
                    <button key={q.id} onClick={() => { jump("study"); setSearch(q.question.slice(0, 40)); }} className="flex h-8 w-full items-center text-left hover:bg-[#b4473f]/5">
                      <span className="flex w-[18rem] shrink-0 items-center gap-2 border-r-2 border-[#b4473f]/30 px-4 sm:w-[26rem]">
                        <b className="w-9 shrink-0 text-xs text-slate-400">Q{q.question_number.replace(/^q/i, "")}</b>
                        <span className={`min-w-0 truncate text-sm ${done.has(q.id) ? "text-slate-400 line-through" : ""}`}>{q.question}</span>
                      </span>
                      {papers.map(([id]) => (
                        <span key={id} className="flex h-8 w-8 shrink-0 items-center justify-center">
                          {q.papers.has(id) ? <i className="sq block h-4 w-4 rounded-[3px] bg-[#b4473f]" /> : <i className="block h-1 w-1 rounded-full bg-slate-300" />}
                        </span>
                      ))}
                      <span className="w-12 shrink-0 text-center text-xs font-semibold text-slate-500">{q.count}×</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "units" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => {
              const qs = items.filter((i) => i.unit === u);
              const d = qs.filter((i) => done.has(i.id)).length;
              const hot = qs.filter((i) => i.count > 1).length;
              return (
                <button key={u} onClick={() => { jump("study", u); setStatus("todo"); }} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5">
                  <div className="flex items-baseline justify-between">
                    <h3 className={`${FD} text-2xl font-semibold`}>Unit {u}</h3>
                    <span className="text-sm font-semibold text-[#4f7f6a]">{qs.length ? Math.round((d / qs.length) * 100) : 0}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6e9ef]"><div className="h-full rounded-full bg-[#4f7f6a]" style={{ width: `${qs.length ? (d / qs.length) * 100 : 0}%` }} /></div>
                  <p className="mt-3 text-sm text-slate-500">{d} of {qs.length} done{hot > 0 && `, ${hot} repeated`}</p>
                </button>
              );
            })}
          </div>
        )}

        {tab === "papers" && (
          <div className="space-y-3">
            {papers.map(([id, name]) => {
              const n = items.filter((i) => i.papers.has(id)).length;
              return (
                <button key={id} onClick={() => jump("study", undefined, id)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-[#f6f4ea]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef0f4]"><FileText size={18} className="text-[#b4473f]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{clean(name)}</span>
                    <span className="text-sm text-slate-500">{n} questions</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </Shell>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => { try { const s = localStorage.getItem("req_user"); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [subject, setSubject] = useState<Subject | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!isLoggedIn()) { setChecking(false); return; }
    getMe().then(setUser).catch(() => { logout(); setUser(null); }).finally(() => setChecking(false));
  }, []);
  const handleLogout = () => { logout(); setUser(null); setSubject(null); };
  if (checking) return <Shell><div className="flex min-h-screen items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Loading ReQ…</div></Shell>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  if (!subject) return <SubjectScreen user={user} onSelect={setSubject} onLogout={handleLogout} />;
  return <AnalyzerApp user={user} subject={subject} onLogout={handleLogout} onBackToSubjects={() => setSubject(null)} />;
}