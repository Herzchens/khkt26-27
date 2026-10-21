import { useEffect, useRef, useState } from "react";
import {
  mapFogApertureScale,
  mapFogApertureTransform,
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
        <linearGradient id={`${id}-mist-fill`} x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0%" stopColor="var(--fog-cover-start)" stopOpacity=".82" />
          <stop offset="30%" stopColor="var(--fog-cover-mid)" stopOpacity=".74" />
          <stop offset="68%" stopColor="var(--fog-cover-start)" stopOpacity=".82" />
          <stop offset="100%" stopColor="var(--fog-cover-end)" stopOpacity=".88" />
        </linearGradient>
        <radialGradient id={`${id}-aperture-feather`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="1" />
          <stop offset="38%" stopColor="#000" stopOpacity=".96" />
          <stop offset="74%" stopColor="#000" stopOpacity=".6" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter
          id={`${id}-cloud-density`}
          x="0"
          y="0"
          width="1100"
          height="650"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".004 .006"
            numOctaves={3}
            seed={17}
            result="cloudNoise"
          />
          <feColorMatrix
            in="cloudNoise"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0"
            result="cloudLuminance"
          />
          <feComponentTransfer in="cloudLuminance" result="cloudDensity">
            <feFuncA type="table" tableValues=".025 .045 .10 .23 .48 .76 .96 1" />
          </feComponentTransfer>
          <feDisplacementMap
            in="cloudDensity"
            in2="cloudNoise"
            scale={27}
            xChannelSelector="R"
            yChannelSelector="G"
            result="billowedClouds"
          />
          <feGaussianBlur in="billowedClouds" stdDeviation="20 15" result="softBanks" />
          <feFlood floodColor="var(--fog-bank-blue)" floodOpacity=".78" result="blueFlood" />
          <feComposite in="blueFlood" in2="softBanks" operator="in" result="blueBanks" />
          <feComponentTransfer in="billowedClouds" result="brightDensity">
            <feFuncA type="table" tableValues="0 0 .005 .02 .07 .25 .68 1" />
          </feComponentTransfer>
          <feFlood floodColor="var(--fog-bank-highlight)" floodOpacity=".88" result="whiteFlood" />
          <feComposite in="whiteFlood" in2="brightDensity" operator="in" result="sharpWisps" />
          <feGaussianBlur in="sharpWisps" stdDeviation="9 7" result="wispGlow" />
          <feMerge>
            <feMergeNode in="blueBanks" />
            <feMergeNode in="wispGlow" />
          </feMerge>
        </filter>
        <filter
          id={`${id}-eddy-density`}
          x="0"
          y="0"
          width="1100"
          height="650"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".010 .016"
            numOctaves="2"
            seed="43"
            result="eddyNoise"
          />
          <feColorMatrix
            in="eddyNoise"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0"
            result="eddyLuminance"
          />
          <feComponentTransfer in="eddyLuminance" result="eddyDensity">
            <feFuncA type="table" tableValues="0 0 .005 .025 .12 .46 .92 1" />
          </feComponentTransfer>
          <feDisplacementMap
            in="eddyDensity"
            in2="eddyNoise"
            scale={16}
            xChannelSelector="R"
            yChannelSelector="G"
            result="curledEddies"
          />
          <feGaussianBlur in="curledEddies" stdDeviation="9 7" result="softEddies" />
          <feFlood floodColor="var(--fog-bank-highlight)" floodOpacity=".76" result="eddyFlood" />
          <feComposite in="eddyFlood" in2="softEddies" operator="in" />
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
                transform={mapFogApertureTransform(cloud, opening)}
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
          <rect
            className="map-fog-cloud-density"
            x="0"
            y="0"
            width="1100"
            height="650"
            rx="24"
            filter={`url(#${id}-cloud-density)`}
          />
        </g>
        <g className={`map-fog-flow map-fog-flow--quick${shouldAnimate ? " is-active" : ""}`}>
          <rect
            className="map-fog-eddy-density"
            x="0"
            y="0"
            width="1100"
            height="650"
            rx="24"
            filter={`url(#${id}-eddy-density)`}
          />
        </g>
      </g>
    </g>
  );
}
