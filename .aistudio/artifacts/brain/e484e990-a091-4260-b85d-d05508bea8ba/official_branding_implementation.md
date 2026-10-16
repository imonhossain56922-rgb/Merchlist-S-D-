# Official Merchlist Brand Implementation

The two official uploaded brand assets have been integrated as the locked logos for the **March List Mockup Request App**. No logos have been recreated, restyled, altered, or substituted.

---

## 1. Primary App Icon Logo (`IMG_8904.png`)
The solid black circular logo containing the white lowercase **“ml”** mark.

![Primary App Icon Logo](IMG_8904.png)

- **Asset Path**: `/IMG_8904.png` (also deployed to `/src/assets/images/IMG_8904.png`)
- **Usage**:
  - Browser favicon (`<link rel="icon">`)
  - Apple touch icon
  - PWA home screen icon (`manifest.json`)
  - Login screen brand emblem
  - Mobile header compact brand mark
  - Loading / splash screen session initializer

---

## 2. Official Wordmark Logo (`IMG_8905.png`)
The official **“merchlist”** editorial typography wordmark.

![Merchlist Wordmark](IMG_8905.png)

- **Asset Path**: `/IMG_8905.png` (also deployed to `/src/assets/images/IMG_8905.png`)
- **Usage**:
  - Main application login branding
  - Desktop sidebar header
  - Desktop TopBar brand header
  - Loading screen brand identity
  - System settings locked corporate assets display

---

## Responsive Brand Architecture

1. **Desktop / Tablet View**:
   - Uses the full **“merchlist”** wordmark (`/IMG_8905.png`) with proportional height scaling.
   - The desktop navigation sidebar features the official brand badge with the circular **“ml”** icon and **“merchlist”** wordmark.
2. **Mobile / Compact View**:
   - Automatically prioritizes the compact black circular **“ml”** icon (`/IMG_8904.png`) to keep navigation compact, clear, and focused.
3. **Pristine Preservation**:
   - Zero aspect ratio distortion (`object-contain`).
   - No color inversion, no CSS filters, no drop shadows, no outlines, no altered typography.
