# Responsive Design Quick Reference

**For rapid testing and verification**

## Device Breakpoints at a Glance

| Device | Width | Stat Grid | Modal Width | Action |
|--------|-------|-----------|-------------|--------|
| Samsung S21 | 360px | 1 col | 360px | Test inputs 16px |
| iPhone SE | 375px | 2 col | 420px | Check touch targets |
| iPhone 12 | 390px | 2 col | 420px | Verify no overflow |
| iPhone 12PM | 428px | 2 col | 420px | Landscape test |
| iPad Mini | 768px | 2 col | 620px | Theme toggle |
| iPad Air | 820px | 3 col | 680px | Grid layout |
| Desktop Std | 1280px | 4 col | 900px | All features |
| Desktop HD | 1440px | 4 col | 1000px | Spacing check |
| Desktop 4K | 2560px | 6 col | 1400px | Centering |

## Touch Targets ✅

```
✓ Buttons: min 40×40px
✓ Inputs: 16px font, 44px height  
✓ Links: 40px min-height
✓ Icon-only: 32×32px + padding
```

## Key CSS Classes

```css
.hide-mobile       /* Hidden ≤767px */
.responsive-split-1-1   /* 2-col, stacks on mobile */
.table-responsive-wrapper   /* Scrollable tables */
```

## Testing Steps (5 minutes)

1. **Desktop** (Ctrl+Shift+M in Chrome)
   - [ ] 1280px: 4-column grid ✓
   - [ ] 1920px: Wide layout ✓

2. **Tablet** (Ctrl+Shift+M)
   - [ ] 768px: iPad Mini ✓
   - [ ] 820px: iPad Air ✓

3. **Mobile** (Ctrl+Shift+M)
   - [ ] 360px: Single column ✓
   - [ ] 428px: 2 columns ✓
   - [ ] Landscape mode ✓

4. **Interaction**
   - [ ] Theme toggle: 40px button ✓
   - [ ] Touch modals: Fit viewport ✓
   - [ ] Tables: Horizontal scroll ✓

## Common Issues

| Issue | Solution | File |
|-------|----------|------|
| Text too small | Check `font-size: 16px` in inputs | index.css:190 |
| Button too small | min-height: 40px, padding: 10px | index.css:205 |
| Modal too wide | max-width limits per breakpoint | index.css:500+ |
| No horizontal scroll | overflow-x: hidden on body | index.css:1050 |

## Media Query Template

```css
/* Mobile (≤767px) */
@media (max-width: 767px) {
  .admin-content { padding: 12px; }
}

/* Tablet (768-1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop (≥1024px) */
@media (min-width: 1024px) {
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}
```

---

**Files:**
- CSS: `frontend/src/index.css`
- Guide: `frontend/RESPONSIVE_DESIGN_GUIDE.md`
- Summary: `frontend/IMPLEMENTATION_SUMMARY.md`

**Status:** ✅ READY FOR TESTING
