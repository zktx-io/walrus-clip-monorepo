import React from 'react';

import {
  KioskClient,
  KioskData,
  KioskOwnerCap,
  KioskTransaction,
  Network,
} from '@mysten/kiosk';
import {
  CoinMetadata,
  CoinStruct,
  getFullnodeUrl,
  SuiClient,
  SuiObjectData,
} from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import {
  ReadonlyWalletAccount,
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  StandardEventsListeners,
  StandardEventsOnMethod,
  SUI_CHAINS,
  SuiFeatures,
  SuiSignAndExecuteTransactionMethod,
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageMethod,
  SuiSignTransactionMethod,
  Wallet,
} from '@mysten/wallet-standard';
import { QRLogin } from '@zktx.io/walrus-scan';
import mitt, { type Emitter } from 'mitt';
import ReactDOM from 'react-dom/client';

import { createNonce } from './createNonce';
import {
  disconnect,
  getAccountData,
  setAccountData,
  setZkLoginData,
} from './localStorage';
import { IAccount, NETWORK, NotiVariant } from './types';
import { cleanup, ZkLoginSigner } from './zkLoginSigner';
import { PwCreate } from '../components/PwCreate';

type WalletEventsMap = {
  [E in keyof StandardEventsListeners]: Parameters<
    StandardEventsListeners[E]
  >[0];
};

const TIME_OUT = 300;

export interface FloatCoinBalance {
  coinType: string;
  name: string;
  symbol: string;
  decimals: number;
  fBalance: string;
  balance: string;
  lockedBalance: Record<string, { balance: string; fBalance: string }>;
}

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];

  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;

  #network: NETWORK;
  #zkLoginNonceCallback?: (nonce: string) => void;
  #epochOffset?: number;
  #onEvent: (data: { variant: NotiVariant; message: string }) => void;
  #setIsConnected: (isConnected: boolean) => void;
  #sponsoredUrl: string | undefined;
  #openSignTxModal: (
    title: string,
    description: string,
    data: {
      transaction: {
        toJSON: () => Promise<string>;
      };
      sponsoredUrl?: string;
    },
  ) => Promise<SuiSignAndExecuteTransactionOutput>;

  #account: IAccount | undefined;
  #signer: ZkLoginSigner | undefined;

  #mode: 'dark' | 'light';

  #coinMetadataCache: { [coinType: string]: CoinMetadata } = {};

  get version() {
    return this.#version;
  }

  get name() {
    return this.#name;
  }

  get icon() {
    return this.#icon;
  }

  get chains() {
    return SUI_CHAINS;
  }

  get accounts() {
    return this.#accounts;
  }

  get signer() {
    return this.#signer;
  }

  get coinMetadata() {
    return this.#coinMetadataCache;
  }

  get address() {
    return this.#account?.address;
  }

  constructor(
    name: string,
    icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`,
    network: NETWORK,
    sponsoredUrl: string,
    mode: 'dark' | 'light',
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
    setIsConnected: (isConnected: boolean) => void,
    openSignTxModal: (
      title: string,
      description: string,
      data: {
        transaction: {
          toJSON: () => Promise<string>;
        };
        sponsoredUrl?: string;
      },
    ) => Promise<SuiSignAndExecuteTransactionOutput>,
    zklogin?: {
      callbackNonce?: (nonce: string) => void;
      epochOffset?: number;
    },
  ) {
    this.#events = mitt();
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#sponsoredUrl = sponsoredUrl === '' ? undefined : sponsoredUrl;
    this.#mode = mode;
    this.#onEvent = onEvent;
    this.#setIsConnected = setIsConnected;
    this.#epochOffset = zklogin?.epochOffset;
    this.#openSignTxModal = openSignTxModal;
    this.#zkLoginNonceCallback = zklogin?.callbackNonce;
  }

  get features(): StandardConnectFeature &
    StandardDisconnectFeature &
    StandardEventsFeature &
    SuiFeatures {
    return {
      'standard:connect': {
        version: '1.0.0',
        connect: this.#connect,
      },
      'standard:events': {
        version: '1.0.0',
        on: this.#on,
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: this.#disconnect,
      },
      'sui:signTransaction': {
        version: '2.0.0',
        signTransaction: this.#signTransaction,
      },
      'sui:signAndExecuteTransaction': {
        version: '2.0.0',
        signAndExecuteTransaction: this.#signAndExecuteTransaction,
      },
      'sui:signPersonalMessage': {
        version: '1.0.0',
        signPersonalMessage: this.#signPersonalMessage,
      },
    };
  }

  #openZkLoginModal(): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <PwCreate
          mode={this.#mode}
          onClose={() => {
            cleanup(container, root);
            reject(new Error('rejected'));
          }}
          onConfirm={async (password: string) => {
            cleanup(container, root);
            const { nonce, data } = await createNonce(
              password,
              this.#network,
              this.#epochOffset,
            );
            setZkLoginData({ network: this.#network, zkLogin: data });
            resolve(nonce);
          }}
          onEvent={this.#onEvent}
        />,
      );
    });
  }

  #openQrLoginModal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <QRLogin
          mode={this.#mode}
          icon={this.#icon}
          network={this.#network}
          onEvent={this.#onEvent}
          onClose={(result) => {
            cleanup(container, root);
            if (!!result) {
              setAccountData(result);
              resolve();
            } else {
              reject(new Error('rejected'));
            }
          }}
        />,
      );
    });
  }

  #on: StandardEventsOnMethod = (event, listener) => {
    this.#events.on(event, listener);
    return () => this.#events.off(event, listener);
  };

  #connected = async () => {
    if (this.#account && this.#signer) {
      this.#setIsConnected(true);
      this.#accounts = [
        new ReadonlyWalletAccount({
          address: this.#account.address,
          publicKey: this.#signer.getPublicKey().toSuiBytes(),
          chains: [`sui:${this.#network}`],
          features: [
            'sui:signTransaction',
            'sui:signAndExecuteTransaction',
            'sui:signPersonalMessage',
          ],
        }),
      ];
    } else {
      this.#setIsConnected(false);
      this.#accounts = [];
    }
    if (this.#accounts.length) {
      this.#events.emit('change', { accounts: this.accounts });
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  };

  #connect: StandardConnectMethod = async (input) => {
    this.#account = getAccountData();
    if (!this.#account) {
      if (this.#zkLoginNonceCallback) {
        const nonce = await this.#openZkLoginModal();
        this.#zkLoginNonceCallback(nonce);
      } else {
        await this.#openQrLoginModal();
        this.#account = getAccountData();
      }
    } else if (this.#account.zkLogin) {
      this.#signer = new ZkLoginSigner(
        this.#network,
        this.#account.zkLogin,
        this.#account.address,
        this.#mode,
      );
    }
    await this.#connected();
    return { accounts: this.accounts };
  };

  #disconnect: StandardDisconnectMethod = (): Promise<void> => {
    if (this.#accounts.length > 0) {
      disconnect();
      this.#accounts = [];
      this.#account = undefined;
      this.#signer = undefined;
      this.#events.emit('change', { accounts: undefined });
    }
    return Promise.resolve();
  };

  logout = () => {
    this.#disconnect();
  };

  public signAndExecuteTransaction = async (
    transaction: Transaction,
  ): Promise<SuiSignAndExecuteTransactionOutput> => {
    return this.#signAndExecuteTransaction({
      transaction,
      chain: `sui:${this.#network}`,
      account: this.#accounts[0],
    });
  };

  #signTransaction: SuiSignTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    if (chain === `sui:${this.#network}`) {
      if (this.#signer) {
        const client = new SuiClient({
          url: getFullnodeUrl(this.#network),
        });
        const txJson = await transaction.toJSON();
        const tx = Transaction.from(txJson);
        tx.setSenderIfNotSet(this.#signer.toSuiAddress());
        const txBytes = await tx.build({
          client,
        });
        const { bytes, signature } =
          await this.#signer.signTransaction(txBytes);
        return {
          bytes,
          signature,
        };
      } else {
        const tx = await transaction.toJSON();
        const txResult = await this.#openSignTxModal(
          'Sign Transaction',
          'Please scan the QR code to sign.',
          {
            transaction: Transaction.from(tx),
            sponsoredUrl: this.#sponsoredUrl,
          },
        );
        return {
          bytes: txResult.bytes,
          signature: txResult.signature,
        };
      }
    }
    throw new Error('chain error');
  };

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    if (chain === `sui:${this.#network}`) {
      if (this.#signer) {
        const client = new SuiClient({
          url: getFullnodeUrl(this.#network),
        });
        const txJson = await transaction.toJSON();
        const tx = Transaction.from(txJson);
        tx.setSenderIfNotSet(this.#signer.toSuiAddress());
        const txBytes = await tx.build({
          client,
        });
        const { bytes, signature } =
          await this.#signer.signTransaction(txBytes);
        const { digest, errors } = await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature: signature,
        });
        if (errors) {
          throw new Error(errors.join(', '));
        }
        const { rawEffects } = await client.waitForTransaction({
          digest,
          options: {
            showRawEffects: true,
          },
        });
        return {
          digest,
          bytes,
          signature,
          effects: rawEffects ? toBase64(new Uint8Array(rawEffects)) : '',
        };
      } else {
        const tx = await transaction.toJSON();
        const txResult = await this.#openSignTxModal(
          'Sign and Execute',
          'Please scan the QR code to sign.',
          {
            transaction: Transaction.from(tx),
            sponsoredUrl: this.#sponsoredUrl,
          },
        );
        return {
          digest: txResult.digest,
          bytes: txResult.bytes,
          signature: txResult.signature,
          effects: txResult.effects,
        };
      }
    }
    throw new Error('chain error');
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async ({ message }) => {
    if (this.#signer) {
      const { signature } = await this.#signer.signPersonalMessage(message);
      return {
        bytes: toBase64(message),
        signature,
      };
    }
    throw new Error('signer error');
  };

  public getAllBalances = async (): Promise<FloatCoinBalance[] | undefined> => {
    if (this.#account) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });

      const allBalances = await client.getAllBalances({
        owner: this.#account.address,
      });

      const balances: FloatCoinBalance[] = [];

      const formatBalance = (value: string, dec: number) => {
        const formatted = (parseInt(value) / Math.pow(10, dec)).toString();
        return formatted;
      };

      for (const balance of allBalances) {
        const { coinType, totalBalance, lockedBalance } = balance;

        if (coinType !== '0x2::sui::SUI' && parseInt(totalBalance) === 0)
          continue;

        if (!this.#coinMetadataCache[coinType]) {
          try {
            const metadata = await client.getCoinMetadata({ coinType });
            if (metadata) {
              this.#coinMetadataCache[coinType] = metadata;
            }
          } catch (error) {
            continue;
          }
        }

        const metadata = this.#coinMetadataCache[coinType];
        const decimals = metadata.decimals || 0;
        const fBalance = formatBalance(totalBalance, decimals);

        const lBalance: Record<string, { balance: string; fBalance: string }> =
          {};
        Object.keys(lockedBalance).forEach((key) => {
          lBalance[key] = {
            balance: lockedBalance[key],
            fBalance: formatBalance(lockedBalance[key], decimals),
          };
        });

        balances.push({
          coinType,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals,
          fBalance,
          balance: totalBalance,
          lockedBalance: lBalance,
        });
      }

      return balances.sort((a, b) =>
        a.coinType === '0x2::sui::SUI'
          ? -1
          : b.coinType === '0x2::sui::SUI'
            ? 1
            : 0,
      );
    }

    return undefined;
  };

  public getCoins = async (coinType: string): Promise<CoinStruct[]> => {
    if (this.#account && coinType) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const coins = await client.getCoins({
        owner: this.#account.address,
        coinType,
      });
      return coins.data;
    }
    return [];
  };

  public getOwnedObjects = async (): Promise<SuiObjectData[]> => {
    if (this.#account) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const allObjects: SuiObjectData[] = [];
      let hasNextPage = true;
      let nextCursor: string | null | undefined = undefined;

      while (hasNextPage) {
        const response = await client.getOwnedObjects({
          owner: this.#account.address,
          filter: {
            MatchNone: [
              { StructType: '0x2::coin::Coin' },
              { StructType: '0x2::coin::TreasuryCap' },
            ],
          },
          options: {
            showType: true,
            showDisplay: true,
          },
          cursor: nextCursor,
          limit: 50,
        });
        allObjects.push(
          ...response.data
            .filter(
              (item) =>
                !!item.data && !!item.data.display && !!item.data.display.data,
            )
            .map((item) => item.data!),
        );
        nextCursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      }
      return [...allObjects];
    }
    return [];
  };

  public getObjects = async (ids: string[]): Promise<SuiObjectData[]> => {
    const client = new SuiClient({
      url: getFullnodeUrl(this.#network),
    });
    const response = await client.multiGetObjects({
      ids,
      options: {
        showType: true,
        showDisplay: true,
      },
    });
    return response
      .filter(
        (item) =>
          !!item.data && !!item.data.display && !!item.data.display.data,
      )
      .map((item) => item.data!);
  };

  public createKiosk = async (isPersonal: boolean) => {
    if (
      this.#account &&
      (this.#network === 'mainnet' || this.#network === 'testnet')
    ) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const kioskClient = new KioskClient({
        client,
        network: this.#network as Network,
      });

      const transaction = new Transaction();
      const kioskTx = new KioskTransaction({ transaction, kioskClient });

      if (isPersonal) {
        kioskTx.createPersonal(true).finalize();
      } else {
        kioskTx.create();
        kioskTx.shareAndTransferCap(this.#account.address);
        kioskTx.finalize();
      }

      await this.signAndExecuteTransaction(transaction);
    }
  };

  public getOwnedKiosks = async (): Promise<KioskOwnerCap[] | undefined> => {
    if (
      this.#account &&
      (this.#network === 'mainnet' || this.#network === 'testnet')
    ) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const kioskClient = new KioskClient({
        client,
        network: this.#network as Network,
      });

      let allKioskOwnerCaps: KioskOwnerCap[] = [];
      let allKioskIds: string[] = [];
      let cursor: string | undefined = undefined;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await kioskClient.getOwnedKiosks({
          address: this.#account.address,
          pagination: { cursor },
        });

        if (response) {
          allKioskOwnerCaps.push(...response.kioskOwnerCaps);
          allKioskIds.push(...response.kioskIds);
          hasNextPage = response.hasNextPage;
          cursor = response.nextCursor || undefined;
        } else {
          hasNextPage = false;
        }
      }

      return allKioskOwnerCaps;
    }
    return undefined;
  };

  public getKiosk = async (
    id: string,
  ): Promise<{ kiosk: KioskData; items: SuiObjectData[] } | undefined> => {
    if (
      this.#account &&
      (this.#network === 'mainnet' || this.#network === 'testnet')
    ) {
      try {
        const client = new SuiClient({
          url: getFullnodeUrl(this.#network),
        });
        const kioskClient = new KioskClient({
          client,
          network: this.#network as Network,
        });
        const kiosk = await kioskClient.getKiosk({
          id,
          options: {
            withKioskFields: true,
            withListingPrices: true,
            withObjects: true,
            objectOptions: {
              showType: true,
              showDisplay: true,
              showContent: true,
            },
          },
        });
        const items = await this.getObjects(kiosk.itemIds);
        return {
          kiosk,
          items,
        };
      } catch (error) {
        //
      }
    }
    return undefined;
  };

  public kioskPlace = async (
    cap: KioskOwnerCap,
    nftId: { item: string; itemType: string },
  ) => {
    if (
      this.#account &&
      (this.#network === 'mainnet' || this.#network === 'testnet')
    ) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const kioskClient = new KioskClient({
        client,
        network: this.#network as Network,
      });
      const transaction = new Transaction();
      const kioskTx = new KioskTransaction({ transaction, kioskClient, cap });
      kioskTx.place(nftId).finalize();
      await this.signAndExecuteTransaction(transaction);
    }
    return undefined;
  };

  public kiosTake = async (
    cap: KioskOwnerCap,
    nftId: { itemId: string; itemType: string },
    recipient?: string,
  ) => {
    if (
      this.#account &&
      (this.#network === 'mainnet' || this.#network === 'testnet')
    ) {
      const client = new SuiClient({
        url: getFullnodeUrl(this.#network),
      });
      const kioskClient = new KioskClient({
        client,
        network: this.#network as Network,
      });
      const transaction = new Transaction();
      const kioskTx = new KioskTransaction({ transaction, kioskClient, cap });
      const item = kioskTx.take(nftId);
      transaction.transferObjects(
        [item],
        recipient ? recipient : this.#account.address,
      );
      kioskTx.finalize();
      await this.signAndExecuteTransaction(transaction);
    }
    return undefined;
  };
}
