
const API = "http://localhost:8000";

const elements = {
  download: document.getElementById("download"),
  upload: document.getElementById("upload"),
  ping: document.getElementById("ping"),
  jitter: document.getElementById("jitter"),
  button: document.getElementById("startTest"),
  status: document.getElementById("testStatus"),
  server: document.getElementById("serverName")
};

let testing = false;

function showStatus(message) {
  elements.status.textContent = message;
}

function showNumber(element, value, decimals = 2) {
  element.textContent = Number(value).toFixed(decimals);
}

async function checkServer() {
  try {
    const response = await fetch(`${API}/api/health`, {
      cache: "no-store"
    });

    if (!response.ok) throw new Error("Server error");

    const data = await response.json();

    elements.server.textContent =
      data.name || "NEXUS Test Node";

    return true;
  } catch (error) {
    elements.server.textContent = "Server unavailable";
    return false;
  }
}

// Mengukur latency melalui HTTP request
async function measurePing(samples = 10) {
  const results = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();

    const response = await fetch(
      `${API}/api/health?t=${Date.now()}-${i}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Ping request failed");
    }

    const elapsed = performance.now() - start;
    results.push(elapsed);

    showStatus(`Measuring latency ${i + 1}/${samples}`);

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const average =
    results.reduce((a, b) => a + b, 0) / results.length;

  const differences = [];

  for (let i = 1; i < results.length; i++) {
    differences.push(Math.abs(results[i] - results[i - 1]));
  }

  const jitter = differences.length
    ? differences.reduce((a, b) => a + b, 0) / differences.length
    : 0;

  return { ping: average, jitter };
}

// Mengukur download dengan data aktual dari backend
async function measureDownload() {
  const duration = 7000;
  const startTime = performance.now();

  let totalBytes = 0;
  let active = true;

  const workers = Array.from({ length: 4 }, async () => {
    while (active) {
      const response = await fetch(
        `${API}/api/download?size=5000000&t=${Date.now()}-${Math.random()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      if (!response.body) {
        throw new Error("Streaming tidak didukung");
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, duration));
  active = false;

  await Promise.all(workers);

  const seconds = (performance.now() - startTime) / 1000;

  return (totalBytes * 8) / seconds / 1000000;
}

// Mengukur upload dengan mengirim data ke backend
async function measureUpload() {
  const duration = 7000;
  const startTime = performance.now();

  let totalBytes = 0;
  let active = true;

  const payload = new Uint8Array(1024 * 1024);
  crypto.getRandomValues(payload.subarray(0, 65536));

  for (let i = 65536; i < payload.length; i += 65536) {
    payload.set(payload.subarray(0, 65536), i);
  }

  const workers = Array.from({ length: 3 }, async () => {
    while (active) {
      const response = await fetch(
        `${API}/api/upload?t=${Date.now()}-${Math.random()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream"
          },
          body: payload
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      await response.json();
      totalBytes += payload.byteLength;
    }
  });

  await new Promise(resolve => setTimeout(resolve, duration));
  active = false;

  await Promise.all(workers);

  const seconds = (performance.now() - startTime) / 1000;

  return (totalBytes * 8) / seconds / 1000000;
}

// Proses utama
async function startSpeedTest() {
  if (testing) return;

  testing = true;
  elements.button.disabled = true;
  elements.button.textContent = "TESTING...";

  elements.download.textContent = "0.00";
  elements.upload.textContent = "0.00";
  elements.ping.textContent = "--";
  elements.jitter.textContent = "--";

  try {
    showStatus("Connecting to NEXUS server...");

    const connected = await checkServer();

    if (!connected) {
      throw new Error(
        "Backend belum tersedia. Server Python perlu dijalankan terlebih dahulu."
      );
    }

    showStatus("Measuring latency...");

    const latency = await measurePing();

    showNumber(elements.ping, latency.ping);
    showNumber(elements.jitter, latency.jitter);

    showStatus("Measuring download speed...");

    const download = await measureDownload();

    showNumber(elements.download, download);

    showStatus("Measuring upload speed...");

    const upload = await measureUpload();

    showNumber(elements.upload, upload);

    showStatus("Test completed successfully.");

  } catch (error) {
    console.error(error);

    showStatus(error.message || "Test failed.");

  } finally {
    testing = false;
    elements.button.disabled = false;
    elements.button.textContent = "START TEST";
  }
}

elements.button.addEventListener("click", startSpeedTest);

checkServer();


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("NEXUS PWA ready"))
      .catch(error => console.error("PWA error:", error));
  });
}

