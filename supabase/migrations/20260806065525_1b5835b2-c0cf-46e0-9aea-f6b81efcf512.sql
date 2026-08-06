CREATE TABLE public.wiki_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'characters',
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wiki_entries TO authenticated;
GRANT ALL ON public.wiki_entries TO service_role;
ALTER TABLE public.wiki_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wiki entries" ON public.wiki_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wiki_entries_touch BEFORE UPDATE ON public.wiki_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX wiki_entries_user_idx ON public.wiki_entries (user_id, category);