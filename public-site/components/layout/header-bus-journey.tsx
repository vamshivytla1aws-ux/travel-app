export function HeaderBusJourney() {
  const passengers = [48, 65, 82, 99, 116];

  return (
    <div className="header-journey" aria-hidden="true">
      <span className="header-journey-line" />
      <span className="header-journey-terminal terminal-start" />
      <span className="header-journey-terminal terminal-end" />
      <span className="header-journey-reflection" />
      <div className="header-journey-motion">
        <div className="header-journey-direction">
          <span className="header-bus-road-beam" />
          <span className="header-bus-road-focus" />
          <div className="header-journey-scale">
            <svg className="header-bus" viewBox="0 0 164 56" focusable="false">
              <defs>
                <linearGradient id="header-bus-body" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#17273a" />
                  <stop offset="0.56" stopColor="#0b1726" />
                  <stop offset="1" stopColor="#030a12" />
                </linearGradient>
                <linearGradient id="header-bus-gold" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#8d7134" />
                  <stop offset="0.48" stopColor="#f0d98f" />
                  <stop offset="1" stopColor="#a98335" />
                </linearGradient>
                <linearGradient id="header-bus-glass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#e8c76e" stopOpacity=".3" />
                  <stop offset="1" stopColor="#51708f" stopOpacity=".12" />
                </linearGradient>
                <filter id="header-bus-glow" x="-60%" y="-100%" width="220%" height="300%">
                  <feGaussianBlur stdDeviation="2.8" />
                </filter>
              </defs>

              <ellipse className="header-bus-shadow" cx="82" cy="49" rx="66" ry="3" />
              <path
                className="header-bus-shell"
                d="M13 42V20c0-6 4-10 10-11 30-4 79-4 111 1 8 1 13 7 15 15l3 17-8 5H22c-5 0-9-2-9-5Z"
                fill="url(#header-bus-body)"
              />
              <path d="M18 19c30-7 84-7 117-2 5 1 9 4 11 8H18v-6Z" fill="url(#header-bus-glass)" />
              <path d="M20 29h127M26 39h116" fill="none" stroke="url(#header-bus-gold)" strokeWidth="1.2" opacity=".72" />
              <path d="M19 34c34 5 89 5 128-1" fill="none" stroke="#d9b966" strokeWidth=".75" opacity=".34" />

              {[31, 47, 64, 81, 98, 115, 132].map((x, index) => (
                <path key={x} d={`M${x} 16v10`} stroke="#d9b966" strokeWidth=".65" opacity={index === 0 || index === 6 ? ".62" : ".34"} />
              ))}

              {passengers.map((x) => (
                <g className="header-bus-passenger" key={x}>
                  <circle cx={x} cy="19.4" r="1.8" />
                  <path d={`M${x - 2.7} 25c.2-2.7 1.2-4 2.7-4s2.5 1.3 2.7 4Z`} />
                </g>
              ))}

              <path d="M135 16c6 2 9 6 11 11h-12V16Z" fill="#102235" stroke="#d9b966" strokeWidth=".7" />
              <path d="M25 31h9v9h-9z" fill="#101c2a" stroke="#d9b966" strokeWidth=".65" opacity=".9" />
              <path d="M70 34h24" stroke="#f0d98f" strokeWidth="1" opacity=".62" />
              <circle cx="82" cy="34" r="2.4" fill="none" stroke="#d9b966" strokeWidth=".8" opacity=".74" />
              <text x="82" y="35.7" textAnchor="middle" fill="#f0d98f" fontSize="3.4" fontWeight="700">JBT</text>

              <g className="header-bus-wheel">
                <circle cx="39" cy="44" r="7.3" fill="#02070d" stroke="#9c7b36" strokeWidth="1.2" />
                <circle cx="39" cy="44" r="3.1" fill="#152436" stroke="#f0d98f" strokeWidth=".8" />
                <path d="M39 41v6M36 44h6" stroke="#d9b966" strokeWidth=".6" />
              </g>
              <g className="header-bus-wheel">
                <circle cx="127" cy="44" r="7.3" fill="#02070d" stroke="#9c7b36" strokeWidth="1.2" />
                <circle cx="127" cy="44" r="3.1" fill="#152436" stroke="#f0d98f" strokeWidth=".8" />
                <path d="M127 41v6M124 44h6" stroke="#d9b966" strokeWidth=".6" />
              </g>

              <ellipse className="header-bus-headlight-glow" cx="150" cy="36" rx="8" ry="4" fill="#f7dda0" filter="url(#header-bus-glow)" />
              <path className="header-bus-headlight" d="M145 33h5l1 5h-6Z" fill="#ffe8ab" />
              <path d="M14 34h3v6h-3Z" fill="#b35235" opacity=".9" />
              <path d="M20 47h124" stroke="#f0d98f" strokeWidth=".8" opacity=".42" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
