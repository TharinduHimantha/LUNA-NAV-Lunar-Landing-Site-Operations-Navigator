# LUNA-NAV // Lunar Landing Site & Operations Navigator

**2026 NASA Space Apps Challenge — "Lunar Landing Site Navigator"**

**LUNA-NAV** is a monolithic, full-stack aerospace mission-planning and educational web application (**Python FastAPI Astrodynamics Backend + React / TypeScript / Three.js / Recharts Frontend**). It enables mission planners, systems engineers, educators, and the public to evaluate and compare lunar landing sites and mission dates by computing topocentric **Sun** and **Earth** trajectories against ray-cast local **LOLA (Lunar Orbiter Laser Altimeter)** terrain horizons.

---

## 1. Key Capabilities & Engineering Features

1. **Selenographic Topocentric Ephemeris Engine (`backend/physics_engine.py`)**:
   - Auto-loads NASA JPL `de421.bsp` via `skyfield` (with an out-of-the-box deterministic IAU 2015 Selenographic / ELP2000 analytical fallback for offline environments).
   - Captures **Sub-Earth optical libration** ($\pm 7.9^\circ$ longitude, $\pm 6.7^\circ$ latitude wobble over the 27.2-day draconic and 27.55-day anomalistic months) and **Sub-Solar seasonal inclination** ($\pm 1.54^\circ$ lunar axial tilt to the ecliptic).
2. **Atmosphereless 360° Horizon Ray-Caster & Lunar Curvature Drop**:
   - Generates $64 \times 64$ local Digital Elevation Models ($20\text{ km} \times 20\text{ km}$ patches) for 6 reference sites + custom user coordinates.
   - Ray-marches $360^\circ$ ($1^\circ$ resolution) outward from the lander with exact lunar sphere curvature correction ($-\frac{d^2}{2 R_{\text{moon}}}$) and elevated peak spherical horizon dip ($\theta_{\text{dip}}$).
3. **Partial Solar Limb Eclipse & Hardware-Aware Solar Array Power**:
   - Models the $r_\odot = 0.266^\circ$ solar disk semi-diameter for multi-hour grazing polar eclipses.
   - Evaluates electrical output ($P_{\text{kW}}$) for **Vertical Cylindrical Masts** ($\cos\text{El}$), **Dual-Axis Sun-Tracking Gimbals** ($\eta_{\text{inc}}=1.0$), and **Horizontal Flat Decks** ($\sin\text{El}$).
4. **Interactive 3D DEM Shadow Simulator & 360° Polar Azimuthal Radar**:
   - Real-time Three.js (`@react-three/fiber`) surface viewport with grazing directional shadows, orbital/surface camera toggle, and celestial Sun/Earth sky-dome vectors.
   - Custom SVG 360° Polar Azimuthal Sky-Chart plotting the local terrain mask $H(\text{Az})$, $0^\circ$ flat horizon, 360° Sun track, and Earth libration ellipse.
5. **Launch Schedule Slip Simulator & Multi-Site Trade-Off Matrix**:
   - Scrub mission elapsed time at 60 FPS (`1x`, `5x`, `20x`) or shift launch dates from `-14 days` to `+28 days` to expose "schedule cliffs" and compare up to 4 scenarios side-by-side.

---

## 2. Quick-Start Execution Guide

### Step 1: Start the Python FastAPI Backend (`port 8000`)
```bash
cd backend
# Using the existing virtual environment:
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```
The API will be live at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### Step 2: Start the React + Vite Frontend (`port 5173`)
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.
*(Note: The frontend also includes a built-in deterministic IAU selenographic fallback engine in `src/api/client.ts` so it remains 100% interactive even if opened offline without the backend.)*

