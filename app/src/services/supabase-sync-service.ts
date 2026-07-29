import { ProgramBlueprintJSON } from '@/models/storage/versions/latest';
import { assertSupabaseConfigured, getSupabaseClient } from '@/services/supabase-client';

export type RemoteProgram = {
  id: string;
  payload: ProgramBlueprintJSON;
  revision: number;
  updated_at: string;
};

/** Explicit sync only: the SQLite copy remains usable and authoritative offline. */
export class SupabaseSyncService {
  get isConfigured() {
    return getSupabaseClient() !== null;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await assertSupabaseConfigured().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async signUp(email: string, password: string) {
    const { data, error } = await assertSupabaseConfigured().auth.signUp({ email, password });
    if (error) throw error;
    return { user: data.user, confirmationRequired: !data.session };
  }

  async getSignedInEmail(): Promise<string | null> {
    const { data, error } = await assertSupabaseConfigured().auth.getSession();
    if (error) throw error;
    return data.session?.user.email ?? null;
  }

  async signOut() {
    const { error } = await assertSupabaseConfigured().auth.signOut();
    if (error) throw error;
  }

  async uploadPrograms(programs: Readonly<Record<string, ProgramBlueprintJSON>>) {
    const supabase = assertSupabaseConfigured();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Inicia sesion antes de sincronizar.');

    const records = Object.entries(programs).map(([id, payload]) => ({
      id,
      owner_id: user.id,
      payload,
      updated_at: new Date().toISOString(),
    }));
    if (!records.length) return;
    const { error } = await supabase.from('programs').upsert(records, { onConflict: 'id' });
    if (error) throw error;
  }

  async downloadPrograms(): Promise<RemoteProgram[]> {
    const { data, error } = await assertSupabaseConfigured()
      .from('programs')
      .select('id,payload,revision,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
