from typing import Dict, List

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


MODEL_NAME = "all-MiniLM-L6-v2"

# Load the model once when the service starts.
model = SentenceTransformer(MODEL_NAME)


def build_question_text(question: Dict) -> str:
    """
    Build the complete text representation of a question.

    The main question and nested items are treated as one
    complete exam question.
    """

    parts = [question["question"]]

    nested_items = question.get("nested_items", [])

    for item in nested_items:
        parts.append(item["text"])

    return " ".join(parts).strip()


def calculate_similarity(
    question1: Dict,
    question2: Dict
) -> float:

    text1 = build_question_text(question1)
    text2 = build_question_text(question2)

    embeddings = model.encode(
        [text1, text2],
        normalize_embeddings=True
    )

    similarity = cosine_similarity(
        [embeddings[0]],
        [embeddings[1]]
    )[0][0]

    return float(similarity)


def find_semantic_matches(
    questions: List[Dict],
    threshold: float = 0.80
) -> List[Dict]:

    matches = []

    for i in range(len(questions)):

        for j in range(i + 1, len(questions)):

            q1 = questions[i]
            q2 = questions[j]

            # Only compare questions from the same unit.
            if q1["unit"] != q2["unit"]:
                continue

            # Don't compare questions from the same paper.
            if q1["paper_id"] == q2["paper_id"]:
                continue

            similarity = calculate_similarity(
                q1,
                q2
            )

            if similarity >= threshold:

                matches.append({
                    "question1": q1,
                    "question2": q2,
                    "similarity": round(similarity, 4)
                })

    return matches