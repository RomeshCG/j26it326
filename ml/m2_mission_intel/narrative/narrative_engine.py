"""M2 Grounded Narrative Engine.

Generates structured executive narratives for Mission Drift events, adhering strictly to
NFR-06: strictly grounded on structured evidence, never altering calculated values or hallucinating figures.

Explains:
1. What changed financially (commercial performance, loan size, OSS)
2. What changed socially (outreach to women, rural communities, poverty-level borrowers)
3. The dual-mission trade-off and prescriptive governance recommendations
"""
from __future__ import annotations

import json
from typing import Any


def determine_severity(score: float, threshold: float = 20.0, velocity: float | None = None) -> str:
    """Classifies mission drift severity."""
    if score >= threshold * 1.5:
        return "CRITICAL"
    if score >= threshold:
        return "ALERT"
    if score >= threshold * 0.7 or (velocity is not None and velocity >= 5.0):
        return "WATCH"
    return "NORMAL"


def generate_grounded_narrative(
    mdi_data: dict[str, Any],
    kpi_data: dict[str, Any] | None = None,
    predictive_risk: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generates an evidence-grounded narrative from structured MDI and financial KPIs.

    All numerical facts in the output are strictly taken from the input dictionary.
    """
    score = float(mdi_data.get("score", 0.0))
    threshold = float(mdi_data.get("threshold", 20.0))
    state = str(mdi_data.get("state", "normal"))
    velocity = mdi_data.get("changeVelocity")
    month = str(mdi_data.get("month", "current period"))

    trends: list[dict[str, Any]] = mdi_data.get("contributingTrends", [])
    if isinstance(trends, str):
        try:
            trends = json.loads(trends)
        except Exception:
            trends = []

    severity = determine_severity(score, threshold, velocity)

    # Sort trends by adverse contribution
    adverse_trends = [t for t in trends if t.get("contribution", 0) > 0]
    adverse_trends.sort(key=lambda t: t.get("contribution", 0), reverse=True)

    favorable_trends = [t for t in trends if t.get("contribution", 0) < 0]
    favorable_trends.sort(key=lambda t: t.get("contribution", 0))

    # Identify primary drivers
    primary_adverse = adverse_trends[:3]
    driver_clauses = []
    evidence_points = []

    for t in primary_adverse:
        lbl = t.get("label", t.get("indicator", ""))
        rel = float(t.get("relativeChange", 0.0))
        contrib = float(t.get("contribution", 0.0))
        sign = "+" if rel > 0 else ""
        driver_clauses.append(f"{lbl} ({sign}{rel * 100:.1f}%, contributing +{contrib:.1f} pts)")
        evidence_points.append({
            "indicator": t.get("indicator"),
            "label": lbl,
            "relative_change_pct": round(rel * 100, 2),
            "baseline": t.get("baseline"),
            "current": t.get("current"),
            "contribution_points": round(contrib, 2),
        })

    # Compose headline
    if state == "alert" or score >= threshold:
        headline = (
            f"Mission Drift Alert: MDI reached {score:.1f} (threshold {threshold:.1f}) in {month}, "
            f"driven primarily by {'; '.join([t.get('label', '') for t in primary_adverse])}."
        )
    elif severity == "WATCH":
        vel_text = f" with rapid momentum (+{velocity:.1f} pts/month)" if velocity else ""
        headline = (
            f"Mission Drift Watch: MDI elevated at {score:.1f} (threshold {threshold:.1f}){vel_text}. "
            f"Early warning indicators require managerial attention."
        )
    else:
        headline = (
            f"Mission Alignment Normal: MDI stands at {score:.1f}, safely below threshold {threshold:.1f}. "
            f"Social mission targets remain balanced with financial operations."
        )

    # Financial analysis
    fin_text_parts = []
    if kpi_data:
        if "portfolioOutstanding" in kpi_data and kpi_data["portfolioOutstanding"]:
            port_m = float(kpi_data["portfolioOutstanding"]) / 1_000_000.0
            fin_text_parts.append(f"gross portfolio outstanding at LKR {port_m:.2f}M")
        if "avgLoanSize" in kpi_data and kpi_data["avgLoanSize"]:
            fin_text_parts.append(f"average loan ticket size at LKR {float(kpi_data['avgLoanSize']):,.0f}")
        if "par30" in kpi_data and kpi_data["par30"] is not None:
            fin_text_parts.append(f"PAR30 at {float(kpi_data['par30']) * 100:.2f}%")
        if "oss" in kpi_data and kpi_data["oss"] is not None:
            fin_text_parts.append(f"Operational Self-Sufficiency (OSS) at {float(kpi_data['oss']) * 100:.1f}%")

    avg_loan_trend = next((t for t in trends if "loan_size" in t.get("indicator", "")), None)
    if avg_loan_trend:
        fin_text_parts.append(f"average loan size shifted by {avg_loan_trend.get('relativeChange', 0) * 100:+.1f}% vs baseline")

    financial_summary = (
        "Commercial operations show " + "; ".join(fin_text_parts) + "."
        if fin_text_parts
        else "Financial indicators remain within baseline operating ranges."
    )

    # Social analysis
    social_text_parts = []
    for t in adverse_trends:
        if "loan_size" not in t.get("indicator", ""):
            social_text_parts.append(
                f"{t.get('label')} fell from baseline {t.get('baseline'):.1%} to {t.get('current'):.1%} ({t.get('relativeChange'):+.1%})"
            )
    social_summary = (
        "Social outreach has experienced contraction: " + "; ".join(social_text_parts) + "."
        if social_text_parts
        else "Social inclusion indicators remain stable relative to the 3-month baseline."
    )

    # Trade-off analysis
    if state == "alert" or severity in ("ALERT", "CRITICAL"):
        tradeoff = (
            f"The institution is exhibiting classical commercialization trade-offs: operational focus "
            f"has pivoted towards larger, more commercially profitable credit facilities, while core vulnerable cohorts "
            f"({', '.join([t.get('label', '') for t in primary_adverse if 'loan_size' not in t.get('indicator', '')])}) "
            f"face disproportionate exclusion."
        )
    else:
        tradeoff = (
            "The balance between commercial sustainability and social outreach is currently healthy, "
            "with no systemic exclusion observed across primary mission segments."
        )

    # Recommendations
    recs = []
    if score >= threshold:
        recs.append("Institute branch-level borrower diversity targets to restore female and below-poverty outreach.")
        recs.append("Introduce loan size caps on commercial micro-enterprise loans to halt upward ticket creep.")
        recs.append("Conduct a loan officer incentive review to align field disbursements with social performance targets.")
    elif severity == "WATCH":
        recs.append("Monitor client intake pipeline over the next 30 days to halt downward trajectory in rural cohorts.")
        recs.append("Review branch manager credit approvals for deviations from target demographic profiles.")
    else:
        recs.append("Maintain current underwriting and field outreach policies.")
        recs.append("Continue quarterly MDI surveillance across all branch portfolios.")

    # Predictive risk context if present
    predictive_summary = None
    if predictive_risk:
        prob = predictive_risk.get("drift_probability_next_3m")
        pred_band = predictive_risk.get("risk_band", "unknown")
        if prob is not None:
            predictive_summary = {
                "forward_drift_probability": round(float(prob), 4),
                "forward_risk_band": pred_band,
                "model_confidence": predictive_risk.get("confidence", "high"),
                "leading_signals": predictive_risk.get("leading_signals", []),
            }

    return {
        "headline": headline,
        "severity": severity,
        "score": score,
        "threshold": threshold,
        "state": state,
        "month": month,
        "financial_summary": financial_summary,
        "social_summary": social_summary,
        "tradeoff_analysis": tradeoff,
        "recommendations": recs,
        "primary_drivers": driver_clauses,
        "evidence_table": evidence_points,
        "predictive_risk": predictive_summary,
    }


def format_llm_prompt(evidence: dict[str, Any]) -> str:
    """Formats a strictly constrained prompt for LLM narrative refinement.

    Guarantees NFR-06 by providing explicit instructions that the model MUST NOT
    hallucinate, invent, or modify any numbers.
    """
    evidence_json = json.dumps(evidence, indent=2)
    return f"""You are the Chief Mission Governance Advisor for a Microfinance Institution (MFI).
Analyze the following verified Mission Drift Index (MDI) evidence and produce an executive briefing.

CRITICAL INSTRUCTIONS (NFR-06 COMPLIANCE):
1. Use ONLY the exact numbers, percentages, and metrics provided in the JSON data below.
2. DO NOT invent, extrapolate, or estimate any financial or social figures.
3. Structure your response into:
   - Executive Alert Summary
   - Financial Context vs. Social Outreach Dynamics
   - Dual-Mission Trade-off Assessment
   - Recommended Strategic Interventions

VERIFIED EVIDENCE:
{evidence_json}
"""
