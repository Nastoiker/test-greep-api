import type { PropsWithChildren } from 'react';
import {
  CssBaseline,
  GlobalStyles,
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@mui/material';

const theme = createTheme({
  palette: {
    primary: { main: '#191817', dark: '#000000', contrastText: '#ffffff' },
    background: { default: '#f2efeb', paper: '#ffffff' },
    text: { primary: '#191817', secondary: '#68635f' },
    divider: '#d8d3ce',
    error: { main: '#963a29' },
    action: { hover: '#f7f6f4', selected: '#eae5df' },
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 14,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44 },
        outlined: {
          borderColor: '#191817',
          '&:hover': { borderColor: '#191817', backgroundColor: '#f2efeb' },
        },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined', size: 'small' } },
    MuiInputBase: {
      styleOverrides: { input: { fontSize: 14, '@media (max-width:700px)': { fontSize: 16 } } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24 } } },
    MuiAlert: { styleOverrides: { root: { fontSize: 13 } } },
  },
});

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          ':root': {
            '--accent': theme.palette.primary.main,
            '--muted': theme.palette.text.secondary,
            '--line': theme.palette.divider,
            '--surface': theme.palette.action.hover,
            '--selected': theme.palette.action.selected,
            '--page': theme.palette.background.default,
            '--paper': theme.palette.background.paper,
            '--ink': theme.palette.text.primary,
          },
        }}
      />
      {children}
    </MuiThemeProvider>
  );
}
