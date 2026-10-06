import re
from collections import defaultdict
from typing import Dict, List

from app.services.semantic_matcher import calculate_similarity


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_question(text: str) -> str:
    """
    Normalize question text for exact/semantic matching.

    Example:

        "Define and explain the following terms. [6]"

    becomes:

        "define and explain the following terms 6"

    Punctuation is removed and whitespace is normalized.
    """

    if not text:
        return ""

    text = text.lower().strip()

    # Remove punctuation
    text = re.sub(r"[^\w\s]", " ", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ============================================================
# BUILD FULL QUESTION TEXT
# ============================================================

def get_full_question_text(question: Dict) -> str:
    """
    Build the complete text used for repetition matching.

    For a normal question:

        Q1(b)
        Calculate precision and recall...

    returns:

        Calculate precision and recall...

    For a question with nested items:

        Q1(a)
        Define and explain the following terms.
            i) MRR
            ii) NDCG

    returns:

        Define and explain the following terms MRR NDCG

    This is important because the nested items are part of
    the actual question and should participate in repetition
    detection.
    """

    parts = []

    parent_text = question.get("question", "")

    if parent_text:
        parts.append(parent_text)

    nested_items = question.get("nested_items", [])

    for item in nested_items:

        item_text = item.get("text", "")

        if item_text:
            parts.append(item_text)

    return " ".join(parts).strip()


# ============================================================
# CREATE MATCHING KEY
# ============================================================

def build_question_key(question: Dict) -> str:
    """
    Create an exact comparison key using:

        unit + parent question + nested items

    Example:

        Unit 1
        Define and explain the following terms.
        i) MRR
        ii) NDCG

    becomes approximately:

        1::define and explain the following terms mrr ndcg
    """

    full_text = get_full_question_text(question)

    normalized = normalize_question(full_text)

    return f"{question.get('unit')}::{normalized}"


# ============================================================
# EXACT MATCHING
# ============================================================

def find_exact_groups(
    questions: List[Dict],
) -> List[List[Dict]]:
    """
    Find exact duplicate questions.

    Parent questions and their nested items are matched
    together.

    A paper can contribute only one occurrence to a group.
    """

    groups = defaultdict(list)

    for question in questions:

        key = build_question_key(question)

        if not key:
            continue

        groups[key].append(question)

    valid_groups = []

    for group in groups.values():

        unique_paper_questions = {}

        for question in group:

            paper_id = question.get("paper_id")

            if not paper_id:
                continue

            if paper_id not in unique_paper_questions:

                unique_paper_questions[
                    paper_id
                ] = question

        unique_group = list(
            unique_paper_questions.values()
        )

        # Must appear in at least 2 papers
        if len(unique_group) >= 2:

            valid_groups.append(
                unique_group
            )

    return valid_groups


# ============================================================
# SEMANTIC MATCHING
# ============================================================

def find_semantic_groups(
    questions: List[Dict],
    threshold: float = 0.85,
) -> List[List[Dict]]:
    """
    Group semantically similar questions.

    Rules:

    - Questions must belong to the same unit.
    - Parent question + nested items are used for matching.
    - Similarity must be >= threshold.
    - A paper can appear only once in a group.
    - A group must contain at least two papers.
    """

    groups = []

    assigned = set()

    for i, question1 in enumerate(questions):

        if i in assigned:
            continue

        group = [question1]

        papers_in_group = {
            question1.get("paper_id")
        }

        for j in range(
            i + 1,
            len(questions),
        ):

            if j in assigned:
                continue

            question2 = questions[j]

            # ------------------------------------------------
            # Same unit only
            # ------------------------------------------------

            if (
                question1.get("unit")
                != question2.get("unit")
            ):
                continue

            paper_id = question2.get(
                "paper_id"
            )

            # ------------------------------------------------
            # One occurrence per paper
            # ------------------------------------------------

            if paper_id in papers_in_group:
                continue

            # ------------------------------------------------
            # Semantic similarity
            #
            # calculate_similarity() should use the complete
            # question text including nested items.
            # ------------------------------------------------

            similarity = calculate_similarity(
                question1,
                question2,
            )

            if similarity >= threshold:

                group.append(question2)

                papers_in_group.add(
                    paper_id
                )

                assigned.add(j)

        # ----------------------------------------------------
        # Only keep actual repetitions
        # ----------------------------------------------------

        if len(papers_in_group) >= 2:

            groups.append(group)

            assigned.add(i)

    return groups


# ============================================================
# OCCURRENCE BUILDER
# ============================================================

def build_occurrence(
    question: Dict,
) -> Dict:
    """
    Convert a parsed question into the occurrence object
    returned by the API.
    """

    occurrence = {
        "paper_id": question.get(
            "paper_id"
        ),
        "paper_name": question.get(
            "paper_name"
        ),
        "question_number": question.get(
            "question_number"
        ),
        "marks": question.get(
            "marks"
        ),
        "page_number": question.get(
            "page_number"
        ),
    }

    # Keep nested items so the frontend can display them.
    nested_items = question.get(
        "nested_items",
        [],
    )

    if nested_items:

        occurrence[
            "nested_items"
        ] = nested_items

    return occurrence


# ============================================================
# REPETITION DETECTION
# ============================================================

def find_repeated_questions(
    questions: List[Dict],
    threshold: float = 0.85,
) -> List[Dict]:
    """
    Find repeated questions across papers.

    IMPORTANT:

    Nested questions are NOT expanded into separate questions.

    Example:

        Q1(a)
        Define and explain the following terms.
            i) MRR
            ii) NDCG

    remains ONE question for repetition analysis.

    The matching text becomes:

        Define and explain the following terms MRR NDCG

    This allows the complete question to be compared across
    different papers.
    """

    # ========================================================
    # STEP 1
    # Exact matching
    # ========================================================

    exact_groups = find_exact_groups(
        questions
    )

    # ========================================================
    # STEP 2
    # Semantic matching
    #
    # We use semantic matching for questions that were not
    # already grouped exactly.
    # ========================================================

    semantic_groups = find_semantic_groups(
        questions,
        threshold,
    )

    # ========================================================
    # STEP 3
    # Combine groups
    #
    # Avoid returning the same question twice.
    # ========================================================

    all_groups = []

    seen_group_keys = set()

    for group in exact_groups + semantic_groups:

        if len(group) < 2:
            continue

        # Create a stable identity for the group based on
        # paper + question number.
        group_key = tuple(
            sorted(
                (
                    question.get("paper_id"),
                    question.get("question_number"),
                )
                for question in group
            )
        )

        if group_key in seen_group_keys:
            continue

        seen_group_keys.add(
            group_key
        )

        all_groups.append(
            group
        )

    # ========================================================
    # STEP 4
    # Build final API response
    # ========================================================

    results = []

    for group in all_groups:

        # ----------------------------------------------------
        # Safety:
        # one occurrence per paper.
        # ----------------------------------------------------

        unique_paper_questions = {}

        for question in group:

            paper_id = question.get(
                "paper_id"
            )

            if not paper_id:
                continue

            if paper_id not in unique_paper_questions:

                unique_paper_questions[
                    paper_id
                ] = question

        unique_group = list(
            unique_paper_questions.values()
        )

        if len(unique_group) < 2:
            continue

        # ----------------------------------------------------
        # Sort occurrences by paper name/question number
        # ----------------------------------------------------

        unique_group.sort(
            key=lambda question: (
                question.get(
                    "paper_name",
                    "",
                ),
                question.get(
                    "question_number",
                    "",
                ),
            )
        )

        # ----------------------------------------------------
        # Occurrences
        # ----------------------------------------------------

        occurrences = []

        for question in unique_group:

            occurrences.append(
                build_occurrence(
                    question
                )
            )

        # ----------------------------------------------------
        # Representative question
        #
        # Keep the original parent question text.
        # Do NOT replace it with "MRR" or "NDCG".
        # ----------------------------------------------------

        representative = unique_group[0]

        marks = sorted(
            set(
                occurrence["marks"]
                for occurrence in occurrences
                if occurrence.get(
                    "marks"
                )
                is not None
            )
        )

        result = {
            "unit": representative.get(
                "unit"
            ),
            "question": representative.get(
                "question"
            ),
            "marks": marks,
            "repeated": len(
                unique_group
            ),
            "occurrences": occurrences,
        }

        # ----------------------------------------------------
        # Preserve nested items at the top level too.
        #
        # This makes it easy for the frontend to display:
        #
        # Define and explain...
        #
        # i) MRR
        # ii) NDCG
        # ----------------------------------------------------

        nested_items = representative.get(
            "nested_items",
            [],
        )

        if nested_items:

            result[
                "nested_items"
            ] = nested_items

        results.append(
            result
        )

    # ========================================================
    # STEP 5
    # Sort results
    # ========================================================

    results.sort(
        key=lambda item: (
            item.get(
                "unit",
                999,
            ),
            item.get(
                "question",
                "",
            ),
        )
    )

    return results