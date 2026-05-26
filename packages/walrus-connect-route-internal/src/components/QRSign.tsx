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
import { NETWORK, NotiVariant } from '../types';
import { createPeerDataConnectionTransport } from '../protocol/peerTransport';
import { routeQRSignHostBoundaryFailure } from '../protocol/qrSignHostBoundary';
import {
  formatSignHostOutcome,
  startSignHostRunner,
  type QRSignOutcome,
} from '../protocol/signHostRunner';
import { DEFAULT_PROTOCOL_MESSAGE_TTL_MS } from '../utils/message';
import {
  DEFAULT_ICE_CONF,
  loadIceConfig,
  toPeerOptions,
} from '../webrtc/connection';
import { generateRandomId } from '../webrtc/generateRandomId';
import { buildPeerId } from '../webrtc/qr-id';

/**
 * QR host component: shows QR and waits for the initiator to connect.
 * - If iceConfigUrl is provided, it is embedded into the QR via base64url, and also used locally to load ICE.
 * - If not provided, the default ICE config is used.
 */
export const QRSign = ({
  mode,
  data: { network, transaction, sponsoredUrl },
  icon,
  option,
  onEvent,
  onClose,
}: {
  mode: 'dark' | 'light';
  data: {
    network: NETWORK;
    transaction: { toJSON: () => Promise<string> };
    sponsoredUrl?: string;
  };
  icon: string;
  option: { title?: string; description?: string; iceConfigUrl?: string };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (outcome: QRSignOutcome) => void;
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
        type: 'sign',
        iceConfigUrl: option?.iceConfigUrl,
      }),
    [network, option?.iceConfigUrl, sessionId],
  );
  const peerIdHyphen = useMemo(() => peerId.replace(/::/g, '-'), [peerId]);

  const handleClose = useCallback(
    (outcome: QRSignOutcome) => {
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

  const handleFailure = useCallback(
    (reason: string) => {
      if (closedRef.current) return;
      onEvent({ variant: 'error', message: reason });
      handleClose({ type: 'failed_before_submit', reason });
    },
    [handleClose, onEvent],
  );

  useEffect(() => {
    let peer: Peer | undefined;
    let cancelled = false;
    let cleanedUp = false;
    let finished = false;
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

    const finish = (outcome: QRSignOutcome) => {
      if (finished) return;
      finished = true;
      clearSessionTimeout();
      handleClose(outcome);
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
        finish({
          type: 'failed_before_submit',
          reason: 'QR sign session disposed.',
        });
      }
    };

    cleanupSessionRef.current = cleanupSession;

    sessionTimeout = setTimeout(() => {
      routeQRSignHostBoundaryFailure({
        runnerCancel: cancelSessionRef.current,
        failBeforeRunner: handleFailure,
        reason: 'QR sign session timed out.',
      });
    }, DEFAULT_PROTOCOL_MESSAGE_TTL_MS);

    (async () => {
      try {
        // Load ICE config if URL is present; otherwise fallback to default
        const conf = option?.iceConfigUrl
          ? ((await loadIceConfig(option.iceConfigUrl)) ?? DEFAULT_ICE_CONF)
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

          const runner = startSignHostRunner({
            sessionId,
            network,
            transport: createPeerDataConnectionTransport(connection),
            transaction,
            sponsoredUrl,
            onEvent,
            onFinish: (outcome) => {
              onEvent({
                variant:
                  outcome.type === 'signed_and_finalized'
                    ? 'success'
                    : outcome.type === 'failed_before_submit'
                      ? 'error'
                      : 'warning',
                message: formatSignHostOutcome(outcome),
              });
              finish(outcome);
            },
          });
          cancelSessionRef.current = runner.cancel;
          activeRunnerDispose = runner.dispose;
        });

        peer.on('error', (err) => {
          routeQRSignHostBoundaryFailure({
            runnerCancel: cancelSessionRef.current,
            failBeforeRunner: handleFailure,
            reason: `Peer error: ${err.message}`,
          });
        });
      } catch (err) {
        if (!cancelled) handleFailure(`Peer init error: ${String(err)}`);
      }
    })();

    return () => {
      cleanupSessionRef.current = undefined;
      cleanupSession();
    };
  }, [
    handleClose,
    handleFailure,
    network,
    onEvent,
    option?.iceConfigUrl,
    peerIdHyphen,
    sessionId,
    sponsoredUrl,
    transaction,
  ]);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} />
        <DlgContentQR mode={mode} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <DlgTitle mode={mode}>{option.title}</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => {
                routeQRSignHostBoundaryFailure({
                  runnerCancel: cancelSessionRef.current,
                  failBeforeRunner: handleFailure,
                  reason: 'User closed',
                });
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
            {peerReady ? option.description : 'Preparing secure connection...'}
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
