import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { downloadIronLogCloudSnapshot } from '@/services/ironlog-firebase-import-service';
import { importIronLogSnapshotAsPlan } from '@/services/ironlog-routine-importer';
import { upsertSavedPlans } from '@/store/program';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { HelperText, Text, TextInput } from 'react-native-paper';

export default function ImportIronLog() {
  const dispatch = useDispatch();
  const [payload, setPayload] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string>();

  const importRoutine = () => {
    try {
      const snapshot = JSON.parse(payload) as Parameters<typeof importIronLogSnapshotAsPlan>[0];
      if (!snapshot.program?.length) throw new Error('No encontramos una rutina en ese backup.');
      dispatch(upsertSavedPlans(importIronLogSnapshotAsPlan(snapshot)));
      setMessage('Rutina importada. Ahora podes editarla desde Gestionar rutinas.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'El backup no es valido.');
    }
  };

  const importFromFirebase = async () => {
    setIsImporting(true);
    try {
      const snapshot = await downloadIronLogCloudSnapshot(email, password);
      if (!snapshot.program?.length) throw new Error('No encontramos una rutina en la nube.');
      dispatch(upsertSavedPlans(importIronLogSnapshotAsPlan(snapshot)));
      setMessage('Rutina de la nube importada. Las superseries quedaron vinculadas.');
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo importar la rutina.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <FullHeightScrollView>
      <Stack.Screen options={{ title: 'Importar desde IronLog' }} />
      <Text variant="titleLarge">Importar rutina de la nube</Text>
      <Text variant="bodyMedium">Inicia sesion una vez con tu cuenta de IronLog. Solo se lee el snapshot y se crea una copia editable local; la contrasena no se guarda.</Text>
      <TextInput mode="outlined" label="Email de IronLog" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput mode="outlined" label="Contrasena" value={password} onChangeText={setPassword} secureTextEntry />
      <Button mode="contained" onPress={() => { void importFromFirebase(); }} disabled={!email.trim() || !password || isImporting} loading={isImporting}>Importar desde mi nube</Button>
      <Text variant="titleMedium">O importar un backup JSON</Text>
      <Text variant="bodyMedium">Pega un backup exportado de IronLog. Se conservan las superseries como bloques consecutivos.</Text>
      <TextInput mode="outlined" multiline numberOfLines={14} value={payload} onChangeText={setPayload} placeholder={'{ "program": [...] }'} autoCapitalize="none" autoCorrect={false} />
      <Button mode="contained" onPress={importRoutine} disabled={!payload.trim()}>Importar rutina</Button>
      {message ? <HelperText type={message.startsWith('Rutina') ? 'info' : 'error'}>{message}</HelperText> : null}
    </FullHeightScrollView>
  );
}
