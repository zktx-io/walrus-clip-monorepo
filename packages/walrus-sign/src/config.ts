export type Network = 'testnet';

export const Publisher: { [key in Network]: string } = {
  testnet: 'https://publisher.walrus-testnet.walrus.space/v1',
};

export const Aggregator: { [key in Network]: string } = {
  testnet: 'https://aggregator.walrus-testnet.walrus.space/v1',
};

export const CONTRACT = {
  testnet: '0x883b27de942203191726d6722dc097b6d5499234be2aa22c3872849c45fdd712',
};
