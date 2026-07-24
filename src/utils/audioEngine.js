export class AudioEngine {
  constructor() {
    this.initialized = false;
  }

  init(audioEl1, audioEl2) {
    if (this.initialized) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return; 

    this.ctx = new AudioContext();

    audioEl1.crossOrigin = "anonymous";
    audioEl2.crossOrigin = "anonymous";

    this.source1 = this.ctx.createMediaElementSource(audioEl1);
    this.source2 = this.ctx.createMediaElementSource(audioEl2);

    this.gain1 = this.ctx.createGain();
    this.gain2 = this.ctx.createGain();

    this.source1.connect(this.gain1);
    this.source2.connect(this.gain2);

    // 3-band EQ
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 320;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.5;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3200;

    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    this.gain1.connect(this.eqLow);
    this.gain2.connect(this.eqLow);
    
    this.karaokeInput = this.ctx.createGain();
    this.karaokeOutput = this.ctx.createGain();
    this.eqHigh.connect(this.karaokeInput);
    this.karaokeInput.connect(this.karaokeOutput);
    
    this.masterGain = this.ctx.createGain();
    this.karaokeOutput.connect(this.masterGain);
    
    // Dynamics Compressor for Volume Normalization
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Attach gain nodes to audio elements for tweening
    audioEl1.gainNode = this.gain1;
    audioEl2.gainNode = this.gain2;

    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEQ(preset) {
    if (!this.initialized) return;
    switch(preset) {
      case 'bass-boost':
        this.eqLow.gain.setTargetAtTime(8, this.ctx.currentTime, 0.1);
        this.eqMid.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.eqHigh.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        break;
      case 'acoustic':
        this.eqLow.gain.setTargetAtTime(2, this.ctx.currentTime, 0.1);
        this.eqMid.gain.setTargetAtTime(4, this.ctx.currentTime, 0.1);
        this.eqHigh.gain.setTargetAtTime(2, this.ctx.currentTime, 0.1);
        break;
      case 'vocal':
        this.eqLow.gain.setTargetAtTime(-2, this.ctx.currentTime, 0.1);
        this.eqMid.gain.setTargetAtTime(6, this.ctx.currentTime, 0.1);
        this.eqHigh.gain.setTargetAtTime(2, this.ctx.currentTime, 0.1);
        break;
      default: // flat
        this.eqLow.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.eqMid.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.eqHigh.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        break;
    }
  }

  setKaraoke(enabled) {
    if (!this.initialized) return;
    
    this.karaokeInput.disconnect();
    
    if (enabled) {
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);
      
      const inverter = this.ctx.createGain();
      inverter.gain.value = -1;
      
      this.karaokeInput.connect(splitter);
      
      splitter.connect(inverter, 1, 0);
      
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
      
      inverter.connect(merger, 0, 0);
      inverter.connect(merger, 0, 1);
      
      merger.connect(this.karaokeOutput);
    } else {
      this.karaokeInput.connect(this.karaokeOutput);
    }
  }
}

export const audioEngine = new AudioEngine();
