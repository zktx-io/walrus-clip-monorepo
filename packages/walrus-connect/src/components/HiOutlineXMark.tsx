// https://github.com/tailwindlabs/heroicons/blob/master/src/24/outline/x-mark.svg

import React from 'react';

interface HiOutlineXMarkProps extends React.SVGProps<SVGSVGElement> {}

export const HiOutlineXMark: React.FC<HiOutlineXMarkProps> = ({
  className,
  ...props
}) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 18L18 6M6 6L18 18"
        stroke="#0F172A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
