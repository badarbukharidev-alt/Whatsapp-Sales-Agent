import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  GitBranch,
  GitCommit,
  RotateCcw,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  RefreshCw,
  ShieldCheck,
  Zap,
  Check,
  AlertTriangle,
  ArrowDownToLine,
  Sliders,
  Radio,
  GitPullRequest,
  Terminal,
} from "lucide-react";

function GitHubIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

interface CommitItem {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  isCurrent: boolean;
  htmlUrl: string;
}

interface DeployStatusData {
  config: {
    username: string;
    repo: string;
    repositoryUrl: string;
    branch: string;
    token: string;
    autoBuildAfterPull: boolean;
    lastChecked?: string;
    lastDeployment?: {
      sha: string;
      timestamp: string;
      status: "success" | "failed";
      action: "deploy" | "rollback";
      message: string;
    };
  };
  local: {
    headSha: string;
    shortSha: string;
    branch: string;
    author: string;
    date: string;
    message: string;
    isDirty: boolean;
  };
}

interface AdminDeploymentsProps {
  onToast?: (message: string, type?: "success" | "error") => void;
}

export default function AdminDeployments({ onToast }: AdminDeploymentsProps) {
  const [statusData, setStatusData] = useState<DeployStatusData | null>(null);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [isUpToDate, setIsUpToDate] = useState<boolean>(true);
  const [commitsBehind, setCommitsBehind] = useState<number>(0);
  const [remoteLatestSha, setRemoteLatestSha] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);

  const [deploymentLog, setDeploymentLog] = useState<string | null>(null);
  const [rollbackModalCommit, setRollbackModalCommit] = useState<CommitItem | null>(null);
  const [confirmDeployModal, setConfirmDeployModal] = useState<boolean>(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    if (onToast) {
      onToast(text, type);
    } else {
      alert(text);
    }
  };

  // Fetch local status and GitHub commits
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statusRes, commitsRes] = await Promise.all([
        axios.get("/api/admin/deploy/status"),
        axios.get("/api/admin/deploy/commits"),
      ]);

      if (statusRes.data) {
        setStatusData(statusRes.data);
      }

      if (commitsRes.data) {
        setCommits(commitsRes.data.commits || []);
        setIsUpToDate(Boolean(commitsRes.data.isUpToDate));
        setCommitsBehind(commitsRes.data.commitsBehind || 0);
        setRemoteLatestSha(commitsRes.data.remoteLatestSha || "");
      }

      if (isManualRefresh) {
        showToast("GitHub commits & local status synchronized.");
      }
    } catch (err: any) {
      console.error("Error loading deployment data:", err);
      showToast(err.response?.data?.error || "Failed to load GitHub commits.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Deploy Latest from GitHub
  const handleDeployLatest = async () => {
    setConfirmDeployModal(false);
    setIsDeploying(true);
    setDeploymentLog("Initiating Git pull from GitHub origin/main...");

    try {
      const res = await axios.post("/api/admin/deploy/latest");
      if (res.data.success) {
        setDeploymentLog(res.data.output || "Successfully deployed latest version.");
        showToast(`Successfully deployed version ${res.data.deployedSha.substring(0, 7)}!`);
        await fetchData(true);
      } else {
        setDeploymentLog(res.data.output || "Deployment failed.");
        showToast("Deployment failed. Inspect log output below.", "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Deployment failed.";
      setDeploymentLog(`[Error] ${msg}`);
      showToast(msg, "error");
    } finally {
      setIsDeploying(false);
    }
  };

  // Rollback to specific commit
  const handleRollback = async (commit: CommitItem) => {
    setRollbackModalCommit(null);
    setIsRollingBack(true);
    setDeploymentLog(`Initiating rollback to commit ${commit.shortSha} (${commit.message})...`);

    try {
      const res = await axios.post("/api/admin/deploy/rollback", {
        commitSha: commit.sha,
      });

      if (res.data.success) {
        setDeploymentLog(res.data.output || `Successfully rolled back to ${commit.shortSha}.`);
        showToast(`Rolled back to version ${commit.shortSha}!`);
        await fetchData(true);
      } else {
        setDeploymentLog(res.data.output || "Rollback failed.");
        showToast("Rollback failed. Inspect log output below.", "error");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Rollback failed.";
      setDeploymentLog(`[Error] ${msg}`);
      showToast(msg, "error");
    } finally {
      setIsRollingBack(false);
    }
  };

  // Test GitHub Connection
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const res = await axios.post("/api/admin/deploy/test-connection");
      if (res.data.success) {
        showToast(`Connected to GitHub repository: ${res.data.repoName} (${res.data.isPrivate ? "Private" : "Public"})`);
      } else {
        showToast(res.data.error || "GitHub connection failed", "error");
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "GitHub authentication failed", "error");
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full text-[var(--ink)]">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--panel-solid)] p-6 sm:p-7 rounded-3xl border border-[var(--line)] shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center shrink-0 shadow-md">
            <GitHubIcon className="w-6 h-6 text-[#10b981]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 flex items-center gap-1.5">
                <Radio className="w-3 h-3 animate-pulse" />
                GitHub CI/CD Engine
              </span>
              <span className="text-xs text-[var(--muted)] font-mono flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5 text-[#10b981]" />
                {statusData?.config?.branch || "main"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
              GitHub Version Deployment & Rollback
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              Pull and deploy latest releases directly from GitHub, or safely roll back to any previous version with 1 click.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line)] text-xs font-bold text-[var(--ink)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Check GitHub for new commits"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#10b981]" : "text-[var(--muted)]"}`} />
            <span>Check Updates</span>
          </button>

          <button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line)] text-xs font-bold text-[var(--ink)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Verify GitHub PAT Token and repository accessibility"
          >
            <Zap className={`w-3.5 h-3.5 ${isTestingConnection ? "animate-spin text-amber-500" : "text-amber-500"}`} />
            <span>Test Connection</span>
          </button>

          <button
            onClick={() => setConfirmDeployModal(true)}
            disabled={isDeploying || isRollingBack}
            className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white text-xs font-black shadow-md shadow-[#10b981]/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <ArrowDownToLine className={`w-4 h-4 ${isDeploying ? "animate-bounce" : ""}`} />
            <span>{isDeploying ? "Deploying..." : "Deploy Latest Version"}</span>
          </button>
        </div>
      </div>

      {/* Grid: Current Active Version + Sync Status + GitHub Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Active Local Version */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Active Version</span>
              <div className="w-8 h-8 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center">
                <GitCommit className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black font-mono text-[var(--ink)]">
                  {statusData?.local?.shortSha || "5a3e637"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
                  Live in Memory
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--ink)] mt-2 line-clamp-2">
                {statusData?.local?.message || "Loading commit details..."}
              </p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[var(--line)] text-[11px] text-[var(--muted)] flex items-center justify-between">
            <span>Author: {statusData?.local?.author || "Badar Bukhari"}</span>
            <span className="font-mono text-[10px]">{statusData?.local?.branch || "main"}</span>
          </div>
        </div>

        {/* Card 2: Remote Sync Status */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Sync with GitHub</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isUpToDate ? "bg-[#10b981]/15 text-[#10b981]" : "bg-amber-500/15 text-amber-500"
              }`}>
                {isUpToDate ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className={`text-xl font-black ${isUpToDate ? "text-[#10b981]" : "text-amber-500"}`}>
                  {isUpToDate ? "Up to Date" : `${commitsBehind} Commit${commitsBehind > 1 ? "s" : ""} Behind`}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">
                {isUpToDate
                  ? "Local codebase matches the latest release on GitHub origin/main."
                  : "A new version is available on GitHub. Click 'Deploy Latest Version' to upgrade."}
              </p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[var(--line)] text-[11px] text-[var(--muted)] flex items-center justify-between">
            <span>Latest remote: <span className="font-mono text-[var(--ink)]">{remoteLatestSha ? remoteLatestSha.substring(0, 7) : "—"}</span></span>
            <span className="text-[10px] text-[#10b981] font-bold">Auto-Sync Safe</span>
          </div>
        </div>

        {/* Card 3: GitHub Config */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Repository Info</span>
              <a
                href={statusData?.config?.repositoryUrl || "https://github.com/badarbukharidev-alt/Whatsapp-Sales-Agent"}
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-[var(--panel)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-center transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="mt-3 space-y-1">
              <div className="text-sm font-bold text-[var(--ink)] truncate">
                {statusData?.config?.username}/{statusData?.config?.repo}
              </div>
              <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                <span>PAT Authenticated:</span>
                <span className="font-mono text-[10px] text-[var(--ink)] font-semibold">
                  {statusData?.config?.token || "Configured"}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[var(--line)] text-[11px] text-[var(--muted)] flex items-center justify-between">
            <span>Branch: <span className="font-mono text-[var(--ink)] font-bold">{statusData?.config?.branch || "main"}</span></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">● Protected</span>
          </div>
        </div>
      </div>

      {/* Deployment Log Terminal (if any active or recent operation) */}
      {deploymentLog && (
        <div className="bg-[#0b0d0b] text-slate-200 p-5 rounded-3xl border border-[var(--line-strong)] font-mono text-xs shadow-xl space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 text-slate-400">
              <Terminal className="w-4 h-4 text-[#10b981]" />
              <span className="font-bold text-slate-300">Deployment & Git Operation Log</span>
            </div>
            <button
              onClick={() => setDeploymentLog(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Clear Log
            </button>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
            {deploymentLog}
          </pre>
        </div>
      )}

      {/* Commit History & Rollback Table */}
      <div className="bg-[var(--panel-solid)] rounded-3xl border border-[var(--line)] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--ink)] flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#10b981]" />
              GitHub Commit History & Rollback Targets
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Select any previous commit from GitHub to safely roll back the server codebase.
            </p>
          </div>

          <div className="text-xs font-bold text-[var(--muted)] bg-[var(--panel)] px-3 py-1.5 rounded-xl border border-[var(--line)]">
            Showing {commits.length} commits
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--muted)] flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#10b981]" />
            <span>Fetching commit history from GitHub...</span>
          </div>
        ) : commits.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--muted)]">
            No commits returned from repository.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel)]/50 text-[var(--muted)] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4 pl-6">Commit</th>
                  <th className="p-4">Message</th>
                  <th className="p-4">Author</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">State</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {commits.map((commit) => {
                  const isCurrent = commit.isCurrent;
                  return (
                    <tr
                      key={commit.sha}
                      className={`hover:bg-[var(--panel)]/60 transition-colors ${
                        isCurrent ? "bg-[#10b981]/5 dark:bg-[#10b981]/10" : ""
                      }`}
                    >
                      {/* Commit SHA */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2">
                          <a
                            href={commit.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono font-bold text-[#10b981] hover:underline flex items-center gap-1"
                            title="View commit on GitHub"
                          >
                            <span>{commit.shortSha}</span>
                            <ExternalLink className="w-3 h-3 text-[var(--muted)]" />
                          </a>
                        </div>
                      </td>

                      {/* Commit Message */}
                      <td className="p-4">
                        <span className="font-semibold text-[var(--ink)] block max-w-md truncate" title={commit.message}>
                          {commit.message}
                        </span>
                      </td>

                      {/* Author */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {commit.authorAvatar ? (
                            <img
                              src={commit.authorAvatar}
                              alt={commit.author}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[10px] font-bold">
                              {commit.author.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[var(--ink)] truncate max-w-[120px]">
                            {commit.author}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-[var(--muted)] whitespace-nowrap">
                        {commit.date ? new Date(commit.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </td>

                      {/* Status State */}
                      <td className="p-4 whitespace-nowrap">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Current Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] font-medium">
                            Historical Release
                          </span>
                        )}
                      </td>

                      {/* Rollback Action Button */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <span className="text-[11px] font-bold text-[#10b981]">
                            Active Version
                          </span>
                        ) : (
                          <button
                            onClick={() => setRollbackModalCommit(commit)}
                            disabled={isRollingBack || isDeploying}
                            className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                            title={`Rollback server to commit ${commit.shortSha}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rollback Here</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Deploy Latest */}
      {confirmDeployModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--panel-solid)] text-[var(--ink)] border border-[var(--line)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center shrink-0">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ink)]">Deploy Latest from GitHub</h3>
                <p className="text-xs text-[var(--muted)]">Synchronize local workspace with origin/main</p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              This will pull the latest commits from <strong className="text-[var(--ink)]">badarbukharidev-alt/Whatsapp-Sales-Agent</strong> (branch: <code>main</code>). Any local tracked changes will be stashed safely and merged. Customer directories and persistent databases in <code>data/</code> are unaffected.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeployModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-bold hover:bg-[var(--panel)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeployLatest}
                className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Deploy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Rollback to Commit */}
      {rollbackModalCommit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--panel-solid)] text-[var(--ink)] border border-[var(--line)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ink)]">Confirm Version Rollback</h3>
                <p className="text-xs text-[var(--muted)]">Target: Commit {rollbackModalCommit.shortSha}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] space-y-1 text-xs">
              <div className="font-bold text-[var(--ink)]">{rollbackModalCommit.message}</div>
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-2">
                <span>By {rollbackModalCommit.author}</span>
                <span>•</span>
                <span className="font-mono">{rollbackModalCommit.shortSha}</span>
              </div>
            </div>

            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
              Are you sure you want to rollback to this version? The local repository HEAD will be checked out to this historical commit. You can return to the newest release anytime by clicking "Deploy Latest Version".
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRollbackModalCommit(null)}
                className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-bold hover:bg-[var(--panel)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(rollbackModalCommit)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Rollback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
