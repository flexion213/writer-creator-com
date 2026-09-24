CREATE TABLE public.tactical_maps (
  user_id uuid PRIMARY KEY,
  markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  bg jsonb,
  view jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_maps TO authenticated;
GRANT ALL ON public.tactical_maps TO service_role;
ALTER TABLE public.tactical_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own map select" ON public.tactical_maps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own map insert" ON public.tactical_maps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own map update" ON public.tactical_maps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own map delete" ON public.tactical_maps FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER tactical_maps_touch BEFORE UPDATE ON public.tactical_maps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();