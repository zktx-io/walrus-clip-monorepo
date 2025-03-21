import React, { useEffect, useState } from 'react';

import { Transaction } from '@mysten/sui/transactions';
import { QRAddressScan } from '@zktx.io/walrus-connect';
import { HiOutlineXMark } from 'react-icons/hi2';

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
  const [error, setError] = useState('');

  const handleCoinChange = (coinType: string) => {
    const coin = coins?.find((t) => t.coinType === coinType);
    if (coin) {
      setSelectCoin(coin);
      setAmount('');
      setError('');
    }
  };

  const setMaxAmount = () => {
    if (selectCoin) {
      const balanceInDecimals =
        parseFloat(selectCoin.balance) / Math.pow(10, selectCoin.decimals);
      setAmount(balanceInDecimals.toString());
      setError('');
    }
  };

  const handleAmountChange = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      setAmount('');
      setError('Invalid amount');
      return;
    }

    if (selectCoin) {
      const balanceInDecimals =
        parseFloat(selectCoin.balance) / Math.pow(10, selectCoin.decimals);

      if (num > balanceInDecimals) {
        setAmount(value);
        setError('Insufficient balance');
      } else {
        setAmount(value);
        setError('');
      }
    }
  };

  const handleTransfer = async () => {
    if (wallet && wallet.address && selectCoin && amount) {
      setLoading(true);
      try {
        const coins = await wallet.getCoins(selectCoin.coinType);
        const transferAmount = BigInt(
          parseFloat(amount) * Math.pow(10, selectCoin.decimals),
        );
        const tx = new Transaction();
        let total = BigInt(0);
        for (const item of coins) {
          const coinBalance = BigInt(item.balance);
          total += coinBalance;
        }

        if (coins.length === 0 || total < transferAmount) {
          setLoading(false);
          onEvent({
            variant: 'error',
            message: 'Insufficient balance',
          });
          return;
        }

        if (selectCoin.coinType === '0x2::sui::SUI') {
          if (transferAmount === total) {
            tx.transferObjects([tx.gas], recipient);
          } else {
            tx.setGasPayment([
              {
                objectId: coins[0].coinObjectId,
                version: coins[0].version,
                digest: coins[0].digest,
              },
            ]);
            if (coins.length > 1) {
              tx.mergeCoins(
                tx.gas,
                coins.slice(1).map((coin) => tx.object(coin.coinObjectId)),
              );
            }
            const [transferCoin] = tx.splitCoins(tx.gas, [transferAmount]);
            tx.transferObjects([transferCoin], recipient);
          }
        } else {
          const destination = tx.object(coins[0].coinObjectId);
          if (coins.length > 1) {
            tx.mergeCoins(
              destination,
              coins.slice(1).map((coin) => tx.object(coin.coinObjectId)),
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
        onEvent({
          variant: 'success',
          message: 'Transfer successful',
        });
      } catch (error) {
        onEvent({
          variant: 'error',
          message: `${error}`,
        });
      } finally {
        setLoading(true);
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
        setError('');
        const allBalances = await wallet.getAllBalances();
        if (allBalances !== undefined) {
          setCoins(allBalances);
          if (open.coin) {
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
    }
    update();
  }, [open, wallet]);

  return (
    <DlgRoot open={!!open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContent
          mode={mode}
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
            <DlgTitle mode={mode}>Transfer Coins</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
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
                  onChange={(e) => {
                    setRecipient(e.target.value);
                  }}
                  style={{ flexGrow: 1, border: 'none' }}
                />
                <QRAddressScan mode={mode} onClose={setRecipient} />
              </FormInputWithButton>
            </FormField>
          </FormRoot>

          <FormRoot>
            <FormField name="Amount to send">
              <FormLabel mode={mode}>Amount to send</FormLabel>
              <FormInputWithButton mode={mode}>
                <FormInput
                  type="number"
                  mode={mode}
                  disabled={loading}
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  style={{ flexGrow: 1, border: 'none' }}
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
              <FormMessage mode={mode} error={!!error}>
                {error
                  ? error
                  : `Balance: ${selectCoin?.fBalance} ${selectCoin?.symbol}`}
              </FormMessage>
            </FormField>
          </FormRoot>

          <div
            style={{
              display: 'flex',
              marginTop: 16,
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <DlgButton
              mode={mode}
              disabled={!!error || !amount || !recipient || loading}
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
