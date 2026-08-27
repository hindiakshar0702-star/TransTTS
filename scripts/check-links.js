const { spawn } = require("child_process");
const http = require("http");
const { LinkChecker } = require("linkinator");

async function checkPort(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          resolve();
        });
        req.on("error", reject);
      });
      return true;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

async function run() {
  console.log("Starting Next.js development server...");
  const devServer = spawn("npm", ["run", "dev"], {
    shell: true,
    stdio: "ignore", // Avoid cluttering the console, Playwright or Linkinator output is cleaner
  });

  const cleanup = () => {
    console.log("Cleaning up dev server...");
    devServer.kill("SIGTERM");
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    const ok = await checkPort(3000);
    if (!ok) {
      console.error("Failed to connect to dev server on port 3000 within timeout.");
      process.exit(1);
    }

    console.log("Server is running. Starting Linkinator link check...");
    const checker = new LinkChecker();
    const results = await checker.check({
      path: "http://localhost:3000",
      recurse: true,
      skip: "^http://localhost:3000/api",
    });

    console.log(`Link check completed. Checked ${results.links.length} links.`);
    const broken = results.links.filter(x => x.state === "BROKEN");
    if (broken.length > 0) {
      console.error(`Found ${broken.length} broken links:`);
      broken.forEach(l => console.error(`- ${l.url} (status: ${l.status})`));
      process.exit(1);
    } else {
      console.log("All links are valid!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error running link check:", error);
    process.exit(1);
  } finally {
    cleanup();
  }
}

run();
