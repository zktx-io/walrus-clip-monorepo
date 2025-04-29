export type Network = 'testnet';

export const Aggregator: { [key in Network]: string } = {
  testnet: 'https://aggregator.walrus-testnet.walrus.space/v1',
};

export const PackageId =
  // '0x3c4e5884ce9e00f0daab7213a5366edaa0984555bb3478ba7087ace37859224a';
  '0x4cb081457b1e098d566a277f605ba48410e26e66eaab5b3be4f6c560e9501800';
