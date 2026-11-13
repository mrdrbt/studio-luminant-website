"use strict";

(() => {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const mod360 = d => ((d % 360) + 360) % 360;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // NOAA low-precision solar position, Meeus-derived.
  // Longitude and UTC offsets are east-positive.
  function julianDay(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716))
      + Math.floor(30.6001 * (month + 1))
      + day + B - 1524.5;
  }

  function sunGeometry(year, month, day, utcHourDecimal) {
    const jd = julianDay(year, month, day) + utcHourDecimal / 24;
    const T = (jd - 2451545.0) / 36525.0;
    const L0 = mod360(280.46646 + T * (36000.76983 + T * 0.0003032));
    const M = mod360(357.52911 + T * (35999.05029 - 0.0001537 * T));
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Mrad = toRad(M);
    const C = Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T))
      + Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T)
      + Math.sin(3 * Mrad) * 0.000289;
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const apparentLong = trueLong - 0.00569
      - 0.00478 * Math.sin(toRad(omega));
    const eps0 = 23 + (
      26 + (
        21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))
      ) / 60
    ) / 60;
    const eps = eps0 + 0.00256 * Math.cos(toRad(omega));
    const declDeg = toDeg(Math.asin(
      Math.sin(toRad(eps)) * Math.sin(toRad(apparentLong))
    ));
    const y = Math.pow(Math.tan(toRad(eps / 2)), 2);
    const eqtimeMin = 4 * toDeg(
      y * Math.sin(2 * toRad(L0))
      - 2 * e * Math.sin(Mrad)
      + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * toRad(L0))
      - 0.5 * y * y * Math.sin(4 * toRad(L0))
      - 1.25 * e * e * Math.sin(2 * Mrad)
    );
    return { declDeg, eqtimeMin };
  }

  // localHour is local decimal clock time. Azimuth is compass-based.
  function solarPosition(
    year,
    month,
    day,
    localHour,
    lat,
    lon,
    utcOffsetHours
  ) {
    const utcHour = localHour - utcOffsetHours;
    const { declDeg, eqtimeMin } = sunGeometry(
      year,
      month,
      day,
      utcHour
    );
    const trueSolarMin = mod360(
      (utcHour * 60 + eqtimeMin + 4 * lon) / 4
    ) * 4;
    const hourAngleDeg = trueSolarMin / 4 - 180;
    const latR = toRad(lat);
    const declR = toRad(declDeg);
    const haR = toRad(hourAngleDeg);
    const cosZenith = clamp(
      Math.sin(latR) * Math.sin(declR)
        + Math.cos(latR) * Math.cos(declR) * Math.cos(haR),
      -1,
      1
    );
    const zenithR = Math.acos(cosZenith);
    const elDeg = 90 - toDeg(zenithR);

    let azDeg;
    const denom = Math.cos(latR) * Math.sin(zenithR);
    if (Math.abs(denom) > 1e-3) {
      let azR = (
        Math.sin(latR) * cosZenith - Math.sin(declR)
      ) / denom;
      azR = clamp(azR, -1, 1);
      azDeg = 180 - toDeg(Math.acos(azR));
      if (hourAngleDeg > 0) {
        azDeg = -azDeg;
      }
    } else {
      azDeg = lat > 0 ? 180 : 0;
    }

    azDeg = mod360(azDeg);
    return { elDeg, azDeg, declDeg, eqtimeMin };
  }

  function sunriseSunset(
    year,
    month,
    day,
    lat,
    lon,
    utcOffsetHours
  ) {
    const { declDeg, eqtimeMin } = sunGeometry(
      year,
      month,
      day,
      12 - utcOffsetHours + lon / 15 * -1 + utcOffsetHours
    );
    const latR = toRad(lat);
    const declR = toRad(declDeg);
    const cosHA = (
      Math.cos(toRad(90.833)) / (
        Math.cos(latR) * Math.cos(declR)
      )
    ) - Math.tan(latR) * Math.tan(declR);

    if (cosHA > 1) {
      return { sunrise: null, sunset: null, note: "sun never rises" };
    }
    if (cosHA < -1) {
      return { sunrise: null, sunset: null, note: "sun never sets" };
    }

    const haDeg = toDeg(Math.acos(cosHA));
    const solarNoonLocalMin = 720 - 4 * lon - eqtimeMin
      + 60 * utcOffsetHours;
    const sunriseMin = solarNoonLocalMin - 4 * haDeg;
    const sunsetMin = solarNoonLocalMin + 4 * haDeg;
    return {
      sunrise: mod360(sunriseMin / 60 * 15) / 15,
      sunset: mod360(sunsetMin / 60 * 15) / 15,
      note: ""
    };
  }

  function fmtHour(h) {
    if (h == null || !isFinite(h)) {
      return "--";
    }
    h = ((h % 24) + 24) % 24;
    let hh = Math.floor(h);
    let mm = Math.round((h - hh) * 60);
    if (mm === 60) {
      // rounding 23.999 -> hh=23, mm=60 without this carry; roll the minute into the next
      // hour and wrap 24 back to 0, so the display never shows "23:60".
      mm = 0;
      hh = (hh + 1) % 24;
    }
    return String(hh).padStart(2, "0")
      + ":"
      + String(mm).padStart(2, "0");
  }

  function wallLocalAngle(sunAzDeg, sunElDeg, wallAzDeg) {
    const azR = toRad(sunAzDeg);
    const elR = toRad(sunElDeg);
    const wallR = toRad(wallAzDeg);
    const Lx = Math.sin(azR) * Math.cos(elR);
    const Ly = Math.cos(azR) * Math.cos(elR);
    const Lz = Math.sin(elR);
    const nx = Math.sin(wallR);
    const ny = Math.cos(wallR);
    const rx = -Math.cos(wallR);
    const ry = Math.sin(wallR);
    const Ldotn = Lx * nx + Ly * ny;
    const Ldotup = Lz;
    const Ldotright = Lx * rx + Ly * ry;
    const elPrime = toDeg(Math.asin(clamp(Ldotn, -1, 1)));
    const azPrime = mod360(toDeg(Math.atan2(Ldotup, Ldotright)));
    return {
      azPrime,
      elPrime,
      directLit: Ldotn > 0 && sunElDeg > 0
    };
  }

  globalThis.SunStudioSolar = Object.freeze({
    toRad,
    toDeg,
    mod360,
    clamp,
    julianDay,
    sunGeometry,
    solarPosition,
    sunriseSunset,
    fmtHour,
    wallLocalAngle
  });
})();
