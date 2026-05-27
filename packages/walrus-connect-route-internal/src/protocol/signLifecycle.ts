import type { ProtocolEnvelope } from '../utils/message';
import type {
  PendingPersonalMessage,
  PendingSignTransaction,
} from '../utils/signProtocol';

export type QRSignResult = {
  bytes: string;
  signature: string;
  digest: string;
  effects: string;
};

export type QRSignOutcome =
  | { type: 'failed_before_submit'; reason: string }
  | {
      type: 'signed';
      bytes: string;
      signature: string;
    }
  | {
      type: 'personal_message_signed';
      bytes: string;
      signature: string;
    }
  | {
      type: 'execute_result_unknown';
      bytes: string;
      signature: string;
      digest?: string;
      reason: string;
    }
  | {
      type: 'submitted_delivery_failed';
      bytes: string;
      signature: string;
      digest: string;
      reason: string;
    }
  | {
      type: 'submitted_finality_unknown';
      bytes: string;
      signature: string;
      digest: string;
      reason: string;
    }
  | {
      type: 'finalized_delivery_failed';
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
      reason: string;
    }
  | {
      type: 'signed_and_finalized';
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
    };

export type SignProtocolPhaseState =
  | 'awaiting_address'
  | 'building_transaction'
  | 'awaiting_signature'
  | 'awaiting_personal_message_signature'
  | 'verifying_signature'
  | 'executing'
  | 'awaiting_submitted_ack'
  | 'awaiting_finality'
  | 'awaiting_finalized_ack'
  | 'terminal';

export type SignChainFact =
  | { type: 'no_submit' }
  | { type: 'signed'; bytes: string; signature: string }
  | { type: 'personal_message_signed'; bytes: string; signature: string }
  | { type: 'execute_in_flight'; bytes: string; signature: string }
  | { type: 'execute_unknown'; bytes: string; signature: string; reason: string }
  | {
      type: 'digest_known';
      bytes: string;
      signature: string;
      digest: string;
    }
  | {
      type: 'finality_unknown';
      bytes: string;
      signature: string;
      digest: string;
      reason: string;
    }
  | {
      type: 'finality_known';
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
    };

export type SignDeliveryFact =
  | { type: 'open' }
  | { type: 'submitted_ack_pending'; digest: string }
  | { type: 'finalized_ack_pending'; digest: string }
  | { type: 'closed'; reason: string }
  | { type: 'timeout'; reason: string };

export type SignPublicSettlement =
  | { type: 'unresolved' }
  | { type: 'settled'; outcome: QRSignOutcome };

export type SignHostLifecycleState =
  | {
      type: 'awaiting_address';
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'building_transaction';
      signerAddress: string;
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'awaiting_signature';
      pending: PendingSignTransaction;
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'awaiting_personal_message_signature';
      pending: PendingPersonalMessage;
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'verifying_signature';
      pending: PendingSignTransaction | PendingPersonalMessage;
      signature: string;
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'executing';
      pending: PendingSignTransaction;
      signature: string;
      chain: Extract<SignChainFact, { type: 'execute_in_flight' }>;
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'awaiting_submitted_ack';
      pending: PendingSignTransaction;
      signature: string;
      digest: string;
      chain: Extract<SignChainFact, { type: 'digest_known' }>;
      delivery: Extract<SignDeliveryFact, { type: 'submitted_ack_pending' }>;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'awaiting_finality';
      pending: PendingSignTransaction;
      signature: string;
      digest: string;
      chain: Extract<SignChainFact, { type: 'digest_known' }>;
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'awaiting_finalized_ack';
      pending: PendingSignTransaction;
      signature: string;
      digest: string;
      effects: string;
      chain: Extract<SignChainFact, { type: 'finality_known' }>;
      delivery: Extract<SignDeliveryFact, { type: 'finalized_ack_pending' }>;
      publicSettlement: { type: 'unresolved' };
    }
  | {
      type: 'terminal';
      chain: SignChainFact;
      delivery: SignDeliveryFact;
      publicSettlement: { type: 'settled'; outcome: QRSignOutcome };
    };

export type SignScannerLifecycleState =
  | {
      type: 'sending_address';
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
    }
  | {
      type: 'awaiting_transaction';
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
    }
  | {
      type:
        | 'validating_transaction'
        | 'reviewing_transaction'
        | 'signing'
        | 'signing_personal_message';
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
    }
  | {
      type: 'awaiting_submitted';
      chain: { type: 'no_submit' };
      delivery: SignDeliveryFact;
    }
  | {
      type: 'awaiting_finalized';
      digest: string;
      chain: Extract<SignChainFact, { type: 'digest_known' }>;
      delivery: SignDeliveryFact;
    }
  | {
      type: 'terminal';
      chain: SignChainFact;
      delivery: SignDeliveryFact;
      remoteTerminal?: ProtocolEnvelope<'protocol.error'>;
    };

export const initialSignHostLifecycleState =
  (): SignHostLifecycleState => ({
    type: 'awaiting_address',
    chain: { type: 'no_submit' },
    delivery: { type: 'open' },
    publicSettlement: { type: 'unresolved' },
  });

export const initialSignScannerLifecycleState =
  (): SignScannerLifecycleState => ({
    type: 'sending_address',
    chain: { type: 'no_submit' },
    delivery: { type: 'open' },
  });

export const createSignHostFailureOutcome = (
  state: SignHostLifecycleState,
  reason: string,
): QRSignOutcome | undefined => {
  switch (state.type) {
    case 'awaiting_address':
    case 'building_transaction':
    case 'awaiting_signature':
    case 'awaiting_personal_message_signature':
    case 'verifying_signature':
      return { type: 'failed_before_submit', reason };
    case 'executing':
      return {
        type: 'execute_result_unknown',
        bytes: state.pending.bytes,
        signature: state.signature,
        reason,
      };
    case 'awaiting_submitted_ack':
      return {
        type: 'submitted_delivery_failed',
        bytes: state.pending.bytes,
        signature: state.signature,
        digest: state.digest,
        reason,
      };
    case 'awaiting_finality':
      return {
        type: 'submitted_finality_unknown',
        bytes: state.pending.bytes,
        signature: state.signature,
        digest: state.digest,
        reason,
      };
    case 'awaiting_finalized_ack':
      return {
        type: 'finalized_delivery_failed',
        bytes: state.pending.bytes,
        signature: state.signature,
        digest: state.digest,
        effects: state.effects,
        reason,
      };
    case 'terminal':
      return state.publicSettlement.outcome;
  }
};

export const signOutcomeToResult = (
  outcome: QRSignOutcome,
): QRSignResult | undefined =>
  outcome.type === 'signed_and_finalized'
    ? {
        bytes: outcome.bytes,
        signature: outcome.signature,
        digest: outcome.digest,
        effects: outcome.effects,
      }
    : undefined;

export const formatQRSignOutcome = (outcome: QRSignOutcome): string => {
  if (outcome.type === 'failed_before_submit') return outcome.reason;
  if (outcome.type === 'signed') return 'Transaction signed';
  if (outcome.type === 'personal_message_signed') return 'Personal message signed';
  if (outcome.type === 'execute_result_unknown') {
    return outcome.digest
      ? `${outcome.reason} Digest: ${outcome.digest}`
      : outcome.reason;
  }
  if (outcome.type === 'signed_and_finalized') return 'Transaction executed';
  return `${outcome.reason} Digest: ${outcome.digest}`;
};

export class QRSignOutcomeError extends Error {
  readonly outcome: QRSignOutcome;

  constructor(outcome: QRSignOutcome) {
    super(formatQRSignOutcome(outcome));
    this.name = 'QRSignOutcomeError';
    this.outcome = outcome;
  }
}
