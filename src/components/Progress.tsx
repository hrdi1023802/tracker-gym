import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subDays } from 'date-fns';
import { exerciseCatalog, Exercise } from '../data/exerciseCatalog';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ExerciseLog {
  exerciseId: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
}

const Progress: React.FC = () => {
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);

  useEffect(() => {
    // Mock fetching exercise logs from the database
    const mockFetchExerciseLogs = () => {
      const logs: ExerciseLog[] = [];
      const today = new Date();
      for (let i = 30; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        logs.push({
          exerciseId: 'bench-press',
          weight: 60 + Math.random() * 20,
          reps: 8 + Math.floor(Math.random() * 5),
          sets: 3,
          date,
        });
      }
      setExerciseLogs(logs);
    };

    mockFetchExerciseLogs();
  }, []);

  const filteredLogs = exerciseLogs.filter(log => log.exerciseId === selectedExercise);

  const chartData = {
    labels: filteredLogs.map(log => log.date),
    datasets: [
      {
        label: 'Weight (kg)',
        data: filteredLogs.map(log => log.weight),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'Reps',
        data: filteredLogs.map(log => log.reps),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Exercise Progress',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Exercise Progress</h1>
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="mb-4">
            <label htmlFor="exercise" className="block text-sm font-medium text-gray-700">Select Exercise</label>
            <select
              id="exercise"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              <option value="">Select an exercise</option>
              {exerciseCatalog.map((exercise: Exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} ({exercise.category} - {exercise.subcategory})
                </option>
              ))}
            </select>
          </div>
          {selectedExercise && (
            <div className="h-96">
              <Line data={chartData} options={options} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Progress;