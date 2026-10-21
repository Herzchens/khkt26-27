import { useEffect, useState } from "react";
import { API_URL, request } from "../services/api";
import type { DeviceCategory } from "../../backend/src/adventure/domain";
import { studyTopics } from "./topics";
import "./experimentResults.css";

export type ExperimentRun = {
  id: string;
  tripCode: string;
  testerCode: string;
  topic: string;
  goalSummary: string;
  targetSeconds: number;
  elapsedSeconds: number;
  focusedSeconds: number;
  distractions: number;
  breakSeconds?: number;
  plannedBreakSeconds?: number;
  studyElapsedSeconds?: number;
  deviceCategory: DeviceCategory | null;
  completed: boolean;
  quizScore: number | null;
  quizTotal: number | null;
  startedAt: string;
  endedAt: string;
};
type Results = { runs: ExperimentRun[]; total: number; limit: number; offset: number };

export function formatExperimentDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} giờ`);
  if (minutes) parts.push(`${minutes} phút`);
  if (remainder || parts.length === 0) parts.push(`${remainder} giây`);
  return parts.join(" ");
}

export function experimentStudySeconds(run: ExperimentRun): number {
  return run.studyElapsedSeconds ?? Math.max(0, run.elapsedSeconds - (run.breakSeconds ?? 0));
}

function compactDateTime(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Không rõ";
  try {
    return new Intl.DateTimeFormat("vi-VN", options).format(date);
  } catch {
    return "Không rõ";
  }
}

const deviceLabels: Record<DeviceCategory, string> = {
  pc: "PC", ios: "iOS", android: "Android", tablet: "iPad/Tablet",
  unknown: "Không xác định",
};
const deviceLabel = (category: ExperimentRun["deviceCategory"]) =>
  category == null ? "Chưa ghi nhận" : deviceLabels[category];

function topicLabel(topic: string): string {
  return studyTopics.find((item) => item.id === topic)?.name ?? topic;
}

function QuizBadge({ run }: { run: ExperimentRun }) {
  const scored = run.quizTotal !== null && run.quizScore !== null;
  return <span className={`experiment-quiz-badge ${scored ? "experiment-quiz-badge--scored" : "experiment-quiz-badge--pending"}`}>
    {scored ? `${run.quizScore}/${run.quizTotal} điểm` : "Chưa làm"}
  </span>;
}

function RunDetails({ run }: { run: ExperimentRun }) {
  const fullTimestampOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  };
  const startedDate = compactDateTime(run.startedAt, fullTimestampOptions);
  const endedDate = compactDateTime(run.endedAt, fullTimestampOptions);
  const breakTime = run.breakSeconds == null
    ? "Chưa có thời gian giải lao"
    : `${formatExperimentDuration(run.breakSeconds)} thực tế`;
  const plannedBreak = run.plannedBreakSeconds == null
    ? "Không ghi nhận lịch nghỉ"
    : `${formatExperimentDuration(run.plannedBreakSeconds)} đã lên lịch`;
  return <details className="experiment-details">
    <summary>Chi tiết</summary>
    <dl>
      <div><dt>ID chuyến</dt><dd><code>{run.id}</code></dd></div>
      <div><dt>Mã người thử</dt><dd><code>{run.testerCode}</code></dd></div>
      <div><dt>Thiết bị</dt><dd>{deviceLabel(run.deviceCategory)}</dd></div>
      <div><dt>Bắt đầu (giờ địa phương của bạn)</dt><dd><time dateTime={run.startedAt}>{startedDate}</time></dd></div>
      <div><dt>Kết thúc (giờ địa phương của bạn)</dt><dd><time dateTime={run.endedAt}>{endedDate}</time></dd></div>
      <div><dt>Xao nhãng</dt><dd>{run.distractions} lần</dd></div>
      <div><dt>Giải lao thực tế</dt><dd>{breakTime}</dd></div>
      <div><dt>Giải lao dự kiến</dt><dd>{plannedBreak}</dd></div>
      <div><dt>Trạng thái</dt><dd>{run.completed ? "Đủ giờ" : "Kết thúc sớm"}</dd></div>
    </dl>
  </details>;
}

function JourneyTime({ run }: { run: ExperimentRun }) {
  const studyTarget = formatExperimentDuration(run.targetSeconds);
  const journeyTarget = formatExperimentDuration(run.targetSeconds + (run.plannedBreakSeconds ?? 0));
  return <div className="experiment-time-summary">
    <strong>{formatExperimentDuration(experimentStudySeconds(run))} học</strong>
    <span className="experiment-run-card__meta">{studyTarget} mục tiêu</span>
    <span className="experiment-run-card__meta">
      {formatExperimentDuration(run.elapsedSeconds)} tổng chuyến / {journeyTarget} dự kiến
    </span>
  </div>;
}

function RestAndFocus({ run }: { run: ExperimentRun }) {
  const actualBreak = run.breakSeconds == null
    ? "Chưa có thời gian giải lao"
    : `${formatExperimentDuration(run.breakSeconds)} thực tế`;
  const plannedBreak = run.plannedBreakSeconds == null
    ? "Không ghi nhận lịch nghỉ"
    : `${formatExperimentDuration(run.plannedBreakSeconds)} đã lên lịch`;
  return <div className="experiment-rest-summary">
    <strong>{formatExperimentDuration(run.focusedSeconds)} tập trung</strong>
    <span className="experiment-run-card__meta">{actualBreak}</span>
    <span className="experiment-run-card__meta">{plannedBreak}</span>
  </div>;
}

export function ExperimentRunList({ runs }: { runs: readonly ExperimentRun[] }) {
  return <>
    <div className="experiment-table-wrap" tabIndex={0} aria-label="Bảng lịch sử chuyến đi; cuộn ngang để xem thêm">
      <table className="experiment-table">
        <caption>Lịch sử các chuyến học</caption>
        <thead><tr>
          <th scope="col">Mã chuyến</th>
          <th scope="col">Khởi hành</th>
          <th scope="col">Mục tiêu học tập</th>
          <th scope="col">Học và thời gian chuyến</th>
          <th scope="col">Tập trung và nghỉ</th>
          <th scope="col">Quiz</th>
        </tr></thead>
        <tbody>{runs.map((run) => <tr key={run.id}>
          <td className="experiment-code-cell">
            <code className="experiment-trip-code">{run.tripCode}</code>
            <RunDetails run={run} />
          </td>
          <td className="experiment-started-cell">
            <time dateTime={run.startedAt}>
              <span>{compactDateTime(run.startedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              <small>{compactDateTime(run.startedAt, { hour: "2-digit", minute: "2-digit" })}</small>
            </time>
          </td>
          <td className="experiment-goal">
            <strong>{run.goalSummary}</strong>
            <small>{topicLabel(run.topic)}</small>
          </td>
          <td><JourneyTime run={run} /></td>
          <td><RestAndFocus run={run} /></td>
          <td><QuizBadge run={run} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="experiment-run-cards" aria-label="Các chuyến học">
      {runs.map((run) => <article className="experiment-run-card" key={run.id}>
        <header className="experiment-run-card__header">
          <div><span className="experiment-run-card__meta">Mã chuyến</span><code className="experiment-trip-code">{run.tripCode}</code></div>
          <time dateTime={run.startedAt}>
            {compactDateTime(run.startedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
            <small>{compactDateTime(run.startedAt, { hour: "2-digit", minute: "2-digit" })}</small>
          </time>
        </header>
        <h3>{run.goalSummary}</h3>
        <p className="experiment-run-card__topic">{topicLabel(run.topic)}</p>
        <div className="experiment-run-card__metrics">
          <div><span className="experiment-run-card__metric-label">Học và thời gian chuyến</span><JourneyTime run={run} /></div>
          <div><span className="experiment-run-card__metric-label">Tập trung và nghỉ</span><RestAndFocus run={run} /></div>
          <div><span className="experiment-run-card__metric-label">Quiz</span><QuizBadge run={run} /></div>
        </div>
        <RunDetails run={run} />
      </article>)}
    </div>
  </>;
}

export function ExperimentResults() {
  const [data, setData] = useState<Results | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    request<Results>(`/experiments?limit=50&offset=${offset}`, {}, false).then((value) => {
      if (!cancelled) { setData(value); setError(""); }
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Không tải được lịch sử.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offset, revision]);
  useEffect(() => {
    const refreshIfVisible = () => { if (!document.hidden) setRevision((value) => value + 1); };
    const interval = setInterval(refreshIfVisible, 30000);
    window.addEventListener("online", refreshIfVisible);
    return () => { clearInterval(interval); window.removeEventListener("online", refreshIfVisible); };
  }, []);
  const refresh = () => { setLoading(true); setRevision((value) => value + 1); };
  return <section className="experiment-results">
    <div className="page-heading"><span className="eyebrow">NHỮNG CHẶNG ĐƯỜNG ĐÃ QUA</span>
      <h1>Lịch sử chuyến đi</h1>
      <p>Mỗi chuyến lưu mã ẩn danh, thời gian học, giải lao và kết quả quiz. Thiết bị, mã người thử cùng thông tin kết thúc được giữ trong mục Chi tiết.</p>
    </div>
    <div className="choice-row"><button disabled={loading} onClick={refresh}>{loading ? "Đang tải…" : "Cập nhật lịch sử"}</button>
      <a className="experiment-export" href={`${API_URL}/experiments/export.csv`} download="viendu-trip-history.csv">Tải dữ liệu CSV</a></div>
    {error && <p role="alert" className="info-box">{error}</p>}
    {data && <><p>{data.total} chuyến công khai · Chuyến offline xuất hiện sau khi gửi thành công. Lịch sử cập nhật mỗi 30 giây.</p>
      {data.runs.length ? <ExperimentRunList runs={data.runs} />
        : <div className="panel"><h2>Chưa có chuyến đi nào</h2><p>Kết thúc và lưu một phiên học để chuyến đi tự xuất hiện trong lịch sử.</p></div>}
      <div className="choice-row"><button disabled={loading || offset === 0} onClick={() => { setLoading(true); setData(null); setOffset(Math.max(0, offset - 50)); }}>Trang trước</button>
        <button disabled={loading || offset + 50 >= data.total} onClick={() => { setLoading(true); setData(null); setOffset(offset + 50); }}>Trang sau</button></div></>}
    <p className="material-hint">Thời gian tập trung loại trừ khoảng rời phiên và giải lao; đồng hồ chuyến vẫn chạy liên tục. Điểm quiz được chấm trên máy chủ. Email tài khoản và nội dung tài liệu học được giữ riêng. CSV chứa tối đa 10.000 chuyến gần nhất.</p>
  </section>;
}
