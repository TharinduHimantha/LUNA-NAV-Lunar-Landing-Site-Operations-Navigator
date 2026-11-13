# LUNA-NAV // Master Documentation & Mission Operations Library

Welcome to the comprehensive documentation library for **LUNA-NAV (Lunar Landing Site & Operations Navigator)**, built for the **2026 NASA Space Apps Challenge ("Lunar Landing Site Navigator")**.

This documentation folder is designed to take **anyone**—from a first-time student or space enthusiast to an aerospace systems engineer or mission director—and give them a complete, crystal-clear understanding of:
1. **What every single visual element, number, color, chart, and 3D object in the UI represents.**
2. **How to read, interpret, and cross-reference the 3D terrain shadows, the 360° Polar Radar, the timeline tracks, and the Trade-Off Matrix.**
3. **The real-world lunar science, orbital mechanics, and spacecraft hardware constraints behind the app.**
4. **How to use LUNA-NAV step-by-step to make high-stakes lunar landing site and launch-window decisions.**

---

## 📚 Documentation Directory & Reading Order

| Document | Target Audience | What You Will Learn |
| :--- | :--- | :--- |
| **[01_UI_ENCYCLOPEDIA_AND_VISUAL_GUIDE.md](./01_UI_ENCYCLOPEDIA_AND_VISUAL_GUIDE.md)** | Everyone (Users, Judges, Students, Engineers) | **A-to-Z Visual Encyclopedia of the Interface:** Detailed breakdown of every header control, the 6 real-time KPI cards, the 3D Lunar Terrain & PSR cold-trap simulator, the 360° Polar Azimuthal Sky-Chart, the 4 timeline tracks, and the Split-Screen Comparison Matrix. |
| **[02_SCIENCE_ASTRODYNAMICS_AND_LUNAR_PHYSICS.md](./02_SCIENCE_ASTRODYNAMICS_AND_LUNAR_PHYSICS.md)** | Students, Educators, Scientists & Engineers | **The Real Science Behind LUNA-NAV:** Why the Sun circles the South Pole horizon at $1.54^\circ$, why Earth weaves a 27.3-day libration loop, how lunar curvature drops off over distance, why vertical solar arrays beat flat decks by $38\times$ at the pole, and why shadowed craters plunge to $40\text{ K}$ ($-233^\circ\text{C}$). |
| **[03_DECISION_MAKING_PLAYBOOK_AND_USE_CASES.md](./03_DECISION_MAKING_PLAYBOOK_AND_USE_CASES.md)** | Mission Planners, Systems Engineers & Judges | **How to Make Mission Decisions Step-by-Step:** Flight rules, Go/No-Go survival thresholds (50-hour battery limit, $70\text{ K}$ thermal floor, $1.0^\circ$ DTE multipath clearance), decision trees, and **4 Real-World Aerospace Case Studies** (Artemis III, VIPER, CLPS, and Launch Slip Contingencies). |
| **[04_STUDENT_AND_EXPLORER_LAB_GUIDE.md](./04_STUDENT_AND_EXPLORER_LAB_GUIDE.md)** | Learners, Students, Teachers & Public Explorers | **5 Interactive Hands-On Labs:** Step-by-step guided experiments telling you exactly what to click, what to watch on screen, how to interpret what happens, and why it matters. |
| **[05_TECHNICAL_ARCHITECTURE_AND_FILE_REFERENCE.md](./05_TECHNICAL_ARCHITECTURE_AND_FILE_REFERENCE.md)** | Developers & Software Architects | **Codebase & Dataset Pipeline Reference:** How every Python backend module (`main.py`, `physics_engine.py`, `data_ingestion.py`, `sites_catalog.py`, `fetch_nasa_data.py`) and React/Three.js frontend component works under the hood. |

---

## 🎨 Visual Diagrams & Infographics (`./assets/`)

We have also included annotated SVG visual reference diagrams in [`./assets/`](./assets/):
- [`./assets/ui_architecture_map.svg`](./assets/ui_architecture_map.svg) — Annotated visual map of the LUNA-NAV Mission Control interface.
- [`./assets/polar_radar_anatomy.svg`](./assets/polar_radar_anatomy.svg) — How to read the 360° Polar Azimuthal Horizon Sky-Chart.
- [`./assets/south_pole_grazing_physics.svg`](./assets/south_pole_grazing_physics.svg) — Grazing solar geometry, terrain masking, and vertical vs. flat solar array physics.

