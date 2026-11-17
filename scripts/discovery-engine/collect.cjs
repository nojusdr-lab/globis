// CLI: node collect.cjs <source>. Prints the run as JSON; exit code 1 when the run failed.
// Writes nothing.
const sources = { 'lietuva-gyvunams': './lietuva-gyvunams.cjs', kggn: './kggn.cjs', 'sos-gyvunai': './sos-gyvunai.cjs' };
const file = Object.hasOwn(sources, process.argv[2]) ? sources[process.argv[2]] : null;
if (!file) { console.error(`Usage: node collect.cjs <${Object.keys(sources).join('|')}>`); process.exit(2); }
require(file).collect().then(run => {
  console.log(JSON.stringify(run, null, 1));
  process.exitCode = run.state === 'complete' ? 0 : 1;
});
