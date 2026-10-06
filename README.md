# ReQ — Question Paper Analyzer

> **Analyze. Understand. Revise. Ace.**

ReQ is an AI-powered question paper analyzer designed to help engineering students study smarter by analyzing previous question papers, identifying repeated questions, tracking preparation progress, and generating exam-ready answers using local AI.

---

## ✨ Features

### 📄 Question Paper Analysis
- Upload multiple question papers
- Automatically extract questions from uploaded papers
- Organize questions by unit, marks, paper, and question number
- View all analyzed questions in one place

### 🔁 Repeated Question Detection
- Detects repeated and similar questions using semantic similarity
- Displays each unique question only once
- Shows how many times a question has appeared
- Shows the papers and question numbers where it appeared
- Handles nested subquestions such as `i)`, `ii)`, `a)`, `b)`

### 📊 Study Dashboard
- Track overall preparation progress
- View questions by:
  - Study
  - Repeated
  - Units
  - Papers
- Search and filter questions
- Filter by unit, paper, and completion status
- Sort questions for easier revision

### ✅ Question Progress
- Mark questions as completed
- Star important questions
- Create a revision-focused question list
- Add personal notes
- Track study progress visually

### 🤖 Ask ReQ AI

Generate answers directly from any question using local AI.

ReQ supports three answer modes:

#### ✍️ Exam
Generate a university-ready answer structured according to the marks.

#### 🧠 Learn
Understand the concept through simple explanations focused on **why** and **how**.

#### ⚡ Revise
Get short, memorable revision points, keywords, definitions, formulas, and examples.

### 📝 Marks-Aware Answers
ReQ automatically adjusts answer depth according to the marks:

| Marks | Answer Style |
|---|---|
| 1–2 | Concise definition / key points |
| 3–4 | Short explanation |
| 5–6 | Moderately detailed answer |
| 7–8 | Detailed structured answer |
| 9–10 | Comprehensive answer |

### 🔹 Subquestion-Aware AI
ReQ understands questions containing multiple parts.

For example:

```text
Q6(b) Write Short note on

i) Representation Learning
ii) Distributed Representation
```

ReQ generates separate answers for:

```text
i) Representation Learning

ii) Distributed Representation
```

instead of combining them into one unrelated answer.

### 💾 Save AI Answers
- Save generated answers for revision
- Copy answers with one click
- Answers are stored locally
- Revisit saved answers while studying

---

## 🧠 How ReQ Detects Repeated Questions

ReQ uses semantic similarity rather than relying only on exact text matching.

The question repetition system uses:

- **Sentence Transformers**
- `all-MiniLM-L6-v2`
- Cosine similarity

This allows ReQ to identify questions that are worded differently but ask essentially the same thing.

---

## 🤖 Local AI

ReQ uses local AI for answer generation.

### AI Stack

- **Ollama**
- **Qwen**
- FastAPI backend

Because the model runs locally, ReQ does not require sending study questions to an external AI API for answer generation.

---

## 🛠️ Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Python
- FastAPI
- Uvicorn

### AI & NLP

- Ollama
- Qwen
- Sentence Transformers
- `all-MiniLM-L6-v2`
- Scikit-learn

### Data Processing

- PDF question paper processing
- Semantic similarity analysis
- Local browser storage for saved study data

---

## 📁 Project Structure

```text
ReQ/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   └── main.py
│   │
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   │
│   └── ...
│
├── README.md
└── ...
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sayalipandav305/ReQ.git
cd ReQ
```

---

### 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

The backend will run on:

```text
http://127.0.0.1:8000
```

---

### 3. Ollama Setup

Install and run Ollama, then make sure the required Qwen model is available locally.

For example:

```bash
ollama pull qwen2.5:7b
```

Start Ollama if required:

```bash
ollama serve
```

> The exact model name may depend on the model configured in `ai_service.py`.

---

### 4. Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local URL shown by Vite.

---

## 🔄 How ReQ Works

```text
Upload Question Papers
        ↓
Extract Questions
        ↓
Analyze Questions
        ↓
Detect Similar / Repeated Questions
        ↓
Organize by Unit, Marks & Paper
        ↓
Track Study Progress
        ↓
Ask ReQ AI
        ↓
┌───────────────┬───────────────┬───────────────┐
│     Exam      │     Learn     │     Revise    │
│      ✍️       │      🧠       │       ⚡       │
└───────────────┴───────────────┴───────────────┘
        ↓
Save / Copy / Revise
```

---

## 🎯 Why ReQ?

Traditional question-paper analysis usually means manually going through multiple PDFs and trying to remember which questions have appeared before.

ReQ turns that process into a structured study workflow:

**Find what matters → Understand it → Track it → Revise it.**

Instead of repeatedly searching through old papers, students can immediately see which questions are important and how frequently they appear.

---

## 🔮 Future Improvements

Planned improvements include:

- AI-generated study plans
- Important-question predictions
- Advanced revision dashboard
- More detailed analytics
- Answer history / revision vault
- Improved question-paper parsing
- More AI-powered study tools

---

## 👩‍💻 Author

**Sayali Pandav**



---

## 📌 Project Status

🚧 **Actively under development**

ReQ is being continuously improved with new AI-powered study and revision features.
