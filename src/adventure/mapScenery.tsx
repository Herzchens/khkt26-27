import "./mapScenery.css";

type SceneryKind = "overview" | "travel";

const overviewTrees = [
  [115, 140, 1], [170, 165, 0.88], [140, 220, 0.95], [220, 95, 0.82],
  [520, 75, 0.82], [570, 92, 0.72], [630, 62, 0.86], [685, 85, 0.75], [725, 105, 0.72],
  [410, 215, 0.82], [455, 230, 0.76], [590, 220, 0.78], [665, 265, 0.9], [720, 365, 0.85],
  [740, 580, 0.85], [665, 600, 0.9], [195, 410, 0.92], [245, 385, 0.78], [130, 560, 0.82],
  [565, 505, 0.72], [875, 544, 0.75], [835, 116, 0.68], [57, 198, 0.75], [770, 220, 0.68],
] as const;

const overviewRoofs = [
  [220, 455, "#d4885c"], [870, 363, "#dfac5a"], [790, 65, "#8d9cba"],
  [320, 145, "#77a786"], [1016, 265, "#d57064"],
] as const;

const travelTrees = [
  [82, 92, 0.74], [212, 87, 0.62], [350, 82, 0.78], [531, 90, 0.66],
  [668, 92, 0.77], [828, 95, 0.66], [105, 308, 0.68], [270, 304, 0.82],
  [498, 314, 0.7], [714, 300, 0.76], [875, 322, 0.63],
] as const;

const travelRoofs = [
  [414, 112, "#ce8a65"], [782, 286, "#d2a25f"], [1042, 103, "#d57064"],
] as const;

function TreeCanopy({ x, y, size, index }: { x: number; y: number; size: number; index: number }) {
  return (
    <g className="overhead-tree" transform={`translate(${x} ${y}) scale(${size})`}>
      <ellipse className="overhead-tree-canopy" cx="0" cy="0" rx="28" ry="22" />
      <circle className="overhead-tree-leaf" cx="-15" cy="-2" r="15" />
      <circle className={index % 2 ? "overhead-tree-leaf overhead-tree-leaf--deep" : "overhead-tree-leaf"} cx="13" cy="-4" r="16" />
      <circle className="overhead-tree-leaf overhead-tree-leaf--light" cx="-3" cy="-11" r="11" />
      <circle className="overhead-tree-fruit" cx={index % 2 ? 9 : -9} cy="7" r="2.4" />
    </g>
  );
}

function RoofFootprint({ x, y, color, size = 1 }: { x: number; y: number; color: string; size?: number }) {
  return (
    <g className="overhead-roof" transform={`translate(${x} ${y}) scale(${size})`}>
      <rect className="overhead-roof-base" x="-31" y="-25" width="62" height="50" rx="8" />
      <path d="M-27-21H0V21H-27Z" fill={color} />
      <path d="M0-21H27V21H0Z" fill={color} opacity=".77" />
      <path d="M0-21V21M-25-7H25M-25 8H25" className="overhead-roof-seam" />
      <rect x="16" y="-19" width="9" height="9" rx="2" className="overhead-roof-chimney" />
    </g>
  );
}

function OverviewTerrain() {
  return (
    <g className="map-overview-terrain" aria-hidden="true">
      <path className="overhead-ridge-land" d="M24 337C44 298 90 270 143 278c44 6 69 33 113 31 36-2 64-21 97-10 33 12 39 41 17 69-24 29-90 37-143 28-48-8-77-1-116 17-48 21-91 6-94-24-2-17 0-35 7-52Z" />
      <path className="overhead-ridge-contour" d="M49 339c17-31 54-50 95-48 45 2 64 26 107 28 34 1 60-13 82-4 22 9 24 25 8 41-20 19-72 24-116 17-53-9-82 5-120 17-34 11-61 5-66-12-4-12 2-26 10-39Z" />
      <path className="overhead-ridge-contour" d="M78 341c18-18 39-29 68-28 39 1 61 22 98 25 29 2 47-7 64 0 12 5 13 14 4 21-18 14-52 15-84 10-48-7-78 8-112 16-24 5-40 0-42-10-1-11 0-22 4-34Z" />
      <path className="overhead-ridge-land overhead-ridge-land--soft" d="M725 504c23-38 62-60 110-57 43 2 67 26 113 24 37-2 69-16 102-3 25 10 32 33 17 55-18 27-61 42-105 36-45-5-81 4-117 20-51 22-109 10-125-19-10-18-5-39 5-56Z" />
      <path className="overhead-ridge-contour" d="M751 510c20-27 48-40 84-40 43 1 63 19 105 19 33 1 62-11 85-3 16 5 19 17 9 30-14 18-49 28-83 24-48-5-82 9-117 23-38 15-77 8-88-12-8-13-3-28 5-41Z" />
      <g className="overhead-road" aria-hidden="true">
        <path className="overhead-road-bed" d="M-20 271C97 250 174 262 256 292s168 37 249 18 166-31 265-6 225 23 351-22" />
        <path className="overhead-road-center" d="M-20 271C97 250 174 262 256 292s168 37 249 18 166-31 265-6 225 23 351-22" />
        <path className="overhead-road-markings" d="M-20 271C97 250 174 262 256 292s168 37 249 18 166-31 265-6 225 23 351-22" />
      </g>
    </g>
  );
}

function TravelTile({ coast }: { coast: boolean }) {
  return (
    <g className="travel-land-tile" aria-hidden="true">
      <rect width="900" height="420" className="travel-meadow" />
      <path d="M-20 42c104-31 180-18 267 4s164 14 232-8 145-25 231-4 152 25 223-8v112c-93 25-170 18-244-1s-139-18-214 8-161 29-245 4-164-24-250 12Z" className="travel-field travel-field--soft" />
      <path d="M-15 309c84-25 153-26 220-2s138 32 211 7 152-32 229-5 167 34 270 4v110H-15Z" className="travel-field" />
      <path d="M14 67c46-30 107-36 161-20 56 17 87 12 132-10 45-21 97-17 122 9 23 23 5 49-27 62-48 18-86 0-132 17-49 18-82 36-141 23-74-16-158-37-115-81Z" className="travel-ridge-land" />
      <path d="M38 73c40-22 85-27 129-13 54 18 89 17 130-2 37-17 76-15 94 3 13 13 1 30-24 39-42 14-81-3-130 14-45 16-76 26-127 15-55-12-104-31-72-56Z" className="travel-ridge-contour" />
      <path d="M640 338c38-34 96-47 144-32 45 15 80 14 118-1v115H640c-23-22-18-55 0-82Z" className="travel-ridge-land travel-ridge-land--soft" />
      <path d="M673 347c33-25 76-34 111-23 39 13 72 12 108-1v76H665c-8-20-4-38 8-52Z" className="travel-ridge-contour" />
      <path className="travel-water" d="M254 13c-27 34-24 60 9 77s42 36 22 65-11 39 18 51 37 28 15 56-19 53 13 70 31 35 3 63" />
      <path className="travel-water-highlight" d="M254 13c-27 34-24 60 9 77s42 36 22 65-11 39 18 51 37 28 15 56-19 53 13 70 31 35 3 63" />
      {coast && <path className="travel-coast-water" d="M825-10c-34 45-27 75 10 106 35 29 47 51 24 85-19 28-22 53 3 78 34 34 24 61-10 95-19 20-21 42-8 76h80V-10Z" />}
      {!coast && <path className="travel-pond" d="M674 132c26-19 71-23 101-8 35 17 37 42 6 56-30 15-79 13-105-4-20-13-21-30-2-44Z" />}
      {!coast && <path className="travel-pond-highlight" d="M686 138c22-12 55-15 79-5 19 8 20 19 4 28-23 13-62 11-81-1-11-7-12-15-2-22Z" />}
      <g className="travel-road" aria-hidden="true">
        <path className="overhead-road-bed" d="M-20 154c105-25 160-12 226 8s132 20 192-3 130-37 200-14 153 24 321-16" />
        <path className="overhead-road-center" d="M-20 154c105-25 160-12 226 8s132 20 192-3 130-37 200-14 153 24 321-16" />
        <path className="overhead-road-markings" d="M-20 154c105-25 160-12 226 8s132 20 192-3 130-37 200-14 153 24 321-16" />
      </g>
      {travelTrees.map(([x, y, size], index) => (
        <TreeCanopy key={`travel-tree-${x}`} x={x} y={y} size={size} index={index} />
      ))}
      {travelRoofs.map(([x, y, color], index) => (
        <RoofFootprint key={`travel-roof-${x}`} x={x} y={y} color={color} size={index === 2 ? 0.8 : 0.9} />
      ))}
      <g className="travel-flower-patch">
        {Array.from({ length: 14 }, (_, index) => (
          <circle key={index} cx={42 + index * 31} cy={365 + (index % 3) * 10} r="2.3" className={index % 2 ? "flower flower--rose" : "flower"} />
        ))}
      </g>
    </g>
  );
}

export function MapScenery({ kind, coast = false }: { kind: SceneryKind; coast?: boolean }) {
  if (kind === "travel") {
    return (
      <g className="map-scenery map-scenery--travel travel-mid-layer travel-parallax-layer" aria-hidden="true">
        {[0, 900].map((offset) => (
          <g key={offset} transform={`translate(${offset} 0)`}>
            <TravelTile coast={coast} />
          </g>
        ))}
      </g>
    );
  }

  const roofPositions = coast
    ? [...overviewRoofs.slice(0, 4), [850, 255, "#d57064"] as const]
    : overviewRoofs;

  return (
    <g className="map-scenery map-scenery--overview" aria-hidden="true">
      <OverviewTerrain />
      <g className="overhead-woodland">
        {overviewTrees.map(([x, y, size], index) => (
          <TreeCanopy key={`overview-tree-${x}-${y}`} x={x} y={y} size={size} index={index} />
        ))}
      </g>
      <g className="overhead-settlement">
        {roofPositions.map(([x, y, color], index) => (
          <RoofFootprint key={`overview-roof-${x}`} x={x} y={y} color={color} size={index === 4 ? 0.86 : 1} />
        ))}
      </g>
      <g className="overview-flower-meadow">
        {Array.from({ length: 25 }, (_, index) => (
          <circle
            key={index}
            cx={54 + index * 39}
            cy={584 + (index % 3) * 14}
            r="4"
            className={index % 2 ? "flower flower--rose" : "flower"}
          />
        ))}
      </g>
    </g>
  );
}

export function OverheadStationFootprint({
  x = 0,
  y = 0,
  scale = 1,
  roofColor = "#d8875e",
  title,
  detail,
}: {
  x?: number;
  y?: number;
  scale?: number;
  roofColor?: string;
  title?: string;
  detail?: string;
}) {
  return (
    <g className="overhead-station-footprint" transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect className="station-platform" x="-43" y="-14" width="86" height="34" rx="12" />
      <rect className="station-roof" x="-31" y="-20" width="62" height="31" rx="8" fill={roofColor} />
      <path className="station-roof-seam" d="M0-18v27M-28-4h56" />
      <rect className="station-chimney" x="18" y="-17" width="8" height="8" rx="2" />
      {(title || detail) && <rect className="station-caption" x="-64" y="26" width="128" height={detail ? 34 : 24} rx="9" />}
      {title && <text className="station-title" x="0" y="40" textAnchor="middle">{title}</text>}
      {detail && <text className="station-detail" x="0" y="52" textAnchor="middle">{detail}</text>}
    </g>
  );
}
