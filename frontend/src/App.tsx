import { DashboardSummaryProvider } from "./components/layout/DashboardSummaryProvider";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { AppRouter } from "./routes/AppRouter";

export default function App() {
  return (
    <ThemeProvider>
      <DashboardSummaryProvider>
        <AppRouter />
      </DashboardSummaryProvider>
    </ThemeProvider>
  );
}
