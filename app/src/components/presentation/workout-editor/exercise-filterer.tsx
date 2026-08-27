import { fuzzyMatchScore } from '@/components/presentation/workout-editor/exercise-fuzzy-match';
import ExerciseSearchAndFilters from '@/components/presentation/workout-editor/exercise-search-and-filters';
import { ExerciseDescriptor } from '@/models/exercise-models';
import { useAppSelector } from '@/store';
import { selectExercises } from '@/store/stored-sessions';
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export default function ExerciseFilterer(props: {
  onFilteredExerciseIdsChange: (ids: string[]) => void;
  onSuggestedNewExercise: (
    exerciseDescriptor: ExerciseDescriptor | 'NONE',
  ) => void;
}) {
  const exercises = useAppSelector(selectExercises);
  const { onFilteredExerciseIdsChange, onSuggestedNewExercise } = props;
  const [muscleFilters, setMuscleFilters] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  const search = useDebouncedCallback(
    (rawSearchText: string, activeMuscleFilters: string[]) => {
      const trimmed = rawSearchText.trim();
      const muscleSet = new Set(activeMuscleFilters);
      let hasExactMatch = false;
      const ranked: Array<{
        id: string;
        name: string;
        score: number;
      }> = [];

      for (const [id, exercise] of Object.entries(exercises)) {
        if (
          muscleSet.size > 0 &&
          !exercise.muscles.some((muscle) => muscleSet.has(muscle))
        ) {
          continue;
        }

        const score = trimmed ? fuzzyMatchScore(trimmed, exercise.name) : 0;
        if (trimmed && score === null) continue;

        if (
          trimmed &&
          exercise.name.localeCompare(trimmed, undefined, {
            sensitivity: 'base',
          }) === 0
        ) {
          hasExactMatch = true;
        }
        ranked.push({ id, name: exercise.name, score: score ?? 0 });
      }

      ranked.sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name),
      );
      onFilteredExerciseIdsChange(ranked.map((item) => item.id));

      if (!hasExactMatch && trimmed) {
        onSuggestedNewExercise({
          name: trimmed,
          category: '',
          equipment: null,
          force: null,
          instructions: '',
          level: '',
          mechanic: '',
          muscles: activeMuscleFilters,
        });
      } else {
        onSuggestedNewExercise('NONE');
      }
    },
    100,
  );

  return (
    <ExerciseSearchAndFilters
      searchText={searchText}
      setSearchText={(nextText) => {
        setSearchText(nextText);
        search(nextText, muscleFilters);
      }}
      muscleFilters={muscleFilters}
      setMuscleFilters={(nextMuscles) => {
        setMuscleFilters(nextMuscles);
        search(searchText, nextMuscles);
      }}
    />
  );
}
