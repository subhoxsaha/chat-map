"use client";

import * as React from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import NextAppDirEmotionCacheProvider from "./EmotionCache";

// Custom palette
// Deepest dark: #091413
// Mid dark:    #285A48
// Accent/Main: #408A71
// Light:       #B0E4CC

export const getDesignTokens = (mode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // LIGHT MODE
          primary: {
            main: '#408A71',
            light: '#B0E4CC',
            dark: '#285A48',
          },
          background: {
            default: '#f8fafc',
            paper: '#ffffff',
          },
          text: {
            primary: '#091413',
            secondary: '#285A48',
          },
        }
      : {
          // DARK MODE
          primary: {
            main: '#408A71',
            light: '#B0E4CC',
            dark: '#285A48',
          },
          background: {
            default: '#091413',
            paper: '#0d1d1b', // slightly lighter than default
          },
          text: {
            primary: '#ffffff',
            secondary: '#B0E4CC',
          },
          divider: 'rgba(176, 228, 204, 0.1)',
        }),
  },
  typography: {
    fontFamily: 'var(--font-inter), sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          color: '#ffffff',
        }
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default MUI elevation overlay
        },
      },
    },
  },
});

export const ColorModeContext = React.createContext({ toggleColorMode: () => {} });

export default function ThemeRegistry({ children }) {
  const [mode, setMode] = React.useState('dark');

  React.useEffect(() => {
    const saved = localStorage.getItem('mapchat-theme');
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
    }
  }, []);

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const next = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('mapchat-theme', next);
          return next;
        });
      },
    }),
    [],
  );

  const theme = React.useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <NextAppDirEmotionCacheProvider options={{ key: "mui" }}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ColorModeContext.Provider>
    </NextAppDirEmotionCacheProvider>
  );
}
