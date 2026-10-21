import { useEffect, useId, useRef, useState } from "react";
import type { AnimationEvent, CSSProperties } from "react";
import {
  completeSceneStopMotion,
  SCENE_ENGINE_CENTER_X,
  SCENE_ARRIVAL_STATION_X,
  SCENE_REST_STATION_X,
  SCENE_REST_DEPARTURE_END_X,
  sceneTrainScale,
  sceneTrainLayout,
  sceneViewBoxForZoom,
  sceneArrivalStationX,
  sceneDepartureStationX,
  sceneRestStationPosition,
  transitionSceneStop,
  type SceneRestStop,
  type SceneUpcomingRestStop,
  type SceneStopPhase,
} from "./sceneMotion";
import { MapScenery, OverheadStationFootprint } from "./mapScenery";
import "./fog.css";
import "./travelScene.css";

type Carriage = { id: string; name: string; color: string };
type SceneArrival = { label: string; completed: boolean };
export type SceneSessionTiming = { elapsedSeconds: number; remainingSeconds: number };

function SceneStation({
  centerX,
  kind,
  title,
  detail,
  accessibleLabel,
}: {
  centerX: number;
  kind: "rest" | "arrival" | "departure";
  title: string;
  detail: string;
  accessibleLabel: string;
}) {
  const className = kind === "rest"
    ? "travel-rest-stop"
    : kind === "arrival"
      ? "travel-arrival-stop"
      : "travel-departure-stop";
  return (
    <g
      className={className}
      transform={`translate(${centerX} 18)`}
      data-station-x={centerX}
      role="img"
      aria-label={accessibleLabel}
    >
      <OverheadStationFootprint
        x={0}
        y={251}
        roofColor={kind === "arrival" ? "#d8a552" : kind === "departure" ? "#82a179" : "#d8875e"}
        title={title}
        detail={detail}
      />
    </g>
  );
}

export function TopDownScene({
  carriages,
  ownId,
  running,
  fogStrength,
  exploration = 0,
  coast = false,
  restStop = null,
  upcomingRestStop = null,
  arrival = null,
  sessionTiming,
  motionAllowed = true,
}: {
  carriages: Carriage[];
  ownId: string;
  running: boolean;
  fogStrength: number;
  exploration?: number;
  coast?: boolean;
  restStop?: SceneRestStop | null;
  upcomingRestStop?: SceneUpcomingRestStop | null;
  arrival?: SceneArrival | null;
  sessionTiming?: SceneSessionTiming;
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
  const engineX = SCENE_ENGINE_CENTER_X;
  const { travelX, travelShift, restShift, arrivalShift } = sceneTrainLayout(engineX);
  const viewBox = sceneViewBoxForZoom(zoom);
  const viewBoxLeft = Number(viewBox.split(" ", 1)[0]);
  const trainScale = sceneTrainScale(
    carriages.length,
    travelX,
    viewBoxLeft,
  );
  const chosen = carriages.find((car) => car.id === selected) ?? carriages[0];
  const finalStationX = !arrival && !restStop && sessionTiming
    ? sceneArrivalStationX(sessionTiming.remainingSeconds)
    : null;
  const departureStationX = !arrival && !restStop && finalStationX === null && sessionTiming
    ? sceneDepartureStationX(sessionTiming.elapsedSeconds)
    : null;
  const finalStationArrived = finalStationX !== null && sessionTiming?.remainingSeconds === 0;
  const moving = !arrival && !finalStationArrived && running && sceneMotionAllowed;
  const arrivalLabel = arrival?.label.trim() || (arrival?.completed ? "Đã đến ga cuối." : "Chuyến đã dừng.");
  const restStation = sceneRestStationPosition(
    restStop,
    upcomingRestStop,
    previousRestStop.current,
    stopPhase,
  );
  const sceneStatus = arrival
    ? arrivalLabel
    : finalStationX !== null
      ? finalStationArrived ? "đã đến ga cuối" : "ga cuối đang đến gần"
    : restStation.phase === "approaching"
    ? "trạm nghỉ đang đến gần"
    : stopPhase === "parked" && restStop
      ? `tàu đang dừng tại trạm nghỉ ${restStop.index} / ${restStop.count}`
      : stopPhase === "departing"
        ? "trạm nghỉ đang rời đi"
        : moving
          ? "cảnh vật đang trôi quanh tàu"
          : "cảnh vật đang dừng";
  const visibleRestStop = arrival ? null : restStation.stop;
  const renderedStopPhase = arrival ? "arrived" : stopPhase;
  const sessionStation = arrival
    ? {
        kind: "arrival" as const,
        x: SCENE_ARRIVAL_STATION_X,
        phase: "arrived",
        title: arrival.completed ? "GA CUỐI" : "ĐIỂM DỪNG",
        detail: arrival.completed ? "ĐÃ HOÀN THÀNH" : "KẾT THÚC SỚM",
        accessibleLabel: `${arrival.completed ? "Ga cuối" : "Điểm dừng cuối"}: ${arrivalLabel}`,
      }
    : finalStationX !== null
      ? {
          kind: "arrival" as const,
          x: finalStationX,
          phase: sessionTiming?.remainingSeconds === 0 ? "arrived" : "approaching",
          title: "GA CUỐI",
          detail: `CÒN ${Math.ceil(sessionTiming?.remainingSeconds ?? 0)} GIÂY`,
          accessibleLabel: `Ga cuối, còn ${Math.ceil(sessionTiming?.remainingSeconds ?? 0)} giây`,
        }
      : departureStationX !== null
        ? {
            kind: "departure" as const,
            x: departureStationX,
            phase: sessionTiming?.elapsedSeconds === 0 ? "starting" : "departing",
            title: "GA KHỞI ĐẦU",
            detail: "ĐOÀN KHỞI HÀNH",
            accessibleLabel: "Ga khởi đầu của chuyến học",
          }
        : null;
  const finishStopMotion = (event: AnimationEvent<SVGGElement>) => {
    if (event.animationName === "travel-stop-depart") {
      setStopPhase((phase) => completeSceneStopMotion(phase));
      if (event.animationName === "travel-stop-depart" && restIndex === null)
        previousRestStop.current = null;
    }
  };
  return (
    <section
      ref={element}
      className="travel-scene"
      aria-label={arrival ? `Cảnh kết thúc: ${arrivalLabel}` : "Cảnh tàu 2D nhìn thẳng từ trên xuống"}
      data-moving={moving}
      data-stop-phase={renderedStopPhase}
      data-rest-index={arrival ? undefined : visibleRestStop?.index}
      data-stop-motion={arrival ? false : sceneMotionAllowed}
      data-arrival={arrival ? "true" : undefined}
      data-arrival-complete={arrival ? arrival.completed : undefined}
      data-terminal-approaching={finalStationX !== null && !finalStationArrived ? "true" : undefined}
      data-terminal-arrived={finalStationArrived ? "true" : undefined}
      data-session-elapsed={sessionTiming?.elapsedSeconds}
      data-session-remaining={sessionTiming?.remainingSeconds}
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
        viewBox={viewBox}
        role="group"
        aria-label={arrival
          ? `Điểm kết thúc ${arrival.completed ? "ga cuối" : "điểm dừng"}: ${arrivalLabel}`
          : `Góc nhìn 2D: ${carriages.length} toa, ${sceneStatus}`}
      >
        <defs>
          <pattern id={`${id}-sleepers`} width="30" height="50" patternUnits="userSpaceOnUse">
            <rect x="3" y="2" width="8" height="46" rx="3" fill="#9a7654" />
          </pattern>
        </defs>
        <rect width="900" height="420" fill="#c4dda0" />
        <MapScenery kind="travel" coast={coast} />
        <rect y="183" width="900" height="54" fill="#8b7355" opacity=".45" />
        <rect y="188" width="900" height="44" fill="#c19b6b" />
        <g className="travel-track" aria-hidden="true">
          <rect x="0" y="188" width="1800" height="44" fill={`url(#${id}-sleepers)`} />
        </g>
        <path d="M0 194 H900 M0 226 H900" stroke="#5b6260" strokeWidth="7" />
        <path d="M0 193 H900 M0 227 H900" stroke="#eee1bd" strokeWidth="2.5" />
        {visibleRestStop && restStation.x !== null && (
          <g
            className="travel-rest-stop-position"
            data-stop-phase={restStation.phase}
            data-station-x={restStation.x}
            data-rest-index={visibleRestStop.index}
            style={{
              "--station-shift": `${restStation.x - SCENE_REST_STATION_X}px`,
              "--station-departure-shift": `${SCENE_REST_DEPARTURE_END_X - SCENE_REST_STATION_X}px`,
            } as CSSProperties}
            onAnimationEnd={finishStopMotion}
          >
            <SceneStation
              centerX={SCENE_REST_STATION_X}
              kind="rest"
              title="TRẠM NGHỈ"
              detail={`${visibleRestStop.index}/${visibleRestStop.count}`}
              accessibleLabel={`Trạm nghỉ ${visibleRestStop.index} / ${visibleRestStop.count}`}
            />
          </g>
        )}
        {sessionStation && (
          <g
            className={`travel-session-stop-position travel-${sessionStation.kind}-stop-position`}
            data-station-phase={sessionStation.phase}
            data-station-x={sessionStation.x}
            style={{
              "--station-shift": `${sessionStation.x - SCENE_ENGINE_CENTER_X}px`,
              "--station-departure-shift": `${SCENE_REST_DEPARTURE_END_X - SCENE_ENGINE_CENTER_X}px`,
            } as CSSProperties}
          >
            <SceneStation
              centerX={SCENE_ENGINE_CENTER_X}
              kind={sessionStation.kind}
              title={sessionStation.title}
              detail={sessionStation.detail}
              accessibleLabel={sessionStation.accessibleLabel}
            />
          </g>
        )}
        <g className="travel-train-motion">
          <g
            className="travel-train-position"
            data-stop-phase={renderedStopPhase}
            style={{
              "--travel-shift": `${travelShift}px`,
              "--rest-shift": `${restShift}px`,
              "--arrival-shift": `${arrivalShift}px`,
            } as CSSProperties}
          >
          <g
            className="travel-train"
            aria-label="Đoàn tàu nhìn từ trên xuống"
            transform={`translate(${engineX} 210) scale(${trainScale}) translate(${-engineX} -210)`}
            data-train-scale={trainScale}
          >
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
          {arrival
            ? arrivalLabel
            : fogStrength > 0.25
            ? "☁ Toa đang chờ bạn quay lại"
            : exploration >= 1
              ? "Đã khám phá toàn tuyến"
                : restStation.phase === "approaching"
                ? "Trạm nghỉ đang đến gần."
                : stopPhase === "departing"
                  ? "Trạm nghỉ đang rời đi."
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
