from fastapi import FastAPI

from app.api.papers import router as papers_router
from app.api.auth import router as auth_router
from app.api.subjects import router as subjects_router

from app.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.api.ai import router as ai_router

# Import models so SQLAlchemy registers them
from app.models import User, Subject


app = FastAPI(
    title="ReQ API",
    description="Repeated Question Paper Analyzer",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Create database tables
Base.metadata.create_all(
    bind=engine
)


# Existing analyzer routes
app.include_router(papers_router)

# New authentication routes
app.include_router(auth_router)

# New subject routes
app.include_router(subjects_router)


# New AI routes
app.include_router(ai_router)


@app.get("/")
def root():
    return {
        "message": "ReQ API is running 🚀"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }