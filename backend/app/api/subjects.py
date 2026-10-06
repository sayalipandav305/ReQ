from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import (
    SubjectCreate,
    SubjectResponse,
)


router = APIRouter(
    prefix="/subjects",
    tags=["Subjects"],
)


@router.get(
    "",
    response_model=list[SubjectResponse],
)
def get_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    return (
        db.query(Subject)
        .filter(
            Subject.user_id == current_user.id
        )
        .order_by(Subject.created_at.desc())
        .all()
    )


@router.post(
    "",
    response_model=SubjectResponse,
)
def create_subject(
    data: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    subject_name = data.name.strip()

    if not subject_name:
        raise HTTPException(
            status_code=400,
            detail="Subject name cannot be empty.",
        )

    existing = (
        db.query(Subject)
        .filter(
            Subject.user_id == current_user.id,
            Subject.name == subject_name,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a subject with this name.",
        )

    subject = Subject(
        name=subject_name,
        user_id=current_user.id,
    )

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return subject


@router.get(
    "/{subject_id}",
    response_model=SubjectResponse,
)
def get_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    subject = (
        db.query(Subject)
        .filter(
            Subject.id == subject_id,
            Subject.user_id == current_user.id,
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found.",
        )

    return subject

@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = (
        db.query(Subject)
        .filter(
            Subject.id == subject_id,
            Subject.user_id == current_user.id,
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found.",
        )

    db.delete(subject)
    db.commit()

    return {"message": "Subject deleted successfully."}