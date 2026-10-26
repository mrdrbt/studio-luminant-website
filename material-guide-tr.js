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

const TXT = {
  better: "", worse: "",
  tableLabel: "Spesifikasyon Tablosu",
  sampleHref: "iletisim.htm#sampleForm"
};
const COLORS = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  borderGold: "rgba(var(--accent-rgb),0.18)",
  gold: "var(--accent)",
  goldLight: "var(--accent-hover)",
  ivory: "var(--ink)",
  muted: "var(--ink-muted)",
  sage: "#6B8F71",
  amber: "#C4956A",
  crimson: "#A65D5D"
};
const specCategories = [{
  key: "physical",
  label: "Fiziksel",
  specs: ["density", "weight", "thickness"]
}, {
  key: "performance",
  label: "Performans",
  specs: ["moisture", "impact", "uv", "chemical", "temperature"]
}, {
  key: "finish",
  label: "İşlem & Tasarım",
  specs: ["surface", "customDesign", "voc"]
}, {
  key: "installation",
  label: "Montaj",
  specs: ["method", "speed", "leadTime"]
}];
const specMeta = {
  density: {
    label: "Yoğunluk",
    unit: "kg/m³"
  },
  weight: {
    label: "m² Başına Ağırlık",
    unit: "kg/m²"
  },
  thickness: {
    label: "Panel kalınlığı",
    unit: "mm"
  },
  moisture: {
    label: "Nem direnci",
    unit: ""
  },
  impact: {
    label: "Darbe direnci",
    unit: ""
  },
  uv: {
    label: "UV direnci",
    unit: ""
  },
  chemical: {
    label: "Kimyasal direnç",
    unit: ""
  },
  temperature: {
    label: "Sıcaklık aralığı",
    unit: ""
  },
  surface: {
    label: "Yüzey işlemi",
    unit: ""
  },
  customDesign: {
    label: "Özel tasarım",
    unit: ""
  },
  voc: {
    label: "VOC emisyonları",
    unit: ""
  },
  acoustic: {
    label: "Akustik",
    unit: ""
  },
  antimicrobial: {
    label: "Antimikrobiyal",
    unit: ""
  },
  method: {
    label: "Montaj yöntemi",
    unit: ""
  },
  speed: {
    label: "Montaj hızı",
    unit: ""
  },
  leadTime: {
    label: "Teslim süresi",
    unit: ""
  }
};
const finishTypes = [{
  id: "matte",
  label: "Mat",
  desc: "Pürüzsüz, yansımasız yüzey",
  preview: {
    gradient: "linear-gradient(145deg, #333 0%, #444 100%)",
    overlay: null
  }
}, {
  id: "satin",
  label: "Saten",
  desc: "Yumuşak parlaklık, düşük yansıma",
  preview: {
    gradient: "linear-gradient(145deg, #555 0%, #777 60%, #555 100%)",
    overlay: {
      type: "sheen"
    }
  }
}, {
  id: "mica",
  label: "Mika Metalik",
  desc: "Sedefli metalik parıltı",
  preview: {
    gradient: "linear-gradient(135deg, #5A4A2A 0%, #8B7340 40%, #5A4A2A 60%, #8B7340 100%)",
    overlay: {
      type: "grain",
      angle: "90deg"
    }
  }
}];
const colorPalettes = {
  pmag: [
    { group: "Konaklama", colors: [
      { id: "warm-taupe", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "ivory", label: "Ivory", hex: ["#D8D0C4", "#EDE8DF"] },
      { id: "bronze", label: "Bronz", hex: ["#5C4A2A", "#8B7355"] },
      { id: "espresso", label: "Espresso", hex: ["#3C2415", "#5C3A2A"] }
    ]},
    { group: "Kurumsal", colors: [
      { id: "obsidian", label: "Obsidian", hex: ["#1A1A1A", "#2D2D2D"] },
      { id: "cloud-white", label: "Cloud White", hex: ["#EDEAE4", "#F0EFEB"] },
      { id: "silhouette", label: "Silhouette", hex: ["#4A433E", "#635C56"] },
      { id: "gold", label: "Altın", hex: ["#8B6914", "#C9A84C"] }
    ]},
    { group: "Konut", colors: [
      { id: "warm-taupe-r", label: "Warm Taupe", hex: ["#6B5D50", "#8A7B6D"] },
      { id: "copper", label: "Bakır", hex: ["#7A4A2A", "#B87333"] },
      { id: "midnight-sage", label: "Midnight Sage", hex: ["#3D503E", "#576B52"] },
      { id: "ivory-r", label: "Ivory", hex: ["#D8D0C4", "#EDE8DF"] }
    ]}
  ]
};
const radarAxes = [{
  key: "weightAdv",
  label: "Ağırlık"
}, {
  key: "moistureRes",
  label: "Nem"
}, {
  key: "finishQuality",
  label: "İşlem Kalitesi"
}, {
  key: "designFreedom",
  label: "Tasarım Özgürlüğü"
}, {
  key: "installSpeed",
  label: "Montaj Hızı"
}, {
  key: "leadTimeAdv",
  label: "Teslim Süresi"
}, {
  key: "impactRes",
  label: "Darbe"
}];
var _S = window.SL_SPECS || {};
var _pmag = _S.pmag || {};
var _F = _S.fmt || {};
const studioMaterials = [{
  id: "pmag",
  name: "Lumina PMAG™",
  fullName: "Polymer Modified Composite Gypsum",
  tagline: "Yüksek spesifikasyonlu iç mekânlar için mimari rölyef panelleri",
  domain: "İç Mekân",
  application: "Öne çıkan duvarlar, tavan elemanları, kolon kaplamaları, banko ve tezgâh önleri, vurgu yüzeyleri, resepsiyon alanları, koridor vurgu duvarları",
  specs: {
    density: "1,400–1,600",
    weight: (_pmag.weight ? _pmag.weight.min + '–' + _pmag.weight.max : "35–40"),
    thickness: (_pmag.thickness ? _pmag.thickness.min + '–' + _pmag.thickness.max : "15–40"),
    moisture: "Standart alçıya göre neme dayanıklı",
    impact: "Orta (cam elyaf takviyeli)",
    uv: "—",
    chemical: "—",
    temperature: "—",
    surface: (_pmag.finish ? _pmag.finish.tr : "Tüm RAL / özel renkler — artizan finish, pürüzsüz ya da dokulu"),
    customDesign: "Parametrik tasarım, sınırsız desen",
    voc: "Düşük",
    acoustic: "—",
    antimicrobial: "—",
    method: "LuminClip™ gizli ray sistemi",
    speed: "Panel başına 20–30 sn",
    leadTime: "Teklifte netleşir"
  },
  radar: {
    weightAdv: 0.6,
    moistureRes: 0.4,
    finishQuality: 0.95,
    designFreedom: 0.95,
    installSpeed: 0.9,
    leadTimeAdv: 0.8,
    impactRes: 0.5
  }
}];
const sectorMaterials = [{
  id: "grg",
  name: "Standart GRG",
  fullName: "Cam Elyaf Takviyeli Alçı",
  specs: {
    density: "1,000–1,300",
    weight: "15–25",
    thickness: "10–20",
    moisture: "Düşük — yalnızca kuru iç mekân",
    impact: "Düşük–Orta",
    uv: "—",
    chemical: "—",
    temperature: "—",
    surface: "Boyalı (şantiyede boya gerekir)",
    customDesign: "Kalıp seçeneği sınırlı",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Yapıştırıcı + mekanik sabitleme",
    speed: "Usta işçilik gerekir",
    leadTime: "6–10 hafta"
  },
  radar: {
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
  fullName: "Cam Elyaf Takviyeli Beton",
  specs: {
    density: "1,800–2,200",
    weight: "25–45",
    thickness: "10–25",
    moisture: "Yüksek",
    impact: "Yüksek",
    uv: "İyi",
    chemical: "Orta",
    temperature: "Geniş aralık",
    surface: "Döküm hâliyle ya da boyalı (sınırlı)",
    customDesign: "Mümkün, ancak kalıp maliyeti yüksek",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Ağır mekanik sabitleme",
    speed: "Taşıyıcı destek gerekebilir",
    leadTime: "8–14 hafta"
  },
  radar: {
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
  name: "Doğal Taş",
  fullName: "Mermer / Kireçtaşı Kaplama",
  specs: {
    density: "2,300–2,800",
    weight: "50–75",
    thickness: "20+",
    moisture: "Değişken (yüzey korunmazsa gözenekli)",
    impact: "Kırılgan — kenar kırığı ve çatlak",
    uv: "Çok iyi (doğal)",
    chemical: "Asitlere hassas",
    temperature: "Geniş aralık",
    surface: "Cilalı, honlu, dokulu (doğal)",
    customDesign: "Yalnızca oyma — çok yüksek maliyet",
    voc: "Yok",
    acoustic: "—",
    antimicrobial: "—",
    method: "Taşıyıcı destek, usta taş işçiliği",
    speed: "Yavaş, uzman işçilik",
    leadTime: "10–20 hafta"
  },
  radar: {
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
  fullName: "Elyaf Takviyeli Polimer",
  specs: {
    density: "1,500–2,000",
    weight: "5–15",
    thickness: "3–12",
    moisture: "Çok iyi",
    impact: "Yüksek",
    uv: "Orta (jelkota bağlı)",
    chemical: "İyi",
    temperature: "Orta aralık",
    surface: "Jelkot ya da boya (plastik görünebilir)",
    customDesign: "Kalıba bağlı",
    voc: "—",
    acoustic: "—",
    antimicrobial: "—",
    method: "Yapıştırıcı ya da mekanik",
    speed: "Orta",
    leadTime: "4–8 hafta"
  },
  radar: {
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
  name: "MDF / Ahşap",
  fullName: "MDF ve Ahşap Paneller",
  specs: {
    density: "600–800",
    weight: "10–18",
    thickness: "6–25",
    moisture: "Zayıf — şişer, eğilir",
    impact: "Orta",
    uv: "Zayıf",
    chemical: "Zayıf",
    temperature: "Yalnızca iç mekân",
    surface: "Kaplamalı, boyalı ya da CNC ile oyulmuş",
    customDesign: "CNC ile mümkün, derinlik sınırlı",
    voc: "Orta (formaldehit riski)",
    acoustic: "Orta düzeyde doğal ses yutumu",
    antimicrobial: "—",
    method: "Standart doğrama işçiliği",
    speed: "Hızlı — standart bağlantılar",
    leadTime: "3–6 hafta"
  },
  radar: {
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
  const radarSummary = primary.name + ": " + radarAxes.map(a => a.label + " " + Math.round((primary.radar[a.key] || 0) * 100) + "%").join(", ");
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
    role: "img",
    "aria-label": radarSummary,
    style: {
      overflow: "visible"
    }
  }, /*#__PURE__*/React.createElement("title", null, radarSummary), Array.from({
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
        transition: "opacity 0.3s ease, r 0.3s ease",
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
      fontWeight: 400
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
      fontSize: 10,
      fontWeight: 400,
      color: COLORS.gold,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 14
    }
  }, "Yüzey İşlemi"), /*#__PURE__*/React.createElement("div", {
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
      type: "button",
      "aria-pressed": isAct,
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
        transition: "background-color 0.3s ease, border-color 0.3s ease",
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
        fontSize: 10,
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
      fontSize: 10,
      fontWeight: 400,
      color: COLORS.gold,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 14
    }
  }, "Renk"), colorGroups.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.group,
    role: "group",
    "aria-label": group.group,
    style: { marginBottom: 16 }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 10,
      fontWeight: 400,
      color: COLORS.muted,
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      display: "block",
      marginBottom: 8
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
    return /*#__PURE__*/React.createElement("button", {
      key: color.id,
      type: "button",
      className: "mg-swatch",
      "aria-pressed": isAct,
      "aria-label": color.label,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        cursor: "pointer"
      },
      onClick: () => setActiveColor(isAct ? null : color.id)
    }, /*#__PURE__*/React.createElement("div", {
      className: "mg-chip",
      "aria-hidden": "true",
      style: {
        width: 44,
        height: 44,
        borderRadius: 2,
        border: isAct ? `2px solid ${COLORS.gold}` : `1px solid ${COLORS.borderGold}`,
        background: getSwatchStyle(selectedFinish, color),
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        transform: isAct ? "scale(1.1)" : "scale(1)",
        boxShadow: isAct ? `0 2px 12px ${color.hex[0]}55` : "none"
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
        fontSize: 10,
        color: isAct ? COLORS.gold : COLORS.muted,
        textAlign: "center",
        lineHeight: 1.2,
        fontWeight: isAct ? 400 : 300,
        maxWidth: 56,
        transition: "color 0.2s ease"
      }
    }, color.label));
  })))), /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite"
  }, activeColor && /*#__PURE__*/React.createElement("div", {
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
  }, selectedFinish.label, " \xB7 ", allColors.find(c => c.id === activeColor)?.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      padding: "12px 16px",
      background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.06) 0%, rgba(var(--accent-rgb),0.02) 100%)",
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
  }, "Özel renk eşleştirme mümkündür \u2014 RAL, NCS veya ısmarlama referans.")));
}
function AdvantageArrow({
  advantage
}) {
  const glyph = (color, ch) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      color,
      fontSize: "11px",
      marginLeft: 4
    }
  }, ch), advantage !== "neutral" && TXT[advantage] ? /*#__PURE__*/React.createElement("span", {
    className: "mg-sr"
  }, " (" + TXT[advantage] + ")") : null);
  if (advantage === "better") return glyph(COLORS.sage, "\u25B2");
  if (advantage === "worse") return glyph(COLORS.crimson, "\u25BC");
  return glyph(COLORS.muted, "\u2014");
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
      transition: "box-shadow 0.3s cubic-bezier(0.25,0.1,0.25,1)",
      boxShadow: "none",
      flex: isExpanded ? "1 1 100%" : "1 1 calc(50% - 12px)",
      minWidth: 300,
      maxWidth: isExpanded ? "100%" : 560,
      overflow: "hidden"
    },
    className: "mg-card"
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
    width: material.id === "pmag" ? 1120 : 1536,
    height: material.id === "pmag" ? 1400 : 1024,
    loading: "lazy",
    decoding: "async",
    src: material.id === "pmag" ? "images/studio-luminant-charcoal-relief-wall-beauty-salon-reception-concept.jpg" : "images/studio-luminant-cellular-relief-wall-hotel-reception-concept.jpg",
    alt: material.id === "pmag" ? "Güzellik merkezinin bekleme salonunda dikey akan kıvrımlarla antrasit rölyef duvar, önünde pudra pembesi bir bank" : "Otel resepsiyonunda traverten bankonun arkasında yükselen, sıcak yalama ışıkla aydınlanan hücre desenli rölyef duvar",
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
    className: "mg-eyebrow"
  }, material.domain)), /*#__PURE__*/React.createElement("h3", {
    translate: "no",
    style: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: 34,
      fontWeight: 300,
      color: COLORS.ivory,
      margin: "8px 0 4px",
      lineHeight: 1.1
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
    type: "button",
    className: "mg-explore",
    "aria-expanded": isExpanded,
    "aria-controls": "mg-panel-" + material.id,
    onClick: onToggle
  }, isExpanded ? "Daralt" : "Keşfet", /*#__PURE__*/React.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { flexShrink: 0, transition: "transform 0.3s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" } }, /*#__PURE__*/React.createElement("path", { d: "M2 4.5l4 4 4-4" })))), isExpanded && /*#__PURE__*/React.createElement("div", {
    id: "mg-panel-" + material.id,
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
      type: "button",
      "aria-expanded": isOpen,
      "aria-controls": "mg-cat-" + material.id + "-" + cat.key,
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
        fontSize: 11,
        fontWeight: 400,
        color: COLORS.ivory,
        letterSpacing: "0.22em",
        textTransform: "uppercase"
      }
    }, /*#__PURE__*/React.createElement("span", null, cat.label), /*#__PURE__*/React.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { color: COLORS.muted, flexShrink: 0, transition: "transform 0.3s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0)" } }, /*#__PURE__*/React.createElement("path", { d: "M2 4.5l4 4 4-4" }))), /*#__PURE__*/React.createElement("div", {
      id: "mg-cat-" + material.id + "-" + cat.key,
      role: "region",
      "aria-hidden": !isOpen,
      inert: isOpen ? undefined : "",
      style: {
        maxHeight: isOpen ? 600 : 0,
        overflow: "hidden",
        visibility: isOpen ? "visible" : "hidden",
        transition: `max-height 0.3s cubic-bezier(0.25,0.1,0.25,1), visibility 0s linear ${isOpen ? 0 : 0.3}s`
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
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums"
        }
      }, val, specMeta[sk]?.unit && val !== "—" ? `\u00A0${specMeta[sk].unit}` : ""));
    }))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: TXT.sampleHref,
    className: "mg-cta"
  }, "Numune Talep Et"))));
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
    className: "mg-scroll",
    tabIndex: 0,
    role: "region",
    "aria-label": TXT.tableLabel,
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
      fontSize: 13,
      fontVariantNumeric: "tabular-nums"
    }
  }, /*#__PURE__*/React.createElement("caption", {
    className: "mg-sr"
  }, TXT.tableLabel + ": " + slMaterial.name), /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    scope: "col",
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
  }, "Özellik"), /*#__PURE__*/React.createElement("th", {
    scope: "col",
    style: {
      textAlign: "left",
      padding: "12px 14px",
      color: COLORS.gold,
      fontWeight: 400,
      fontSize: 12,
      letterSpacing: "0.04em",
      borderBottom: `1px solid ${COLORS.borderGold}`,
      minWidth: 160,
      background: `${COLORS.gold}08`
    }
  }, slMaterial.name), cols.map(m => /*#__PURE__*/React.createElement("th", {
    key: m.id,
    scope: "col",
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
    }, /*#__PURE__*/React.createElement("th", {
      scope: "row",
      style: {
        textAlign: "left",
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
    }, slVal, spec.unit && slVal !== "—" ? `\u00A0${spec.unit}` : ""), cols.map(m => {
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
      }, cv, spec.unit && cv !== "—" ? `\u00A0${spec.unit}` : "", /*#__PURE__*/React.createElement(AdvantageArrow, {
        advantage: adv
      }));
    }));
  }))));
}

// ─── MAIN ───
function MaterialGuide() {
  const [expandedMaterial, setExpandedMaterial] = useState(() => {
    const q = new URLSearchParams(location.search).get("material");
    if (q === "none") return null;
    return studioMaterials.some(m => m.id === q) ? q : "pmag";
  });
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (expandedMaterial === "pmag") p.delete("material"); else p.set("material", expandedMaterial || "none");
    const s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }, [expandedMaterial]);
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
        .mg-root{box-sizing:border-box;}.mg-root *,.mg-root *::before,.mg-root *::after{box-sizing:inherit;}
        .mg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
        .mg-root button{font:inherit;}
        .mg-swatch{background:none;border:0;padding:0;color:inherit;font:inherit;}
        .mg-swatch:hover .mg-chip{transform:scale(1.06);}
        .mg-root button:focus-visible,.mg-root a:focus-visible{outline:2px solid ${COLORS.gold};outline-offset:3px;}
        .mg-eyebrow{display:inline-flex;align-items:center;gap:14px;font-family:'Jost',sans-serif;font-size:10px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;color:${COLORS.gold};}
        .mg-eyebrow::before{content:'';width:24px;height:1px;background:${COLORS.gold};}
        .mg-root .mg-explore,.mg-root .mg-link{display:inline-flex;align-items:center;gap:10px;font-family:'Jost',sans-serif;font-size:11px;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.gold};background:none;border:0;border-bottom:1px solid rgba(var(--accent-rgb),0.45);border-radius:0;padding:0 0 4px;cursor:pointer;transition:border-color 0.3s ease,color 0.3s ease;}
        .mg-root .mg-explore:hover,.mg-root .mg-link:hover{border-bottom-color:${COLORS.gold};color:${COLORS.goldLight};}
        .mg-root .mg-cta{display:inline-flex;align-items:center;font-family:'Jost',sans-serif;font-size:11px;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:var(--on-accent);background:${COLORS.gold};padding:14px 32px;text-decoration:none;transition:background-color 0.3s ease;}
        .mg-root .mg-cta:hover,.mg-root .mg-cta:focus-visible{background-color:${COLORS.goldLight};}
        .mg-scroll:focus-visible{outline:2px solid ${COLORS.gold};outline-offset:-2px;}
        .mg-root ::-webkit-scrollbar{height:6px;width:6px;}.mg-root ::-webkit-scrollbar-track{background:${COLORS.bg};}.mg-root ::-webkit-scrollbar-thumb{background:${COLORS.borderGold};border-radius:2px;}
      `), /*#__PURE__*/React.createElement("section", {
    className: "mg-root",
    style: {
      background: COLORS.bg,
      color: COLORS.ivory,
      padding: isMobile ? "64px 24px" : "96px 60px",
      fontFamily: "'Jost',sans-serif",
      maxWidth: 1280,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: isMobile ? 36 : 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mg-eyebrow",
    style: { marginBottom: 28 }
  }, "Lumina PMAG\u2122"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: isMobile ? 36 : 52,
      fontWeight: 300,
      lineHeight: 1.05,
      color: COLORS.ivory,
      margin: "0 0 20px"
    }
  }, "Malzeme Zekâsı" ), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 14,
      lineHeight: 1.85,
      fontWeight: 300,
      color: COLORS.muted,
      margin: 0,
      maxWidth: 520
    }
  }, "İç mekân mimari yüzeyleri için Lumina PMAG™.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 24,
      justifyContent: "flex-start",
      marginBottom: 32
    }
  }, studioMaterials.map(mat => /*#__PURE__*/React.createElement(MaterialCard, {
    key: mat.id,
    material: mat,
    isExpanded: expandedMaterial === mat.id,
    onToggle: () => setExpandedMaterial(expandedMaterial === mat.id ? null : mat.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": compareMode,
    "aria-controls": "mg-compare",
    onClick: () => setCompareMode(!compareMode),
    className: "mg-link"
  }, compareMode ? "Karşılaştırmayı Kapat" : "Endüstri Standartlarıyla Karşılaştır", /*#__PURE__*/React.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { flexShrink: 0, transition: "transform 0.3s ease", transform: compareMode ? "rotate(180deg)" : "rotate(0)" } }, /*#__PURE__*/React.createElement("path", { d: "M2 4.5l4 4 4-4" })))), compareMode && /*#__PURE__*/React.createElement("div", {
    id: "mg-compare",
    style: {
      background: COLORS.surface,
      border: `1px solid ${COLORS.borderGold}`,
      borderRadius: 2,
      padding: isMobile ? "24px 16px" : "32px 28px",
      transition: "border-color 0.3s ease"
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
      fontWeight: 400
    }
  }, "Karşılaştırılan:"), studioMaterials.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    type: "button",
    "aria-pressed": compareMaterial === m.id,
    onClick: () => setCompareMaterial(m.id),
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 400,
      padding: "6px 16px",
      borderRadius: 2,
      cursor: "pointer",
      letterSpacing: "0.04em",
      border: compareMaterial === m.id ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.borderGold}`,
      color: compareMaterial === m.id ? COLORS.gold : COLORS.muted,
      background: compareMaterial === m.id ? `${COLORS.gold}12` : "transparent",
      transition: "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease"
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
      fontWeight: 400,
      marginRight: 4
    }
  }, "Karşı:"), sectorMaterials.map(m => {
    const isOn = activeSector.includes(m.id);
    return /*#__PURE__*/React.createElement("button", {
      key: m.id,
      type: "button",
      "aria-pressed": isOn,
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
        transition: "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease"
      }
    }, m.name);
  })), !isMobile && /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    onKeyDown: e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const keys = ["table", "radar"];
      const i = keys.indexOf(compareView);
      const next = e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
      setCompareView(keys[next]);
      const el = document.getElementById("mg-tab-" + keys[next]);
      if (el) el.focus();
    },
    style: {
      display: "flex",
      gap: 0,
      marginBottom: 24,
      borderBottom: `1px solid ${COLORS.borderGold}`
    }
  }, [{
    key: "table",
    label: "Spesifikasyon Tablosu"
  }, {
    key: "radar",
    label: "Performans Profili"
  }].map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab.key,
    type: "button",
    role: "tab",
    id: "mg-tab-" + tab.key,
    "aria-selected": compareView === tab.key,
    "aria-controls": "mg-tabpanel",
    tabIndex: compareView === tab.key ? 0 : -1,
    onClick: () => setCompareView(tab.key),
    style: {
      fontFamily: "'Jost',sans-serif",
      fontSize: 12,
      fontWeight: 400,
      padding: "10px 20px",
      cursor: "pointer",
      background: "none",
      border: "none",
      borderBottom: compareView === tab.key ? `2px solid ${COLORS.gold}` : "2px solid transparent",
      color: compareView === tab.key ? COLORS.gold : COLORS.muted,
      letterSpacing: "0.06em",
      transition: "color 0.3s ease, border-color 0.3s ease"
    }
  }, tab.label))), /*#__PURE__*/React.createElement("div", {
    id: "mg-tabpanel",
    role: isMobile ? undefined : "tabpanel",
    "aria-labelledby": isMobile ? undefined : "mg-tab-" + compareView
  }, (compareView === "table" || isMobile) && /*#__PURE__*/React.createElement(ComparisonTable, {
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
      fontWeight: 400
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
  }, m.name)))))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: COLORS.muted,
      fontWeight: 300,
      marginTop: 28,
      fontStyle: "italic",
      opacity: 0.85
    }
  }, "Değerler tasarım spesifikasyonlarını temsil eder."))));
}
ReactDOM.createRoot(document.getElementById("material-guide-root")).render(/*#__PURE__*/React.createElement(MaterialGuide, null));
})();
