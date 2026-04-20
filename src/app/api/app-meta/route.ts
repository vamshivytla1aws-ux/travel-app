import { readFile } from "fs/promises";
import path from "path";

type PackageJsonShape = {
  version?: string;
};

export async function GET() {
  let appVersion = "unknown";
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJsonShape;
    appVersion = packageJson.version ?? "unknown";
  } catch {
    appVersion = "unknown";
  }

  const payload = {
    appVersion,
    commit:
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA ??
      "unknown",
    deployedAt: new Date().toISOString(),
  };

  return Response.json(payload);
}
