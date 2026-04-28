import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import PdfGeneration from './pages/PdfGeneration';
import { useState, useEffect } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={!isAuthenticated ? <Landing setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/pdf" element={isAuthenticated ? <PdfGeneration /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
