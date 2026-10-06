from app.services.semantic_matcher import calculate_similarity


q1 = {
    "question": "Define and explain the following terms.",
    "nested_items": [
        {"item": "i", "text": "MRR"},
        {"item": "ii", "text": "NDCG"},
    ],
    "unit": 3,
}


q2 = {
    "question": "Define and explain the following terms.",
    "nested_items": [
        {"item": "i", "text": "Precision"},
        {"item": "ii", "text": "Recall"},
    ],
    "unit": 3,
}


q3 = {
    "question": "What is multimedia IR? Explain GEMINI approach of Multimedia IR.",
    "nested_items": [],
    "unit": 4,
}


q4 = {
    "question": "What is multimedia IR? Explain GEMINI approach for Multimedia IR.",
    "nested_items": [],
    "unit": 4,
}


print("\n--- ReQ Semantic Test ---")


nested_similarity = calculate_similarity(q1, q2)

print(
    f"MRR/NDCG vs Precision/Recall: "
    f"{nested_similarity:.4f}"
)


gemini_similarity = calculate_similarity(q3, q4)

print(
    f"GEMINI vs GEMINI: "
    f"{gemini_similarity:.4f}"
)