export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentStream: MediaStream | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.currentStream = stream;
    this.audioChunks = [];

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    ) ?? '';

    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType ?? 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.currentStream?.getTracks().forEach((t) => t.stop());
        this.currentStream = null;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  async playArrayBuffer(buffer: ArrayBuffer): Promise<void> {
    this.stopPlayback();
    this.audioCtx ??= new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    const audioBuffer = await this.audioCtx.decodeAudioData(buffer);
    return new Promise((resolve) => {
      const source = this.audioCtx!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx!.destination);
      source.onended = () => {
        this.currentSource = null;
        resolve();
      };
      this.currentSource = source;
      source.start();
    });
  }

  stopPlayback(): void {
    try { this.currentSource?.stop(); } catch { /* already stopped */ }
    this.currentSource = null;
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  get isPlaying(): boolean {
    return this.currentSource !== null;
  }

  dispose(): void {
    this.stopPlayback();
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    this.currentStream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
  }
}
