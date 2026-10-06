import fitz
from pathlib import Path


def extract_text_from_pdf(file_path: str) -> dict:
    """
    Extract text from every page of a PDF while preserving
    page boundaries.
    """

    pdf_path = Path(file_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    document = fitz.open(file_path)

    pages = []

    for page_number, page in enumerate(document, start=1):
        text = page.get_text("text")

        pages.append({
            "page_number": page_number,
            "text": text.strip()
        })

    document.close()

    return {
        "total_pages": len(pages),
        "pages": pages
    }