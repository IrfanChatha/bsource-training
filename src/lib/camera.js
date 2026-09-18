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
 * The fraction of the viewfinder used as the scan region. Only pixels inside
 * this box are decoded, so a tight box means the user has to aim precisely at
 * a code they are photographing off a screen. Keep it generous.
 */
export const QRBOX_RATIO = 0.9;

/**
 * html5-qrcode measures its container, so a box larger than the video stream
 * throws. Sizing it from the actual element keeps it valid on any screen.
 */
export function qrboxFor(viewfinderWidth, viewfinderHeight) {
  const smallest = Math.min(viewfinderWidth || 0, viewfinderHeight || 0);
  const size = Math.max(140, Math.floor(smallest * QRBOX_RATIO));
  return { width: size, height: size };
}

/**
 * Scanner configuration shared by both QR screens.
 *
 * Reading a QR code off a projector or laptop screen is much harder than
 * reading one off paper — it is lower contrast, often out of focus, and can
 * moire against the sensor. Three things matter:
 *
 *  - `useBarCodeDetectorIfSupported` hands decoding to the platform's native
 *    BarcodeDetector where it exists (Android Chrome), which is far more
 *    tolerant than the JavaScript decoder.
 *  - a high-resolution stream with continuous autofocus, so the code is
 *    actually in focus and has enough pixels per module.
 *  - a higher frame rate, giving more decode attempts per second.
 */
export function scannerConfig() {
  return {
    fps: 15,
    qrbox: qrboxFor,
    aspectRatio: 1.0,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    videoConstraints: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      // Not every device honours this; it is ignored where unsupported.
      advanced: [{ focusMode: 'continuous' }],
    },
  };
}
