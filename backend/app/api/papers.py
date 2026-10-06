from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.pdf_service import extract_text_from_pdf
from app.services.question_parser import parse_paper
from app.services.repetition_service import find_repeated_questions


router = APIRouter(
    prefix="/papers",
    tags=["Question Papers"]
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_paper(file: UploadFile = File(...)):

    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    # Generate unique filename
    file_id = uuid4().hex
    filename = f"{file_id}.pdf"

    file_path = UPLOAD_DIR / filename

    # Save file
    contents = await file.read()
    file_path.write_bytes(contents)

    # Extract text
    try:
        extracted = extract_text_from_pdf(str(file_path))
    except Exception as e:
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract PDF text: {str(e)}"
        )

    return {
        "success": True,
        "file_id": file_id,
        "filename": file.filename,
        "pages": extracted["total_pages"],
        "content": extracted["pages"]
    }

@router.post("/parse")
async def parse_uploaded_paper(file: UploadFile = File(...)):

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    file_id = uuid4().hex
    filename = f"{file_id}.pdf"

    file_path = UPLOAD_DIR / filename

    contents = await file.read()
    file_path.write_bytes(contents)

    try:

        extracted = extract_text_from_pdf(
            str(file_path)
        )

        questions = parse_paper(
            extracted["pages"]
        )

    except Exception as e:

        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse paper: {str(e)}"
        )

    return {
        "success": True,
        "file_id": file_id,
        "filename": file.filename,
        "total_pages": extracted["total_pages"],
        "total_questions": len(questions),
        "questions": questions
    }

@router.post("/analyze")
async def analyze_paper(
    file: UploadFile = File(...)
):

    if file.content_type != "application/pdf":

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    file_id = uuid4().hex

    filename = f"{file_id}.pdf"

    file_path = UPLOAD_DIR / filename

    contents = await file.read()

    file_path.write_bytes(contents)

    try:

        # ---------------------------------------------
        # 1. Extract PDF text
        # ---------------------------------------------

        extracted = extract_text_from_pdf(
            str(file_path)
        )

        # ---------------------------------------------
        # 2. Parse questions
        # ---------------------------------------------

        questions = parse_paper(
            extracted["pages"]
        )

        # ---------------------------------------------
        # 3. Add paper information
        # ---------------------------------------------

        paper_name = Path(
            file.filename
        ).stem

        for question in questions:

            question["paper_id"] = file_id

            question["paper_name"] = paper_name

    except Exception as e:

        file_path.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze paper: {str(e)}"
        )

    return {
        "success": True,

        "paper": {
            "id": file_id,
            "name": paper_name,
            "filename": file.filename,
            "total_pages":
                extracted["total_pages"]
        },

        "total_questions":
            len(questions),

        "questions":
            questions
    }

@router.post("/compare")
async def compare_papers(
    files: List[UploadFile] = File(...)
):
    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least 2 question papers."
        )

    all_questions = []
    analyzed_papers = []

    for file in files:

        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail=f"{file.filename} is not a PDF file."
            )

        file_id = uuid4().hex
        filename = f"{file_id}.pdf"
        file_path = UPLOAD_DIR / filename

        contents = await file.read()
        file_path.write_bytes(contents)

        try:
            extracted = extract_text_from_pdf(str(file_path))

            questions = parse_paper(
                extracted["pages"]
            )

            paper_name = Path(file.filename).stem

            for question in questions:
                question["paper_id"] = file_id
                question["paper_name"] = paper_name

            all_questions.extend(questions)

            analyzed_papers.append({
                "id": file_id,
                "name": paper_name,
                "filename": file.filename,
                "total_pages": extracted["total_pages"],
                "total_questions": len(questions),
            })

        except Exception as e:
            file_path.unlink(missing_ok=True)

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Failed to analyze "
                    f"{file.filename}: {str(e)}"
                )
            )

    repeated_questions = find_repeated_questions(
        all_questions
    )

    return {
        "success": True,
        "papers": analyzed_papers,
        "total_papers": len(analyzed_papers),
        "total_questions": len(all_questions),
        "questions": all_questions,
        "repeated_questions": repeated_questions,
    }