import type { Config } from 'tailwindcss'

/**
 * Arivu Design Tokens v1.0
 * 
 * This configuration provides IDE autocomplete and type checking for Arivu Design Tokens.
 * 
 * IMPORTANT: This is a system-level change only.
 * Do NOT modify Vue components, pages, or UI files.
 * 
 * WARNING:
 * Spacing tokens are NOT the source of truth.
 * Arivu spacing is governed by Design Laws v1.0 (8-based system).
 *
 * This file exists ONLY for:
 * - IDE autocomplete
 * - Type checking
 *
 * Do NOT introduce or rely on custom spacing scales here.
 * 
 * The actual token source of truth is in: client/src/assets/main.css (@theme directive)
 */

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      /**
       * Intent-Based Color Tokens (Law 7: Intent-Based Token Law)
       * 
       * Colors communicate intent, not appearance.
       * Light/Dark preserve intent, not brightness (Law 8).
       * 
       * Valid intents: Primary, Secondary, Neutral, Success, Warning, Danger
       * No new semantic meanings allowed.
       */
      colors: {
        /**
         * Primary — Intelligence, Trust (Law 7)
         * Maps to indigo for Arivu identity
         */
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#6049E7',
          600: '#5037d9',
          700: '#4527a0',
          800: '#3a1f8a',
          900: '#2e1872',
          DEFAULT: '#6049E7',
        },
        
        /**
         * Secondary — Growth, Motion (Law 7)
         * Used for app participation badges, secondary actions
         */
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
        },
        
        /**
         * Neutral — Structure, Calm (Law 7)
         * Replaces conceptual role of gray-* (Law 7)
         * Must fully replace gray-* usage
         */
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0a0f1a',
          DEFAULT: '#6b7280',
        },
        
        /**
         * Success — Completion (Law 7)
         */
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#10b981',
        },
        
        /**
         * Warning — Risk, Attention (Law 7)
         */
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#f59e0b',
        },
        
        /**
         * Danger — Irreversible Change (Law 7)
         */
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#ef4444',
        },
      },
      
      /**
       * Spacing Tokens
       * 
       * WARNING: Spacing is NOT defined here.
       * Arivu spacing is governed by Design Laws v1.0 (8-based system: 8, 16, 24, 32, 48, 64).
       * 
       * Tailwind's default spacing scale remains available.
       * Components should use 8-based values per Law 9, but enforcement happens via linting/rules,
       * not via token overrides (which would break existing components).
       */
      
      /**
       * Typography Roles (Law 11: Typography Expresses Certainty)
       * 
       * Each role specifies font-size, line-height, font-weight.
       * Labels are never bold (Law 11).
       */
      fontSize: {
        // Typography roles will be consumed via utility classes
        // These are base sizes; components will compose them
      },
      
      /**
       * Typography Role Utilities
       * Defined as custom utilities for semantic clarity
       */
      fontFamily: {
        sans: ['InterVariable', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

