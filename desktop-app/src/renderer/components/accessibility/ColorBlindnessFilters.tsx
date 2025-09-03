import React from 'react'

/**
 * SVG filters for color blindness simulation and correction
 * These filters help users with different types of color vision deficiency
 */
export const ColorBlindnessFilters: React.FC = () => {
  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Protanopia Filter (Red-blind) */}
        <filter id="protanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0 0 0
                    0.558 0.442 0 0 0
                    0 0.242 0.758 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Deuteranopia Filter (Green-blind) */}
        <filter id="deuteranopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0
                    0.7 0.3 0 0 0
                    0 0.3 0.7 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Tritanopia Filter (Blue-blind) */}
        <filter id="tritanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05 0 0 0
                    0 0.433 0.567 0 0
                    0 0.475 0.525 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Protanomaly Filter (Red-weak) */}
        <filter id="protanomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.817 0.183 0 0 0
                    0.333 0.667 0 0 0
                    0 0.125 0.875 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Deuteranomaly Filter (Green-weak) */}
        <filter id="deuteranomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.8 0.2 0 0 0
                    0.258 0.742 0 0 0
                    0 0.142 0.858 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Tritanomaly Filter (Blue-weak) */}
        <filter id="tritanomaly-filter">
          <feColorMatrix
            type="matrix"
            values="0.967 0.033 0 0 0
                    0 0.733 0.267 0 0
                    0 0.183 0.817 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Enhanced contrast filter for better visibility */}
        <filter id="enhanced-contrast-filter">
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 0.5 1"/>
          </feComponentTransfer>
          <feColorMatrix
            type="saturate"
            values="1.5"
          />
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude="1" exponent="0.8"/>
            <feFuncG type="gamma" amplitude="1" exponent="0.8"/>
            <feFuncB type="gamma" amplitude="1" exponent="0.8"/>
          </feComponentTransfer>
        </filter>

        {/* High contrast filter */}
        <filter id="high-contrast-filter">
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 1"/>
          </feComponentTransfer>
          <feColorMatrix
            type="saturate"
            values="0"
          />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 0.5 1"/>
            <feFuncG type="discrete" tableValues="0 0.5 1"/>
            <feFuncB type="discrete" tableValues="0 0.5 1"/>
          </feComponentTransfer>
        </filter>

        {/* Dark mode enhancement filter */}
        <filter id="dark-mode-filter">
          <feColorMatrix
            type="matrix"
            values="-1 0 0 0 1
                    0 -1 0 0 1
                    0 0 -1 0 1
                    0 0 0 1 0"
          />
        </filter>

        {/* Blue light reduction filter */}
        <filter id="blue-light-filter">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 0.9 0 0 0
                    0 0 0.8 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Sepia filter for reduced eye strain */}
        <filter id="sepia-filter">
          <feColorMatrix
            type="matrix"
            values="0.393 0.769 0.189 0 0
                    0.349 0.686 0.168 0 0
                    0.272 0.534 0.131 0 0
                    0 0 0 1 0"
          />
        </filter>

        {/* Invert colors filter */}
        <filter id="invert-filter">
          <feColorMatrix
            type="matrix"
            values="-1 0 0 0 1
                    0 -1 0 0 1
                    0 0 -1 0 1
                    0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  )
}

export default ColorBlindnessFilters