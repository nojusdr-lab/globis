// Keep the original entry point blocked even when invoked directly or by old runbooks.
console.error('Live Globok updates are disabled pending verified access and pagination. See docs/globok-refresh.md.');
process.exitCode = 1;
