import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";

import {

  Search, Upload, X, FileText, ChevronDown, Check, Star, RotateCcw, Loader2, BookOpen, Flame,

  Focus, Copy, StickyNote, ChevronLeft, ChevronRight, Trophy, Trash2

} from "lucide-react";

import {
  comparePapers,
  getMe,
  getSubjects,
  isLoggedIn,
  login,
  logout,
  register,
  createSubject,
  deleteSubject,
  type Subject,
  type User,
} from "./services/api";



/* ---------- types ---------- */

interface NestedItem { item: string; text: string }

interface Question {

  question_number: string; main_question: number; sub_question: string | null;

  question: string; marks: number | null; page_number: number; unit: number | null;

  nested_items?: NestedItem[]; paper_id: string; paper_name: string;

}

interface Occurrence {

  paper_id: string; paper_name: string; question_number: string; marks: number | null; page_number: number;

}

interface RepeatedQuestion {

  unit: number | null; question: string; marks: number[]; repeated: number;

  occurrences: Occurrence[]; nested_items?: NestedItem[];

}

interface CompareResponse {

  success: boolean; papers: any[]; total_papers: number; total_questions: number;

  questions: Question[]; repeated_questions: RepeatedQuestion[];

}

type Item = Question & { id: string; count: number; occ: Occurrence[]; papers: Set<string> };



const TABS = [["study", "Study"], ["repeated", "Repeated"], ["units", "Units"], ["papers", "Papers"]] as const;

type Tab = (typeof TABS)[number][0];

type Status = "todo" | "done" | "starred" | "all";

type Sort = "priority" | "number" | "marks";



/* ---------- helpers ---------- */
const clean = (n: string) =>
  n
    .replace(/\.pdf$/i, "")
    .replace(/[-_]/g, " ")
    .trim();

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

  }, [notes]);

  return [notes, (id: string, v: string) => setNotes((c) => ({ ...c, [id]: v }))] as const;

}



const heat = (n: number) => (n >= 3 ? "High" : n === 2 ? "Medium" : null);



/* ---------- question card ---------- */

function Card({ q, done, starred, note, onDone, onStar, onNote }: {

  q: Item; done: boolean; starred: boolean; note: string;

  onDone: () => void; onStar: () => void; onNote: (v: string) => void;

}) {

  const [open, setOpen] = useState(false);

  const nested = q.nested_items || [];

  const level = heat(q.count);



  return (

    <article className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(27,23,80,0.05)] transition hover:shadow-md sm:p-6 ${done ? "border-emerald-200 bg-emerald-50/60" : "border-white"}`}>

      <span className={`absolute inset-y-0 left-0 w-1.5 ${done ? "bg-emerald-500" : q.count >= 3 ? "bg-[#d9bd6a]" : q.count === 2 ? "bg-[#9fb3cc]" : "bg-transparent"}`} />

      <div className="flex gap-3.5">

        <button

          onClick={onDone}

          aria-label={done ? "Mark as not done" : "Mark as done"}

          aria-pressed={done}

          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f2937] ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent hover:border-emerald-600 hover:text-emerald-600/40"}`}

        >

          <Check size={14} strokeWidth={3} />

        </button>



        <div className="min-w-0 flex-1">

          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">

            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">Q{q.question_number.replace(/^q/i, "")}</span>

            {q.unit !== null && <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700">Unit {q.unit}</span>}

            {q.marks !== null && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{q.marks} marks</span>}

            {level && (

              <span className="flex items-center gap-1 rounded-md bg-[#f3e7b8] px-2 py-0.5 text-[#5c4a12]">

                <Flame size={12} /> Asked {q.count}× · {level} priority

              </span>

            )}

          </div>



          <p className={`text-[16px] leading-7 ${done ? "text-slate-500" : "text-[#1f2937]"} ${level === "High" && !done ? "[background:linear-gradient(transparent_58%,#f3e7b8_58%,#f3e7b8_92%,transparent_92%)] [box-decoration-break:clone] inline" : ""}`}>

            {q.question}

          </p>



          {open && (

            <div className="mt-3 space-y-3">

              <textarea

                value={note} onChange={(e) => onNote(e.target.value)} rows={3}

                placeholder="Your notes: formula, hint, answer outline…"

                className="w-full resize-y rounded-lg border border-slate-200 bg-amber-50/50 p-3 text-sm outline-none focus:border-[#1f2937]"

              />

              {nested.length > 0 && (

                <ul className="space-y-1.5 border-l-2 border-slate-200 pl-4 text-[15px] text-slate-600">

                  {nested.map((n) => (

                    <li key={n.item} className="flex gap-2"><b className="text-slate-400">{n.item})</b>{n.text}</li>

                  ))}

                </ul>

              )}

              <div>

                <p className="mb-1.5 text-xs font-semibold text-slate-500">

                  {q.count > 1 ? `Found in ${q.count} papers` : "Found in"}

                </p>

                <ul className="space-y-1">

                  {q.occ.map((o, i) => (

                    <li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">

                      <b className="text-slate-800">{clean(o.paper_name)}</b> — Q{o.question_number.replace(/^q/i, "")}

                      {o.marks !== null && `, ${o.marks} marks`}, page {o.page_number}

                    </li>

                  ))}

                </ul>

              </div>

            </div>

          )}



          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">

            <button onClick={() => setOpen(!open)} className="flex items-center gap-1 font-semibold hover:text-[#1f2937]">

              <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />

              {open ? "Hide details" : nested.length ? `Parts & papers (${nested.length})` : "Papers"}

            </button>

            <span className="truncate">{clean(q.paper_name)} · p.{q.page_number}</span>

            {note && <StickyNote size={13} className="shrink-0 text-amber-500" aria-label="Has notes" />}

          </div>

        </div>



        <button

          onClick={onStar}

          aria-label={starred ? "Remove from revise list" : "Add to revise list"}

          aria-pressed={starred}

          className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition ${starred ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}

        >

          <Star size={18} fill={starred ? "currentColor" : "none"} />

        </button>

      </div>

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

  const btn = "flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 disabled:opacity-30";



  return (

    <div role="dialog" aria-label="Focus mode" className="fixed inset-0 z-50 flex flex-col bg-[#1f2937] text-white">

      <div className="flex items-center gap-4 px-5 py-4">

        <span className="text-sm font-semibold">{i + 1} / {list.length}</span>

        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">

          <div className="h-full rounded-full bg-[#f3e7b8] transition-all" style={{ width: `${((i + 1) / list.length) * 100}%` }} />

        </div>

        <button onClick={onExit} aria-label="Exit focus mode" className="text-white/70 hover:text-white"><X size={20} /></button>

      </div>



      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center overflow-y-auto px-6 py-6">

        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">

          {q.unit !== null && <span className="rounded-md bg-white/10 px-2 py-1">Unit {q.unit}</span>}

          {q.marks !== null && <span className="rounded-md bg-white/10 px-2 py-1">{q.marks} marks</span>}

          {q.count > 1 && <span className="flex items-center gap-1 rounded-md bg-[#f3e7b8] px-2 py-1 text-[#5c4a12]"><Flame size={12} /> Asked {q.count}×</span>}

        </div>

        <p className="text-2xl font-medium leading-9 sm:text-3xl sm:leading-[1.4]">{q.question}</p>

        {(q.nested_items || []).length > 0 && (

          <ul className="mt-5 space-y-2 border-l-2 border-white/20 pl-4 text-lg text-white/80">

            {q.nested_items!.map((n) => <li key={n.item}><b className="mr-2 text-white/50">{n.item})</b>{n.text}</li>)}

          </ul>

        )}

        <p className="mt-6 text-sm text-white/50">{q.occ.map((o) => clean(o.paper_name)).join(", ")}</p>

      </div>



      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 pb-4">

        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous" className={btn}><ChevronLeft /></button>

        <button onClick={markDone} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-semibold transition ${isDone ? "bg-emerald-600" : "bg-white text-[#1f2937] hover:bg-slate-100"}`}>

          <Check size={18} strokeWidth={3} /> {isDone ? "Done" : "Mark done & next"}

        </button>

        <button onClick={() => onStar(q.id)} aria-label="Revise later" aria-pressed={starred.has(q.id)} className={`${btn} ${starred.has(q.id) ? "text-amber-300" : ""}`}>

          <Star fill={starred.has(q.id) ? "currentColor" : "none"} />

        </button>

        <button onClick={() => go(1)} disabled={i === list.length - 1} aria-label="Next" className={btn}><ChevronRight /></button>

      </div>

      <p className="hidden pb-5 text-center text-xs text-white/40 sm:block">← → move · D done · S revise later · Esc exit</p>

    </div>

  );

}



/* ---------- app ---------- */

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode,setMode]=useState<"login"|"signup">("login"); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError("");setLoading(true);try{const data=mode==="login"?await login(email,password):await register(name,email,password);onAuthenticated(data.user)}catch(err:any){setError(err?.message||"Something went wrong. Please try again.")}finally{setLoading(false)}};
  return <div className="min-h-screen bg-[#f6f7f9] text-[#1f2937]"><main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-12"><div className="w-full"><div className="mb-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f2937] text-lg font-bold text-white">R</span><h1 className="mt-5 text-3xl font-bold">Welcome to ReQ</h1><p className="mt-2 text-sm text-slate-500">Find the questions your exams keep asking.</p></div><form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setMode("login")} className={`rounded-lg py-2.5 text-sm font-semibold ${mode==="login"?"bg-white shadow-sm":"text-slate-500"}`}>Login</button><button type="button" onClick={()=>setMode("signup")} className={`rounded-lg py-2.5 text-sm font-semibold ${mode==="signup"?"bg-white shadow-sm":"text-slate-500"}`}>Create account</button></div>{mode==="signup"&&<label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold">Name</span><input value={name} onChange={e=>setName(e.target.value)} required minLength={2} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#1f2937]" /></label>}<label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold">Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#1f2937]" /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#1f2937]" /></label>{error&&<p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f2937] font-semibold text-white disabled:opacity-50">{loading&&<Loader2 size={16} className="animate-spin"/>}{loading?"Please wait…":mode==="login"?"Login to ReQ":"Create my account"}</button></form></div></main></div>;
}

function SubjectScreen({
  user,
  onSelect,
  onLogout,
}: {
  user: User;
  onSelect: (s: Subject) => void;
  onLogout: () => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch((e) => setError(e?.message || "Couldn't load subjects."))
      .finally(() => setLoading(false));
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      setError("");

      const s = await createSubject(name.trim());

      setSubjects((c) => [s, ...c]);
      setName("");
      onSelect(s);
    } catch (e: any) {
      setError(e?.message || "Couldn't create subject.");
    }
  };

  const handleDelete = async (
    e: React.MouseEvent,
    subject: Subject
  ) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${subject.name}"?\n\nThis will permanently delete this subject.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(subject.id);
      setError("");

      await deleteSubject(subject.id);

      setSubjects((current) =>
        current.filter((s) => s.id !== subject.id)
      );
    } catch (e: any) {
      setError(e?.message || "Couldn't delete subject.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1f2937]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f2937] text-white">
              R
            </span>
            ReQ
          </span>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Hi, {user.name}
            </span>

            <button
              onClick={onLogout}
              className="rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-sm font-semibold text-sky-700">
          Your study space
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Choose a subject
        </h1>

        <p className="mt-3 max-w-2xl text-slate-600">
          Pick a subject before uploading papers. Each analysis will be
          saved under it in the database.
        </p>

        <form
          onSubmit={add}
          className="mt-8 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a subject — e.g. DBMS"
            className="h-12 flex-1 rounded-xl border border-slate-200 px-4 outline-none focus:border-[#1f2937]"
          />

          <button
            disabled={!name.trim()}
            className="h-12 rounded-xl bg-[#1f2937] px-6 font-semibold text-white disabled:opacity-40"
          >
            Add subject
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-12 text-center text-slate-500">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="group relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-slate-400"
              >
                {/* Open subject */}
                <button
                  onClick={() => onSelect(s)}
                  className="w-full text-left"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                    <BookOpen size={20} />
                  </span>

                  <h2 className="mt-4 text-lg font-bold">
                    {s.name}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Open study workspace →
                  </p>
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(e, s)}
                  disabled={deletingId === s.id}
                  aria-label={`Delete ${s.name}`}
                  title="Delete subject"
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === s.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={17} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

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



const addFiles = (list: FileList | null) => {
  if (!list) return;

  const pdfs = Array.from(list).filter((f) =>
    /\.pdf$/i.test(f.name)
  );

  setFiles((cur) =>
    [...cur, ...pdfs].filter(
      (f, i, a) =>
        i ===
        a.findIndex(
          (o) =>
            o.name === f.name &&
            o.size === f.size
        )
    )
  );

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



  const units = useMemo(

    () => [...new Set(items.map((i) => i.unit).filter((u): u is number => u !== null))].sort((a, b) => a - b),

    [items]

  );

  const papers = useMemo(() => {

    const m = new Map<string, string>();

    result?.questions.forEach((q) => m.set(q.paper_id, q.paper_name));

    return [...m];

  }, [result]);



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

    const text = items.filter((i) => starred.has(i.id))

      .map((i, n) => `${n + 1}. ${i.question}${i.unit !== null ? ` (Unit ${i.unit})` : ""}`).join("\n");

    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }

  };



  const next = items.filter((i) => !done.has(i.id)).sort((a, b) => b.count - a.count)[0];

  const jump = (t: Tab, u?: number, p?: string) => { setTab(t); setUnit(u ?? "all"); setPaper(p ?? "all"); setStatus("all"); };



  const chip = (on: boolean) =>

    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? "bg-[#1f2937] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400"}`;



  const shell = (children: React.ReactNode) => (

    <div className="min-h-screen bg-[#f6f7f9] text-[#1f2937]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      <style>{`@import url('https\://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght\@400;500;600;700;800&display=swap');`}</style>

      {children}

    </div>

  );



  /* ---------- upload screen ---------- */

  if (!result) {

    return shell(

      <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">

        <p className="mb-10 flex items-center gap-2 text-lg font-bold tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f2937] text-white">R</span>ReQ</p>

        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">

          Find out what your exam <span className="[background:linear-gradient(transparent_58%,#f3e7b8_58%,#f3e7b8_92%,transparent_92%)]">keeps asking.</span>

        </h1>

        <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">

          Upload past papers. ReQ finds repeated questions, ranks them by how often they appear, and gives you a checklist to study from.

        </p>



        <div className="mt-7 grid gap-3 sm:grid-cols-3">

          {[

            { icon: Flame, t: "Spots repeats", d: "Same question, different year" },

            { icon: Star, t: "Ranks by priority", d: "Study the likely ones first" },

            { icon: Check, t: "Tracks progress", d: "Tick off, take notes, focus" },

          ].map(({ icon: Icon, t, d }) => (

            <div key={t} className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200">

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={18} /></span>

              <p className="mt-3 font-bold">{t}</p>

              <p className="text-sm text-slate-500">{d}</p>

            </div>

          ))}

        </div>



        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

          <label

            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}

            onDragLeave={() => setDragging(false)}

            onDrop={onDrop}

            className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-[#1f2937] bg-sky-50" : "border-slate-300 hover:border-slate-400"}`}

          >

            <Upload size={22} className="text-slate-500" />

            <span className="mt-3 font-semibold">Drop PDFs here or click to choose</span>

            <span className="mt-1 text-sm text-slate-500">Add 2 or more papers from the same subject</span>

            <input type="file" accept=".pdf" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)} />

          </label>



          {files.length > 0 && (

            <ul className="mt-4 space-y-2">

              {files.map((f, i) => (

                <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">

                  <FileText size={16} className="shrink-0 text-slate-400" />

                  <span className="min-w-0 flex-1 truncate">{f.name}</span>

                <button
  onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}
  aria-label={`Remove ${f.name}`}
  className="text-slate-400 hover:text-slate-900"
>
  <X size={16} />
</button>
                </li>

              ))}

            </ul>

          )}



          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}



          <button

            onClick={analyze}

            disabled={loading || files.length < 2}

            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f2937] py-3.5 font-semibold text-white transition hover:bg-[#374151] disabled:opacity-40"

          >

            {loading && <Loader2 size={16} className="animate-spin" />}

            {loading ? "Reading papers…" : files.length < 2 ? `Add ${2 - files.length} more paper${files.length ? "" : "s"}` : `Find repeats in ${files.length} papers`}

          </button>

        </div>

      </main>

    );

  }



  /* ---------- results ---------- */

  return shell(

    <>

      {focusList && (

        <FocusMode list={focusList} done={done} starred={starred} onDone={toggleDone} onStar={toggleStar} onExit={() => setFocusList(null)} />

      )}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">

        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">

          <span className="flex items-center gap-2 font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1f2937] text-white">R</span>ReQ</span>

          <div className="flex min-w-0 flex-1 items-center gap-3">

            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>

              <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />

            </div>

            <span className="whitespace-nowrap text-sm font-semibold">{doneCount}/{items.length} done</span>

          </div>
          <div className="hidden items-center gap-2 md:flex"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{subject.name}</span><span className="text-xs text-slate-400">{user.name}</span></div>
          <button onClick={onBackToSubjects} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><BookOpen size={14} /> <span className="hidden sm:inline">Subjects</span></button>
          <button onClick={reset} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><RotateCcw size={14} /> <span className="hidden sm:inline">New papers</span></button>
          <button onClick={onLogout} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:text-slate-900">Logout</button>

        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">

          {TABS.map(([v, l]) => (

            <button key={v} onClick={() => jump(v)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === v ? "border-[#1f2937] text-[#1f2937]" : "border-transparent text-slate-500 hover:text-slate-900"}`}>

              {l}

              {v === "repeated" && <span className="ml-1.5 rounded-full bg-[#f3e7b8] px-1.5 text-xs text-[#5c4a12]">{items.filter((i) => i.count > 1).length}</span>}

            </button>

          ))}

        </nav>

      </header>



      <main className="mx-auto max-w-5xl px-5 py-6">

        {(tab === "study" || tab === "repeated") && (

          <>

            {tab === "study" && pct === 100 && (

              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-600 p-5 text-white">

                <Trophy /> <p className="font-bold">Every question done. Nice work.</p>

              </div>

            )}



            {tab === "study" && (

              <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">

                <div className="col-span-2 flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:col-span-1">

                  <svg width="64" height="64" viewBox="0 0 36 36" className="shrink-0 -rotate-90" aria-hidden>

                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#eef0f3" strokeWidth="4" />

                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#3f8a6b" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} className="transition-all duration-700" />

                  </svg>

                  <div>

                    <p className="text-2xl font-bold">{pct}%</p>

                    <p className="text-sm text-slate-500">{doneCount} of {items.length} done</p>

                  </div>

                </div>

                {[

                  { l: "Repeated", v: items.filter((i) => i.count > 1).length, c: "bg-[#f3e7b8] text-[#5c4a12]" },

                  { l: "High priority left", v: items.filter((i) => i.count >= 3 && !done.has(i.id)).length, c: "bg-[#1f2937] text-white" },

                  { l: "Revise later", v: starred.size, c: "bg-[#eef0f3] text-slate-700" },

                ].map(({ l, v, c }) => (

                  <div key={l} className={`rounded-2xl p-5 ${c}`}>

                    <p className="text-3xl font-bold">{v}</p>

                    <p className="mt-1 text-sm font-medium opacity-75">{l}</p>

                  </div>

                ))}

              </section>

            )}



            {tab === "study" && next && status === "todo" && !search && unit === "all" && paper === "all" && (

              <section className="relative mb-6 overflow-hidden rounded-2xl bg-[#1f2937] p-6 text-white">

                <p className="text-sm font-semibold text-[#f3e7b8]">Start here</p>

                <p className="mt-1 line-clamp-2 text-lg font-medium leading-snug">{next.question}</p>

                <p className="mt-2 text-sm text-slate-300">

                  {next.count > 1 ? `Asked in ${next.count} papers` : "Next in your list"}{next.unit !== null && ` · Unit ${next.unit}`}

                </p>

              <button onClick={() => setFocusList(list)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1f2937]">

                  <Focus size={16} /> Focus mode · {list.length} questions

                </button>

              </section>

            )}



            <div className="relative mb-4">

              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

              <input

                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by topic or keyword"

                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1f2937]"

              />

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



            {paper !== "all" && (

              <button onClick={() => setPaper("all")} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800">

                {clean(papers.find(([id]) => id === paper)?.[1] || "Paper")} <X size={14} />

              </button>

            )}



            <div className="mb-3 flex items-center justify-between gap-3">

              <p className="text-sm text-slate-500">{list.length} question{list.length === 1 ? "" : "s"}</p>

              <div className="flex gap-2 text-sm font-semibold">

                {status === "starred" && list.length > 0 && (

                  <button onClick={copyRevise} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400">

                    <Copy size={14} /> {copied ? "Copied" : "Copy list"}

                  </button>

                )}

                {list.length > 0 && (

                  <button onClick={() => setFocusList(list)} className="flex items-center gap-1.5 rounded-lg bg-[#1f2937] px-3 py-1.5 text-white hover:bg-[#374151]">

                    <Focus size={14} /> Focus

                  </button>

                )}

              </div>

            </div>



            <div className="space-y-3">

              {list.length === 0 ? (

                <div className="rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-slate-200">

                  <BookOpen className="mx-auto text-slate-400" />

                  <p className="mt-3 font-semibold">

                    {status === "todo" && !search && unit === "all" && paper === "all" ? "Everything here is done." : "No questions match."}

                  </p>

                  <button onClick={() => { setStatus("all"); setUnit("all"); setPaper("all"); setSearch(""); }} className="mt-3 text-sm font-semibold text-sky-700 hover:underline">

                    Clear filters

                  </button>

                </div>

              ) : (

                list.map((q) => (

                  <Card key={q.id} q={q} done={done.has(q.id)} starred={starred.has(q.id)} note={notes[q.id] || ""} onNote={(v) => setNote(q.id, v)} onDone={() => toggleDone(q.id)} onStar={() => toggleStar(q.id)} />

                ))

              )}

            </div>

          </>

        )}



        {tab === "units" && (

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {units.map((u) => {

              const qs = items.filter((i) => i.unit === u);

              const d = qs.filter((i) => done.has(i.id)).length;

              const hot = qs.filter((i) => i.count > 1).length;

              return (

                <button key={u} onClick={() => { jump("study", u); setStatus("todo"); }} className="rounded-2xl bg-white p-5 text-left ring-1 ring-slate-200 transition hover:ring-slate-400">

                  <div className="flex items-baseline justify-between">

                    <h3 className="text-lg font-bold">Unit {u}</h3>

                    <span className="text-sm font-semibold text-emerald-700">{qs.length ? Math.round((d / qs.length) * 100) : 0}%</span>

                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">

                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${qs.length ? (d / qs.length) * 100 : 0}%` }} />

                  </div>

                  <p className="mt-3 text-sm text-slate-500">{d} of {qs.length} done{hot > 0 && ` · ${hot} repeated`}</p>

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

                <button key={id} onClick={() => jump("study", undefined, id)} className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:ring-slate-400">

                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><FileText size={18} className="text-slate-500" /></span>

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

    </>

  );

}

export default function App() {
  const [user,setUser]=useState<User|null>(()=>{try{const s=localStorage.getItem("req_user");return s?JSON.parse(s):null}catch{return null}});
  const [subject,setSubject]=useState<Subject|null>(null); const [checking,setChecking]=useState(true);
  useEffect(()=>{if(!isLoggedIn()){setChecking(false);return}getMe().then(setUser).catch(()=>{logout();setUser(null)}).finally(()=>setChecking(false))},[]);
  const handleLogout=()=>{logout();setUser(null);setSubject(null)};
  if(checking)return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] text-slate-500"><Loader2 className="mr-2 animate-spin" size={18}/>Loading ReQ…</div>;
  if(!user)return <AuthScreen onAuthenticated={setUser}/>;
  if(!subject)return <SubjectScreen user={user} onSelect={setSubject} onLogout={handleLogout}/>;
  return <AnalyzerApp user={user} subject={subject} onLogout={handleLogout} onBackToSubjects={()=>setSubject(null)}/>;
}
