import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { X } from 'lucide-react';
import Peer from 'peerjs';
import { QRCode } from 'react-qrcode-logo';

import {
  DlgButtonIcon,
  DlgContentQR,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import {
  formatLoginHostOutcome,
  startLoginHostSessionForConnection,
  type LoginHostOutcome,
} from '../protocol/loginHostSession';
import type { NETWORK, NotiVariant } from '../types';
import { DEFAULT_PROTOCOL_MESSAGE_TTL_MS } from '../utils/message';
import {
  DEFAULT_ICE_CONF,
  loadIceConfig,
  toPeerOptions,
} from '../webrtc/connection';
import { generateRandomId } from '../webrtc/generateRandomId';
import { buildPeerId } from '../webrtc/qr-id';

export { connectQRLogin } from '../protocol/loginScannerSession';

/**
 * QR host component: shows QR and waits for the initiator to connect.
 * - If iceConfigUrl is provided, it is embedded into the QR via base64url, and also used locally to load ICE.
 * - If not provided, the default ICE config is used.
 */
export const QRLogin = ({
  mode,
  network,
  icon,
  onClose,
  onEvent,
  iceConfigUrl,
  portalContainer,
}: {
  mode: 'dark' | 'light';
  network: NETWORK;
  icon: string;
  onClose: (outcome: LoginHostOutcome) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  /** Optional: when provided, embed this URL into the QR and load ICE from `{url}/ice-conf.json` */
  iceConfigUrl?: string;
  portalContainer?: HTMLElement;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const [sessionId] = useState<string>(() => generateRandomId());
  const [peerReady, setPeerReady] = useState<boolean>(false);
  const cleanupSessionRef = useRef<(() => void) | undefined>(undefined);
  const cancelSessionRef = useRef<((reason?: string) => void) | undefined>(
    undefined,
  );
  const closedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Compose peerId with optional iceConfigUrl suffix so the scanner can use the same ICE config
  const peerId = useMemo(
    () =>
      buildPeerId({
        network,
        sessionId,
        type: 'login',
        iceConfigUrl,
      }),
    [iceConfigUrl, network, sessionId],
  );
  const peerIdHyphen = useMemo(() => peerId.replace(/::/g, '-'), [peerId]);

  const handleClose = useCallback(
    (outcome: LoginHostOutcome) => {
      if (closedRef.current) return;
      closedRef.current = true;
      const cleanup = cleanupSessionRef.current;
      cleanupSessionRef.current = undefined;
      cleanup?.();
      if (mountedRef.current) setOpen(false);
      onClose(outcome);
    },
    [onClose],
  );

  useEffect(() => {
    let peer: Peer | undefined;
    let finished = false;
    let cleanedUp = false;
    let cancelled = false;
    let acceptedConnection = false;
    let sessionTimeout: ReturnType<typeof setTimeout> | undefined;
    let activeConnection:
      | {
          open: boolean;
          close: () => void;
        }
      | undefined;
    let activeRunnerDispose: (() => void) | undefined;

    setPeerReady(false);

    const clearSessionTimeout = () => {
      if (sessionTimeout) clearTimeout(sessionTimeout);
      sessionTimeout = undefined;
    };

    const finish = (outcome: LoginHostOutcome) => {
      if (finished) return;
      finished = true;
      clearSessionTimeout();
      handleClose(outcome);
    };

    const failBeforeRunner = (reason: string) => {
      onEvent({ variant: 'error', message: reason });
      finish({ type: 'failed', reason });
    };

    const cleanupSession = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      cancelled = true;
      clearSessionTimeout();
      const disposeRunner = activeRunnerDispose;
      cancelSessionRef.current = undefined;
      activeRunnerDispose = undefined;
      disposeRunner?.();
      try {
        activeConnection?.close();
      } catch {}
      activeConnection = undefined;
      try {
        peer?.destroy();
      } catch {}
      if (!disposeRunner && !finished && !closedRef.current) {
        failBeforeRunner('QR login session disposed.');
      }
    };

    cleanupSessionRef.current = cleanupSession;

    sessionTimeout = setTimeout(() => {
      if (cancelSessionRef.current) {
        cancelSessionRef.current('QR login session timed out.');
        return;
      }
      failBeforeRunner('QR login session timed out.');
    }, DEFAULT_PROTOCOL_MESSAGE_TTL_MS);

    (async () => {
      try {
        // Load ICE config for the local listener
        const conf = iceConfigUrl
          ? ((await loadIceConfig(iceConfigUrl)) ?? DEFAULT_ICE_CONF)
          : DEFAULT_ICE_CONF;
        if (cancelled) return;

        peer = new Peer(peerIdHyphen, toPeerOptions(conf) as any);
        if (cancelled) {
          try {
            peer.destroy();
          } catch {}
          return;
        }

        peer.on('open', () => {
          if (!cancelled && !finished) setPeerReady(true);
        });

        peer.on('connection', (connection) => {
          if (finished || acceptedConnection) {
            try {
              connection.close();
            } catch {}
            return;
          }
          acceptedConnection = true;
          activeConnection = connection;

          onEvent({ variant: 'info', message: 'Connecting...' });
          setOpen(false);

          const runner = startLoginHostSessionForConnection({
            sessionId,
            network,
            challenge: peerId,
            connection,
            onEvent,
            onFinish: (outcome) => {
              if (outcome.type !== 'connected') {
                onEvent({
                  variant: 'error',
                  message: formatLoginHostOutcome(outcome),
                });
              }
              finish(outcome);
            },
          });
          cancelSessionRef.current = runner.cancel;
          activeRunnerDispose = runner.dispose;
        });

        peer.on('error', (err) => {
          if (cancelSessionRef.current) {
            cancelSessionRef.current(`Peer error: ${err.message}`);
            return;
          }
          failBeforeRunner(`Peer error: ${err.message}`);
        });
      } catch (err) {
        if (!cancelled) failBeforeRunner(`Peer init error: ${String(err)}`);
      }
    })();

    return () => {
      cleanupSessionRef.current = undefined;
      cleanupSession();
    };
  }, [
    handleClose,
    iceConfigUrl,
    network,
    onEvent,
    peerId,
    peerIdHyphen,
    sessionId,
  ]);

  return (
    <DlgRoot open={open}>
      <DlgPortal container={portalContainer}>
        <DlgOverlay mode={mode} style={{ zIndex: 2147483645 }} />
        <DlgContentQR
          mode={mode}
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{ zIndex: 2147483645 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <DlgTitle mode={mode}>Login</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => {
                if (cancelSessionRef.current) {
                  cancelSessionRef.current('Login canceled');
                  return;
                }
                onEvent({ variant: 'error', message: 'Login canceled' });
                handleClose({ type: 'failed', reason: 'Login canceled' });
              }}
            >
              <X />
            </DlgButtonIcon>
          </div>
          {peerReady ? (
            <QRCode
              value={peerId}
              logoImage={icon}
              logoPadding={5}
              size={256}
              qrStyle="dots"
              style={{ width: '256px', height: '256px' }}
            />
          ) : (
            <div
              style={{
                alignItems: 'center',
                display: 'flex',
                height: '256px',
                justifyContent: 'center',
                width: '256px',
              }}
            >
              Preparing...
            </div>
          )}
          <DlgDescription2 mode={mode}>
            {peerReady
              ? 'Please scan the QR code to log in.'
              : 'Preparing secure connection...'}
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
