import { enqueueSnackbar } from 'notistack';
import React, { useRef, useEffect } from 'react';
import { WasmBoy } from 'wasmboy';

const OPTION = {
  headless: false,
  useGbcWhenOptional: true,
  isAudioEnabled: true,
  frameSkip: 1,
  audioBatchProcessing: true,
  timersBatchProcessing: false,
  audioAccumulateSamples: true,
  graphicsBatchProcessing: false,
  graphicsDisableScanlineRendering: false,
  tileRendering: true,
  tileCaching: true,
  gameboyFPSCap: 60,
  updateGraphicsCallback: false,
  updateAudioCallback: false,
  saveStateCallback: false,
  onReady: false,
  onPlay: false,
  onPause: false,
  onLoadedAndStarted: false,
};

export const GameBoy = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      console.error('Canvas not available in useEffect');
      return;
    }

    const initWasmBoy = async () => {
      try {
        if (canvasRef.current) {
          await WasmBoy.config(
            {
              ...OPTION,
            },
            canvasRef.current,
          );
        }
      } catch (error) {
        enqueueSnackbar(`WasmBoy: ${error}`, { variant: 'error' });
      }
    };

    initWasmBoy();
  }, []);

  const loadROM = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvasRef.current) {
      enqueueSnackbar('Canvas not ready', { variant: 'error' });
      return;
    }

    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      await WasmBoy.loadROM(new Uint8Array(arrayBuffer));
      await WasmBoy.play();
    } catch (error) {
      enqueueSnackbar(`ROM: ${error}`, { variant: 'error' });
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '500px',
          height: '500px',
          margin: '0 auto',
          backgroundColor: 'gray',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            backgroundColor: 'gray',
            width: '100%',
            height: 'auto',
            aspectRatio: '1 / 1',
          }}
        />
      </div>
      <input type="file" onChange={loadROM} style={{ marginTop: '10px' }} />
    </>
  );
};
