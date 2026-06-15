import io
import re
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _escape(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _strip_markdown(text: str) -> str:
    t = re.sub(r"#{1,6}\s*", "", text)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"^[-*]\s+", "• ", t, flags=re.MULTILINE)
    t = re.sub(r"^>\s+", "", t, flags=re.MULTILINE)
    return t.strip()


class PDFService:
    def generate_report_pdf(self, title: str, content: dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = [
            Paragraph(_escape(title), styles["Title"]),
            Spacer(1, 12),
        ]

        equipment_code = content.get("equipment_code")
        equipment_name = content.get("equipment_name")
        if equipment_code:
            story.append(Paragraph("Equipment", styles["Heading2"]))
            line = f"<b>{_escape(equipment_code)}</b>"
            if equipment_name:
                line += f" — {_escape(equipment_name)}"
            story.append(Paragraph(line, styles["Normal"]))
            story.append(Spacer(1, 8))

        risk = content.get("risk", {})
        if risk.get("risk_level"):
            story.append(Paragraph(
                f"Risk level: <b>{_escape(str(risk['risk_level']).upper())}</b>",
                styles["Normal"],
            ))
            story.append(Spacer(1, 6))

        summary = content.get("executive_summary") or content.get("query", "")
        if summary:
            story.append(Paragraph("Diagnosis Summary", styles["Heading2"]))
            story.append(Paragraph(_escape(_strip_markdown(str(summary))[:5000]), styles["Normal"]))
            story.append(Spacer(1, 8))

        diagnosis = content.get("diagnosis", {})
        causes = diagnosis.get("probable_causes", [])
        if causes:
            story.append(Paragraph("Root Cause Analysis", styles["Heading2"]))
            for c in causes[:8]:
                conf = c.get("confidence", "N/A")
                if isinstance(conf, (int, float)):
                    conf = f"{float(conf):.0%}" if conf <= 1 else f"{conf}%"
                text = f"• {_escape(c.get('cause', 'N/A'))} (confidence: {conf})"
                story.append(Paragraph(text, styles["Normal"]))
                evidence = c.get("evidence")
                if evidence:
                    story.append(Paragraph(
                        f"&nbsp;&nbsp;&nbsp;{_escape(str(evidence)[:400])}",
                        styles["Normal"],
                    ))
            story.append(Spacer(1, 8))

        predictive = content.get("predictive", {})
        if predictive:
            story.append(Paragraph("Predictive Maintenance", styles["Heading2"]))
            fp = predictive.get("failure_probability")
            rul = predictive.get("rul_cycles")
            parts = []
            if fp is not None:
                parts.append(f"Failure probability: {float(fp):.0%}" if float(fp) <= 1 else f"Failure probability: {fp}")
            if rul is not None:
                parts.append(f"RUL: {rul} cycles")
            if parts:
                story.append(Paragraph(" | ".join(parts), styles["Normal"]))
                story.append(Spacer(1, 8))

        actions = content.get("maintenance_actions", [])
        if actions:
            story.append(Paragraph("Maintenance Actions", styles["Heading2"]))
            for a in actions[:10]:
                story.append(Paragraph(
                    f"[{_escape(a.get('priority', ''))}] {_escape(a.get('action', ''))} — {_escape(a.get('timeframe', ''))}",
                    styles["Normal"],
                ))
            story.append(Spacer(1, 8))

        spares = content.get("spare_recommendations", [])
        if spares:
            story.append(Paragraph("Spare Parts", styles["Heading2"]))
            for s in spares[:8]:
                name = s.get("part") or s.get("part_name") or s.get("part_code") or "Part"
                qty = s.get("quantity_recommended", "")
                story.append(Paragraph(
                    f"• {_escape(name)} (qty: {qty})",
                    styles["Normal"],
                ))

        doc.build(story)
        buffer.seek(0)
        return buffer.read()
