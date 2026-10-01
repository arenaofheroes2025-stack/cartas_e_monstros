import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const adapters = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
  (addresses || []).filter(address => address.family === 'IPv4' && !address.internal).map(address => ({ name, address: address.address }))
);
const isPrivate = address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
const wifi = adapters.find(adapter => /wi[ -]?fi|wlan|wireless/i.test(adapter.name) && isPrivate(adapter.address));
const host = process.env.LAN_HOST || wifi?.address;
const port = Number(process.env.LAN_PORT || 5183);

if (!host) {
  console.error('Nenhum IPv4 de Wi-Fi foi encontrado. Defina LAN_HOST com o IP do adaptador da rede local.');
  console.error('Adaptadores disponíveis:', adapters.map(adapter => `${adapter.name}: ${adapter.address}`).join(', ') || 'nenhum');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('LAN_PORT precisa ser uma porta válida entre 1 e 65535.');
  process.exit(1);
}

const portIsFree = await new Promise((resolve,reject) => {
  const probe = net.createServer();
  probe.once('error', error => {
    if (error.code === 'EADDRINUSE') resolve(false);
    else reject(error);
  });
  probe.listen(port, host, () => probe.close(() => resolve(true)));
});
if (!portIsFree) {
  console.error(`A porta ${port} já está ocupada em ${host}. Encerre a prévia anterior ou defina LAN_PORT.`);
  process.exit(1);
}

const url = `http://${host}:${port}/`;
console.log(`\nJogo na rede local: ${url}`);
console.log('Conecte o celular ao mesmo Wi-Fi e abra esse endereço no navegador.\n');
const child = spawn(process.execPath, [viteCli, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  cwd: root, stdio: 'inherit', windowsHide: true
});

async function checkLocalAddress() {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      const responses = await Promise.all(['/', '/art/people/artisan.png', '/art/terrain-atlas.png'].map(route => fetch(new URL(route, url))));
      if (responses.every(response => response.ok)) {
        console.log('Prévia e assets responderam pelo endereço Wi-Fi.');
        return;
      }
    } catch { /* O servidor ainda está iniciando. */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  console.warn('Não foi possível confirmar o endereço Wi-Fi neste computador. Verifique a rede privada e o firewall.');
}
void checkLocalAddress();
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => { process.exitCode = code ?? 1; });
