for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch("http://127.0.0.1:5225/health/ready");
    if (r.ok) {
      console.log("API ready");
      process.exit(0);
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
throw new Error("API readiness timed out");
