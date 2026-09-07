import { Express, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import { recordAuditLog } from "./auth.js";

const execAsync = promisify(exec);

const CONFIG_FILE = path.join(process.cwd(), "data", "github_config.json");

export interface GitHubConfig {
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
}

const DEFAULT_CONFIG: GitHubConfig = {
  username: "badarbukharidev-alt",
  repo: "Whatsapp-Sales-Agent",
  repositoryUrl: "https://github.com/badarbukharidev-alt/Whatsapp-Sales-Agent.git",
  branch: "main",
  token: process.env.GITHUB_TOKEN || "",
  autoBuildAfterPull: true,
};

export async function getGitHubConfig(): Promise<GitHubConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    await saveGitHubConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export async function saveGitHubConfig(config: Partial<GitHubConfig>): Promise<GitHubConfig> {
  const current = await getGitHubConfig();
  const updated: GitHubConfig = { ...current, ...config };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export interface LocalGitInfo {
  headSha: string;
  shortSha: string;
  branch: string;
  author: string;
  date: string;
  message: string;
  isDirty: boolean;
}

export async function getLocalGitInfo(): Promise<LocalGitInfo> {
  try {
    const { stdout: headShaOut } = await execAsync("git rev-parse HEAD");
    const headSha = headShaOut.trim();
    const shortSha = headSha.substring(0, 7);

    let branch = "main";
    try {
      const { stdout: branchOut } = await execAsync("git rev-parse --abbrev-ref HEAD");
      branch = branchOut.trim();
    } catch {
      // Detached head
      branch = `detached (${shortSha})`;
    }

    const { stdout: logOut } = await execAsync('git log -1 --format="%an|%ad|%s"');
    const [author = "Unknown", date = "", message = ""] = logOut.trim().split("|");

    const { stdout: statusOut } = await execAsync("git status --porcelain");
    const isDirty = statusOut.trim().length > 0;

    return {
      headSha,
      shortSha,
      branch,
      author,
      date,
      message,
      isDirty,
    };
  } catch (err: any) {
    return {
      headSha: "unknown",
      shortSha: "unknown",
      branch: "main",
      author: "Local Git",
      date: new Date().toISOString(),
      message: "Unable to read local Git info",
      isDirty: false,
    };
  }
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  isCurrent: boolean;
  htmlUrl: string;
}

export async function fetchRemoteCommits(): Promise<{
  commits: CommitInfo[];
  currentSha: string;
  remoteLatestSha: string;
  isUpToDate: boolean;
  commitsBehind: number;
}> {
  const config = await getGitHubConfig();
  const local = await getLocalGitInfo();

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "SalesAgent-Deployment-Manager",
  };

  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const url = `https://api.github.com/repos/${config.username}/${config.repo}/commits?sha=${config.branch}&per_page=30`;
  const response = await axios.get(url, { headers, timeout: 10000 });

  const rawCommits = response.data;
  if (!Array.isArray(rawCommits) || rawCommits.length === 0) {
    throw new Error("No commits returned from repository.");
  }

  const currentSha = local.headSha;
  const remoteLatestSha = rawCommits[0].sha;

  let foundIndex = -1;
  const commits: CommitInfo[] = rawCommits.map((c: any, index: number) => {
    const isCurrent = c.sha === currentSha || c.sha.startsWith(currentSha) || currentSha.startsWith(c.sha);
    if (isCurrent) foundIndex = index;

    return {
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name || c.author?.login || "Unknown",
      authorAvatar: c.author?.avatar_url,
      date: c.commit.author?.date || "",
      isCurrent,
      htmlUrl: c.html_url || `https://github.com/${config.username}/${config.repo}/commit/${c.sha}`,
    };
  });

  const isUpToDate = currentSha === remoteLatestSha;
  const commitsBehind = foundIndex > 0 ? foundIndex : (isUpToDate ? 0 : 1);

  // Update lastChecked in config
  await saveGitHubConfig({ lastChecked: new Date().toISOString() });

  return {
    commits,
    currentSha,
    remoteLatestSha,
    isUpToDate,
    commitsBehind,
  };
}

export async function deployLatestCommit(): Promise<{
  success: boolean;
  output: string;
  deployedSha: string;
}> {
  const config = await getGitHubConfig();
  const logs: string[] = [];

  try {
    logs.push(`[1/4] Preparing Git deployment from ${config.username}/${config.repo} (${config.branch})...`);

    // Stash any uncommitted tracking modifications safely so they aren't lost
    try {
      const { stdout: stashOut } = await execAsync('git stash push -m "Auto-stash before deploy"');
      if (stashOut && !stashOut.includes("No local changes")) {
        logs.push(`[Info] Local changes stashed: ${stashOut.trim()}`);
      }
    } catch {
      // Ignored if nothing to stash
    }

    // Set remote origin URL with PAT if present for authenticated fetch
    if (config.token) {
      const authenticatedUrl = `https://${config.username}:${config.token}@github.com/${config.username}/${config.repo}.git`;
      await execAsync(`git remote set-url origin "${authenticatedUrl}"`);
    }

    logs.push(`[2/4] Fetching latest commits from origin/${config.branch}...`);
    const { stdout: fetchOut, stderr: fetchErr } = await execAsync(`git fetch origin ${config.branch}`);
    if (fetchOut) logs.push(fetchOut.trim());
    if (fetchErr) logs.push(fetchErr.trim());

    logs.push(`[3/4] Checking out and fast-forwarding to origin/${config.branch}...`);
    // Ensure we are on branch or checkout origin
    try {
      await execAsync(`git checkout ${config.branch}`);
    } catch {
      await execAsync(`git checkout -B ${config.branch} origin/${config.branch}`);
    }

    const { stdout: pullOut } = await execAsync(`git merge origin/${config.branch} --ff-only`).catch(async () => {
      // Fallback if merge fails: reset to origin
      return await execAsync(`git reset --hard origin/${config.branch}`);
    });
    logs.push(pullOut.trim());

    // Restore stashed files if stash was created
    try {
      await execAsync("git stash pop");
      logs.push("[Info] Restored local workspace stashed changes.");
    } catch {
      // No stash or clean merge
    }

    const { stdout: newHeadOut } = await execAsync("git rev-parse HEAD");
    const deployedSha = newHeadOut.trim();
    logs.push(`[4/4] Successfully deployed version: ${deployedSha.substring(0, 7)}`);

    await saveGitHubConfig({
      lastDeployment: {
        sha: deployedSha,
        timestamp: new Date().toISOString(),
        status: "success",
        action: "deploy",
        message: `Deployed latest ${deployedSha.substring(0, 7)}`,
      },
    });

    await recordAuditLog(
      "DEPLOY_LATEST_VERSION",
      "Deployment Manager",
      `Successfully pulled and deployed latest version ${deployedSha.substring(0, 7)} from GitHub.`
    );

    return {
      success: true,
      output: logs.join("\n"),
      deployedSha,
    };
  } catch (err: any) {
    logs.push(`[Error] Deployment failed: ${err.message}`);
    await saveGitHubConfig({
      lastDeployment: {
        sha: "unknown",
        timestamp: new Date().toISOString(),
        status: "failed",
        action: "deploy",
        message: err.message,
      },
    });

    await recordAuditLog(
      "DEPLOY_FAILED",
      "Deployment Manager",
      `Failed to deploy latest version: ${err.message}`
    );

    return {
      success: false,
      output: logs.join("\n"),
      deployedSha: "",
    };
  }
}

export async function rollbackToCommit(commitSha: string): Promise<{
  success: boolean;
  output: string;
  targetSha: string;
}> {
  const logs: string[] = [];
  try {
    logs.push(`[1/3] Preparing rollback to commit ${commitSha.substring(0, 7)}...`);

    // Stash any uncommitted tracking modifications
    try {
      const { stdout: stashOut } = await execAsync(`git stash push -m "Auto-stash before rollback to ${commitSha.substring(0, 7)}"`);
      if (stashOut && !stashOut.includes("No local changes")) {
        logs.push(`[Info] Local changes stashed: ${stashOut.trim()}`);
      }
    } catch {
      // Ignored
    }

    logs.push(`[2/3] Checking out commit ${commitSha.substring(0, 7)}...`);
    const { stdout: coOut, stderr: coErr } = await execAsync(`git checkout ${commitSha}`);
    if (coOut) logs.push(coOut.trim());
    if (coErr) logs.push(coErr.trim());

    const { stdout: headOut } = await execAsync("git rev-parse HEAD");
    const activeSha = headOut.trim();
    logs.push(`[3/3] Successfully rolled back. Active commit is now: ${activeSha.substring(0, 7)}`);

    await saveGitHubConfig({
      lastDeployment: {
        sha: activeSha,
        timestamp: new Date().toISOString(),
        status: "success",
        action: "rollback",
        message: `Rolled back to ${activeSha.substring(0, 7)}`,
      },
    });

    await recordAuditLog(
      "ROLLBACK_VERSION",
      "Deployment Manager",
      `Rolled back system version to commit ${activeSha.substring(0, 7)}.`
    );

    return {
      success: true,
      output: logs.join("\n"),
      targetSha: activeSha,
    };
  } catch (err: any) {
    logs.push(`[Error] Rollback failed: ${err.message}`);
    return {
      success: false,
      output: logs.join("\n"),
      targetSha: "",
    };
  }
}

export function setupDeploymentRoutes(app: Express) {
  // GET /api/admin/deploy/status
  app.get("/api/admin/deploy/status", async (req: Request, res: Response) => {
    try {
      const config = await getGitHubConfig();
      const local = await getLocalGitInfo();

      // Mask token for frontend response
      const maskedConfig = {
        ...config,
        token: config.token ? `${config.token.substring(0, 12)}...${config.token.slice(-4)}` : "",
      };

      res.json({
        config: maskedConfig,
        local,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/deploy/commits
  app.get("/api/admin/deploy/commits", async (req: Request, res: Response) => {
    try {
      const data = await fetchRemoteCommits();
      res.json(data);
    } catch (err: any) {
      console.error("[Deployment] Failed to fetch remote commits:", err.message);
      res.status(500).json({ error: err.message || "Failed to query GitHub repository." });
    }
  });

  // POST /api/admin/deploy/latest
  app.post("/api/admin/deploy/latest", async (req: Request, res: Response) => {
    try {
      const result = await deployLatestCommit();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/deploy/rollback
  app.post("/api/admin/deploy/rollback", async (req: Request, res: Response) => {
    try {
      const { commitSha } = req.body;
      if (!commitSha || typeof commitSha !== "string") {
        return res.status(400).json({ error: "commitSha is required." });
      }
      const result = await rollbackToCommit(commitSha);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/deploy/test-connection
  app.post("/api/admin/deploy/test-connection", async (req: Request, res: Response) => {
    try {
      const config = await getGitHubConfig();
      const headers: Record<string, string> = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SalesAgent-Deployment-Manager",
      };
      if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

      const repoRes = await axios.get(`https://api.github.com/repos/${config.username}/${config.repo}`, {
        headers,
        timeout: 8000,
      });

      res.json({
        success: true,
        repoName: repoRes.data.full_name,
        isPrivate: repoRes.data.private,
        defaultBranch: repoRes.data.default_branch,
        updatedAt: repoRes.data.pushed_at,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.response?.data?.message || err.message || "Connection failed.",
      });
    }
  });

  // POST /api/admin/deploy/config
  app.post("/api/admin/deploy/config", async (req: Request, res: Response) => {
    try {
      const updated = await saveGitHubConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
