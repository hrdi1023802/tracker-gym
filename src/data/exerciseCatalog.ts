export interface Exercise {
  id: string;
  name: string;
  category: string;
  subcategory: string;
}

export const exerciseCatalog: Exercise[] = [
  { id: 'bench-press', name: 'Press de Banca', category: 'Pecho', subcategory: 'Press Plano' },
  { id: 'incline-press', name: 'Press Inclinado', category: 'Pecho', subcategory: 'Press Inclinado' },
  { id: 'decline-press', name: 'Press Declinado', category: 'Pecho', subcategory: 'Press Declinado' },
  { id: 'squat', name: 'Sentadilla', category: 'Piernas', subcategory: 'Cuádriceps' },
  { id: 'deadlift', name: 'Peso Muerto', category: 'Espalda', subcategory: 'Espalda Baja' },
  { id: 'pull-up', name: 'Dominadas', category: 'Espalda', subcategory: 'Espalda Alta' },
  { id: 'shoulder-press', name: 'Press de Hombros', category: 'Hombros', subcategory: 'Deltoides' },
  { id: 'bicep-curl', name: 'Curl de Bíceps', category: 'Brazos', subcategory: 'Bíceps' },
  { id: 'tricep-extension', name: 'Extensión de Tríceps', category: 'Brazos', subcategory: 'Tríceps' },
  { id: 'leg-press', name: 'Prensa de Piernas', category: 'Piernas', subcategory: 'Cuádriceps' },
];