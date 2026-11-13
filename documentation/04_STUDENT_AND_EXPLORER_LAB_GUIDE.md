# 04 // Student & Explorer Curriculum: 5 Hands-On Interactive Labs

This guide is written for **students, educators, space enthusiasts, and newcomers** who want to learn lunar mission design by experimenting directly with **LUNA-NAV**.

Each lab takes **3 minutes**, tells you **exactly what to click**, **what to observe on your screen**, and **how to interpret what you see**.

> **Tip:** Before starting, click the **`Educator`** button in the top-right header bar (`Planner | Educator`) so the yellow **Interactive Lunar South Pole Physics Guide** banner appears near the top of your screen!

---

## Lab 1: Watch the Sun Circle the South Pole Without Setting

### Goal
Understand why the Sun at the Lunar South Pole moves horizontally $360^\circ$ around the compass instead of rising in the East and setting in the West.

### Step-by-Step Instructions
1. In the top header bar, click **`Single-Site Deep Dive`** (`Split-Screen Compare | Single-Site Deep Dive`).
2. In the **`Site:`** dropdown on the left, select **`Shackleton Connecting Ridge (-89.54°, +2150m)`**.
3. In the bottom dock, click the **`PLAY 60FPS`** button and click **`5x`** speed.

### What to Observe & How to Interpret It
- **Look at the 3D Terrain Viewport (Left):**
  - Watch the glowing **SUN** sphere travel in a complete horizontal circle around the sky dome just above the crater rim.
  - Watch the long dark shadows of the crater ridge sweep $360^\circ$ around the terrain like the hand of a clock!
- **Look at the 360° Polar Azimuthal Radar (Right):**
  - Watch the glowing gold Sun marker trace a tight gold circle around the center of the radar (`+1.1°` to `+1.9°` elevation).
  - Notice that as the gold dot makes a full $360^\circ$ lap (`0° N → 270° W → 180° S → 90° E → 0° N`), it stays *inside* the dark-slate mountain mask (`Terrain Mask H(Az)`). That means **no mountain is tall enough to block the Sun**—giving the lander $100\%$ sunlight for all $720\text{ hours}$!
- **Now switch the camera to the Lander's Eyes:**
  - In the top-right corner of the 3D Terrain Viewport, click **`Lander Horizon`** (`Orbital Tactical | Lander Horizon`).
  - Drag with your mouse to look around $360^\circ$ from the lander deck—you are now standing on Shackleton Ridge watching the Sun skim the mountain peaks!

---

## Lab 2: Discover Earth's 27.3-Day "Optical Libration" Wobble

### Goal
See with your own eyes why Earth does *not* stay still in the lunar sky, and why Earth bobs above and below South Pole mountains every month.

### Step-by-Step Instructions
1. Stay in **`Single-Site Deep Dive`** mode on **`Shackleton Connecting Ridge`** (or click **`60d`** duration in the top bar to see two full months!).
2. Look at the **360° Polar Azimuthal Radar** on the right, specifically near the top label **`0° N (EARTHWARD)`**.
3. Drag the **`MET: T+Xh` time scrubber slider** slowly left and right across the 30-day (or 60-day) mission.

### What to Observe & How to Interpret It
- **Look at the Blue Earth Dot on the Radar:**
  - Instead of staying fixed at one point, the blue Earth marker traces a **cyan oval loop** (`Earth Libration Loop`).
  - For about half the month ($\sim 300\text{ hours}$), the blue dot is *inside* the clear center of the radar (Earth elevation is $+1.5^\circ$ to $+6.7^\circ$)—look at **Card 2 (`Earth DTE Link`)**: it glows blue and says **`EARTHSET IN Xh`**.
  - For the other half of the month, Earth's orbital tilt carries the blue dot *outward* into the gray shaded mountain mask (Earth elevation drops to $-1^\circ$ to $-6^\circ$)—**Card 2** flashes red: **`COMMS BLACKOUT — RISE IN Xh`**!
- **Look at the Bottom-Left Chart (`Track 1 & 2: Sun & Earth Elevation vs. Terrain Mask`):**
  - Compare the **Gold Line (Sun Elevation)**—which stays flat and steady around $+1.5^\circ$—against the **Cyan Line (Earth Elevation)**, which rises and falls like a giant ocean wave every $27.2\text{ days}$!

---

## Lab 3: Why Flat Solar Panels Fail at the South Pole

### Goal
Prove why spacecraft engineers must use **Vertical Cylindrical Masts** or **Sun-Tracking Gimbals** at the South Pole instead of classic flat solar panels.

### Step-by-Step Instructions
1. Make sure **`Shackleton Connecting Ridge`** is selected as your active site.
2. Look at **Card 3 (`Array Power`)** in the KPI Strip near the top:
   - With **`Vertical 360° Mast`** selected, your lander generates **`4.51 kW`** of electricity (`Incidence η: 100%`).
3. Now click the **`Hardware: Vertical 360° Mast`** button in the top scenario bar to open the Hardware Popover.
4. Change **Solar Array Geometry** to **`Horizontal Flat Deck (Equatorial Classic, sin El)`**.

### What to Observe & How to Interpret It
- **Look at Card 3 (`Array Power`) and the 3D Lander Beacon:**
  - On the 3D lander in the center of the terrain, the tall gold vertical cylinder disappears and is replaced by a flat blue disk on the lander deck.
  - In **Card 3**, **`Incidence η`** plunges from **`100%` down to `3%`**, and electrical power collapses from **`4.51 kW` down to `0.12 kW`**!
- **Why did this happen?**
  - Because the Sun is only $+1.5^\circ$ above the horizon, sunlight hits a flat horizontal panel almost completely edge-on ($\sin(1.5^\circ) = 0.026$).
- **Don't forget:** Switch **Solar Array Geometry** back to **`Vertical Cylindrical Mast`** when you finish this lab!

---

## Lab 4: Explore a 40 Kelvin (-233°C) Permanently Shadowed Ice Trap

### Goal
Compare a sunlit mountain ridge (`+2,150 m`) against the floor of a deep polar crater (`-1,800 m`) where water ice is trapped in permanent darkness.

### Step-by-Step Instructions
1. Click **`Split-Screen Compare (A vs B)`** in the top-right header bar.
2. In the **Presets** row at the top of the comparison dashboard, click **`Peak of Light vs Cold Trap`**.
3. Make sure the **`PSR Cold-Trap Overlay: ON`** button (Snowflake icon) is active.

### What to Observe & How to Interpret It
- **Compare Left 3D Viewport (`SCENARIO A: Shackleton Ridge`) vs. Right 3D Viewport (`SCENARIO B: Haworth Crater Floor`):**
  - On the **Left (Shackleton)**, your lander sits on the high gray/gold ridge in bright sunlight (`210K`), while the deep crater slopes off to the sides are tinted **indigo-blue** (showing where adjacent PSR cold traps lie).
  - On the **Right (Haworth Crater Floor)**, your lander sits at the bottom of a deep bowl surrounded by towering crater walls. Almost the entire terrain ($89.5\%$) is painted **indigo-blue**, the lander ring is **Red (`ECLIPSE`)**, and the bottom-left HUD reads **`40K (38K–45K)`** in red!
- **Look at the Trade-Off Matrix Table Below:**
  - Every single survival metric on Haworth Crater Floor is flagged in **Red (`CRITICAL_RISK`, `722.0h ⚠️ >50h LIMIT`, `0.0% Sunlight`)**.

---

## Lab 5: Design Your Own Custom Landing Site on the South Pole Map

### Goal
Use the interactive polar coordinate picker to test your own custom landing site anywhere near the Lunar South Pole.

### Step-by-Step Instructions
1. In the top scenario bar, click the **`Primary (A):` / `Site:`** dropdown and select the bottom option: **`+ Custom Coordinates / Polar Map Picker...`**.
2. In the modal that pops up:
   - Click anywhere on the circular **South Pole Map (80°S–90°S)** on the left (notice how `0° (Earth)` is at the top of the circle).
   - Try setting **Elevation (m)** to **`+3500`** with **Morphology: `Mountain Massif`**, and click **`Extract 128×128 DEM & Evaluate Ephemeris`**.
3. Now click **`Edit`** next to the site dropdown, change **Elevation (m)** to **`-2000`** with **Morphology: `PSR Crater Basin`**, and click **`Extract 128×128 DEM & Evaluate Ephemeris`** again!

### Self-Check Questions & Answers
1. **Q: Why does a site at $0^\circ$ longitude (like Malapert Massif) have better Earth communications than a site at $180^\circ$ longitude?**
   - *A:* Because $0^\circ$ selenographic longitude is the center of the Moon's Earth-facing hemisphere (Prime Meridian). Standing at $0^\circ$ longitude puts Earth directly toward your northern horizon, whereas at $180^\circ$ longitude you are on the far side of the South Pole looking *across* the pole peak toward Earth.
2. **Q: If a landing site has $85\%$ total sunlight over a 30-day mission ($612\text{ hours}$ sunlit, $108\text{ hours}$ dark), how can it still fail the `Max Eclipse` battery test?**
   - *A:* If all $108\text{ hours}$ of darkness happen in *one continuous block* behind a wide mountain massif, it exceeds the $50\text{-hour}$ rechargeable battery survival limit! Conversely, if those $108\text{ hours}$ are split into three short $36\text{-hour}$ shadows separated by days of sunlight, the batteries recharge between each shadow and the lander survives easily.

