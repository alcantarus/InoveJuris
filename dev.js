const { spawn } = require('child_process');
const child = spawn('npx', ['next', 'dev', '--turbopack=false', '-H', '0.0.0.0', '-p', '3000'], { stdio: 'inherit', shell: true });
child.on('exit', code => process.exit(code));

