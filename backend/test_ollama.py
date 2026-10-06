from app.services.ai_service import generate_answer


prompt = """
You are ReQ AI, an academic exam preparation assistant.

Explain deadlock prevention in simple language.
Give an answer suitable for a 5-mark engineering exam.
Use headings and bullet points.
"""


answer = generate_answer(prompt)

print("\n===== REQ AI ANSWER =====\n")
print(answer)