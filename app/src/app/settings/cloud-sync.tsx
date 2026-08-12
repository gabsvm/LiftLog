import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { ProgramBlueprint } from '@/models/blueprint-models';
import { SupabaseSyncService } from '@/services/supabase-sync-service';
import { useAppSelector } from '@/store';
import { selectAllPrograms, upsertSavedPlans } from '@/store/program';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { HelperText, Text, TextInput } from 'react-native-paper';

export default function CloudSync() {
  const dispatch = useDispatch();
  const programs = useAppSelector(selectAllPrograms);
  const sync = useMemo(() => new SupabaseSyncService(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!sync.isConfigured) return;
    void sync.getSignedInEmail().then(setSignedInEmail).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'No se pudo recuperar la sesion.');
    });
  }, [sync]);

  const run = async (action: () => Promise<void>) => {
    setWorking(true);
    setMessage(undefined);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la sincronizacion.');
    } finally {
      setWorking(false);
    }
  };

  const signIn = () => run(async () => {
    const user = await sync.signIn(email, password);
    setSignedInEmail(user?.email ?? email);
    setPassword('');
    setMessage('Sesion conectada. Tu copia local sigue disponible sin internet.');
  });

  const signUp = () => run(async () => {
    const result = await sync.signUp(email, password);
    setSignedInEmail(result.user?.email ?? null);
    setPassword('');
    setMessage(result.confirmationRequired ? 'Revisa tu email para confirmar la cuenta.' : 'Cuenta creada y conectada.');
  });

  const upload = () => run(async () => {
    await sync.uploadPrograms(Object.fromEntries(programs.map(({ id, program }) => [id, program.toJSON()])));
    setMessage(`${programs.length} rutina(s) subida(s) a tu nube privada.`);
  });

  const download = () => run(async () => {
    const remote = await sync.downloadPrograms();
    dispatch(upsertSavedPlans(Object.fromEntries(remote.map((program) => [program.id, ProgramBlueprint.fromJSON(program.payload)]))));
    setMessage(`${remote.length} rutina(s) descargada(s). Las de mismo ID se actualizaron con la copia cloud.`);
  });

  return (
    <FullHeightScrollView avoidKeyboard>
      <Stack.Screen options={{ title: 'Cuenta y sincronizacion' }} />
      <Text variant="titleLarge">Tu nube privada</Text>
      <Text variant="bodyMedium">Las rutinas funcionan primero en SQLite. Supabase solo sincroniza una copia privada entre tus dispositivos.</Text>
      {!sync.isConfigured ? <HelperText type="error">Falta configurar Supabase en este build. Usa app/.env.example como referencia.</HelperText> : null}
      {signedInEmail ? (
        <>
          <Text variant="titleMedium">Conectado como {signedInEmail}</Text>
          <Button mode="contained" onPress={() => { void upload(); }} loading={working} disabled={working}>Subir mis rutinas</Button>
          <Button mode="outlined" onPress={() => { void download(); }} loading={working} disabled={working}>Descargar rutinas</Button>
          <Button mode="text" onPress={() => { void run(async () => { await sync.signOut(); setSignedInEmail(null); setMessage('Sesion cerrada en este dispositivo.'); }); }} disabled={working}>Cerrar sesion</Button>
        </>
      ) : (
        <>
          <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput mode="outlined" label="Contrasena" value={password} onChangeText={setPassword} secureTextEntry />
          <Button mode="contained" onPress={() => { void signIn(); }} loading={working} disabled={!sync.isConfigured || !email.trim() || !password || working}>Ingresar</Button>
          <Button mode="outlined" onPress={() => { void signUp(); }} loading={working} disabled={!sync.isConfigured || !email.trim() || password.length < 6 || working}>Crear cuenta</Button>
        </>
      )}
      {message ? <HelperText type={message.includes('no se pudo') || message.startsWith('Falta') ? 'error' : 'info'}>{message}</HelperText> : null}
    </FullHeightScrollView>
  );
}
