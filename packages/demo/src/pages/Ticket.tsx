import React from 'react';

const tickets = [
  {
    id: 1,
    name: 'Sui Presents Walrus',
    location: 'Denver, Colorado',
    date: 'Wednesday, February 26',
    price: '$-',
    image: '/ticket/sui-presents-walrus.avif',
  },
  {
    id: 2,
    name: 'Gaming Summit',
    location: 'San Francisco, CA',
    date: 'Tuesday, March 18',
    price: '$-',
    image: '/ticket/sui-gaming-summit.jpg',
  },
  {
    id: 3,
    name: 'Sui Basecamp',
    location: 'Dubai, UAE',
    date: 'May 1 and 2',
    price: '$99',
    image: '/ticket/sui-basecamp-2025.jpg',
  },
];

export const Ticket = () => {
  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Event Ticket 2025</h1>
      <div className="w-full max-w-7xl space-y-6 px-4">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="flex bg-gray-900 text-white p-6 rounded-xl items-center w-full max-w-5xl mx-auto transition-all duration-300 hover:bg-gray-700 hover:shadow-lg"
          >
            <div className="w-40 h-40 flex-shrink-0 rounded overflow-hidden transform transition-transform duration-300 hover:scale-105">
              <img
                src={ticket.image}
                alt={ticket.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 flex flex-col justify-between ml-8">
              <div>
                <h2 className="text-3xl font-bold">{ticket.name}</h2>
                <p className="text-lg text-gray-400">{ticket.location}</p>
                <p className="text-lg text-gray-400">{ticket.date}</p>
                <p className="text-xl font-semibold mt-2">{ticket.price}</p>
              </div>
              <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded cursor-pointer">
                Register
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
