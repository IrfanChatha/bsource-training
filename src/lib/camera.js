/**
 * Shared camera preflight and error wording for the QR scanners.
 *
 * `getUserMedia` only exists in a secure context, so opening the app on a phone
 * over `http://192.168.x.x` silently has no camera API at all. That is by far
 * the most common reason a scanner "just doesn't start", and it needs saying
 * plainly rather than being reported as a generic failure.
 */

/** Returns null when a camera can be requested, or a reason why it cannot. */
export function cameraUnavailableReason() {
  if (typeof window === 'undefined') return 'Camera is only available in the browser.';

  if (!window.isSecureContext) {
    return (
      `This page is served over ${window.location.protocol.replace(':', '')} from ` +
      `${window.location.hostname}, and browsers only allow camera access on HTTPS ` +
      'or localhost. Open the app over HTTPS, or enter the token shown under the QR code.'
    );
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return 'This browser does not expose a camera API. Enter the token shown under the QR code instead.';
  }

  return null;
}

/** Turns a getUserMedia / html5-qrcode failure into something actionable. */
export function describeCameraError(err) {
  const name = err?.name || '';
  const message = err?.message || String(err || '');

  if (name === 'NotAllowedError' || /permission|denied/i.test(message)) {
    return 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || /no camera|not found|requested device/i.test(message)) {
    return 'No camera was found on this device. Enter the token shown under the QR code instead.';
  }
  if (name === 'NotReadableError' || /in use|could not start/i.test(message)) {
    return 'The camera is already in use by another app. Close it and try again.';
  }
  if (name === 'OverconstrainedError' || /facing|constraint/i.test(message)) {
    return 'No rear-facing camera is available. Try again, or enter the token manually.';
  }
  if (/width|height|dimension|qrbox/i.test(message)) {
    return 'The scanner could not size its viewfinder. Reload the page and try again.';
  }
  return `Camera could not start: ${message}`;
}

/**
 * html5-qrcode measures its container, so a box larger than the video stream
 * throws. Sizing it from the actual element keeps it valid on any screen.
 */
export function qrboxFor(viewfinderWidth, viewfinderHeight) {
  const smallest = Math.min(viewfinderWidth || 0, viewfinderHeight || 0);
  const size = Math.max(140, Math.floor(smallest * 0.7));
  return { width: size, height: size };
}
