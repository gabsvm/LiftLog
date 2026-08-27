import AppBottomSheet from '@/components/presentation/foundation/app-bottom-sheet';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import EmptyInfo from '@/components/presentation/foundation/empty-info';
import { SegmentedList } from '@/components/presentation/foundation/segmented-list';
import { TitledSection } from '@/components/presentation/stats/titled-section';
import { WeightedExerciseListSearcher } from '@/components/presentation/stats/weighted-exercise-list-searcher';
import { WeightedExerciseStatSummary } from '@/components/presentation/stats/weighted-exercise-stat-summary';
import { useAppTheme, spacing } from '@/hooks/useAppTheme';
import {
  GranularStatisticView,
  WeightedExerciseStatistics,
} from '@/store/stats';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTranslate } from '@tolgee/react';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

export function ExerciseListSummary(props: { stats: GranularStatisticView }) {
  const { push } = useRouter();
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const topWeightedExercises = props.stats.weightedExerciseStats.slice(0, 5);
  const hasExerciseStats = props.stats.weightedExerciseStats.length > 0;

  const onItemPress = (item: WeightedExerciseStatistics) => {
    setSheetOpen(false);
    push(
      `/stats/expanded-weighted-exercise?exerciseName=${encodeURIComponent(item.exerciseName)}`,
    );
  };

  return (
    <TitledSection
      title={t('stats.weighted_exercise_list.title')}
      titleRight={
        hasExerciseStats ? (
          <Button
            mode="text"
            onPress={() => {
              setSheetOpen(true);
            }}
            style={{ alignSelf: 'flex-end' }}
          >
            {t('stats.see_more.button')}
          </Button>
        ) : undefined
      }
    >
      {hasExerciseStats ? (
        <SegmentedList
          items={topWeightedExercises}
          renderItem={(item) => (
            <WeightedExerciseStatSummary
              onPress={onItemPress}
              exerciseStats={item}
            />
          )}
        />
      ) : (
        <EmptyInfo style={{ paddingVertical: spacing[5] }}>
          {t('generic.no_data_available.message')}
        </EmptyInfo>
      )}
      {sheetOpen ? (
        <AppBottomSheet
          backgroundStyle={{ backgroundColor: colors.surfaceContainerHighest }}
          index={0}
          sheetRef={bottomSheetRef}
          enableContentPanningGesture={false}
          enablePanDownToClose
          enableDynamicSizing={false}
          onClose={() => setSheetOpen(false)}
        >
          <WeightedExerciseListSearcher
            stats={props.stats}
            onItemPress={onItemPress}
          />
        </AppBottomSheet>
      ) : null}
    </TitledSection>
  );
}
