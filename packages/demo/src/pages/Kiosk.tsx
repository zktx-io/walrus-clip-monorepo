import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Transaction } from '@mysten/sui/transactions';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';

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
  const [orderedItems, setOrderedItems] = useState<Item[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
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

      setTxDigest(txResult[0].digest);
      setOrderedItems(cart); // 결제 완료 후 주문 내역 저장
      setIsModalOpen(true);
      setCart([]);
    } catch (error) {
      alert(`Payment failed: ${error}`);
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold text-black mb-4">McDonald's Kiosk</h1>
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
            <span className="text-black">{item.name}</span>
            <span className="text-gray-600">
              {item.price.toLocaleString()} KRW
            </span>
          </button>
        ))}
      </div>
      <div className="w-full max-w-md p-4 border rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-black">Cart</h2>
        {cart.length === 0 ? (
          <p className="text-gray-600">Your cart is empty.</p>
        ) : (
          <ul>
            {cart.map((item, index) => (
              <li
                key={index}
                className="flex justify-between items-center text-black"
              >
                <span>
                  {item.name} -{' '}
                  <span className="text-gray-600">
                    {item.price.toLocaleString()} KRW
                  </span>
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
        <p className="font-bold mt-2 text-black">
          Total:{' '}
          <span className="text-gray-600">
            {getTotalPrice().toLocaleString()} KRW
          </span>
        </p>
        <button
          disabled={cart.length === 0}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-white hover:text-black transition-all duration-300 disabled:bg-gray-300 cursor-pointer"
          onClick={onShowPay}
        >
          Checkout
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{
              backgroundColor: '#00000099',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md"
            >
              <h2 className="text-xl font-bold text-black mb-4">
                Payment Successful!
              </h2>
              <p className="text-black">Transaction ID:</p>
              <p className="text-sm break-all text-gray-600 mb-4">{txDigest}</p>
              <h3 className="text-lg font-semibold text-black mb-2">
                Your Order
              </h3>
              <ul className="text-left mb-4">
                {orderedItems.map((item, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center border-b py-2 text-black"
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-600">
                      {item.price.toLocaleString()} KRW
                    </span>
                  </li>
                ))}
              </ul>
              <p className="font-bold text-lg text-black">
                Total:{' '}
                <span className="text-gray-600">
                  {orderedItems
                    .reduce((acc, item) => acc + item.price, 0)
                    .toLocaleString()}{' '}
                  KRW
                </span>
              </p>
              <button
                className="mt-4 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
