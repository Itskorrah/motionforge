/** Exact integer frame AND PCM-sample beat grid. No rounded beat/cut times. */
export const SAMPLE_RATE = 48000;

export function createTimeline({ fps, bpm, beatsPerCut, frames }) {
  if (![fps, bpm, beatsPerCut, frames].every(Number.isFinite) ||
      !Number.isInteger(fps) || fps < 1 || fps > 120 ||
      bpm <= 0 || !Number.isSafeInteger(beatsPerCut) || beatsPerCut < 1 ||
      !Number.isSafeInteger(frames) || frames < 1) {
    throw new Error('Invalid fps, bpm, beats-per-cut or frames');
  }
  const exactFramesPerBeat = fps * 60 / bpm;
  const exactSamplesPerBeat = SAMPLE_RATE * 60 / bpm;
  const framesPerBeat = Math.round(exactFramesPerBeat);
  const samplesPerBeat = Math.round(exactSamplesPerBeat);
  if (framesPerBeat < 1 || Math.abs(exactFramesPerBeat - framesPerBeat) > 1e-8 ||
      Math.abs(exactSamplesPerBeat - samplesPerBeat) > 1e-8) {
    throw new Error(`BPM ${bpm} at ${fps} FPS cannot put every beat on an exact frame and audio sample. ` +
      'Choose a compatible BPM (e.g. 120 at 24, 30 or 60 FPS; 112.5 at 30 FPS).');
  }
  const cutInterval = framesPerBeat * beatsPerCut;
  const cuts = Array.from({ length: Math.ceil(frames / cutInterval) }, (_, index) => ({
    index,
    frame: index * cutInterval,
    time: index * cutInterval / fps,
    beat: index * beatsPerCut,
    sample: index * beatsPerCut * samplesPerBeat,
  }));
  return { fps, bpm, beatsPerCut, frames, framesPerBeat, samplesPerBeat, cutInterval, cuts,
    sampleRate: SAMPLE_RATE, samplesPerFrame: SAMPLE_RATE / fps };
}
