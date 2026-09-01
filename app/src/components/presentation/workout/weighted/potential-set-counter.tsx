/* eslint-disable no-restricted-imports -- set logging intentionally bypasses the RNGH wrapper to keep the hot-path press native */
import { PotentialSet, WeightAppliesTo } from '@/models/session-models';
import BigNumber from 'bignumber.js';
import { useState } from 'react';
import {
  Text as PaperText,
  Chip,
  TouchableRipple as PaperTouchableRipple,
} from 'react-native-paper';
import { Text, View } from 'react-native';
import WeightFormat from '@/components/presentation/foundation/weight-format';
import WeightDialog from '@/components/presentation/foundation/editors/weight-dialog';
import { useAppTheme, spacing, font, rounding } from '@/hooks/useAppTheme';
import FocusRing from '@/components/presentation/foundation/focus-ring';
import { T } from '@tolgee/react';
import { Weight } from '@/models/weight';
import PotentialSetAdditionalActionsDialog from '@/components/presentation/workout/weighted/potential-sets-addition-actions-dialog';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';

interface PotentialSetCounterProps {
  set: PotentialSet;
  weightIncrement: BigNumber;
  maxReps: number;
  previousRepCount: number | undefined;
  toStartNext: boolean;
  isReadonly: boolean;

  onTap: () => void;
  onUpdateWeight: (weight: Weight, applyTo: WeightAppliesTo) => void;
  onUpdateReps: (reps: number | undefined) => void;
}

export default function PotentialSetCounter(props: PotentialSetCounterProps) {
  const { colors } = useAppTheme();
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [isRepsDialogOpen, setIsRepsDialogOpen] = useState(false);
  const repCountValue = props.set?.set?.repsCompleted;
  const placeholderRepCount = props.previousRepCount;
  const [applyTo, setApplyTo] = useState<WeightAppliesTo>('uncompletedSets');

  return (
    <FocusRing
      isSelected={props.toStartNext}
      radius={rounding.roundedRectangleFocusRingRadius}
    >
      <View
        style={[
          {
            minWidth: spacing[15],
          },
          { userSelect: 'none' },
        ]}
      >
        <View
          style={{
            borderTopLeftRadius: rounding.roundedRectangleRadius,
            borderTopRightRadius: rounding.roundedRectangleRadius,
            overflow: 'hidden',
          }}
        >
          <PaperTouchableRipple
            style={{
              flexShrink: 0,
              padding: 0,
              height: spacing[15],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                repCountValue !== undefined
                  ? colors.primary
                  : colors.secondaryContainer,
            }}
            onPress={props.isReadonly ? undefined : props.onTap}
            onLongPress={
              props.isReadonly ? undefined : () => setIsRepsDialogOpen(true)
            }
            delayLongPress={500}
            disabled={props.isReadonly}
            testID="repcount"
          >
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  color:
                    repCountValue !== undefined
                      ? colors.onPrimary
                      : colors.onSecondaryContainer,
                  ...font['text-xl'],
                }}
              >
                <Text style={{ fontWeight: 'bold' }}>
                  {repCountValue ?? '-'}
                </Text>
                <Text
                  style={{
                    ...font['text-sm'],
                    verticalAlign: 'top',
                  }}
                >
                  /{props.maxReps}
                </Text>
              </Text>
              {repCountValue === undefined &&
                placeholderRepCount !== undefined && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[0.5],
                    }}
                  >
                    <Icon
                      source={'history'}
                      size={12}
                      color={colors.onSecondaryContainer + '99'}
                    />
                    <Text
                      style={{
                        color: colors.onSecondaryContainer + '99',
                      }}
                    >
                      {placeholderRepCount}
                    </Text>
                  </View>
                )}
            </View>
          </PaperTouchableRipple>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.outline,
            backgroundColor: colors.surfaceContainerHigh,
            borderBottomLeftRadius: rounding.roundedRectangleRadius,
            borderBottomRightRadius: rounding.roundedRectangleRadius,
            overflow: 'hidden',
            padding: spacing[2],
            width: '100%',
          }}
        >
          <PaperTouchableRipple
            testID="repcount-weight"
            style={{
              alignItems: 'center',
              margin: -spacing[2],
              padding: spacing[2],
            }}
            onPress={
              props.isReadonly
                ? undefined
                : () => {
                    setApplyTo(props.set.set ? 'thisSet' : 'uncompletedSets');
                    setIsWeightDialogOpen(true);
                  }
            }
            disabled={props.isReadonly}
          >
            <Text style={{ color: colors.onSurface, ...font['text-sm'] }}>
              <WeightFormat weight={props.set.weight} />
            </Text>
          </PaperTouchableRipple>
        </View>
        {isWeightDialogOpen ? (
          <WeightDialog
            open
            allowNegative
            increment={props.weightIncrement}
            weight={props.set.weight}
            onClose={() => setIsWeightDialogOpen(false)}
            updateWeight={(w) => props.onUpdateWeight(w, applyTo)}
          >
            <View style={{ gap: spacing[2] }}>
              <PaperText variant="labelLarge">
                <T keyName="weight.apply_to.label" />
              </PaperText>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing[1],
                }}
              >
                <Chip
                  selected={applyTo === 'thisSet'}
                  testID="repcount-apply-weight-to-this-set"
                  onPress={() => setApplyTo('thisSet')}
                >
                  <T keyName="exercise.this_set.label" />
                </Chip>
                <Chip
                  selected={applyTo === 'uncompletedSets'}
                  testID="repcount-apply-weight-to-uncompleted-sets"
                  onPress={() => setApplyTo('uncompletedSets')}
                >
                  <T keyName="exercise.uncompleted_sets.label" />
                </Chip>
                <Chip
                  selected={applyTo === 'allSets'}
                  testID="repcount-apply-weight-to-all-sets"
                  onPress={() => setApplyTo('allSets')}
                >
                  <T keyName="exercise.all_sets.label" />
                </Chip>
              </View>
            </View>
          </WeightDialog>
        ) : null}
      </View>

      {isRepsDialogOpen ? (
        <PotentialSetAdditionalActionsDialog
          open
          repTarget={props.maxReps}
          set={props.set}
          updateRepCount={(reps) => props.onUpdateReps(reps)}
          close={() => setIsRepsDialogOpen(false)}
        />
      ) : null}
    </FocusRing>
  );
}
