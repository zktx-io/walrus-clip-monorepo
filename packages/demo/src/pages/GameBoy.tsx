import { useRef, useEffect } from 'react';

import { enqueueSnackbar } from 'notistack';
import queryString from 'query-string';
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
  const initialized = useRef<boolean>(false);

  useEffect(() => {
    const loadGame = async (id: string) => {
      try {
        const res = await fetch(
          `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${id}`,
        );
        const data = await res.arrayBuffer();
        await loadROM(new Uint8Array(data));
      } catch (error) {
        enqueueSnackbar(`${error}`, {
          variant: 'error',
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        });
      }
    };

    const { id } = queryString.parse(location.search) as {
      id: string;
    };

    if (!id) {
      enqueueSnackbar('Missing game id', {
        variant: 'error',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
    } else {
      if (!initialized.current) {
        initialized.current = true;
        loadGame(id);
      }
    }
  }, []);

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
        enqueueSnackbar(`WasmBoy: ${error}`, {
          variant: 'error',
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        });
      }
    };

    initWasmBoy();
  }, []);

  const loadROM = async (rom: Uint8Array) => {
    if (!canvasRef.current) {
      enqueueSnackbar('Canvas not ready', {
        variant: 'error',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
      return;
    }

    try {
      await WasmBoy.loadROM(rom);
      await WasmBoy.play();
    } catch (error) {
      enqueueSnackbar(`ROM: ${error}`, {
        variant: 'error',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '320px',
          height: '288px',
          backgroundColor: 'gray',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </>
  );
};
