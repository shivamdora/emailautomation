const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";
const environment = process.env.VERCEL_ENV ?? "";

console.log(`Vercel environment: ${environment || "unknown"}`);
console.log(`Git branch: ${branch || "unknown"}`);

if (branch === "pre") {
  console.log("Skipping Vercel build for the pre branch.");
  process.exit(0);
}

console.log("Proceeding with Vercel build.");
process.exit(1);
