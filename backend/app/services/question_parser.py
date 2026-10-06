import re

from typing import List, Dict, Optional

from app.models.exam_config import (
    DEFAULT_ENDSEM_MAPPING,
    get_unit_for_question
)


# ---------------------------------------------------------
# MAIN QUESTION
# Matches:
# Q1)
# Q2)
# Q 1)
# ---------------------------------------------------------

MAIN_QUESTION_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])Q\s*(\d+)\s*\)",
    re.IGNORECASE
)


# ---------------------------------------------------------
# SUB QUESTION
# Matches:
# a)
# b)
# c)
# ---------------------------------------------------------

SUBQUESTION_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])([a-h])\s*\)",
    re.IGNORECASE
)


# ---------------------------------------------------------
# NESTED ITEM
# Matches:
# i)
# ii)
# iii)
# iv)
# ---------------------------------------------------------

ROMAN_ITEM_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])"
    r"(i{1,3}|iv|v|vi|vii|viii|ix|x)"
    r"\s*\)",
    re.IGNORECASE
)


# ---------------------------------------------------------
# MARKS
# [6]
# [8]
# [9]
# ---------------------------------------------------------

MARKS_PATTERN = re.compile(
    r"\[\s*(\d+)\s*\]"
)


# ---------------------------------------------------------
# OR
# ---------------------------------------------------------

OR_PATTERN = re.compile(
    r"(?m)^\s*OR\s*$",
    re.IGNORECASE
)


# ---------------------------------------------------------
# FOOTER / PAGE ARTIFACTS
# ---------------------------------------------------------
FOOTER_PATTERNS = [

    # Old papers sometimes contain this footer block:
    #
    # Total No. of Questions : 8]
    # [Total No. of Pages : 2
    # [6004]-563
    # B.E. (IT)
    #
    # IMPORTANT:
    # Match "Total No. of Questions" ONLY when it is
    # immediately followed by "Total No. of Pages".
    # This prevents deleting the header at the top.
    re.compile(
        r"Total\s+No\.\s+of\s+Questions\s*:\s*\d+\s*\]"
        r"\s*\[\s*Total\s+No\.\s+of\s+Pages\s*:\s*\d+.*",
        re.IGNORECASE | re.DOTALL
    ),

    # Repeated PDF footer / timestamp
    re.compile(
        r"CEGP\d+.*?static-\d+",
        re.IGNORECASE | re.DOTALL
    ),

    # Known website footer
    re.compile(
        r"SPPUQuestionPapers\.com",
        re.IGNORECASE
    ),
]
# =========================================================
# CLEAN TEXT
# =========================================================

def clean_text(text: str) -> str:

    text = text.replace("\xa0", " ")

    # Remove P.T.O.
    text = re.sub(
        r"P\.T\.O\.",
        "",
        text,
        flags=re.IGNORECASE
    )

    # Remove complete footer
    for pattern in FOOTER_PATTERNS:
        text = pattern.sub("", text)

    # Remove corrupted Unicode symbols
    text = re.sub(
        r"(?:[]){2,}",
        " ",
        text
    )

    # Remove replacement characters
    text = re.sub(
        r"(?:�)+",
        " ",
        text
    )

    # Fix known extraction typo
    text = re.sub(
        r"\bwed\s+searching\b",
        "web searching",
        text,
        flags=re.IGNORECASE
    )

    # Normalize spaces
    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    # Normalize blank lines
    text = re.sub(
        r"\n\s*\n+",
        "\n",
        text
    )

    return text.strip()

# =========================================================
# NORMALIZE QUESTION TEXT
# =========================================================

def normalize_question_text(text: str) -> str:
    """
    Normalize whitespace inside question text.
    """

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# =========================================================
# EXTRACT MARKS
# =========================================================

def extract_marks(text: str) -> Optional[int]:
    """
    Extract the last valid marks value from a question.
    """

    matches = MARKS_PATTERN.findall(text)

    if not matches:
        return None

    valid_marks = []

    for match in matches:

        marks = int(match)

        # Exam questions in our papers use normal marks.
        if 1 <= marks <= 20:
            valid_marks.append(marks)

    if not valid_marks:
        return None

    return valid_marks[-1]


# =========================================================
# REMOVE MARKS
# =========================================================

def remove_marks(text: str) -> str:
    """
    Remove [6], [8], [9] etc.
    """

    return MARKS_PATTERN.sub("", text)


# =========================================================
# PARSE NESTED ITEMS
# =========================================================

def parse_nested_items(
    text: str
) -> List[Dict]:
    """
    Parse i), ii), iii) etc. inside a sub-question.
    """

    matches = list(
        ROMAN_ITEM_PATTERN.finditer(text)
    )

    if not matches:
        return []

    items = []

    for index, match in enumerate(matches):

        roman = match.group(1).lower()

        start = match.end()

        if index + 1 < len(matches):
            end = matches[index + 1].start()
        else:
            end = len(text)

        item_text = text[start:end]

        item_text = normalize_question_text(
            item_text
        )

        if item_text:
            items.append({
                "item": roman,
                "text": item_text
            })

    return items


# =========================================================
# PARSE SUBQUESTIONS
# =========================================================

def parse_subquestions(
    question_block: str,
    main_question_number: int,
    page_number: int
) -> List[Dict]:

    sub_matches = list(
        SUBQUESTION_PATTERN.finditer(
            question_block
        )
    )

    questions = []

    # -----------------------------------------------------
    # No a/b/c
    # -----------------------------------------------------

    if not sub_matches:

        marks = extract_marks(
            question_block
        )

        question_text = remove_marks(
            question_block
        )

        question_text = normalize_question_text(
            question_text
        )

        if question_text:

            questions.append({
                "question_number":
                    f"Q{main_question_number}",

                "main_question":
                    main_question_number,

                "sub_question":
                    None,

                "question":
                    question_text,

                "marks":
                    marks,

                "page_number":
                    page_number,

                "nested_items":
                    []
            })

        return questions

    # -----------------------------------------------------
    # Parse a / b / c
    # -----------------------------------------------------

    for index, sub_match in enumerate(
        sub_matches
    ):

        sub_letter = (
            sub_match
            .group(1)
            .lower()
        )

        start = sub_match.end()

        if index + 1 < len(sub_matches):
            end = sub_matches[index + 1].start()
        else:
            end = len(question_block)

        sub_text = question_block[
            start:end
        ]

        # -------------------------------------------------
        # Extract marks
        # -------------------------------------------------

        marks = extract_marks(
            sub_text
        )

        # -------------------------------------------------
        # Remove marks
        # -------------------------------------------------

        sub_text_without_marks = remove_marks(
            sub_text
        )

        # -------------------------------------------------
        # Extract nested i / ii / iii
        # -------------------------------------------------

        nested_items = parse_nested_items(
            sub_text_without_marks
        )

        # -------------------------------------------------
        # Clean main question text
        # -------------------------------------------------

        question_text = normalize_question_text(
            sub_text_without_marks
        )

        # If nested items exist, remove them from
        # the main question text.

        if nested_items:

            first_item_match = ROMAN_ITEM_PATTERN.search(
                sub_text_without_marks
            )

            if first_item_match:

                question_text = (
                    sub_text_without_marks[
                        :first_item_match.start()
                    ]
                )

                question_text = normalize_question_text(
                    question_text
                )

        if question_text:

            questions.append({

                "question_number":
                    f"Q{main_question_number}({sub_letter})",

                "main_question":
                    main_question_number,

                "sub_question":
                    sub_letter,

                "question":
                    question_text,

                "marks":
                    marks,

                "page_number":
                    page_number,

                "nested_items":
                    nested_items
            })

    return questions


# =========================================================
# PARSE PAGE
# =========================================================

def parse_page(
    text: str,
    page_number: int
) -> List[Dict]:

    text = clean_text(text)

    main_matches = list(
        MAIN_QUESTION_PATTERN.finditer(
            text
        )
    )

    questions = []

    for index, match in enumerate(
        main_matches
    ):

        main_question_number = int(
            match.group(1)
        )

        start = match.end()

        if index + 1 < len(main_matches):

            end = main_matches[
                index + 1
            ].start()

        else:

            end = len(text)

        block = text[
            start:end
        ]

        # -------------------------------------------------
        # Remove OR from current question block
        #
        # Q1 content
        # OR
        # Q2 content
        #
        # Q2 is separately detected as another main
        # question.
        # -------------------------------------------------

        or_match = OR_PATTERN.search(
            block
        )

        if or_match:

            block = block[
                :or_match.start()
            ]

        block = block.strip()

        if not block:
            continue

        parsed = parse_subquestions(
            block,
            main_question_number,
            page_number
        )

        questions.extend(
            parsed
        )

    return questions


# =========================================================
# PARSE COMPLETE PAPER
# =========================================================

def parse_paper(
    pages: List[Dict],
    unit_mapping: Dict[int, List[int]] = DEFAULT_ENDSEM_MAPPING
) -> List[Dict]:

    all_questions = []

    for page in pages:

        page_questions = parse_page(
            page["text"],
            page["page_number"]
        )

        all_questions.extend(
            page_questions
        )

    # -----------------------------------------------------
    # Assign unit
    # -----------------------------------------------------

    for question in all_questions:

        question["unit"] = get_unit_for_question(
            question["main_question"],
            unit_mapping
        )

    return all_questions