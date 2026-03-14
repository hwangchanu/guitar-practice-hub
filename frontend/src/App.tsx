import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { SeparationPage } from './pages/SeparationPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { TabPage } from './pages/TabPage';
import { ChromaticPage } from './pages/ChromaticPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/separation" replace />} />
          <Route path="/separation" element={<SeparationPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/tab" element={<TabPage />} />
          <Route path="/chromatic" element={<ChromaticPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
