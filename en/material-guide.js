(function() {
"use strict";
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

// Paste the full component inline for standalone preview
// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const COLORS = {
  bg: "#0C0C0E",
  surface: "#18181D",
  borderGold: "rgba(201,168,76,0.18)",
  gold: "#C9A84C",
  goldLight: "#E8C96A",
  ivory: "#F0EAD6",
  muted: "#9A9088",
  sage: "#6B8F71",
  amber: "#C4956A",
  crimson: "#A65D5D"
};
const specCategories = [{
  key: "physical",
  label: "Physical",
  icon: "⬡",
  specs: ["density", "weight", "thickness", "maxSize"]
}, {
  key: "performance",
  label: "Performance",
  icon: "◈",
  specs: ["fire", "moisture", "impact", "uv", "chemical", "temperature"]
}, {
  key: "finish",
  label: "Finish & Design",
  icon: "◇",
  specs: ["surface", "customDesign", "voc", "acoustic", "antimicrobial"]
}, {
  key: "installation",
  label: "Installation",
  icon: "▽",
  specs: ["method", "speed", "leadTime"]
}];
const specMeta = {
  density: {
    label: "Density",
    unit: "kg/m³"
  },
  weight: {
    label: "Weight per m²",
    unit: "kg/m²"
  },
  thickness: {
    label: "Panel thickness",
    unit: "mm"
  },
  maxSize: {
    label: "Max panel size",
    unit: ""
  },
  fire: {
    label: "Fire classification",
    unit: ""
  },
  moisture: {
    label: "Moisture resistance",
    unit: ""
  },
  impact: {
    label: "Impact resistance",
    unit: ""
  },
  uv: {
    label: "UV resistance",
    unit: ""
  },
  chemical: {
    label: "Chemical resistance",
    unit: ""
  },
  temperature: {
    label: "Temperature range",
    unit: ""
  },
  surface: {
    label: "Surface finish",
    unit: ""
  },
  customDesign: {
    label: "Custom design",
    unit: ""
  },
  voc: {
    label: "VOC emissions",
    unit: ""
  },
  acoustic: {
    label: "Acoustic",
    unit: ""
  },
  antimicrobial: {
    label: "Antimicrobial",
    unit: ""
  },
  method: {
    label: "Installation method",
    unit: ""
  },
  speed: {
    label: "Installation speed",
    unit: ""
  },
  leadTime: {
    label: "Lead time",
    unit: ""
  }
};
const finishTypes = [{
  id: "matte",
  label: "Matte",
  desc: "Smooth, non-reflective surface",
  preview: {
    gradient: "linear-gradient(145deg, #333 0%, #444 100%)",
    overlay: null
  }
}, {
  id: "satin",
  label: "Satin",
  desc: "Soft sheen, low reflectivity",
  preview: {
    gradient: "linear-gradient(145deg, #555 0%, #777 60%, #555 100%)",
    overlay: {
      type: "sheen"
    }
  }
}, {
  id: "mica",
  label: "Mica Metallic",
  desc: "Pearlescent metallic shimmer",
  preview: {
    gradient: "linear-gradient(135deg, #5A4A2A 0%, #8B7340 40%, #5A4A2A 60%, #8B7340 100%)",
    overlay: {
      type: "grain",
      angle: "90deg"
    }
  }
}, {
  id: "metal",
  label: "Real Metal Leaf",
  desc: "Genuine metal leaf application",
  preview: {
    gradient: "linear-gradient(135deg, #6B5B1E 0%, #C9A84C 35%, #8B7330 50%, #C9A84C 70%, #6B5B1E 100%)",
    overlay: {
      type: "grain",
      angle: "0deg"
    }
  }
}];
const colorPalettes = {
  pmag: [
    { group: "Hospitality", colors: [
      { id: "warm-taupe", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "ivory", label: "Ivory", hex: ["#D8D0C4", "#EDE8DF"] },
      { id: "bronze", label: "Bronze", hex: ["#5C4A2A", "#8B7355"] },
      { id: "espresso", label: "Espresso", hex: ["#3C2415", "#5C3A2A"] }
    ]},
    { group: "Corporate", colors: [
      { id: "obsidian", label: "Obsidian", hex: ["#1A1A1A", "#2D2D2D"] },
      { id: "cloud-white", label: "Cloud White", hex: ["#EDEAE4", "#F0EFEB"] },
      { id: "silhouette", label: "Silhouette", hex: ["#4A433E", "#635C56"] },
      { id: "gold", label: "Gold", hex: ["#8B6914", "#C9A84C"] }
    ]},
    { group: "Residential", colors: [
      { id: "warm-taupe-r", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "copper", label: "Copper", hex: ["#7A4A2A", "#B87333"] },
      { id: "midnight-sage", label: "Midnight Sage", hex: ["#3D503E", "#576B52"] },
      { id: "ivory-r", label: "Ivory", hex: ["#D8D0C4", "#EDE8DF"] }
    ]}
  ],
  pucomp: [
    { group: "Hospitality", colors: [
      { id: "warm-taupe", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "sand", label: "Sand", hex: ["#B5A48A", "#C9BBA3"] },
      { id: "bronze", label: "Bronze", hex: ["#5C4A2A", "#8B7355"] },
      { id: "espresso", label: "Espresso", hex: ["#3C2415", "#5C3A2A"] }
    ]},
    { group: "Corporate", colors: [
      { id: "obsidian", label: "Obsidian", hex: ["#1A1A1A", "#2D2D2D"] },
      { id: "cloud-white", label: "Cloud White", hex: ["#EDEAE4", "#F0EFEB"] },
      { id: "silhouette", label: "Silhouette", hex: ["#4A433E", "#635C56"] },
      { id: "gold", label: "Gold", hex: ["#8B6914", "#C9A84C"] }
    ]},
    { group: "Residential", colors: [
      { id: "warm-taupe-r", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "copper", label: "Copper", hex: ["#7A4A2A", "#B87333"] },
      { id: "midnight-sage", label: "Midnight Sage", hex: ["#3D503E", "#576B52"] },
      { id: "sand-r", label: "Sand", hex: ["#B5A48A", "#C9BBA3"] }
    ]}
  ]
};
const radarAxes = [{
  key: "fireSafety",
  label: "Fire Safety"
}, {
  key: "weightAdv",
  label: "Lightweight"
}, {
  key: "moistureRes",
  label: "Moisture"
}, {
  key: "finishQuality",
  label: "Finish Quality"
}, {
  key: "designFreedom",
  label: "Design Freedom"
}, {
  key: "installSpeed",
  label: "Install Speed"
}, {
  key: "leadTimeAdv",
  label: "Lead Time"
}, {
  key: "impactRes",
  label: "Impact"
}];
var _S = window.SL_SPECS || {};
var _pmag = _S.pmag || {};
var _pucomp = _S.pucomp || {};
var _F = _S.fmt || {};
const studioMaterials = [{
  id: "pmag",
  name: "Lumina PMAG™",
  fullName: "Polymer Modified Alpha Gypsum",
  tagline: "Interior architectural relief panels with target A1 fire performance",
  domain: "Interior",
  domainIcon: "🏛",
  application: "Feature walls, ceiling elements, reception areas, corridor accent walls",
  specs: {
    density: "1,400–1,600",
    weight: (_pmag.weight ? _pmag.weight.min + '–' + _pmag.weight.max : "35–40"),
    thickness: (_pmag.thickness ? _pmag.thickness.min + '–' + _pmag.thickness.max : "15–40"),
    maxSize: (_F.panelSize ? _F.panelSize(_pmag) : "3000 × 1500 mm"),
    fire: (_pmag.fire ? _pmag.fire.value + ' Non-Combustible (' + _pmag.fire.standard + ')' : "A1 Non-Combustible* (EN 13501-1)"),
    moisture: "Moderate — interior dry zones",
    impact: "Moderate (glass fiber reinforced)",
    uv: "—",
    chemical: "—",
    temperature: "—",
    surface: (_pmag.finish ? _pmag.finish.en : "Any RAL / custom colour — cold-cast metal, patina, and textured finishes"),
    customDesign: "AI-assisted parametric design, unlimited patterns",
    voc: "Low — indoor air quality safe",
    acoustic: "Optional backed acoustic fleece",
    antimicrobial: "Optional antimicrobial additive",
    method: "LuminClip™ concealed rail system",
    speed: "20–30 sec per panel",
    leadTime: "4–6 weeks"
  },
  radar: {
    fireSafety: 0.85,
    weightAdv: 0.6,
    moistureRes: 0.4,
    finishQuality: 0.95,
    designFreedom: 0.95,
    installSpeed: 0.9,
    leadTimeAdv: 0.8,
    impactRes: 0.5
  }
}, {
  id: "pucomp",
  name: "Lumina PUCOMP™",
  fullName: "Polyurethane Composite",
  tagline: "Exterior & wet-area panels with superior durability",
  domain: "Exterior",
  domainIcon: "🌐",
  application: "Façade panels, spas, pools, bathrooms, covered outdoor areas, signage",
  specs: {
    density: "600–900",
    weight: (_pucomp.weight ? _pucomp.weight.min + '–' + _pucomp.weight.max : "12–18"),
    thickness: (_pucomp.thickness ? _pucomp.thickness.min + '–' + _pucomp.thickness.max : "8–25"),
    maxSize: (_F.panelSize ? _F.panelSize(_pucomp) : "2500 × 1200 mm"),
    fire: (_pucomp.fire ? _pucomp.fire.value + ' (' + _pucomp.fire.standard + ')' : "B-s1,d0* (EN 13501-1)"),
    moisture: "High — closed-cell, hydrophobic",
    impact: "High — flexible polymer matrix",
    uv: "Stabilised + UV-resistant topcoat",
    chemical: "Resistant to mild acids & cleaning agents",
    temperature: "-30 °C to +80 °C",
    surface: (_pucomp.finish ? _pucomp.finish.en : "Any RAL / custom colour — cold-cast metal and textured finishes available"),
    customDesign: "AI-assisted parametric design, unlimited patterns",
    voc: "Low",
    acoustic: "—",
    antimicrobial: "—",
    method: "LuminClip™ or mechanical fixing (stainless steel)",
    speed: "Application-dependent",
    leadTime: "5–7 weeks"
  },
  radar: {
    fireSafety: 0.55,
    weightAdv: 0.85,
    moistureRes: 0.9,
    finishQuality: 0.95,
    designFreedom: 0.95,
    installSpeed: 0.75,
    leadTimeAdv: 0.75,
    impactRes: 0.85
  }
}];
const sectorMaterials = [{
  id: "grg",
  name: "Standard GRG",
  fullName: "Glass-fibre Reinforced Gypsum",
  specs: {
    density: "1,000–1,300",
    weight: "15–25",
    thickness: "10–20",
    maxSize: "Varies by supplier",
    fire: "A1 / A2-s1,d0",
    moisture: "Low — interior dry only",
    impact: "Low–Moderate",
    uv: "—",
    chemical: "—",
    temperature: "—",
    surface: "Painted (on-site finishing required)",
    customDesign: "Limited mold availability, no AI customisation",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Adhesive + mechanical fixing",
    speed: "Skilled labour required",
    leadTime: "6–10 weeks"
  },
  radar: {
    fireSafety: 0.9,
    weightAdv: 0.55,
    moistureRes: 0.2,
    finishQuality: 0.35,
    designFreedom: 0.3,
    installSpeed: 0.4,
    leadTimeAdv: 0.45,
    impactRes: 0.35
  }
}, {
  id: "grc",
  name: "GRC / GFRC",
  fullName: "Glass-fibre Reinforced Concrete",
  specs: {
    density: "1,800–2,200",
    weight: "25–45",
    thickness: "10–25",
    maxSize: "Varies by supplier",
    fire: "A1 (non-combustible)",
    moisture: "High",
    impact: "High",
    uv: "Good",
    chemical: "Moderate",
    temperature: "Wide range",
    surface: "As-cast or painted (limited)",
    customDesign: "Possible but expensive tooling",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Heavy mechanical fixing",
    speed: "Structural support may be needed",
    leadTime: "8–14 weeks"
  },
  radar: {
    fireSafety: 1.0,
    weightAdv: 0.2,
    moistureRes: 0.8,
    finishQuality: 0.3,
    designFreedom: 0.25,
    installSpeed: 0.2,
    leadTimeAdv: 0.25,
    impactRes: 0.75
  }
}, {
  id: "stone",
  name: "Natural Stone",
  fullName: "Marble / Limestone Cladding",
  specs: {
    density: "2,300–2,800",
    weight: "50–75",
    thickness: "20+",
    maxSize: "Slab-dependent",
    fire: "A1",
    moisture: "Variable (porous unless sealed)",
    impact: "Brittle — chips and cracks",
    uv: "Excellent (natural)",
    chemical: "Sensitive to acids",
    temperature: "Wide range",
    surface: "Polished, honed, textured (natural)",
    customDesign: "Carved only — extreme cost",
    voc: "None",
    acoustic: "—",
    antimicrobial: "—",
    method: "Structural support, skilled stonemason",
    speed: "Slow, specialist labour",
    leadTime: "10–20 weeks"
  },
  radar: {
    fireSafety: 1.0,
    weightAdv: 0.05,
    moistureRes: 0.5,
    finishQuality: 0.7,
    designFreedom: 0.1,
    installSpeed: 0.1,
    leadTimeAdv: 0.1,
    impactRes: 0.2
  }
}, {
  id: "frp",
  name: "FRP",
  fullName: "Fibre Reinforced Polymer",
  specs: {
    density: "1,500–2,000",
    weight: "5–15",
    thickness: "3–12",
    maxSize: "Varies",
    fire: "B-s2,d0 to C (varies)",
    moisture: "Excellent",
    impact: "High",
    uv: "Moderate (gel coat dependent)",
    chemical: "Good",
    temperature: "Moderate range",
    surface: "Gel coat or paint (can look plasticky)",
    customDesign: "Mold-dependent",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Adhesive or mechanical",
    speed: "Moderate",
    leadTime: "4–8 weeks"
  },
  radar: {
    fireSafety: 0.35,
    weightAdv: 0.8,
    moistureRes: 0.95,
    finishQuality: 0.25,
    designFreedom: 0.3,
    installSpeed: 0.6,
    leadTimeAdv: 0.7,
    impactRes: 0.8
  }
}, {
  id: "mdf",
  name: "MDF / Timber",
  fullName: "MDF & Timber Panels",
  specs: {
    density: "600–800",
    weight: "10–18",
    thickness: "6–25",
    maxSize: "Standard sheet sizes",
    fire: "D-s2,d0 (combustible)",
    moisture: "Poor — swells, warps",
    impact: "Moderate",
    uv: "Poor",
    chemical: "Poor",
    temperature: "Interior only",
    surface: "Veneered, painted, or CNC-carved",
    customDesign: "CNC possible but depth-limited",
    voc: "Moderate (formaldehyde risk)",
    acoustic: "Moderate natural absorption",
    antimicrobial: "—",
    method: "Standard carpentry",
    speed: "Fast — standard fixings",
    leadTime: "3–6 weeks"
  },
  radar: {
    fireSafety: 0.15,
    weightAdv: 0.7,
    moistureRes: 0.1,
    finishQuality: 0.4,
    designFreedom: 0.35,
    installSpeed: 0.8,
    leadTimeAdv: 0.85,
    impactRes: 0.45
  }
}];

// ─── RADAR CHART ───
function RadarChart({
  primary,
  comparisons,
  size = 320
}) {
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.38,
    levels = 5;
  const angleStep = 2 * Math.PI / radarAxes.length,
    startAngle = -Math.PI / 2;
  const getPoint = (i, v) => {
    const a = startAngle + i * angleStep;
    return {
      x: cx + r * v * Math.cos(a),
      y: cy + r * v * Math.sin(a)
    };
  };
  const getPolygonPoints = vals => radarAxes.map((_, i) => {
    const p = getPoint(i, vals[radarAxes[i].key] || 0);
    return `${p.x},${p.y}`;
  }).join(" ");
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setAnimated(true);
    }, {
      threshold: 0.3
    });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  const [hover, setHover] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      overflow: "visible"
    }
  }, Array.from({
    length: levels
  }, (_, l) => {
    const lv = (l + 1) / levels;
    const pts = radarAxes.map((_, i) => {
      const p = getPoint(i, lv);
      return `${p.x},${p.y}`;
    }).join(" ");
    return /*#__PURE__*/React.createElement("polygon", {
      key: l,
      points: pts,
      fill: "none",
      stroke: COLORS.borderGold,
      strokeWidth: "0.5",
      opacity: "0.4"
    });
  }), radarAxes.map((_, i) => {
    const p = getPoint(i, 1);
    return /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: cx,
      y1: cy,
      x2: p.x,
      y2: p.y,
      stroke: COLORS.borderGold,
      strokeWidth: "0.5",
      opacity: "0.3"
    });
  }), comparisons.map(c => /*#__PURE__*/React.createElement("polygon", {
    key: c.id,
    points: getPolygonPoints(c.radar),
    fill: "none",
    stroke: COLORS.muted,
    strokeWidth: "1",
    strokeDasharray: "4 3",
    opacity: animated ? 0.5 : 0,
    style: {
      transition: "opacity 0.6s ease 0.3s"
    }
  })), /*#__PURE__*/React.createElement("polygon", {
    points: getPolygonPoints(primary.radar),
    fill: `${COLORS.gold}18`,
    stroke: COLORS.gold,
    strokeWidth: "1.5",
    opacity: animated ? 1 : 0,
    style: {
      transition: "opacity 0.8s ease"
    }
  }), radarAxes.map((axis, i) => {
    const val = primary.radar[axis.key] || 0;
    const p = getPoint(i, val);
    return /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: p.x,
      cy: p.y,
      r: hover === i ? 5 : 3,
      fill: COLORS.gold,
      opacity: animated ? 1 : 0,
      style: {
        transition: "all 0.3s ease",
        cursor: "pointer"
      },
      onMouseEnter: () => setHover(i),
      onMouseLeave: () => setHover(null)
    });
  }), radarAxes.map((axis, i) => {
    const p = getPoint(i, 1.18);
    const isL = p.x < cx - 10,
      isR = p.x > cx + 10;
    return /*#__PURE__*/React.createElement("text", {
      key: i,
      x: p.x,
      y: p.y,
      textAnchor: isL ? "end" : isR ? "start" : "middle",
      dominantBaseline: "central",
      fill: hover === i ? COLORS.ivory : COLORS.muted,
      style: {
        fontSize: "11px",
        fontFamily: "'Jost',sans-serif",
        transition: "fill 0.2s ease"
      }
    }, axis.label);
  }), hover !== null && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: cx - 40,
    y: size - 24,
    width: 80,
    height: 22,
    rx: 2,
    fill: COLORS.surface,
    stroke: COLORS.borderGold
  }), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: size - 10,
    textAnchor: "middle",
    fill: COLORS.gold,
    style: {
      fontSize: "12px",
      fontFamily: "'Jost',sans-serif",
      fontWeight: 500
    }
  }, Math.round((primary.radar[radarAxes[hover].key] || 0) * 100), "%"))));
}

// ─── FINISH & COLOR SELECTOR ───
function FinishColorSelector({
  materialId
}) {
  const [activeFinish, setActiveFinish] = useState("matte");
  const [activeColor, setActiveColor] = useState(null);
  const colorGroups = colorPalettes[materialId] || colorPalettes.pmag;
  const allColors = colorGroups.flatMap(g => g.colors);
  const getSwatchStyle = (finish, color) => {
    const [c1, c2] = color.hex;
    const f = finish || finishTypes[0];
    return f.id === "metal" ? `linear-gradient(135deg,${c1} 0%,${c2} 35%,${c1} 50%,${c2} 70%,${c1} 100%)` : f.id === "mica" ? `linear-gradient(135deg,${c1} 0%,${c2} 40%,${c1} 60%,${c2} 100%)` : f.id === "satin" ? `linear-gradient(145deg,${c1} 0%,${c2} 60%,${c1} 100%)` : `linear-gradient(145deg,${c1} 0%,${c2} 100%)`;
  };
  const selectedFinish = finishTypes.find(f => f.id === activeFinish) || finishTypes[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 11,
      fontWeight: 500,
      color: COLORS.muted,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 10
    }
  }, "Surface Finish"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 20
    }
  }, finishTypes.map(f => {
    const isAct = activeFinish === f.id;
    return /*#__PURE__*/React.createElement("button", {
      key: f.id,
      onClick: () => setActiveFinish(f.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 2,
        border: isAct ? `1px solid ${COLORS.gold}` : "1px solid rgba(138,130,117,0.2)",
        background: isAct ? `${COLORS.gold}10` : "transparent",
        cursor: "pointer",
        transition: "all 0.3s ease",
        fontFamily: "'Jost',sans-serif"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 24,
        height: 24,
        borderRadius: 2,
        background: f.preview.gradient,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0
      }
    }, f.preview.overlay?.type === "grain" && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(${f.preview.overlay.angle},transparent,transparent 1px,rgba(255,255,255,0.06) 1px,rgba(255,255,255,0.06) 2px)`
      }
    }), f.preview.overlay?.type === "sheen" && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "10%",
        left: "15%",
        width: "70%",
        height: "40%",
        background: "rgba(255,255,255,0.12)",
        borderRadius: "50%",
        filter: "blur(4px)"
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: isAct ? 500 : 400,
        color: isAct ? COLORS.gold : COLORS.ivory,
        display: "block",
        lineHeight: 1.2
      }
    }, f.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 300,
        color: COLORS.muted,
        display: "block",
        lineHeight: 1.3,
        marginTop: 1
      }
    }, f.desc)));
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 11,
      fontWeight: 500,
      color: COLORS.muted,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 10
    }
  }, "Colour"), colorGroups.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.group,
    style: { marginBottom: 16 }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 9,
      fontWeight: 400,
      color: COLORS.gold,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 8,
      opacity: 0.7
    }
  }, group.group), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      paddingBottom: 4
    }
  }, group.colors.map(color => {
    const isAct = activeColor === color.id;
    return /*#__PURE__*/React.createElement("div", {
      key: color.id,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        cursor: "pointer"
      },
      onClick: () => setActiveColor(isAct ? null : color.id)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 2,
        border: isAct ? `2px solid ${COLORS.gold}` : `1px solid ${COLORS.borderGold}`,
        background: getSwatchStyle(selectedFinish, color),
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease",
        transform: isAct ? "scale(1.1)" : "scale(1)",
        boxShadow: isAct ? `0 2px 12px ${color.hex[0]}55` : "none"
      },
      onMouseEnter: e => {
        if (!isAct) e.currentTarget.style.transform = "scale(1.06)";
      },
      onMouseLeave: e => {
        if (!isAct) e.currentTarget.style.transform = "scale(1)";
      }
    }, (selectedFinish.id === "mica" || selectedFinish.id === "metal") && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(${selectedFinish.id === "metal" ? "0deg" : "90deg"},transparent,transparent 1px,rgba(255,255,255,0.04) 1px,rgba(255,255,255,0.04) 2px)`
      }
    }), selectedFinish.id === "satin" && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "10%",
        left: "15%",
        width: "70%",
        height: "35%",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "50%",
        filter: "blur(5px)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Jost',sans-serif",
        fontSize: 8,
        color: isAct ? COLORS.gold : COLORS.muted,
        textAlign: "center",
        lineHeight: 1.2,
        fontWeight: isAct ? 500 : 300,
        maxWidth: 48,
        transition: "color 0.2s ease"
      }
    }, color.label));
  })))), activeColor && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: "8px 12px",
      background: `${COLORS.gold}08`,
      border: `1px solid ${COLORS.borderGold}`,
      borderRadius: 2,
      display: "inline-block"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 11,
      color: COLORS.ivory,
      fontWeight: 400
    }
  }, selectedFinish.label, " \xB7 ", allColors.find(c => c.id === activeColor)?.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      padding: "12px 16px",
      background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)",
      border: `1px solid ${COLORS.borderGold}`,
      borderRadius: 2,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
    stroke: COLORS.gold, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
  /*#__PURE__*/React.createElement("path", { d: "M12 8v4M12 16h.01" })),
  /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 11,
      color: COLORS.muted,
      fontWeight: 300,
      lineHeight: 1.4
    }
  }, "Custom colour matching available \u2014 RAL, NCS, or bespoke reference.")));
}
function AdvantageArrow({
  advantage
}) {
  if (advantage === "better") return /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.sage,
      fontSize: "11px",
      marginLeft: 4
    }
  }, "\u25B2");
  if (advantage === "worse") return /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.crimson,
      fontSize: "11px",
      marginLeft: 4
    }
  }, "\u25BC");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.muted,
      fontSize: "11px",
      marginLeft: 4
    }
  }, "\u2014");
}

// ─── MATERIAL CARD ───
function MaterialCard({
  material,
  isExpanded,
  onToggle
}) {
  const [openCat, setOpenCat] = useState(null);
  const toggleCat = k => setOpenCat(openCat === k ? null : k);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      border: `1px solid ${COLORS.borderGold}`,
      borderRadius: 2,
      transition: "all 0.3s cubic-bezier(0.25,0.1,0.25,1)",
      boxShadow: "none",
      flex: isExpanded ? "1 1 100%" : "1 1 calc(50% - 12px)",
      minWidth: 300,
      maxWidth: isExpanded ? "100%" : 560,
      overflow: "hidden"
    },
    onMouseEnter: e => {
      e.currentTarget.style.boxShadow = "0 0 20px rgba(183,142,72,0.08)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.boxShadow = "none";
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: 200,
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a1a1a 50%, ${COLORS.surface} 100%)`,
      borderBottom: `1px solid ${COLORS.borderGold}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: material.id === "pmag" ? "../images/studio-luminant-lumina-pmag-organic-cell-relief-wall-panel.png" : "../images/studio-luminant-geometric-pinwheel-relief-wall-cladding-lounge.jpg",
    alt: material.id === "pmag" ? "Lumina PMAG architectural relief panel detail" : "Lumina PUCOMP façade application",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "32px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, material.domainIcon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 11,
      fontWeight: 500,
      color: COLORS.gold,
      letterSpacing: "0.12em",
      textTransform: "uppercase"
    }
  }, material.domain)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: 26,
      fontWeight: 600,
      color: COLORS.ivory,
      margin: "8px 0 4px",
      lineHeight: 1.2
    }
  }, material.name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 13,
      color: COLORS.muted,
      margin: "0 0 16px",
      fontWeight: 300
    }
  }, material.fullName), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 14,
      color: COLORS.ivory,
      margin: "0 0 20px",
      lineHeight: 1.6,
      fontWeight: 300
    }
  }, material.tagline), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 500,
      color: COLORS.gold,
      background: "transparent",
      border: `1px solid ${COLORS.gold}`,
      borderRadius: 2,
      padding: "8px 20px",
      cursor: "pointer",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      transition: "all 0.3s cubic-bezier(0.25,0.1,0.25,1)"
    },
    onMouseEnter: e => {
      e.target.style.background = COLORS.gold;
      e.target.style.color = COLORS.bg;
    },
    onMouseLeave: e => {
      e.target.style.background = "transparent";
      e.target.style.color = COLORS.gold;
    }
  }, isExpanded ? "Collapse" : "Explore")), isExpanded && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${COLORS.borderGold}`,
      padding: "24px 28px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 13,
      color: COLORS.muted,
      margin: "0 0 20px",
      lineHeight: 1.6,
      fontWeight: 300
    }
  }, material.application), /*#__PURE__*/React.createElement(FinishColorSelector, {
    materialId: material.id
  }), specCategories.map(cat => {
    const isOpen = openCat === cat.key;
    const relevant = cat.specs.filter(s => material.specs[s] && material.specs[s] !== "—");
    if (!relevant.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: cat.key,
      style: {
        borderBottom: "1px solid rgba(183,142,72,0.08)",
        marginBottom: 2
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleCat(cat.key),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "'Jost',sans-serif",
        fontSize: 13,
        fontWeight: 500,
        color: COLORS.ivory,
        letterSpacing: "0.06em"
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.gold,
        marginRight: 10,
        fontSize: 12
      }
    }, cat.icon), cat.label), /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.muted,
        fontSize: 10,
        transform: isOpen ? "rotate(180deg)" : "rotate(0)",
        transition: "transform 0.3s ease",
        display: "inline-block"
      }
    }, "\u25BC")), /*#__PURE__*/React.createElement("div", {
      style: {
        maxHeight: isOpen ? 600 : 0,
        overflow: "hidden",
        transition: "max-height 0.3s cubic-bezier(0.25,0.1,0.25,1)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 16
      }
    }, cat.specs.map(sk => {
      const val = material.specs[sk];
      if (!val) return null;
      return /*#__PURE__*/React.createElement("div", {
        key: sk,
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "6px 0 6px 22px",
          gap: 16
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: "'Jost',sans-serif",
          fontSize: 12,
          color: COLORS.muted,
          fontWeight: 300,
          flexShrink: 0
        }
      }, specMeta[sk]?.label || sk), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: "'Jost',sans-serif",
          fontSize: 13,
          color: COLORS.ivory,
          textAlign: "right",
          fontWeight: 400
        }
      }, val, specMeta[sk]?.unit && val !== "—" ? ` ${specMeta[sk].unit}` : ""));
    }))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#contact",
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 500,
      color: COLORS.gold,
      border: `1px solid ${COLORS.gold}`,
      borderRadius: 2,
      padding: "10px 24px",
      textDecoration: "none",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      display: "inline-block",
      transition: "all 0.3s cubic-bezier(0.25,0.1,0.25,1)"
    },
    onMouseEnter: e => {
      e.target.style.background = `${COLORS.gold}15`;
    },
    onMouseLeave: e => {
      e.target.style.background = "transparent";
    }
  }, "Request Sample"))));
}

// ─── COMPARISON TABLE ───
function ComparisonTable({
  slMaterial,
  activeSector
}) {
  const allSpecs = specCategories.flatMap(c => c.specs.map(s => ({
    ...specMeta[s],
    key: s,
    category: c.label
  })));
  const getAdvantage = (sk, slVal, compVal) => {
    if (!slVal || slVal === "—" || !compVal || compVal === "—") return "neutral";
    const a = {
      fire: () => {
        const rk = {
          A1: 6,
          "A2-s1,d0": 5,
          "B-s1,d0": 4,
          "B-s2,d0": 3,
          C: 2,
          "D-s2,d0": 1
        };
        const g = v => {
          for (const [k, r] of Object.entries(rk)) if (v.includes(k)) return r;
          return 0;
        };
        const s = g(slVal),
          c = g(compVal);
        return s > c ? "better" : s < c ? "worse" : "neutral";
      },
      moisture: () => {
        const rk = ["Poor", "Low", "Moderate", "Variable", "High", "Excellent"];
        const g = v => rk.findIndex(r => v.includes(r));
        const s = g(slVal),
          c = g(compVal);
        return s > c ? "better" : s < c ? "worse" : "neutral";
      },
      impact: () => {
        const rk = ["Brittle", "Low", "Moderate", "High"];
        const g = v => rk.findIndex(r => v.includes(r));
        const s = g(slVal),
          c = g(compVal);
        return s > c ? "better" : s < c ? "worse" : "neutral";
      }
    };
    if (a[sk]) return a[sk]();
    return "neutral";
  };
  const cols = sectorMaterials.filter(m => activeSector.includes(m.id));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      borderRadius: 2
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      minWidth: 600,
      borderCollapse: "collapse",
      fontFamily: "'Jost',sans-serif",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      padding: "12px 14px",
      color: COLORS.muted,
      fontWeight: 400,
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      borderBottom: `1px solid ${COLORS.borderGold}`,
      position: "sticky",
      left: 0,
      background: COLORS.surface,
      zIndex: 2,
      minWidth: 120
    }
  }, "Specification"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      padding: "12px 14px",
      color: COLORS.gold,
      fontWeight: 500,
      fontSize: 12,
      letterSpacing: "0.04em",
      borderBottom: `1px solid ${COLORS.borderGold}`,
      minWidth: 160,
      background: `${COLORS.gold}08`
    }
  }, slMaterial.name), cols.map(m => /*#__PURE__*/React.createElement("th", {
    key: m.id,
    style: {
      textAlign: "left",
      padding: "12px 14px",
      color: COLORS.muted,
      fontWeight: 400,
      fontSize: 12,
      borderBottom: `1px solid ${COLORS.borderGold}`,
      minWidth: 140
    }
  }, m.name)))), /*#__PURE__*/React.createElement("tbody", null, allSpecs.map(spec => {
    const slVal = slMaterial.specs[spec.key] || "—";
    return /*#__PURE__*/React.createElement("tr", {
      key: spec.key,
      style: {
        borderBottom: "1px solid rgba(183,142,72,0.06)"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "10px 14px",
        color: COLORS.muted,
        fontSize: 12,
        fontWeight: 300,
        position: "sticky",
        left: 0,
        background: COLORS.surface,
        zIndex: 1
      }
    }, spec.label), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "10px 14px",
        color: COLORS.ivory,
        fontWeight: 400,
        background: `${COLORS.gold}05`
      }
    }, slVal, spec.unit && slVal !== "—" ? ` ${spec.unit}` : ""), cols.map(m => {
      const cv = m.specs[spec.key] || "—";
      const adv = getAdvantage(spec.key, slVal, cv);
      return /*#__PURE__*/React.createElement("td", {
        key: m.id,
        style: {
          padding: "10px 14px",
          color: COLORS.ivory,
          fontWeight: 300,
          opacity: 0.85
        }
      }, cv, spec.unit && cv !== "—" ? ` ${spec.unit}` : "", /*#__PURE__*/React.createElement(AdvantageArrow, {
        advantage: adv
      }));
    }));
  }))));
}

// ─── MAIN ───
function MaterialGuide() {
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareMaterial, setCompareMaterial] = useState("pmag");
  const [activeSector, setActiveSector] = useState(["grg", "grc", "stone"]);
  const [compareView, setCompareView] = useState("table");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);
  const toggleSector = useCallback(id => {
    setActiveSector(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }, []);
  const comparedSL = studioMaterials.find(m => m.id === compareMaterial);
  const comparedSector = sectorMaterials.filter(m => activeSector.includes(m.id));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Josefin+Sans:wght@300;400;500;600&display=swap');
        .mg-root{box-sizing:border-box;}.mg-root *,.mg-root *::before,.mg-root *::after{box-sizing:inherit;}
        .mg-root ::-webkit-scrollbar{height:6px;width:6px;}.mg-root ::-webkit-scrollbar-track{background:${COLORS.bg};}.mg-root ::-webkit-scrollbar-thumb{background:${COLORS.borderGold};border-radius:2px;}
      `), /*#__PURE__*/React.createElement("section", {
    className: "mg-root",
    style: {
      background: COLORS.bg,
      color: COLORS.ivory,
      padding: isMobile ? "48px 16px" : "80px 40px",
      fontFamily: "'Jost',sans-serif",
      minHeight: "100vh",
      maxWidth: 1200,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: isMobile ? 40 : 64
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: isMobile ? 32 : 42,
      fontWeight: 600,
      color: COLORS.ivory,
      margin: "0 0 12px",
      letterSpacing: "0.02em"
    }
  }, "Material Intelligence"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: isMobile ? 16 : 19,
      fontWeight: 400,
      fontStyle: "italic",
      color: COLORS.muted,
      margin: "0 0 20px"
    }
  }, "Two proprietary composites. Engineered for architectural expression."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 1,
      background: COLORS.gold,
      margin: "0 auto"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 24,
      justifyContent: "center",
      marginBottom: 48
    }
  }, studioMaterials.map(mat => /*#__PURE__*/React.createElement(MaterialCard, {
    key: mat.id,
    material: mat,
    isExpanded: expandedMaterial === mat.id,
    onToggle: () => setExpandedMaterial(expandedMaterial === mat.id ? null : mat.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCompareMode(!compareMode),
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 500,
      color: compareMode ? COLORS.bg : COLORS.gold,
      background: compareMode ? COLORS.gold : "transparent",
      border: `1px solid ${COLORS.gold}`,
      borderRadius: 2,
      padding: "10px 28px",
      cursor: "pointer",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      transition: "all 0.3s cubic-bezier(0.25,0.1,0.25,1)"
    }
  }, compareMode ? "Close Comparison" : "Compare with Industry Standards")), compareMode && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      border: `1px solid ${COLORS.borderGold}`,
      borderRadius: 2,
      padding: isMobile ? "24px 16px" : "32px 28px",
      transition: "all 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: COLORS.muted,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: 500
    }
  }, "Comparing:"), studioMaterials.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => setCompareMaterial(m.id),
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 500,
      padding: "6px 16px",
      borderRadius: 2,
      cursor: "pointer",
      letterSpacing: "0.04em",
      border: compareMaterial === m.id ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.borderGold}`,
      color: compareMaterial === m.id ? COLORS.gold : COLORS.muted,
      background: compareMaterial === m.id ? `${COLORS.gold}12` : "transparent",
      transition: "all 0.3s ease"
    }
  }, m.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: COLORS.muted,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: 500,
      marginRight: 4
    }
  }, "Against:"), sectorMaterials.map(m => {
    const isOn = activeSector.includes(m.id);
    return /*#__PURE__*/React.createElement("button", {
      key: m.id,
      onClick: () => toggleSector(m.id),
      style: {
        fontFamily: "'Jost',sans-serif",
        fontSize: 11,
        fontWeight: 400,
        padding: "5px 12px",
        borderRadius: 2,
        cursor: "pointer",
        border: isOn ? `1px solid ${COLORS.gold}` : "1px solid rgba(138,130,117,0.3)",
        color: isOn ? COLORS.gold : COLORS.muted,
        background: isOn ? `${COLORS.gold}0A` : "transparent",
        transition: "all 0.3s ease"
      }
    }, m.name);
  })), !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 0,
      marginBottom: 24,
      borderBottom: `1px solid ${COLORS.borderGold}`
    }
  }, [{
    key: "table",
    label: "Specification Table"
  }, {
    key: "radar",
    label: "Performance Profile"
  }].map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab.key,
    onClick: () => setCompareView(tab.key),
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 500,
      padding: "10px 20px",
      cursor: "pointer",
      background: "none",
      border: "none",
      borderBottom: compareView === tab.key ? `2px solid ${COLORS.gold}` : "2px solid transparent",
      color: compareView === tab.key ? COLORS.gold : COLORS.muted,
      letterSpacing: "0.06em",
      transition: "all 0.3s ease"
    }
  }, tab.label))), (compareView === "table" || isMobile) && /*#__PURE__*/React.createElement(ComparisonTable, {
    slMaterial: comparedSL,
    activeSector: activeSector
  }), compareView === "radar" && !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "center",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement(RadarChart, {
    primary: comparedSL,
    comparisons: comparedSector,
    size: 360
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 160,
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 3,
      background: COLORS.gold,
      borderRadius: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: COLORS.gold,
      fontWeight: 500
    }
  }, comparedSL.name)), comparedSector.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 1,
      borderTop: `2px dashed ${COLORS.muted}`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: COLORS.muted,
      fontWeight: 300
    }
  }, m.name))))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: COLORS.muted,
      fontWeight: 300,
      marginTop: 28,
      fontStyle: "italic",
      opacity: 0.85
    }
  }, "Target classifications pending EN 13501-1 testing. Values represent design specifications; certification in progress."))));
}
ReactDOM.createRoot(document.getElementById("material-guide-root")).render(/*#__PURE__*/React.createElement(MaterialGuide, null));
})();
