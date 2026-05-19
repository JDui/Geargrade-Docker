import { AppSettingsProvider } from "./components/layout/AppSettingsProvider";
import { DashboardSummaryProvider } from "./components/layout/DashboardSummaryProvider";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { AppRouter } from "./routes/AppRouter";

export default function App() {
  return (
    <ThemeProvider>
      <AppSettingsProvider>
        <DashboardSummaryProvider>
          <AppRouter />
        </DashboardSummaryProvider>
      </AppSettingsProvider>
    </ThemeProvider>
  );
}
