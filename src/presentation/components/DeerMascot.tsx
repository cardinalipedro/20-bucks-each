interface DeerMascotProps {
  size?: number;
}

/** The 20 Bucks Each mascot: an angry buck with a $20 bill in its antlers. */
export function DeerMascot({ size = 48 }: DeerMascotProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="#D9C29A" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 44 C40 30 32 22 22 12 M35 27 L20 29 M30 19 L33 6" />
        <path d="M74 44 C80 30 88 22 98 12 M85 27 L100 29 M90 19 L87 6" />
      </g>
      <rect x="41" y="2" width="38" height="18" rx="2" fill="#35D07F" stroke="#0F3A26" strokeWidth="2" />
      <text x="60" y="15.5" fontSize="11" fontWeight="900" fill="#0A120E" textAnchor="middle" fontFamily="sans-serif">
        $20
      </text>
      <ellipse cx="25" cy="58" rx="15" ry="7" transform="rotate(-22 25 58)" fill="#8A5A34" />
      <ellipse cx="25" cy="58" rx="9" ry="3.5" transform="rotate(-22 25 58)" fill="#E8C7A0" />
      <ellipse cx="95" cy="58" rx="15" ry="7" transform="rotate(22 95 58)" fill="#8A5A34" />
      <ellipse cx="95" cy="58" rx="9" ry="3.5" transform="rotate(22 95 58)" fill="#E8C7A0" />
      <ellipse cx="60" cy="66" rx="29" ry="27" fill="#9A6A3E" />
      <ellipse cx="60" cy="94" rx="19" ry="17" fill="#C89B6D" />
      <path d="M33 54 Q60 44 87 54 L86 64 Q60 54 34 64 Z" fill="#35D07F" />
      <text x="60" y="61" fontSize="10" fontWeight="900" fill="#0A120E" textAnchor="middle" fontFamily="sans-serif">
        $
      </text>
      <path d="M37 67 L56 73 L55 77 L36 71 Z" fill="#3A2412" />
      <path d="M83 67 L64 73 L65 77 L84 71 Z" fill="#3A2412" />
      <ellipse cx="47" cy="79" rx="5.5" ry="3.6" fill="#FFFFFF" />
      <circle cx="49" cy="80" r="2.4" fill="#111111" />
      <ellipse cx="73" cy="79" rx="5.5" ry="3.6" fill="#FFFFFF" />
      <circle cx="71" cy="80" r="2.4" fill="#111111" />
      <ellipse cx="60" cy="97" rx="8" ry="5.5" fill="#1B110A" />
      <path d="M51 107 Q60 101 69 107" stroke="#1B110A" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
