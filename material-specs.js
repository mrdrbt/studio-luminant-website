// ─── MATERIAL SPECS — Single Source of Truth ───
// Generated from Supabase · 2026-03-24
// Referenced by: products.htm, tr/urunler.htm, material-guide.js, tr/material-guide-tr.js, lookbook.htm

window.SL_SPECS = {
  "pmag": {
    "fire": {
      "value": "A1",
      "standard": "EN 13501-1",
      "note_en": "No flame retardant additives required",
      "note_tr": "Alev geciktirici katkı gerektirmez"
    },
    "maxPanel": {
      "w": 3000,
      "h": 1500,
      "unit": "mm"
    },
    "thickness": {
      "min": 15,
      "max": 40,
      "unit": "mm"
    },
    "weight": {
      "min": 35,
      "max": 40,
      "refThickness": 25,
      "unit": "kg/m²"
    },
    "density": {
      "min": 1400,
      "max": 1600,
      "unit": "kg/m³"
    },
    "surface": {
      "en": "Ceramic-Smooth Finish",
      "tr": "Seramik-Pürüzsüz Yüzey"
    },
    "finish": {
      "en": "Any RAL / Custom Colour",
      "tr": "Tüm RAL / Özel Renkler",
      "note_en": "Cold-cast metal, patina, and textured finishes available",
      "note_tr": "Soğuk döküm metal, patina ve dokulu yüzeyler mevcuttur"
    },
    "moisture": {
      "en": "Resistant",
      "tr": "Neme Dayanıklı"
    },
    "domain": {
      "en": "Interior",
      "tr": "İç Mekân"
    },
    "application": {
      "en": "Interior Walls & Ceilings",
      "tr": "İç Mekân Duvar & Tavan"
    },
    "deliverables": {
      "en": "TDS + BIM Files Included",
      "tr": "TDS + BIM Dosyaları Dahil"
    }
  },
  "pucomp": {
    "fire": {
      "value": "B-s1,d0",
      "standard": "EN 13501-1",
      "note_en": "Flame retardant, low smoke",
      "note_tr": "Alev geciktirici, düşük duman"
    },
    "maxPanel": {
      "w": 2500,
      "h": 1200,
      "unit": "mm"
    },
    "thickness": {
      "min": 8,
      "max": 25,
      "unit": "mm"
    },
    "weight": {
      "min": 12,
      "max": 18,
      "refThickness": 15,
      "unit": "kg/m²"
    },
    "density": {
      "min": 600,
      "max": 900,
      "unit": "kg/m³"
    },
    "surface": {
      "en": "Sub-Millimetre Detail",
      "tr": "Submilimetre Detay"
    },
    "finish": {
      "en": "Any RAL / Custom Colour",
      "tr": "Tüm RAL / Özel Renkler",
      "note_en": "Cold-cast metal and textured finishes available",
      "note_tr": "Soğuk döküm metal ve dokulu yüzeyler mevcuttur"
    },
    "moisture": {
      "en": "High — closed-cell, hydrophobic",
      "tr": "Yüksek — kapalı hücre, hidrofobik"
    },
    "domain": {
      "en": "Exterior",
      "tr": "Dış Mekân"
    },
    "application": {
      "en": "Exterior, Wet Areas & Complex Geometry",
      "tr": "Dış Cephe, Islak Hacim & Karmaşık Geometri"
    },
    "deliverables": {
      "en": "TDS + BIM Files Included",
      "tr": "TDS + BIM Dosyaları Dahil"
    },
    "durability": {
      "en": "UV-Stable, Impact & Weather Rated",
      "tr": "UV-Stabil, Darbe & Hava Koşullarına Dayanıklı"
    },
    "repairability": {
      "en": "Spot Repair Without Panel Replacement",
      "tr": "Panel Değişimi Olmadan Nokta Onarım"
    }
  }
};

// ─── HELPER: format spec strings ───
window.SL_SPECS.fmt = {
  panelSize:  function(m) { return m.maxPanel.w + ' × ' + m.maxPanel.h + ' ' + m.maxPanel.unit; },
  thickness:  function(m) { return m.thickness.min + ' – ' + m.thickness.max + ' ' + m.thickness.unit; },
  weight:     function(m) { return m.weight.min + ' – ' + m.weight.max + ' ' + m.weight.unit + ' @ ' + m.weight.refThickness + ' ' + m.thickness.unit; },
  density:    function(m) { return m.density.min.toLocaleString() + '–' + m.density.max.toLocaleString(); },
  fire:       function(m) { return m.fire.value; },
  fireDetail: function(m) { return m.fire.value + ' (' + m.fire.standard + ')';}
};