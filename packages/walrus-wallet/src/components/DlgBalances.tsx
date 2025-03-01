import React, { useEffect, useState } from 'react';

import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineXMark,
} from 'react-icons/hi2';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';
import { FloatCoinBalance, WalletStandard } from '../utils/walletStandard';

export const DlgBalances = ({
  mode = 'light',
  wallet,
  open,
  onClose,
  openTransfer,
}: {
  mode?: Mode;
  wallet?: WalletStandard;
  open: boolean;
  onClose: (isBack: boolean) => void;
  openTransfer: (option: { address?: string; coin?: FloatCoinBalance }) => void;
}) => {
  const [coins, setCoins] = useState<FloatCoinBalance[]>([]);
  // eslint-disable-next-line no-restricted-syntax
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // eslint-disable-next-line no-restricted-syntax
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  function formatNumberFromString(value: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return '0.00';
    }
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
        if (allBalances !== undefined) {
          setCoins(allBalances);
        }
        setLoading(false);
      }
    };
    update();
  }, [open, wallet]);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContentBottom
          mode={mode}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{ height: '40vh' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <DlgTitle mode={mode}>Balances</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '100%',
              height: 'calc(100% - 10px)',
              overflowY: 'auto',
            }}
          >
            {loading && coins.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  height: '150px',
                  fontSize: '16px',
                  color: '#888',
                  gridColumn: '1 / -1',
                }}
              >
                Loading...
              </div>
            ) : (
              coins.map((balance, index) => {
                const hasLockedBalances =
                  Object.keys(balance.lockedBalance).length > 0;

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '4px',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: 'black',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.3s, color 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.color = 'black';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'black';
                    }}
                    onClick={() => {
                      openTransfer({ coin: balance });
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                      }}
                      onClick={() =>
                        hasLockedBalances && toggleLockedBalances(index)
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 'bold',
                          }}
                        >
                          {balance.symbol}
                        </div>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: '#555',
                          }}
                        >
                          {balance.name}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>{formatNumberFromString(balance.fBalance)}</span>
                        {hasLockedBalances ? (
                          expandedIndex === index ? (
                            <HiOutlineChevronUp />
                          ) : (
                            <HiOutlineChevronDown />
                          )
                        ) : (
                          <HiOutlineChevronDown style={{ color: '#aaa' }} />
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        overflow: 'hidden',
                        maxHeight: expandedIndex === index ? '150px' : '0',
                        opacity: expandedIndex === index ? 1 : 0,
                        transition:
                          'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out',
                      }}
                    >
                      {Object.entries(balance.lockedBalance).map(
                        ([lockType, { fBalance }]) => (
                          <div
                            key={lockType}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              width: '100%',
                              paddingLeft: '16px',
                              fontSize: '0.9em',
                            }}
                          >
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
