import { useEffect, useId, useRef, useState } from "react";
import type { AnimationEvent, CSSProperties } from "react";
import {
  completeSceneStopMotion,
  sceneRestStopForPhase,
  transitionSceneStop,
  type SceneRestStop,
  type SceneStopPhase,
} from "./sceneMotion";
import "./fog.css";
import "./travelScene.css";

type Carriage = { id: string; name: string; color: string };

const sceneTrees = [
  [82, 148, 0.7], [228, 179, 0.62], [350, 143, 0.75], [527, 177, 0.65],
  [665, 147, 0.78], [821, 177, 0.62], [75, 296, 0.66], [250, 297, 0.8],
  [505, 285, 0.72], [737, 296, 0.78],
] as const;

const sceneHouses = [
  [405, 158, "#ce8a65"],
  [812, 277, "#d2a25f"],
] as const;

export function TopDownScene({
  carriages,
  ownId,
  running,
  fogStrength,
  exploration = 0,
  coast = false,
  restStop = null,
  motionAllowed = true,
}: {
  carriages: Carriage[];
  ownId: string;
  running: boolean;
  fogStrength: number;
  exploration?: number;
  coast?: boolean;
  restStop?: SceneRestStop | null;
  motionAllowed?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const element = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState(ownId);
  const restIndex = restStop?.index ?? null;
  const restCount = restStop?.count ?? null;
  const [stopPhase, setStopPhase] = useState<SceneStopPhase>(() => restIndex === null ? "travelling" : "parked");
  const previousRestIndex = useRef(restIndex);
  const previousRestStop = useRef<SceneRestStop | null>(restStop);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          update();
        });
    if (element.current) observer?.observe(element.current);
    document.addEventListener("visibilitychange", update);
    update();
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(Boolean(media?.matches));
    updateMotionPreference();
    if (media?.addEventListener) media.addEventListener("change", updateMotionPreference);
    else media?.addListener?.(updateMotionPreference);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      if (media?.removeEventListener) media.removeEventListener("change", updateMotionPreference);
      else media?.removeListener?.(updateMotionPreference);
    };
  }, []);
  const sceneMotionAllowed = motionAllowed && visible && !reducedMotion;
  useEffect(() => {
    const previousIndex = previousRestIndex.current;
    setStopPhase((current) => transitionSceneStop(
      current,
      previousIndex,
      restIndex,
      sceneMotionAllowed,
    ));
    previousRestIndex.current = restIndex;
    if (restIndex !== null && restCount !== null)
      previousRestStop.current = { index: restIndex, count: restCount };
    else if (previousIndex !== null && !sceneMotionAllowed) previousRestStop.current = null;
  }, [restIndex, restCount, sceneMotionAllowed]);
  const engineX = 450 + carriages.length * 32;
  const restShift = 750 - engineX;
  const chosen = carriages.find((car) => car.id === selected) ?? carriages[0];
  const moving = running && sceneMotionAllowed;
  const sceneStatus = stopPhase === "arriving"
    ? "tàu đang vào trạm nghỉ"
    : stopPhase === "parked" && restStop
      ? `tàu đang dừng tại trạm nghỉ ${restStop.index} / ${restStop.count}`
      : stopPhase === "departing"
        ? "tàu đang rời trạm nghỉ"
        : moving
          ? "cảnh vật đang trôi quanh tàu"
          : "cảnh vật đang dừng";
  const visibleRestStop = sceneRestStopForPhase(restStop, previousRestStop.current, stopPhase);
  const finishStopMotion = (event: AnimationEvent<SVGGElement>) => {
    if (event.animationName === "travel-stop-arrive" || event.animationName === "travel-stop-depart") {
      setStopPhase((phase) => completeSceneStopMotion(phase));
      if (event.animationName === "travel-stop-depart" && restIndex === null)
        previousRestStop.current = null;
    }
  };
  return (
    <section
      ref={element}
      className="travel-scene"
      aria-label="Cảnh tàu 2D nhìn thẳng từ trên xuống"
      data-moving={moving}
      data-stop-phase={stopPhase}
      data-rest-index={visibleRestStop?.index}
      data-stop-motion={sceneMotionAllowed}
    >
      <div className="travel-toolbar">
        <span>{sceneStatus.charAt(0).toUpperCase() + sceneStatus.slice(1)}</span>
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
        aria-label={`Góc nhìn 2D: ${carriages.length} toa, ${sceneStatus}`}
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bde2df" />
            <stop offset="1" stopColor="#e4edc9" />
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
              <path d="M0 142 C125 111 202 129 306 145 S481 168 579 139 S759 116 900 143 V420 H0Z" fill="#bdd99d" />
              <path d="M0 179 C113 153 198 175 294 183 S475 198 574 174 S780 154 900 185 V420 H0Z" fill="#a7cc87" />
              <path d="M0 252 C125 228 232 249 351 264 S570 273 694 248 S829 238 900 252 V420 H0Z" fill="#90bd78" />
              <path d="M92 143q31-12 64-2M375 176q38-14 77-3M691 143q32-11 62-1" fill="none" stroke="#e4efc3" strokeWidth="4" strokeLinecap="round" opacity=".8" />
              {coast && <path d="M0 367q90-20 180 0t180 0 180 0 180 0 180 0v53H0Z" fill="#76bbc0" opacity=".45" />}
            </g>
          ))}
        </g>
        <g className="scene-sky-cloud" aria-hidden="true" transform="translate(115 78)">
          <path d="M0 11q1-10 11-10 5 0 8 4 3-8 12-8 13 0 14 13 9 1 8 9H5q-8 0-5-8Z" fill="#fffdf2" stroke="#d0e1c7" strokeWidth="2" />
        </g>
        <g className="scene-sky-cloud" aria-hidden="true" transform="translate(718 102) scale(.78)">
          <path d="M0 11q1-10 11-10 5 0 8 4 3-8 12-8 13 0 14 13 9 1 8 9H5q-8 0-5-8Z" fill="#fffdf2" stroke="#d0e1c7" strokeWidth="2" />
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
        <rect y="183" width="900" height="54" fill="#8b7355" opacity=".45" />
        <rect y="188" width="900" height="44" fill="#c19b6b" />
        <g className="travel-track" aria-hidden="true">
          <rect x="0" y="188" width="1800" height="44" fill={`url(#${id}-sleepers)`} />
        </g>
        <path d="M0 194 H900 M0 226 H900" stroke="#5b6260" strokeWidth="7" />
        <path d="M0 193 H900 M0 227 H900" stroke="#eee1bd" strokeWidth="2.5" />
        {visibleRestStop && (
          <g className="travel-rest-stop" role="img" aria-label={`Trạm nghỉ ${visibleRestStop.index} / ${visibleRestStop.count}`}>
            <ellipse cx="750" cy="286" rx="105" ry="12" fill="#507651" opacity=".15" />
            <path d="M660 269q4-12 17-12h144q13 0 17 12v13H660Z" fill="#e7d5a8" stroke="#846e4c" strokeWidth="3" />
            <path d="M674 265h149" stroke="#fff5d9" strokeWidth="3" strokeLinecap="round" />
            <rect x="815" y="253" width="8" height="32" rx="3" fill="#956d4d" />
            <path d="M784 241q0-5 6-5h59q6 0 6 5v19h-71Z" fill="#fff3cc" stroke="#8a6848" strokeWidth="3" />
            <path d="M780 241q39-22 79 0" fill="#d8875e" stroke="#8a6848" strokeWidth="3" strokeLinejoin="round" />
            <text x="819" y="253" textAnchor="middle" fill="#4c664a" fontSize="8" fontWeight="900">TRẠM NGHỈ</text>
            <text x="819" y="263" textAnchor="middle" fill="#8c7251" fontSize="7" fontWeight="700">{visibleRestStop.index}/{visibleRestStop.count}</text>
          </g>
        )}
        <g className="travel-train-motion">
          <g
            className="travel-train-position"
            data-stop-phase={stopPhase}
            style={{ "--rest-shift": `${restShift}px` } as CSSProperties}
            onAnimationEnd={finishStopMotion}
          >
          <g className="travel-train" aria-label="Đoàn tàu nhìn từ trên xuống">
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
        </g>
      </svg>
      <div className="travel-caption">
        <span>{chosen?.name} · {carriages.length} toa</span>
        <span>
          {fogStrength > 0.25
            ? "☁ Toa đang chờ bạn quay lại"
            : exploration >= 1
              ? "Đã khám phá toàn tuyến"
              : stopPhase === "arriving"
                ? "Tàu đang vào trạm nghỉ."
                : stopPhase === "departing"
                  ? "Tàu đang rời trạm nghỉ."
                  : restStop
                    ? `Tàu nghỉ tại trạm ${restStop.index} / ${restStop.count}.`
              : running
                ? "Mỗi phút học mở thêm một vùng đất."
                : "Cảnh dừng · tiến độ đã học được giữ."}
        </span>
      </div>
    </section>
  );
}
