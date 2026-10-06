import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models.subject import Subject
from app.models.user import User
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisSave, AnalysisResponse

router = APIRouter(prefix="/papers", tags=["Analysis History"])

@router.post("/save-analysis", response_model=AnalysisResponse)
def save_analysis(data: AnalysisSave, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == data.subject_id, Subject.user_id == current_user.id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    result = data.result
    analysis = Analysis(
        subject_id=subject.id,
        total_papers=int(result.get("total_papers", 0)),
        total_questions=int(result.get("total_questions", 0)),
        result_json=json.dumps(result),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return AnalysisResponse(
        id=analysis.id,
        subject_id=analysis.subject_id,
        total_papers=analysis.total_papers,
        total_questions=analysis.total_questions,
        created_at=analysis.created_at.isoformat(),
    )

@router.get("/subjects/{subject_id}/analyses")
def get_subject_analyses(subject_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id, Subject.user_id == current_user.id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    rows = db.query(Analysis).filter(Analysis.subject_id == subject_id).order_by(Analysis.created_at.desc()).all()
    return [{
        "id": row.id,
        "subject_id": row.subject_id,
        "total_papers": row.total_papers,
        "total_questions": row.total_questions,
        "created_at": row.created_at.isoformat(),
        "result": json.loads(row.result_json),
    } for row in rows]
