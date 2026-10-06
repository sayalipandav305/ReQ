# ReQ — Repeated Question Analyzer 📚

ReQ is a web application that helps students analyze university question papers and identify frequently repeated or similar questions.

Instead of manually going through multiple previous-year papers, ReQ analyzes them and presents a clean, deduplicated list of questions along with their repetition frequency and the papers in which they appeared.

## ✨ Features

- 📄 Upload multiple question-paper PDFs
- 🔍 Automatically extract questions from PDFs
- 🧠 Detect repeated and semantically similar questions
- 🔁 Show how many times a question has been repeated
- 📚 Show the papers in which a question appeared
- 📌 Organize questions by unit
- 🔎 Search questions instantly
- ↕️ Filter and sort questions
- ✅ Mark questions as completed
- ⭐ Star important questions for revision
- 📝 Add personal notes
- 👤 User registration and login
- 📂 Subject-wise question paper analysis
- 📊 View question-paper analysis and repetition patterns

## 🎯 Why ReQ?

Students often prepare for exams by going through several previous-year question papers.

The problem is that the same question may appear:

- with slightly different wording
- in different papers
- under different question numbers
- multiple times across different years

ReQ reduces this manual work by identifying similar questions and grouping them together.

### Example

Instead of displaying:

```text
2022 — Explain the OSI model.

2023 — Explain the OSI reference model.

2024 — Describe the OSI model and its layers.

2025 — Explain OSI model with all layers.
```

ReQ can group them as:

```text
Explain the OSI model and its layers.

Repeated: 4 times

Appeared in:
• 2022
• 2023
• 2024
• 2025
```

This allows students to focus on the questions that are most likely to be important.

## 🛠️ Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Python
- FastAPI
- PyMuPDF
- Sentence Transformers
- scikit-learn

### Database

- SQLite
- SQLAlchemy

### Authentication

- JWT
- Argon2 password hashing

## 🧠 How Repetition Detection Works

ReQ uses semantic similarity instead of relying only on exact text matching.

The question text is converted into vector embeddings using:

```text
all-MiniLM-L6-v2
```

The embeddings are then compared using cosine similarity.

This allows ReQ to identify questions that have similar meanings even when their wording is different.

### Example

```text
"Explain the OSI model."

        ↓

"Describe the OSI reference model."

        ↓

Semantic similarity

        ↓

Repeated question group
```

## 📁 Project Structure

```text
ReQ/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── auth.py
│   │   ├── database.py
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── test_semantic.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── services/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── index.css
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Python 3.10+
- Node.js 18+
- npm
- Git

## ⚙️ Backend Setup

Open a terminal inside the project folder.

```bash
cd backend
```

### Create a virtual environment

macOS / Linux:

```bash
python3 -m venv venv
```

Activate it:

```bash
source venv/bin/activate
```

Windows:

```bash
venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Start the FastAPI server

```bash
python -m uvicorn app.main:app --reload
```

The backend will run at:

```text
http://127.0.0.1:8000
```

FastAPI documentation:

```text
http://127.0.0.1:8000/docs
```

## 💻 Frontend Setup

Open a new terminal.

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

The frontend will normally run at:

```text
http://localhost:5173
```

Open the URL in your browser.

## 📖 How to Use ReQ

### 1. Create an account

Register using your name, email and password.

### 2. Select a subject

Create or select the subject you want to study.

### 3. Upload question papers

Upload multiple university question-paper PDFs.

For meaningful repetition analysis, upload at least two papers.

### 4. Analyze

ReQ extracts the questions and compares them using semantic similarity.

### 5. Study repeated questions

The results show:

- Unique questions
- Repeated questions
- Repetition count
- Papers where they appeared
- Units
- Marks

### 6. Track your preparation

Use:

- ✅ Completed
- ⭐ Starred
- 📝 Notes

to organize your revision.

## 🔐 Environment Variables

For local development, configure environment variables as required by the backend and frontend.

Do not commit:

```text
.env
```

or any API keys, passwords, authentication secrets, or private credentials to GitHub.

## 🗃️ Database

The local development version uses SQLite.

The database file is intentionally excluded from Git using `.gitignore`.

When running the backend locally, the database will be created automatically according to the backend configuration.

## 🔒 Security

ReQ uses:

- JWT-based authentication
- Password hashing with Argon2
- User-specific subjects and analysis
- Protected API endpoints

Never expose production secrets or credentials in the source code.

## 🚧 Project Status

ReQ is currently under active development.

Planned improvements include:

- Persistent analysis history
- Improved question parsing
- More accurate semantic matching
- Detailed analytics and visualizations
- Cloud deployment
- Mobile-friendly improvements
- Better study recommendations
- Production database support

## 🌐 Deployment

The frontend can be deployed using platforms such as Netlify.

The FastAPI backend needs to be deployed separately on a backend hosting platform.

A production deployment can follow this architecture:

```text
                    ┌──────────────────┐
                    │     GitHub       │
                    │   Source Code    │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        ┌──────────────┐          ┌──────────────┐
        │   Netlify    │          │   Backend    │
        │    React     │ ───────► │   FastAPI    │
        │   Frontend   │          │              │
        └──────────────┘          └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │   Database   │
                                  └──────────────┘
```

## 🤝 Contributing

Contributions, suggestions and improvements are welcome.

If you find a bug or have an idea for a new feature, feel free to open an issue.

## 👩‍💻 Author

**Sayali Pandav**

Information Technology Engineering Student  
Pune, India

## ⭐ If you find ReQ useful

Give the repository a ⭐ on GitHub!
