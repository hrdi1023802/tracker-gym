import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ExerciseEntry from './components/ExerciseEntry';
import Progress from './components/Progress';
import Plans from './components/Plans';
import PlanEditor from './components/PlanEditor';
import PlanExport from './components/PlanExport';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/entry" element={<PrivateRoute><ExerciseEntry /></PrivateRoute>} />
            <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
            <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
            <Route path="/plans/:planId" element={<PrivateRoute><PlanEditor /></PrivateRoute>} />
            <Route path="/plans/:planId/export/:dayId" element={<PrivateRoute><PlanExport /></PrivateRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;