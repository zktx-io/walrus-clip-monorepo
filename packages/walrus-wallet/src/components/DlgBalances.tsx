import { useEffect, useState } from 'react';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from '@zktx.io/walrus-connect';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { useWalletState } from '../recoil';
import { FloatCoinBalance } from '../utils/walletStandard';

export const DlgBalances = ({
  open,
  onClose,
  openTransfer,
}: {
  open: boolean;
  onClose: (isBack: boolean) => void;
  openTransfer: (option: { address?: string; coin?: FloatCoinBalance }) => void;
}) => {
  const { mode, wallet } = useWalletState();
  const [coins, setCoins] = useState<FloatCoinBalance[]>([]);
  // eslint-disable-next-line no-restricted-syntax
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  function formatNumberFromString(value: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }

  const toggleLockedBalances = (index: number) => {
    // eslint-disable-next-line no-restricted-syntax
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  useEffect(() => {
    const update = async () => {
      if (open && wallet) {
        setLoading(true);
        // eslint-disable-next-line no-restricted-syntax
        setExpandedIndex(null);
        const allBalances = await wallet.getAllBalances();
        if (allBalances !== undefined) setCoins(allBalances);
        setLoading(false);
      }
    };
    update();
  }, [open, wallet]);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContentBottom mode={mode}>
          <div className="balances-header">
            <DlgTitle mode={mode}>Balances</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <X />
            </DlgButtonIcon>
          </div>

          <div className="balances-list">
            {loading && coins.length === 0 ? (
              <div className="balances-loading">Loading...</div>
            ) : (
              coins.map((balance, index) => {
                const hasLockedBalances =
                  Object.keys(balance.lockedBalance).length > 0;

                return (
                  <div
                    key={balance.coinType ?? `coin-${index}`}
                    className="balances-coin-item"
                    onClick={() => openTransfer({ coin: balance })}
                  >
                    <div
                      className="balances-coin-header"
                      onClick={(e) => {
                        if (hasLockedBalances) {
                          e.stopPropagation();
                          toggleLockedBalances(index);
                        }
                      }}
                    >
                      <div className="balances-coin-left">
                        <div className="balances-coin-title">
                          {balance.symbol}
                        </div>
                        <div className="balances-coin-subtitle">
                          {balance.name}
                        </div>
                      </div>
                      <div className="balances-coin-right">
                        <span>{formatNumberFromString(balance.fBalance)}</span>
                        {hasLockedBalances ? (
                          expandedIndex === index ? (
                            <ChevronUp />
                          ) : (
                            <ChevronDown />
                          )
                        ) : (
                          <ChevronDown className="balances-chevron-disabled" />
                        )}
                      </div>
                    </div>

                    <div
                      className={`balances-locked-list ${
                        expandedIndex === index ? 'expanded' : ''
                      }`}
                    >
                      {Object.entries(balance.lockedBalance).map(
                        ([lockType, { fBalance }]) => (
                          <div key={lockType} className="balances-locked-row">
                            <span>{lockType}</span>
                            <span>{formatNumberFromString(fBalance)}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
