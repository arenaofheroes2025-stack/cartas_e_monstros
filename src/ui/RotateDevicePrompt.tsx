import './rotateDevice.css';

export function RotateDevicePrompt() {
  return <div className="rotate-device" role="dialog" aria-modal="true" aria-labelledby="rotate-device-title">
    <div className="rotate-device-card">
      <div className="rotate-device-symbol" aria-hidden="true"><span className="rotate-device-phone"/><span className="rotate-device-arrow">↻</span></div>
      <small>UMA ARENA MAIS AMPLA</small>
      <h2 id="rotate-device-title">Gire o celular</h2>
      <p>Cartas e Monstros é jogado na horizontal. Vire o aparelho para ver a arena e usar os controles com espaço.</p>
      <span className="rotate-device-note">O jogo continuará de onde parou.</span>
    </div>
  </div>;
}
