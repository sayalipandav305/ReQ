from typing import Dict, List


DEFAULT_ENDSEM_MAPPING = {
    3: [1, 2],
    4: [3, 4],
    5: [5, 6],
    6: [7, 8],
}


DEFAULT_INSEM_MAPPING = {
    1: [1, 2],
    2: [3, 4],
}


def get_unit_for_question(
    question_number: int,
    mapping: Dict[int, List[int]]
) -> int | None:

    for unit, question_numbers in mapping.items():

        if question_number in question_numbers:
            return unit

    return None