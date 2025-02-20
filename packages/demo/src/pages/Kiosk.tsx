import { useState } from 'react';

import { Transaction } from '@mysten/sui/transactions';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';

interface Item {
  id: number;
  name: string;
  price: number;
  image: string;
}

const menuItems: Item[] = [
  { id: 1, name: 'Big Mac', price: 5000, image: '/items/mac-1.jpeg' },
  { id: 2, name: 'McNuggets (6pcs)', price: 3000, image: '/items/mac-2.jpeg' },
  { id: 3, name: 'Fries (Large)', price: 2500, image: '/items/mac-3.jpeg' },
  { id: 4, name: 'Coke (Medium)', price: 2000, image: '/items/mac-4.jpeg' },
];

export const Kiosk = () => {
  const [cart, setCart] = useState<Item[]>([]);
  const { pay } = useWalrusWallet();

  const addToCart = (item: Item) => {
    setCart((prev) => [...prev, item]);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const getTotalPrice = () => {
    return cart.reduce((acc, item) => acc + item.price, 0);
  };

  const onShowPay = async () => {
    try {
      const transaction = new Transaction();
      transaction.moveCall({
        target:
          '0x06314af232888760ff6eb65d6acd0e9307546f89e30d8000d162bc3ae21bf639::counter::increment',
        arguments: [
          transaction.object(
            '0xd69afff191858d4dae9cfc7ed166306f9ca90e534833352f67b02abf8e6418be',
          ),
        ],
      });
      const txResult = await pay('Pay', 'Please scan the QR code to pay.', {
        transactions: [transaction],
        isSponsored: true,
      });
      enqueueSnackbar(txResult[0].digest, {
        variant: 'success',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
      setCart([]);
    } catch (error) {
      enqueueSnackbar(`${error}`, {
        variant: 'error',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">McDonald's Kiosk</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="pb-4 border rounded-lg shadow-md hover:bg-white hover:text-black flex flex-col items-center transition-all duration-300 overflow-hidden cursor-pointer"
            onClick={() => addToCart(item)}
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-[829px] object-contain mb-4 transform transition-transform duration-300 hover:scale-105"
            />
            <span>{item.name}</span>
            <span>{item.price.toLocaleString()} KRW</span>
          </button>
        ))}
      </div>
      <div className="w-full max-w-md p-4 border rounded-lg shadow-md">
        <h2 className="text-xl font-bold">Cart</h2>
        {cart.length === 0 ? (
          <p className="text-gray-500">Your cart is empty.</p>
        ) : (
          <ul>
            {cart.map((item, index) => (
              <li key={index} className="flex justify-between items-center">
                <span>
                  {item.name} - {item.price.toLocaleString()} KRW
                </span>
                <button
                  className="ml-2 px-2 py-1 cursor-pointer border border-transparent transition-all duration-300 hover:border-red-500 hover:bg-transparent hover:text-red-500"
                  onClick={() => removeFromCart(index)}
                >
                  ❌
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="font-bold mt-2">
          Total: {getTotalPrice().toLocaleString()} KRW
        </p>
        <button
          disabled={cart.length === 0}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-white hover:text-black transition-all duration-300 disabled:bg-gray-300 cursor-pointer"
          onClick={onShowPay}
        >
          Checkout
        </button>
      </div>
    </div>
  );
};
