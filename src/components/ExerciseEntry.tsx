import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { exerciseCatalog, Exercise } from '../data/exerciseCatalog';
import { Dumbbell } from 'lucide-react';

interface ExerciseLog {
  exerciseId: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
}

const ExerciseEntry: React.FC = () => {
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [sets, setSets] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be logged in to add an exercise entry');
      return;
    }

    const exerciseLog: ExerciseLog = {
      exerciseId: selectedExercise,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      sets: parseInt(sets),
      date,
    };

    // Mock adding entry to database
    console.log('Exercise entry added:', exerciseLog);
    navigate('/progress');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Dumbbell className="mx-auto h-12 w-auto text-indigo-600" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Log Exercise</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="exercise" className="block text-sm font-medium text-gray-700">
                Exercise
              </label>
              <select
                id="exercise"
                name="exercise"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                required
              >
                <option value="">Select an exercise</option>
                {exerciseCatalog.map((exercise: Exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name} ({exercise.category} - {exercise.subcategory})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
                Weight (kg)
              </label>
              <input
                type="number"
                id="weight"
                name="weight"
                step="0.5"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="reps" className="block text-sm font-medium text-gray-700">
                Repetitions
              </label>
              <input
                type="number"
                id="reps"
                name="reps"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="sets" className="block text-sm font-medium text-gray-700">
                Sets
              </label>
              <input
                type="number"
                id="sets"
                name="sets"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Log Exercise
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExerciseEntry;