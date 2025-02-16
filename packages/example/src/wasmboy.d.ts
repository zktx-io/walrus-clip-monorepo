declare module 'wasmboy' {
  export class WasmBoy {
    static config(
      options: {
        headless: boolean;
        useGbcBios?: boolean;
        useGbcWhenOptional?: boolean;
        isAudioEnabled?: boolean;
        frameSkip?: number;
        audioBatchProcessing?: boolean;
        timersBatchProcessing?: boolean;
        audioAccumulateSamples?: boolean;
        graphicsBatchProcessing?: boolean;
        graphicsDisableScanlineRendering?: boolean;
        tileRendering?: boolean;
        tileCaching?: boolean;
        gameboyFPSCap?: number;
        updateGraphicsCallback?: boolean;
        updateAudioCallback?: boolean;
        saveStateCallback?: boolean;
        onReady?: boolean;
        onPlay?: boolean;
        onPause?: boolean;
        onLoadedAndStarted?: boolean;
      },
      canvas: HTMLCanvasElement | null,
    ): Promise<boolean>;

    static start(): Promise<void>;
    static pause(): Promise<void>;
    static reset(): Promise<void>;
    static loadROM(romArrayBuffer: ArrayBuffer | Uint8Array): Promise<void>;
    static play(): Promise<void>;
    static stop(): Promise<void>;

    static getSaveState(): Promise<Uint8Array>;
    static setSaveState(state: Uint8Array): Promise<void>;

    static getConfig(): Record<string, unknown>;
    static isReady(): boolean;
  }
}
