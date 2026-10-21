import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../services/api";
import {
  exportAdminReport,
  fetchAdminAccounts,
  fetchAdminGroups,
  fetchAdminReport,
  fetchAdminSessions,
} from "../services/admin";
import type {
  AdminAccount,
  AdminGroup,
  AdminMetricTotals,
  AdminPeriod,
  AdminReport,
  AdminSession,
} from "../services/adminContracts";
import "./admin.css";

const pageSize = 25;
const periods: AdminPeriod[] = [7, 30, 90];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được dữ liệu quản trị.";
}

function isDenied(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function formatAdminDuration(value: number) {
  const total = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
  if (minutes) return seconds ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
  return `${seconds} giây`;
}

function percent(value: number | null) {
  return value === null ? "Chưa có dữ liệu" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function utcTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toISOString().slice(0, 16).replace("T", " ")} UTC` : "Không rõ";
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="admin-metric">
    <dt>{label}</dt>
    <dd>{value}</dd>
    {note && <small>{note}</small>}
  </div>;
}

function MetricTable({ rows, heading, kind }: {
  rows: (AdminMetricTotals & ({ dateUtc: string } | { topic: string }))[];
  heading: string;
  kind: "daily" | "topic";
}) {
  const name = (row: AdminMetricTotals & ({ dateUtc: string } | { topic: string })) =>
    kind === "daily" ? (row as AdminMetricTotals & { dateUtc: string }).dateUtc : (row as AdminMetricTotals & { topic: string }).topic;
  return <section className="admin-overview-section">
    <h3>{heading}</h3>
    <div className="admin-overview-scroll" role="region" aria-label={heading} tabIndex={0}>
      <table className="admin-data-table">
        <thead><tr>
          <th>{kind === "daily" ? "Ngày UTC" : "Chủ đề"}</th>
          <th>Số phiên</th>
          <th>Thời gian học thực tế</th>
          <th>Thời gian tập trung</th>
          <th>Đạt mục tiêu</th>
          <th>Độ phủ quiz</th>
          <th>Điểm quiz</th>
        </tr></thead>
        <tbody>{rows.length ? rows.map((row) => <tr key={name(row)}>
          <th scope="row">{name(row)}</th>
          <td>{row.sessionCount}</td>
          <td>{formatAdminDuration(row.actualStudySeconds)}</td>
          <td>{formatAdminDuration(row.focusedSeconds)}</td>
          <td>{row.completedSessions} · {percent(row.completionPercent)}</td>
          <td>{row.gradedQuizSessions} · {percent(row.quizCoveragePercent)}</td>
          <td>{row.quizScorePercent === null ? "Chưa có dữ liệu" : `${row.quizScore}/${row.quizTotal} · ${percent(row.quizScorePercent)}`}</td>
        </tr>) : <tr><td colSpan={7}>Chưa có dữ liệu trong khoảng thời gian này.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}

export function adminStudyIndicators(totals: Pick<AdminMetricTotals, "actualStudySeconds" | "focusedSeconds" | "distractions" | "sessionCount">) {
  return {
    focusPercent: totals.actualStudySeconds > 0 ? totals.focusedSeconds / totals.actualStudySeconds * 100 : null,
    distractionsPerHour: totals.actualStudySeconds > 0 ? totals.distractions / totals.actualStudySeconds * 3600 : null,
    averageStudySeconds: totals.sessionCount > 0 ? totals.actualStudySeconds / totals.sessionCount : null,
  };
}

export function adminRowsForKey<T>(result: { key: string; rows: T[]; total: number } | null, key: string) {
  return result?.key === key ? { rows: result.rows, total: result.total } : { rows: [] as T[], total: 0 };
}

export function AdminOverview({ report }: { report: AdminReport }) {
  const totals = report.totals;
  const indicators = adminStudyIndicators(totals);
  const maxFocus = Math.max(1, ...report.daily.map((day) => day.focusedSeconds));
  return <div className="admin-overview">
    <p className="admin-period-note">
      {report.fromUtc.slice(0, 10)} đến {report.asOfUtc.slice(0, 10)} · Mọi mốc thời gian dùng UTC. Bao gồm phiên khách và phiên tài khoản đã lưu.
    </p>
    {report.truncated && <p className="admin-truncated" role="status">
      Đã phân tích {report.recordsAnalyzed.toLocaleString("vi-VN")} trên {report.matchingSessionCount.toLocaleString("vi-VN")} phiên khớp khoảng thời gian. Các tổng bên dưới chỉ tính phần đã phân tích.
    </p>}
    <dl className="admin-metrics">
      <MetricCard label="Phiên trong báo cáo" value={totals.sessionCount.toLocaleString("vi-VN")} note={`${report.matchingSessionCount.toLocaleString("vi-VN")} phiên khớp`} />
      <MetricCard label="Thời lượng học dự kiến" value={formatAdminDuration(totals.plannedStudySeconds)} />
      <MetricCard label="Thời gian học thực tế" value={formatAdminDuration(totals.actualStudySeconds)} note="Đã trừ thời gian nghỉ theo lịch" />
      <MetricCard label="Thời gian tập trung" value={formatAdminDuration(totals.focusedSeconds)} note="Khoảng focus và học tài liệu đã lưu" />
      <MetricCard label="Đạt mục tiêu thời gian" value={`${totals.completedSessions} · ${percent(totals.completionPercent)}`} note="Đủ thời lượng học dự kiến" />
      <MetricCard label="Lượt xao nhãng" value={totals.distractions.toLocaleString("vi-VN")} />
      <MetricCard label="Độ phủ quiz" value={percent(totals.quizCoveragePercent)} note={`${totals.gradedQuizSessions} phiên có quiz đã chấm`} />
      <MetricCard label="Điểm quiz tổng" value={totals.quizScorePercent === null ? "Chưa có dữ liệu" : `${totals.quizScore}/${totals.quizTotal} · ${percent(totals.quizScorePercent)}`} note="Quiz chưa chấm không tính vào điểm" />
    </dl>
    <section className="admin-overview-section">
      <h3>Phân tích nhịp học</h3>
      <dl className="admin-metrics admin-study-indicators">
        <MetricCard label="Tỷ lệ tập trung" value={percent(indicators.focusPercent)} note="Thời gian tập trung / thời gian học thực tế" />
        <MetricCard label="Xao nhãng mỗi giờ học" value={indicators.distractionsPerHour === null ? "Chưa có dữ liệu" : `${indicators.distractionsPerHour.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lượt/giờ`} note="Chuẩn hóa theo thời gian học thực tế, đã trừ nghỉ" />
        <MetricCard label="Thời lượng trung bình mỗi phiên" value={indicators.averageStudySeconds === null ? "Chưa có dữ liệu" : formatAdminDuration(indicators.averageStudySeconds)} note="Tính cả các chuyến kết thúc sớm" />
      </dl>
      <p className="admin-analysis-note">Đối chiếu số phiên và độ phủ quiz khi so sánh chủ đề. Tỷ lệ tập trung mô tả nhịp học; điểm quiz chỉ phản ánh những câu đã được chấm.</p>
    </section>
    <section className="admin-overview-section">
      <h3>Thời gian tập trung theo ngày · UTC</h3>
      <div className="admin-trend" role="img" aria-label="Biểu đồ thời gian tập trung theo ngày, múi giờ UTC">
        {report.daily.map((day) => <div className="admin-trend-row" key={day.dateUtc}>
          <span>{day.dateUtc.slice(5)}</span>
          <div className="admin-trend-track"><span style={{ width: `${Math.max(0, Math.min(100, (day.focusedSeconds / maxFocus) * 100))}%` }} /></div>
          <small>{formatAdminDuration(day.focusedSeconds)}</small>
        </div>)}
      </div>
    </section>
    <MetricTable rows={report.daily} heading="Xu hướng hàng ngày · UTC" kind="daily" />
    <MetricTable rows={report.topics} heading="Phân tích theo chủ đề" kind="topic" />
  </div>;
}

function Pager({ total, offset, onChange }: { total: number; offset: number; onChange: (next: number) => void }) {
  const canPrevious = offset > 0;
  const canNext = offset + pageSize < total;
  return <div className="admin-pager">
    <span>{total.toLocaleString("vi-VN")} kết quả · {total ? offset + 1 : 0}–{Math.min(offset + pageSize, total)}</span>
    <div>
      <button type="button" disabled={!canPrevious} onClick={() => onChange(Math.max(0, offset - pageSize))}>Trước</button>
      <button type="button" disabled={!canNext} onClick={() => onChange(offset + pageSize)}>Tiếp</button>
    </div>
  </div>;
}

function SessionsView({
  sessions,
  loading,
  error,
  total,
  offset,
  onOffsetChange,
  label,
}: {
  sessions: AdminSession[];
  loading: boolean;
  error: string;
  total: number;
  offset: number;
  onOffsetChange: (next: number) => void;
  label: string;
}) {
  return <section className="admin-detail" aria-live="polite">
    <div className="admin-detail-heading"><div><h3>Phiên học của {label}</h3><p>Hiển thị thời lượng học, thời gian tập trung, nghỉ, xao nhãng và quiz đã chấm. Không hiển thị mục tiêu riêng hoặc nội dung tài liệu.</p></div></div>
    {loading && <p role="status">Đang tải phiên học…</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!loading && !error && sessions.length === 0 && <p className="admin-empty">Chưa có phiên học trong khoảng thời gian này.</p>}
    {!!sessions.length && <>
      <div className="admin-table-scroll" role="region" aria-label={`Phiên học của ${label}`} tabIndex={0}>
        <table className="admin-data-table admin-session-table">
          <thead><tr><th>Phiên · chủ đề</th><th>Bắt đầu · kết thúc UTC</th><th>Kế hoạch</th><th>Thực tế · tập trung</th><th>Nghỉ</th><th>Xao nhãng</th><th>Hoàn tất</th><th>Quiz</th></tr></thead>
          <tbody>{sessions.map((session) => <tr key={session.id}>
            <th scope="row"><code>{session.id.slice(0, 8)}</code><small>{session.topic}</small></th>
            <td><time dateTime={session.startedAt}>{utcTime(session.startedAt)}</time><small><time dateTime={session.endedAt}>{utcTime(session.endedAt)}</time></small></td>
            <td>{formatAdminDuration(session.plannedStudySeconds)} học<small>{session.plannedBreakSeconds ? `${formatAdminDuration(session.plannedBreakSeconds)} nghỉ dự kiến` : "Không lên lịch nghỉ"}</small></td>
            <td>{formatAdminDuration(session.actualStudySeconds)} học<small>{formatAdminDuration(session.focusedSeconds)} tập trung</small></td>
            <td>{formatAdminDuration(session.actualBreakSeconds)} thực tế<small>{formatAdminDuration(session.plannedBreakSeconds)} dự kiến</small></td>
            <td>{session.distractions}</td>
            <td>{session.completed ? "Đạt" : "Chưa đạt"}</td>
            <td>{session.quizScore === null || session.quizTotal === null ? "Chưa chấm" : `${session.quizScore}/${session.quizTotal}`}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <Pager total={total} offset={offset} onChange={onOffsetChange} />
    </>}
  </section>;
}

export function AdminPanel({ onClose, onAccessDenied }: { onClose?: () => void; onAccessDenied?: () => void } = {}) {
  const [days, setDays] = useState<AdminPeriod>(7);
  const [tab, setTab] = useState<"overview" | "accounts" | "groups">("overview");
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountOffset, setAccountOffset] = useState(0);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupOffset, setGroupOffset] = useState(0);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null);
  const [sessionResult, setSessionResult] = useState<{ key: string; rows: AdminSession[]; total: number } | null>(null);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const sessionKey = `${days}:${selectedAccount?.id ?? ""}:${selectedGroup?.id ?? ""}:${sessionOffset}`;
  const { rows: sessions, total: sessionTotal } = adminRowsForKey(sessionResult, sessionKey);
  const deniedCallback = useRef(onAccessDenied);
  const exportRequest = useRef<AbortController | null>(null);

  useEffect(() => { deniedCallback.current = onAccessDenied; }, [onAccessDenied]);
  useEffect(() => () => exportRequest.current?.abort(), []);

  const clearAdminData = useCallback(() => {
    setReport(null);
    setAccounts([]);
    setGroups([]);
    setSessionResult(null);
    setAccountTotal(0);
    setGroupTotal(0);
    setSelectedAccount(null);
    setSelectedGroup(null);
    deniedCallback.current?.();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setReportError("");
    setReportLoading(true);
    fetchAdminReport(days, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setReport(value); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isDenied(error)) clearAdminData();
        else setReportError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setReportLoading(false); });
    return () => controller.abort();
  }, [days, clearAdminData]);

  useEffect(() => {
    if (tab !== "accounts") return;
    const controller = new AbortController();
    setAccountLoading(true);
    setAccounts([]);
    setAccountError("");
    fetchAdminAccounts(accountQuery, pageSize, accountOffset, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setAccounts(value.users);
        setAccountTotal(value.total);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isDenied(error)) clearAdminData();
        else setAccountError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setAccountLoading(false); });
    return () => controller.abort();
  }, [accountOffset, accountQuery, clearAdminData, tab]);

  useEffect(() => {
    if (tab !== "groups") return;
    const controller = new AbortController();
    setGroupLoading(true);
    setGroups([]);
    setGroupError("");
    fetchAdminGroups(groupQuery, pageSize, groupOffset, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setGroups(value.groups);
        setGroupTotal(value.total);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isDenied(error)) clearAdminData();
        else setGroupError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setGroupLoading(false); });
    return () => controller.abort();
  }, [clearAdminData, groupOffset, groupQuery, tab]);

  useEffect(() => {
    const filters = selectedAccount ? { accountId: selectedAccount.id } : selectedGroup ? { groupId: selectedGroup.id } : null;
    if (!filters) {
      setSessionResult(null);
      setSessionError("");
      setSessionLoading(false);
      return;
    }
    const controller = new AbortController();
    setSessionLoading(true);
    setSessionError("");
    fetchAdminSessions(days, filters, pageSize, sessionOffset, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSessionResult({ key: sessionKey, rows: value.sessions, total: value.total });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isDenied(error)) clearAdminData();
        else setSessionError(errorMessage(error));
      })
      .finally(() => { if (!controller.signal.aborted) setSessionLoading(false); });
    return () => controller.abort();
  }, [clearAdminData, days, selectedAccount, selectedGroup, sessionOffset, sessionKey]);

  const searchAccounts = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedAccount(null);
    setSelectedGroup(null);
    setAccountOffset(0);
    setAccountQuery(accountSearch.trim());
  };

  const searchGroups = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedGroup(null);
    setSelectedAccount(null);
    setGroupOffset(0);
    setGroupQuery(groupSearch.trim());
  };

  const chooseAccount = (account: AdminAccount) => {
    setSessionError("");
    setSelectedAccount(account);
    setSelectedGroup(null);
    setSessionOffset(0);
  };

  const chooseGroup = (group: AdminGroup) => {
    setSessionError("");
    setSelectedGroup(group);
    setSelectedAccount(null);
    setSessionOffset(0);
  };

  const exportCsv = async () => {
    const controller = new AbortController();
    exportRequest.current?.abort();
    exportRequest.current = controller;
    setExporting(true);
    setReportError("");
    try {
      const file = await exportAdminReport(days, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isDenied(error)) clearAdminData();
      else setReportError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };

  return <section className="admin-panel" aria-labelledby="admin-panel-title">
    <header className="admin-panel-header">
      <div>
        <p className="admin-eyebrow">Viễn Du · Công cụ nội bộ</p>
        <h1 id="admin-panel-title">Báo cáo quản trị</h1>
        <p>Thống kê hoạt động học tập đã lưu. Mọi mốc thời gian dùng UTC.</p>
      </div>
      {onClose && <button type="button" className="admin-close" onClick={onClose}>Đóng</button>}
    </header>

    <div className="admin-toolbar">
      <label htmlFor="admin-report-period">Khoảng báo cáo
        <select id="admin-report-period" value={days} onChange={(event) => { setSessionError(""); setSessionOffset(0); setDays(Number(event.target.value) as AdminPeriod); }}>
          {periods.map((period) => <option value={period} key={period}>{period} ngày</option>)}
        </select>
      </label>
      <button type="button" onClick={exportCsv} disabled={exporting}>
        {exporting ? "Đang xuất…" : "Tải CSV tổng hợp"}
      </button>
    </div>

    <nav className="admin-tabs" aria-label="Báo cáo quản trị">
      <button type="button" aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>Tổng quan</button>
      <button type="button" aria-pressed={tab === "accounts"} onClick={() => setTab("accounts")}>Tài khoản</button>
      <button type="button" aria-pressed={tab === "groups"} onClick={() => setTab("groups")}>Nhóm học</button>
    </nav>

    {reportError && <p className="admin-error" role="alert">{reportError}</p>}
    {tab === "overview" && <section aria-label="Tổng quan quản trị" className="admin-panel-content">
      {reportLoading && <p role="status">Đang tải báo cáo…</p>}
      {!reportLoading && report && <AdminOverview report={report} />}
      {!reportLoading && !report && !reportError && <p className="admin-empty">Chưa có dữ liệu báo cáo.</p>}
    </section>}

    {tab === "accounts" && <section aria-label="Tra cứu tài khoản" className="admin-panel-content">
      <form className="admin-search" onSubmit={searchAccounts}>
        <label htmlFor="admin-account-search">Tìm theo tên hoặc email</label>
        <div><input id="admin-account-search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} maxLength={100} />
          <button type="submit">Tìm tài khoản</button></div>
      </form>
      {accountLoading && <p role="status">Đang tìm tài khoản…</p>}
      {accountError && <p className="admin-error" role="alert">{accountError}</p>}
      {!accountLoading && !accountError && accounts.length === 0 && <p className="admin-empty">Không có tài khoản phù hợp. Thử tìm bằng tên hoặc email khác.</p>}
      {!!accounts.length && <>
        <ul className="admin-result-list">
          {accounts.map((account) => <li key={account.id}>
            <button type="button" className="admin-result-button" aria-pressed={selectedAccount?.id === account.id} onClick={() => chooseAccount(account)}>
              <strong>{account.name}</strong><span>{account.email}</span><small>Tạo lúc {utcTime(account.createdAt)}</small>
            </button>
          </li>)}
        </ul>
        <Pager total={accountTotal} offset={accountOffset} onChange={setAccountOffset} />
      </>}
      {selectedAccount && <SessionsView sessions={sessions} loading={sessionLoading || (!sessionError && sessionResult?.key !== sessionKey)} error={sessionError} total={sessionTotal} offset={sessionOffset} onOffsetChange={setSessionOffset} label={`${selectedAccount.name} · ${selectedAccount.email}`} />}
    </section>}

    {tab === "groups" && <section aria-label="Tra cứu nhóm học" className="admin-panel-content">
      <form className="admin-search" onSubmit={searchGroups}>
        <label htmlFor="admin-group-search">Tìm theo tên hoặc mã nhóm</label>
        <div><input id="admin-group-search" value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} maxLength={100} />
          <button type="submit">Tìm nhóm</button></div>
      </form>
      {groupLoading && <p role="status">Đang tìm nhóm…</p>}
      {groupError && <p className="admin-error" role="alert">{groupError}</p>}
      {!groupLoading && !groupError && groups.length === 0 && <p className="admin-empty">Không có nhóm phù hợp. Thử tên nhóm khác.</p>}
      {!!groups.length && <>
        <ul className="admin-result-list admin-group-list">
          {groups.map((group) => <li key={group.id}>
            <button type="button" className="admin-result-button" aria-pressed={selectedGroup?.id === group.id} onClick={() => chooseGroup(group)}>
              <strong>{group.name}</strong>
              <span>{group.memberCount} thành viên · {group.archived ? "Đã lưu trữ" : "Đang hoạt động"}</span>
              <small>{formatAdminDuration(group.progress.journeySeconds)} tiến độ hành trình · chặng {group.progress.station + 1} · múi giờ nhóm {group.timezone}</small>
            </button>
          </li>)}
        </ul>
        <Pager total={groupTotal} offset={groupOffset} onChange={setGroupOffset} />
      </>}
      {selectedGroup && <SessionsView sessions={sessions} loading={sessionLoading || (!sessionError && sessionResult?.key !== sessionKey)} error={sessionError} total={sessionTotal} offset={sessionOffset} onOffsetChange={setSessionOffset} label={selectedGroup.name} />}
    </section>}

    <footer className="admin-panel-footer">
      Thời gian tập trung là focus và học tài liệu đã lưu; thời gian học thực tế tính theo thời lượng phiên sau khi trừ nghỉ đã lên lịch. Điểm quiz chỉ tính các phiên có kết quả chấm.
    </footer>
  </section>;
}
