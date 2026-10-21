import { useEffect, useRef, useState } from "react";
import {
  mapFogApertureScale,
  mapFogBlobPath,
  mapFogLayerOpacity,
  mapFogMotionShouldRun,
  type MapFogNode,
} from "./mapFogGeometry";

export function MapFog({
  id,
  clouds,
  progress,
}: {
  id: string;
  clouds: readonly MapFogNode[];
  progress: number;
}) {
  const layer = useRef<SVGGElement>(null);
  const [motionActive, setMotionActive] = useState(false);
  const maskId = `${id}-apertures`;
  const fogOpacity = mapFogLayerOpacity(progress);
  const shouldAnimate = motionActive && fogOpacity > 0;

  useEffect(() => {
    const element = layer.current;
    if (!element) return;

    let intersects = false;
    let visible = document.visibilityState === "visible";
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    const updateMotion = () =>
      setMotionActive(mapFogMotionShouldRun(intersects, visible, reducedMotion));
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              intersects = entries.some((entry) => entry.isIntersecting);
              updateMotion();
            },
            { threshold: 0.01 },
          );
    observer?.observe(element);

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible";
      updateMotion();
    };
    const onMotionPreferenceChange = () => {
      reducedMotion = motionPreference.matches;
      updateMotion();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener("change", onMotionPreferenceChange);
    } else {
      motionPreference.addListener(onMotionPreferenceChange);
    }
    updateMotion();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (motionPreference.removeEventListener) {
        motionPreference.removeEventListener("change", onMotionPreferenceChange);
      } else {
        motionPreference.removeListener(onMotionPreferenceChange);
      }
    };
  }, []);

  return (
    <g
      ref={layer}
      className="map-fog-layer"
      aria-hidden="true"
      pointerEvents="none"
      style={{ opacity: fogOpacity }}
    >
      <defs>
        <linearGradient id={`${id}-mist-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7e5e8" />
          <stop offset="36%" stopColor="#edf1ef" />
          <stop offset="70%" stopColor="#d4e1e8" />
          <stop offset="100%" stopColor="#e8ecdf" />
        </linearGradient>
        <radialGradient
          id={`${id}-aperture-feather`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor="#000" stopOpacity="1" />
          <stop offset="38%" stopColor="#000" stopOpacity=".97" />
          <stop offset="72%" stopColor="#000" stopOpacity=".66" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter
          id={`${id}-mist-blur`}
          x="-0.03"
          y="-0.35"
          width="1.06"
          height="1.7"
          filterUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="12 8" />
        </filter>
        <mask
          id={maskId}
          x="0"
          y="0"
          width="1100"
          height="650"
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          style={{ maskType: "luminance" }}
        >
          <rect x="0" y="0" width="1100" height="650" rx="24" fill="#fff" />
          {clouds.map((cloud) => {
            const opening = mapFogApertureScale(progress, cloud.clearsAt);
            if (opening <= 0) return null;
            return (
              <path
                key={cloud.id}
                className="map-fog-aperture"
                d={mapFogBlobPath(cloud.id)}
                transform={`translate(${cloud.x} ${cloud.y}) rotate(${cloud.angle}) scale(${106 * cloud.size * opening} ${75 * cloud.size * opening})`}
                fill={`url(#${id}-aperture-feather)`}
              />
            );
          })}
        </mask>
      </defs>
      <rect
        className="map-fog-cover"
        x="0"
        y="0"
        width="1100"
        height="650"
        rx="24"
        fill={`url(#${id}-mist-fill)`}
        mask={`url(#${maskId})`}
      />
      <g className="map-fog-wisps" mask={`url(#${maskId})`}>
        <g className={`map-fog-flow map-fog-flow--slow${shouldAnimate ? " is-active" : ""}`}>
          <path filter={`url(#${id}-mist-blur)`} d="M-95 176 C76 104 171 252 351 195 S637 110 788 164 S1031 235 1190 121" />
          <path filter={`url(#${id}-mist-blur)`} d="M-112 407 C83 322 230 449 389 392 S677 300 840 372 S1051 424 1190 337" />
        </g>
        <g className={`map-fog-flow map-fog-flow--quick${shouldAnimate ? " is-active" : ""}`}>
          <path filter={`url(#${id}-mist-blur)`} d="M-70 285 C105 230 267 307 424 274 S693 222 869 279 S1060 320 1180 242" />
        </g>
      </g>
    </g>
  );
}
