#!/usr/bin/env python3
"""Genera PDF del plan de trabajo desde PLAN_DE_TRABAJO.md"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[2]
MD_PATH = ROOT / "Soporte" / "Documentos" / "PLAN_DE_TRABAJO.md"
OUT_PATH = ROOT / "Soporte" / "Documentos" / "PLAN_DE_TRABAJO.pdf"
FONT_REG = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")


class PlanPDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 9)
        self.set_text_color(90, 90, 90)
        self.cell(0, 8, "TacticalPtx — Plan de trabajo maestro", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Página {self.page_no()}/{{nb}}", align="C")


def clean_inline(text: str) -> str:
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("\u2011", "-").replace("·", "-")
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text.strip()


def parse_table_row(line: str) -> list[str]:
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    return [clean_inline(p) for p in parts]


def is_table_sep(line: str) -> bool:
    return bool(re.match(r"^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$", line.strip()))


def add_wrapped(pdf: PlanPDF, text: str, size: int = 10, bold: bool = False, indent: float = 0):
    style = "B" if bold else ""
    pdf.set_font("Arial", style, size)
    pdf.set_text_color(20, 20, 20)
    pdf.set_x(pdf.l_margin + indent)
    pdf.multi_cell(0, 5.5, clean_inline(text))


def add_table(pdf: PlanPDF, rows: list[list[str]]):
    if not rows:
        return
    cols = len(rows[0])
    widths = []
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    if cols == 2:
        widths = [page_w * 0.38, page_w * 0.62]
    elif cols == 4:
        widths = [page_w * 0.08, page_w * 0.34, page_w * 0.18, page_w * 0.40]
    elif cols == 5:
        widths = [page_w * 0.06, page_w * 0.28, page_w * 0.14, page_w * 0.22, page_w * 0.30]
    else:
        w = page_w / cols
        widths = [w] * cols

    pdf.set_font("Arial", "B", 8)
    pdf.set_fill_color(240, 244, 238)
    for i, cell in enumerate(rows[0]):
        pdf.cell(widths[i], 7, cell[:80], border=1, fill=True)
    pdf.ln()

    pdf.set_font("Arial", "", 8)
    for row in rows[1:]:
        if pdf.get_y() > pdf.h - 20:
            pdf.add_page()
        line_h = 6
        x0 = pdf.get_x()
        y0 = pdf.get_y()
        max_h = line_h
        cell_lines: list[list[str]] = []
        for i, cell in enumerate(row):
            w = widths[i] if i < len(widths) else widths[-1]
            pdf.set_xy(x0 + sum(widths[:i]), y0)
            txt = (
                cell.replace("🟢", "[OK]")
                .replace("🟡", "[~]")
                .replace("⬜", "[ ]")
                .replace("\u2011", "-")
            )
            lines = pdf.multi_cell(w, line_h, txt, border=0, dry_run=True, output="LINES")
            cell_lines.append(lines)
            max_h = max(max_h, line_h * len(lines))
        for i, lines in enumerate(cell_lines):
            w = widths[i] if i < len(widths) else widths[-1]
            x = x0 + sum(widths[:i])
            pdf.rect(x, y0, w, max_h)
            for j, ln in enumerate(lines):
                pdf.set_xy(x + 1, y0 + j * line_h + 0.5)
                pdf.cell(w - 2, line_h, ln)
        pdf.set_xy(x0, y0 + max_h)


def build_pdf(md_text: str, out_path: Path) -> None:
    pdf = PlanPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_font("Arial", "", str(FONT_REG))
    pdf.add_font("Arial", "B", str(FONT_BOLD))
    pdf.add_page()

    table_buf: list[list[str]] = []
    in_table = False

    for raw in md_text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            if in_table and table_buf:
                add_table(pdf, table_buf)
                table_buf = []
                in_table = False
            pdf.ln(2)
            continue

        if stripped.startswith("|"):
            if is_table_sep(stripped):
                continue
            if not in_table:
                in_table = True
                table_buf = []
            table_buf.append(parse_table_row(stripped))
            continue
        elif in_table and table_buf:
            add_table(pdf, table_buf)
            table_buf = []
            in_table = False

        if stripped == "---":
            pdf.ln(1)
            pdf.set_draw_color(200, 200, 200)
            y = pdf.get_y()
            pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
            pdf.ln(4)
            continue

        if stripped.startswith("# "):
            if pdf.get_y() > 30:
                pdf.ln(2)
            pdf.set_font("Arial", "B", 18)
            pdf.set_text_color(36, 61, 32)
            pdf.multi_cell(0, 9, clean_inline(stripped[2:]))
            pdf.ln(2)
            continue

        if stripped.startswith("## "):
            if pdf.get_y() > 250:
                pdf.add_page()
            pdf.ln(2)
            pdf.set_font("Arial", "B", 13)
            pdf.set_text_color(36, 61, 32)
            pdf.multi_cell(0, 7, clean_inline(stripped[3:]))
            pdf.ln(1)
            continue

        if stripped.startswith("### "):
            pdf.ln(1)
            pdf.set_font("Arial", "B", 11)
            pdf.set_text_color(50, 80, 45)
            pdf.multi_cell(0, 6, clean_inline(stripped[4:]))
            pdf.ln(0.5)
            continue

        if stripped.startswith("- [ ] ") or stripped.startswith("- [x] ") or stripped.startswith("- [X] "):
            mark = "[x]" if stripped[3] in "xX" else "[ ]"
            add_wrapped(pdf, f"  {mark}  {stripped[6:]}", size=9, indent=2)
            continue

        if re.match(r"^\d+\.\s", stripped):
            add_wrapped(pdf, stripped, size=10, indent=2)
            continue

        if stripped.startswith("- "):
            add_wrapped(pdf, f"• {stripped[2:]}", size=9, indent=2)
            continue

        if stripped.startswith("*") and stripped.endswith("*"):
            pdf.set_font("Arial", "", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.multi_cell(0, 5, clean_inline(stripped.strip("*")))
            continue

        add_wrapped(pdf, stripped, size=10)

    if table_buf:
        add_table(pdf, table_buf)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out_path))


def main() -> int:
    md_path = Path(sys.argv[1]) if len(sys.argv) > 1 else MD_PATH
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT_PATH
    if not md_path.is_file():
        print(f"No existe: {md_path}", file=sys.stderr)
        return 1
    if not FONT_REG.is_file() or not FONT_BOLD.is_file():
        print("Fuentes Arial no encontradas en Windows Fonts", file=sys.stderr)
        return 1
    build_pdf(md_path.read_text(encoding="utf-8"), out_path)
    print(f"PDF generado: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
