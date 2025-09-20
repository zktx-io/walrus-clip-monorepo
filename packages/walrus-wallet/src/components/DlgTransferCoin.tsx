import React, { useEffect, useState } from 'react';

import { Transaction } from '@mysten/sui/transactions';
import { QRAddressScan } from '@zktx.io/walrus-connect';
import { X } from 'lucide-react';

import {
  FormCoinSelect,
  FormField,
  FormInput,
  FormInputButton,
  FormInputWithButton,
  FormLabel,
  FormMessage,
  FormRoot,
} from './form';
import {
  DlgButton,
  DlgButtonIcon,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';
import { NotiVariant } from '../utils/types';
import { isSuiAddress } from '../utils/utils';
import { FloatCoinBalance } from '../utils/walletStandard';

export const DlgTransferCoin = ({
  open,
  onClose,
  onEvent,
}: {
  open?: { address?: string; coin?: FloatCoinBalance };
  onClose: (isBack: boolean) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const { mode, wallet } = useWalletState();
  const [loading, setLoading] = useState<boolean>(true);
  const [coins, setCoins] = useState<FloatCoinBalance[]>([]);
  const [selectCoin, setSelectCoin] = useState<FloatCoinBalance | undefined>(
    undefined,
  );
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const getRecipientError = (value: string) => {
    if (!value) return '';
    return isSuiAddress(value) ? '' : 'Invalid Sui address';
  };
  const getAmountError = (value: string, coin?: FloatCoinBalance) => {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return 'Invalid amount';
    if (!coin) return '';
    const balanceInDecimals =
      parseFloat(coin.balance) / Math.pow(10, coin.decimals);
    if (num > balanceInDecimals) return 'Insufficient balance';
    return '';
  };
  const recomputeError = (r: string, a: string, coin?: FloatCoinBalance) => {
    const rErr = getRecipientError(r);
    const aErr = getAmountError(a, coin);
    setErrorMsg(rErr || aErr);
  };

  const handleCoinChange = (coinType: string) => {
    const coin = coins?.find((t) => t.coinType === coinType);
    if (coin) {
      setSelectCoin(coin);
      recomputeError(recipient, amount, coin);
    }
  };

  const setMaxAmount = () => {
    if (selectCoin) {
      const balanceInDecimals =
        parseFloat(selectCoin.balance) / Math.pow(10, selectCoin.decimals);
      const v = balanceInDecimals.toString();
      setAmount(v);
      recomputeError(recipient, v, selectCoin);
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    recomputeError(recipient, value, selectCoin);
  };

  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    recomputeError(value, amount, selectCoin);
  };

  const handleTransfer = async () => {
    if (errorMsg) return;

    if (wallet && wallet.address && selectCoin && amount) {
      setLoading(true);
      try {
        const coinsList = await wallet.getCoins(selectCoin.coinType);

        const decimalToBigInt = (val: string, decimals: number): bigint => {
          const [i, f = ''] = val.trim().split('.');
          const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
          return BigInt((i || '0') + frac.padStart(decimals, '0'));
        };

        const transferAmount = decimalToBigInt(amount, selectCoin.decimals);
        const tx = new Transaction();

        let total = BigInt(0);
        for (const item of coinsList) total += BigInt(item.balance);

        if (coinsList.length === 0 || total < transferAmount) {
          setLoading(false);
          onEvent({ variant: 'error', message: 'Insufficient balance' });
          return;
        }

        if (selectCoin.coinType === '0x2::sui::SUI') {
          const MIN_GAS = BigInt(10n ** BigInt(selectCoin.decimals)) / 100n; // 0.01
          tx.setGasPayment([
            {
              objectId: coinsList[0].coinObjectId,
              version: coinsList[0].version,
              digest: coinsList[0].digest,
            },
          ]);
          if (coinsList.length > 1) {
            tx.mergeCoins(
              tx.gas,
              coinsList.slice(1).map((c) => tx.object(c.coinObjectId)),
            );
          }
          if (transferAmount + MIN_GAS >= total) {
            const [sendCoin] = tx.splitCoins(tx.gas, [total - MIN_GAS]);
            tx.transferObjects([sendCoin], recipient);
          } else {
            const [transferCoin] = tx.splitCoins(tx.gas, [transferAmount]);
            tx.transferObjects([transferCoin], recipient);
          }
        } else {
          const destination = tx.object(coinsList[0].coinObjectId);
          if (coinsList.length > 1) {
            tx.mergeCoins(
              destination,
              coinsList.slice(1).map((c) => tx.object(c.coinObjectId)),
            );
          }
          if (total === transferAmount) {
            tx.transferObjects([destination], recipient);
          } else {
            const [transferCoin] = tx.splitCoins(destination, [transferAmount]);
            tx.transferObjects([transferCoin], recipient);
          }
        }

        await wallet.signAndExecuteTransaction(tx);
        onEvent({ variant: 'success', message: 'Transfer successful' });
      } catch (error) {
        onEvent({ variant: 'error', message: `${error}` });
      } finally {
        setLoading(false);
        onClose(false);
      }
    }
  };

  useEffect(() => {
    const update = async () => {
      if (open && wallet) {
        setLoading(true);
        setRecipient('');
        setAmount('');
        setErrorMsg('');
        const allBalances = await wallet.getAllBalances();
        if (allBalances !== undefined) {
          setCoins(allBalances);
          if (open?.coin) {
            setSelectCoin(open.coin);
          } else {
            allBalances.length && setSelectCoin(allBalances[0]);
          }
        }
        setLoading(false);
      }
    };
    if (open?.address) {
      setRecipient(open.address);
      setTimeout(() => recomputeError(open.address!, amount, selectCoin), 0);
    }
    update();
  }, [open, wallet]); // eslint-disable-line

  const isSendDisabled = !!errorMsg || !amount || !recipient || loading;

  return (
    <DlgRoot open={!!open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContent mode={mode}>
          <div className="transfer-header">
            <DlgTitle mode={mode}>Transfer Coins</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => onClose(true)}
              aria-label="Close"
            >
              <X />
            </DlgButtonIcon>
          </div>

          <DlgDescription mode={mode}>
            Please select the coin you want to send, enter the amount and the
            recipient address.
          </DlgDescription>

          <FormRoot>
            <FormField name="Select Coin">
              <FormLabel mode={mode}>Select Coin</FormLabel>
              <FormCoinSelect
                mode={mode}
                disabled={loading || !!open?.coin}
                value={selectCoin?.coinType}
                onChange={(e) => handleCoinChange(e.target.value)}
                aria-label="Select coin"
              >
                {coins?.map((coin) => (
                  <option key={coin.coinType} value={coin.coinType}>
                    {`${coin.symbol} (${coin.name})`}
                  </option>
                ))}
              </FormCoinSelect>
            </FormField>
          </FormRoot>

          <FormRoot>
            <FormField name="Recipient Address">
              <FormLabel mode={mode}>Recipient Address</FormLabel>
              <FormInputWithButton mode={mode}>
                <FormInput
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  mode={mode}
                  disabled={loading || !!open?.address}
                  placeholder="Enter recipient address"
                  value={recipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="transfer-input-grow"
                  aria-label="Recipient address"
                />
                <QRAddressScan
                  mode={mode}
                  onClose={(addr) => {
                    setRecipient(addr);
                    recomputeError(addr, amount, selectCoin);
                  }}
                />
              </FormInputWithButton>
            </FormField>
          </FormRoot>

          <FormRoot>
            <FormField name="Amount to send">
              <FormLabel mode={mode}>Amount to send</FormLabel>
              <FormInputWithButton mode={mode}>
                <FormInput
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  mode={mode}
                  disabled={loading}
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  className="transfer-input-grow"
                  aria-label="Amount to send"
                />
                <FormInputButton
                  mode={mode}
                  onClick={(e) => {
                    e.preventDefault();
                    setMaxAmount();
                  }}
                >
                  Max
                </FormInputButton>
              </FormInputWithButton>
              <FormMessage mode={mode} error={false}>
                {`Balance: ${selectCoin?.fBalance ?? '0'} ${selectCoin?.symbol ?? ''}`}
              </FormMessage>
            </FormField>
          </FormRoot>

          <div className="transfer-actions">
            <div
              className="transfer-error"
              data-mode={mode}
              role="alert"
              aria-live="polite"
            >
              {errorMsg}
            </div>

            <DlgButton
              mode={mode}
              disabled={isSendDisabled}
              onClick={handleTransfer}
            >
              Send
            </DlgButton>
          </div>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
