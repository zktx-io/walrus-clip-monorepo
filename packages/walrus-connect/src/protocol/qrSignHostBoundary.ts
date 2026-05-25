export type QRSignHostBoundaryFailureRoute =
  | 'runner_cancelled'
  | 'failed_before_runner';

export const routeQRSignHostBoundaryFailure = ({
  runnerCancel,
  failBeforeRunner,
  reason,
}: {
  runnerCancel?: (reason?: string) => void;
  failBeforeRunner: (reason: string) => void;
  reason: string;
}): QRSignHostBoundaryFailureRoute => {
  if (runnerCancel) {
    runnerCancel(reason);
    return 'runner_cancelled';
  }

  failBeforeRunner(reason);
  return 'failed_before_runner';
};
