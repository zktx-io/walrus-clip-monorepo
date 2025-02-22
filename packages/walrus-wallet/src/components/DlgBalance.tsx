import React, { useEffect, useState } from 'react';

import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineXMark,
} from 'react-icons/hi2';

import { DlgCoinTransfer } from './DlgCoinTransfer';
import {
  DlgClose,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';
import { NotiVariant } from '../utils/types';
import { FloatCoinBalance, WalletStandard } from '../utils/walletStandard';

export const DlgBalance = ({
  mode = 'light',
  wallet,
  open,
  onClose,
  onEvent,
}: {
  mode?: Mode;
  wallet?: WalletStandard;
  open: boolean;
  onClose: () => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const [coins, setCoins] = useState<FloatCoinBalance[]>([]);
  // eslint-disable-next-line no-restricted-syntax
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // eslint-disable-next-line no-restricted-syntax
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [openTransfer, setOpenTransfer] = useState<
    { address?: string; coin?: FloatCoinBalance } | undefined
  >(undefined);

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
    <>
      <DlgRoot open={open} onOpenChange={onClose}>
        <DlgPortal>
          <DlgOverlay />
          <DlgContentBottom
            mode={mode}
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
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
              <DlgClose mode={mode} onClick={onClose}>
                <HiOutlineXMark />
              </DlgClose>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginTop: '10px',
                width: '100%',
              }}
            >
              {loading
                ? Array(1)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '100%',
                          height: '48px',
                          background: '#e0e0e0',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          animation: 'pulse 1.5s infinite ease-in-out',
                        }}
                      />
                    ))
                : coins.map((balance, index) => {
                    const hasLockedBalances =
                      Object.keys(balance.lockedBalance).length > 0;

                    return (
                      <div
                        key={balance.coinType}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          marginTop: '2px',
                          paddingBottom: '2px',
                          borderBottom:
                            index === coins.length - 1
                              ? 'none'
                              : '1px solid #ccc',
                          backgroundColor:
                            hoverIndex === index ? '#f3f4f6' : 'transparent',
                          transition: 'background-color 0.2s ease-in-out',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoverIndex(index)}
                        // eslint-disable-next-line no-restricted-syntax
                        onMouseLeave={() => setHoverIndex(null)}
                        onClick={() => {
                          onClose();
                          setOpenTransfer({ coin: balance });
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
                            <span>
                              {formatNumberFromString(balance.fBalance)}
                            </span>
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
                  })}
            </div>
          </DlgContentBottom>
        </DlgPortal>
      </DlgRoot>
      <DlgCoinTransfer
        mode={mode}
        wallet={wallet}
        open={openTransfer}
        onClose={() => {
          setOpenTransfer(undefined);
        }}
        onEvent={onEvent}
      />
    </>
  );
};
