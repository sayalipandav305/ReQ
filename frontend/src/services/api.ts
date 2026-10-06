const API_BASE_URL = "http://127.0.0.1:8000";

export interface Question {
  question_number: string; main_question: number; sub_question: string | null;
  question: string; marks: number | null; page_number: number; unit: number | null;
  nested_items?: { item: string; text: string }[]; paper_id: string; paper_name: string;
}
export interface QuestionOccurrence { paper_id: string; paper_name: string; question_number: string; marks: number | null; page_number: number; }
export interface RepeatedQuestion { unit: number | null; question: string; marks: number[]; repeated: number; occurrences: QuestionOccurrence[]; }
export interface CompareResponse { success: boolean; papers: { id: string; name: string; filename: string; total_pages: number; total_questions: number }[]; total_papers: number; total_questions: number; questions: Question[]; repeated_questions: RepeatedQuestion[]; }
export interface User { id: number; name: string; email: string; }
export interface AuthResponse { access_token: string; token_type: string; user: User; }
export interface Subject { id: number; name: string; created_at: string; }

function getToken() { return localStorage.getItem("req_token"); }

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
  return data as T;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  localStorage.setItem("req_token", data.access_token); localStorage.setItem("req_user", JSON.stringify(data.user)); return data;
}
export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  localStorage.setItem("req_token", data.access_token); localStorage.setItem("req_user", JSON.stringify(data.user)); return data;
}
export async function getMe(): Promise<User> { return request<User>("/auth/me"); }
export function logout() { localStorage.removeItem("req_token"); localStorage.removeItem("req_user"); }
export function isLoggedIn() { return Boolean(localStorage.getItem("req_token")); }
export async function getSubjects(): Promise<Subject[]> { return request<Subject[]>("/subjects"); }
export async function createSubject(name: string): Promise<Subject> { return request<Subject>("/subjects", { method: "POST", body: JSON.stringify({ name }) }); }

export async function comparePapers(
  files: File[],
  subjectId: number
): Promise<CompareResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append(
    "subject_id",
    String(subjectId)
  );

  return request<CompareResponse>(
    "/papers/compare",
    {
      method: "POST",
      body: formData,
    }
  );
}

export async function getSubjectAnalyses(subjectId: number) {
  return request(`/papers/subjects/${subjectId}/analyses`);
}

export async function deleteSubject(subjectId: number): Promise<void> {
  await request(`/subjects/${subjectId}`, {
    method: "DELETE",
  });
}

export async function askReQAI(
  question: string,
  marks: number,
  subject: string,
  unit: number | null,
  mode: "exam" | "learn" | "revise"
) {
  const response = await fetch(`${API_BASE_URL}/ai/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      marks,
      subject,
      unit,
      mode,
    }),
  });

  if (!response.ok) {
    let message = "AI could not generate an answer.";

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {}

    throw new Error(message);
  }

  return response.json();
}