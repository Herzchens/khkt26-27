import { useEffect, useId, useRef, useState } from "react";
import { cloudScaleAtProgress } from "./exploration";
import { CartoonCloud } from "./CartoonCloud";
import "./fog.css";

type Carriage = { id: string; name: string; color: string };

const sceneClouds = [
  { x: 72, y: 78, clearsAt: 0.2, size: 0.76, angle: -2, variant: 0 },
  { x: 270, y: 111, clearsAt: 0.3, size: 0.72, angle: 1, variant: 1 },
  { x: 478, y: 75, clearsAt: 0.4, size: 0.79, angle: 2, variant: 2 },
  { x: 705, y: 108, clearsAt: 0.5, size: 0.73, angle: -1, variant: 0 },
  { x: 875, y: 74, clearsAt: 0.6, size: 0.77, angle: 2, variant: 1 },
  { x: 150, y: 330, clearsAt: 0.7, size: 0.72, angle: 1, variant: 2 },
  { x: 384, y: 345, clearsAt: 0.8, size: 0.78, angle: -2, variant: 0 },
  { x: 632, y: 324, clearsAt: 0.9, size: 0.74, angle: 2, variant: 1 },
  { x: 850, y: 342, clearsAt: 1, size: 0.77, angle: -1, variant: 2 },
];

const sceneTrees = [
  [69, 76, 0.75], [149, 127, 0.68], [235, 60, 0.82], [340, 131, 0.7],
  [548, 83, 0.78], [657, 127, 0.68], [764, 69, 0.82], [850, 132, 0.72],
  [73, 285, 0.68], [252, 294, 0.8], [505, 285, 0.72], [737, 296, 0.78],
] as const;

const sceneHouses = [
  [405, 77, "#ce8a65"],
  [812, 277, "#d2a25f"],
] as const;

export function TopDownScene({
  carriages,
  ownId,
  running,
  fogStrength,
  exploration = 0,
  coast = false,
}: {
  carriages: Carriage[];
  ownId: string;
  running: boolean;
  fogStrength: number;
  exploration?: number;
  coast?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const element = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState(ownId);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    if (element.current) observer.observe(element.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const engineX = 450 + carriages.length * 32;
  const chosen = carriages.find((car) => car.id === selected) ?? carriages[0];
  const moving = running && visible;
  return (
    <section
      ref={element}
      className="travel-scene"
      aria-label="Cảnh tàu 2D nhìn thẳng từ trên xuống"
      data-moving={moving}
    >
      <div className="travel-toolbar">
        <span>1 đầu tàu · {carriages.length} toa · Tàu giữ vị trí giữa khung hình</span>
        <div className="overhead-controls">
          <button aria-label="Thu nhỏ cảnh 2D" disabled={zoom <= 1} onClick={() => setZoom((v) => Math.max(1, v - 0.25))}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Phóng to cảnh 2D" disabled={zoom >= 1.5} onClick={() => setZoom((v) => Math.min(1.5, v + 0.25))}>
            +
          </button>
        </div>
      </div>
      <svg
        className="travel-world"
        viewBox={`${450 - 450 / zoom} ${210 - 210 / zoom} ${900 / zoom} ${420 / zoom}`}
        role="group"
        aria-label={`Góc nhìn 2D: ${carriages.length} toa, ${moving ? "cảnh vật đang trôi quanh tàu" : "cảnh vật đang dừng"}`}
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bde2df" />
            <stop offset="1" stopColor="#e4edc9" />
          </linearGradient>
          <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#9bd4d3" />
            <stop offset="1" stopColor="#65b2bd" />
          </linearGradient>
          <pattern id={`${id}-sleepers`} width="30" height="50" patternUnits="userSpaceOnUse">
            <rect x="3" y="2" width="8" height="46" rx="3" fill="#9a7654" />
          </pattern>
        </defs>
        <rect width="900" height="420" fill={`url(#${id}-sky)`} />
        <circle cx="774" cy="64" r="28" fill="#f8d989" opacity=".9" />
        <circle cx="774" cy="64" r="38" fill="#fff1c6" opacity=".25" />
        <g className="travel-far-layer travel-parallax-layer" aria-hidden="true">
          {[0, 900].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              <path d="M0 128 C110 104 202 130 293 113 S462 137 566 111 S755 125 900 128 V420 H0Z" fill="#d5e8b7" />
              <path d="M56 125 151 32 238 125Z M186 127 271 56 351 127Z M550 124 647 29 733 124Z M672 125 758 51 843 125Z" fill="#91aa91" stroke="#7d9a87" strokeWidth="4" strokeLinejoin="round" />
              <path d="M120 63 151 32 181 64 153 56 142 70Z M618 61 647 29 681 66 650 56 638 72Z" fill="#fff2d0" stroke="#d9e8d3" strokeWidth="2" strokeLinejoin="round" />
              {coast ? (
                <g className="scene-water">
                  <path d="M0 320 C140 281 222 326 349 309 S596 330 727 302 S846 313 900 320 V420 H0Z" fill={`url(#${id}-sea)`} />
                  <path d="M0 320 C140 281 222 326 349 309 S596 330 727 302 S846 313 900 320" fill="none" stroke="#fff0cb" strokeWidth="13" />
                  <path d="M28 353q30-10 58 0t58 0M605 369q30-10 58 0t58 0M755 344q23-8 46 0t46 0" fill="none" stroke="#d6f1df" strokeWidth="4" strokeLinecap="round" opacity=".8" />
                </g>
              ) : (
                <g className="scene-lake">
                  <ellipse cx="691" cy="329" rx="139" ry="49" fill="#85c8cd" />
                  <ellipse cx="681" cy="319" rx="108" ry="33" fill="#b6e1d7" />
                  <path d="M637 318q35-11 68-2M700 334q26 7 49-1" fill="none" stroke="#f1f2d9" strokeWidth="4" strokeLinecap="round" />
                </g>
              )}
            </g>
          ))}
        </g>
        <g className="travel-mid-layer travel-parallax-layer" aria-hidden="true">
          {[0, 900].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              {sceneTrees.map(([x, y, size], index) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
                  <ellipse cx="3" cy="21" rx="26" ry="12" fill="#3e775c" opacity=".2" />
                  <path d="M-5 8h10v20H-5Z" fill="#98744d" />
                  <circle r="23" fill={index % 3 ? "#76a96f" : "#5b9970"} stroke="#467f62" strokeWidth="3" />
                  <circle cx="-13" cy="5" r="14" fill="#a1c87e" stroke="#5a9568" strokeWidth="2" />
                  <circle cx="13" cy="6" r="15" fill="#6ba170" stroke="#4b8762" strokeWidth="2" />
                  <ellipse cx="-6" cy="-8" rx="9" ry="5" fill="#d2e89d" opacity=".7" />
                </g>
              ))}
              {sceneHouses.map(([x, y, roof], index) => (
                <g key={x} transform={`translate(${x} ${y})`}>
                  <ellipse cx="2" cy="24" rx="29" ry="9" fill="#4b725b" opacity=".2" />
                  <rect x="-23" y="-15" width="46" height="38" rx="6" fill="#fff0cb" stroke="#7e684e" strokeWidth="3" />
                  <path d="M-29-13 0-37 29-13Z" fill={roof} stroke="#805f49" strokeWidth="3" strokeLinejoin="round" />
                  <rect x="-7" y="2" width="14" height="21" rx="5" fill="#a66e50" />
                  <rect x="-18" y="-7" width="9" height="9" rx="2" fill="#91c8c4" />
                  <rect x="9" y="-7" width="9" height="9" rx="2" fill="#91c8c4" />
                  {index === 0 && <path d="M0-37v-12h12" fill="none" stroke="#765d48" strokeWidth="3" strokeLinecap="round" />}
                </g>
              ))}
              <path d="M25 295q33-12 65 0M344 299q28-12 56 0M575 291q30-14 60 0M790 298q24-10 50 0" fill="none" stroke="#e4e4ae" strokeWidth="6" strokeLinecap="round" opacity=".8" />
            </g>
          ))}
        </g>
        <g className="travel-near-layer travel-parallax-layer" aria-hidden="true">
          {[0, 900].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              <path d="M0 376q90-22 178 0t178 0 178 0 178 0 188 0v44H0Z" fill="#80b581" opacity=".68" />
              {Array.from({ length: 23 }, (_, index) => (
                <g key={index} transform={`translate(${20 + index * 39} ${index % 2 ? 377 : 392})`}>
                  <path d="M0 13q-5-13-2-24M0 13q4-11 8-17M-1 4q-8-8-11-11" fill="none" stroke="#477f5c" strokeWidth="2.5" strokeLinecap="round" />
                  {index % 3 === 0 && <circle cx="-2" cy="-11" r="3.3" fill="#f7e4a8" />}
                </g>
              ))}
            </g>
          ))}
        </g>
        <g className="travel-cloud-cover travel-parallax-layer" aria-hidden="true" pointerEvents="none">
          {[0, 900].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              {sceneClouds.map((cloud, index) => (
                <g key={index} transform={`translate(${cloud.x} ${cloud.y}) rotate(${cloud.angle})`}>
                  <CartoonCloud
                    scale={cloud.size * cloudScaleAtProgress(exploration, cloud.clearsAt, 0.16)}
                    variant={cloud.variant}
                  />
                </g>
              ))}
            </g>
          ))}
        </g>
        <rect y="183" width="900" height="54" fill="#8b7355" opacity=".45" />
        <rect y="188" width="900" height="44" fill="#c19b6b" />
        <g className="travel-track" aria-hidden="true">
          <rect x="0" y="188" width="1800" height="44" fill={`url(#${id}-sleepers)`} />
        </g>
        <path d="M0 194 H900 M0 226 H900" stroke="#5b6260" strokeWidth="7" />
        <path d="M0 193 H900 M0 227 H900" stroke="#eee1bd" strokeWidth="2.5" />
        <g className="travel-train-motion">
          <g className="travel-train" aria-label="Đoàn tàu cố định">
            <g transform={`translate(${engineX} 210)`} aria-label="Đầu tàu">
              <ellipse cx="3" cy="17" rx="44" ry="21" fill="#385f4b" opacity=".27" />
              <g transform="translate(-16 19)">
                <g className="travel-wheel">
                  <circle r="7" fill="#3a5148" stroke="#f1d7a0" strokeWidth="2" />
                  <path d="M-3 0h6M0-3v6" stroke="#f2e2bb" strokeWidth="1.4" />
                </g>
              </g>
              <g transform="translate(23 19)">
                <g className="travel-wheel">
                  <circle r="7" fill="#3a5148" stroke="#f1d7a0" strokeWidth="2" />
                  <path d="M-3 0h6M0-3v6" stroke="#f2e2bb" strokeWidth="1.4" />
                </g>
              </g>
              <rect x="-32" y="-22" width="68" height="42" rx="13" fill="#33564a" stroke="#fff1ca" strokeWidth="3" />
              <path d="M-27-17h56" stroke="#a5d2a6" strokeWidth="3" strokeLinecap="round" />
              <rect x="-26" y="-16" width="24" height="31" rx="7" fill="#dfb961" stroke="#fff0c8" strokeWidth="2" />
              <rect x="5" y="-15" width="23" height="30" rx="10" fill="#79b49a" stroke="#d5ebcb" strokeWidth="2" />
              <circle cx="16.5" cy="0" r="6" fill="#31493d" />
              <rect x="10" y="-27" width="13" height="8" rx="3" fill="#8f6247" stroke="#f1d5a2" strokeWidth="2" />
              <path d="M36-11 Q48 0 36 11Z" fill="#d38d52" stroke="#fff1ca" strokeWidth="2" />
              <circle cx="41" cy="0" r="3.5" fill="#fff4b9" />
              <g className="train-steam" aria-hidden="true">
                <circle className="train-steam-puff puff-one" cx="19" cy="-33" r="6" />
                <circle className="train-steam-puff puff-two" cx="24" cy="-37" r="7" />
                <circle className="train-steam-puff puff-three" cx="14" cy="-40" r="5" />
              </g>
            </g>
            {carriages.map((car, i) => (
              <g
                key={car.id}
                transform={`translate(${engineX - (i + 1) * 64} 210)`}
                role="button"
                tabIndex={0}
                aria-label={`Toa ${i + 1}: ${car.name}${car.id === ownId ? ", của bạn" : ""}`}
                aria-pressed={chosen?.id === car.id}
                onClick={() => setSelected(car.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(car.id);
                  }
                }}
                className="overhead-car"
              >
                <ellipse cx="1" cy="17" rx="35" ry="20" fill="#385f4b" opacity=".24" />
                <g transform="translate(-17 18)">
                  <g className="travel-wheel">
                    <circle r="6" fill="#3a5148" stroke="#e5cf9d" strokeWidth="1.8" />
                    <path d="M-2.5 0h5M0-2.5v5" stroke="#f2e2bb" strokeWidth="1.2" />
                  </g>
                </g>
                <g transform="translate(17 18)">
                  <g className="travel-wheel">
                    <circle r="6" fill="#3a5148" stroke="#e5cf9d" strokeWidth="1.8" />
                    <path d="M-2.5 0h5M0-2.5v5" stroke="#f2e2bb" strokeWidth="1.2" />
                  </g>
                </g>
                <rect x="-29" y="-22" width="58" height="43" rx="12" fill={car.color} stroke={chosen?.id === car.id ? "#fff2b6" : "#456557"} strokeWidth={chosen?.id === car.id ? 4 : 2.5} />
                <path d="M-22-17h44" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
                <rect x="-21" y="-14" width="42" height="28" rx="8" fill="#fff0ca" opacity=".83" />
                <path d="M-2-12v24" stroke="#d4b67b" strokeWidth="2" />
                <text y="6" textAnchor="middle" fill="#294638" fontSize="16" fontWeight="800">{i + 1}</text>
              </g>
            ))}
          </g>
        </g>
      </svg>
      <div className="travel-caption">
        <span>{chosen?.name} · {carriages.length} toa</span>
        <span>
          {fogStrength > 0.25
            ? "☁ Toa đang chờ bạn quay lại"
            : exploration >= 1
              ? "Đã khám phá toàn tuyến"
              : running
                ? "☁ Mỗi phút học mở thêm một vùng đất"
                : "Cảnh dừng · tiến độ đã học được giữ."}
        </span>
      </div>
    </section>
  );
}
