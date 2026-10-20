// ─── MATERIAL SPECS — Single Source of Truth ───
// Generated from Supabase · 2026-10-15
// Referenced by: products.htm, tr/urunler.htm, material-guide.js, tr/material-guide-tr.js, lookbook.htm

window.SL_SPECS = {
  "pmag": {
    "fire": {
      "value": null,
      "standard": null,
      "note_en": null,
      "note_tr": null
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
      "note_en": "Artisan finishes, smooth or textured.",
      "note_tr": "Artizan finish; pürüzsüz ya da dokulu yüzey."
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
      "en": "Interior Walls, Ceilings, Columns & Counters",
      "tr": "İç Mekân Duvar, Tavan, Kolon & Banko"
    },
    "deliverables": {
      "en": "Technical Data Sheet + Installation Drawing",
      "tr": "Teknik Veri Sayfası + Montaj Çizimi"
    }
  }
};

// ─── HELPER: format spec strings ───
window.SL_SPECS.fmt = {
  thickness:  function(m) { return m.thickness.min + ' – ' + m.thickness.max + ' ' + m.thickness.unit; },
  weight:     function(m) { return m.weight.min + ' – ' + m.weight.max + ' ' + m.weight.unit + ' @ ' + m.weight.refThickness + ' ' + m.thickness.unit; },
  density:    function(m) { return m.density.min.toLocaleString() + '–' + m.density.max.toLocaleString(); },
  fire:       function(m) { return m.fire.value; },
  fireDetail: function(m) { return m.fire.value + ' (' + m.fire.standard + ')';}
};