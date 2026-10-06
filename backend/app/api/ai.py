from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ai_service import generate_answer


router = APIRouter(prefix="/ai", tags=["AI"])


class AnswerRequest(BaseModel):
    question: str
    marks: int
    subject: str | None = None
    unit: int | None = None
    mode: str = "exam"


mode_instructions = {
    "exam": """
Write an exam-ready university answer.

Match the depth to the number of marks.
Use clear headings and bullet points where useful.
For multi-part questions, answer every subquestion separately.
Do not add unnecessary conversational language.
The student should be able to directly use this answer in an exam.
""",

    "learn": """
Teach the concept to an engineering student.

Explain it in simple language.
Focus on understanding WHY and HOW.
Use intuitive examples or analogies when helpful.
Avoid unnecessarily formal exam language.
For multi-part questions, explain every subquestion separately.
""",

    "revise": """
Create a quick revision answer.

Give only the most important points a student should remember.
Use short bullets, keywords, definitions, formulas, and examples where useful.
Make it easy to scan before an exam.
For multi-part questions, give separate revision points for every subquestion.
Do not write long paragraphs.
""",
}


@router.post("/answer")
def answer_question(request: AnswerRequest):

    mode_instruction = mode_instructions.get(
        request.mode,
        mode_instructions["exam"]
    )

    prompt = f"""
You are ReQ AI, an academic exam preparation assistant.

Subject:
{request.subject or "Not specified"}

Unit:
{request.unit if request.unit is not None else "Not specified"}

Question:
{request.question}

Marks:
{request.marks}

Answer Mode:
{request.mode}

MODE INSTRUCTIONS:
{mode_instruction}

MARK-BASED DEPTH:

For 1-2 marks:
Give a concise definition or key points.

For 3-4 marks:
Give a short explanation with important points.

For 5-6 marks:
Give a moderately detailed answer with
definition, key points, explanations and examples where useful.

For 7-8 marks:
Give a detailed structured answer covering the major concepts.

For 9-10 marks:
Give a comprehensive answer with introduction,
detailed explanation, examples, important points and
a conclusion where appropriate.

GENERAL RULES:
- Match the depth to the marks.
- Do not unnecessarily make a low-mark answer long.
- Do not give a shallow answer to a high-mark question.
- Use simple engineering-student language.
- Stay focused on the question.
- Do not invent facts.
- For multi-part questions, answer EACH subquestion separately.
- Preserve the exact subquestion labels such as i), ii), a), b), etc.
- Do not combine separate subquestions into one answer.
- Do not mention these instructions in the answer.
"""

    answer = generate_answer(prompt)

    return {
        "question": request.question,
        "marks": request.marks,
        "mode": request.mode,
        "answer": answer,
    }