
-- Writer Creators schema
CREATE TABLE public.writer_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_projects TO authenticated;
GRANT ALL ON public.writer_projects TO service_role;
ALTER TABLE public.writer_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage projects" ON public.writer_projects FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.writer_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.writer_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Chapter',
  body TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_chapters TO authenticated;
GRANT ALL ON public.writer_chapters TO service_role;
ALTER TABLE public.writer_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage chapters" ON public.writer_chapters FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.writer_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.writer_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unnamed',
  traits TEXT NOT NULL DEFAULT '',
  backstory TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_characters TO authenticated;
GRANT ALL ON public.writer_characters TO service_role;
ALTER TABLE public.writer_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage characters" ON public.writer_characters FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.writer_lore (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.writer_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  category TEXT NOT NULL DEFAULT 'lore',
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_lore TO authenticated;
GRANT ALL ON public.writer_lore TO service_role;
ALTER TABLE public.writer_lore ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage lore" ON public.writer_lore FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.writer_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.writer_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_order INT NOT NULL DEFAULT 0,
  event_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_timeline_events TO authenticated;
GRANT ALL ON public.writer_timeline_events TO service_role;
ALTER TABLE public.writer_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage timeline" ON public.writer_timeline_events FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.writer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'bug',
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_feedback TO authenticated;
GRANT ALL ON public.writer_feedback TO service_role;
ALTER TABLE public.writer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporters insert feedback" ON public.writer_feedback FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reporters read own feedback" ON public.writer_feedback FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));
CREATE POLICY "staff update feedback" ON public.writer_feedback FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));
CREATE POLICY "staff delete feedback" ON public.writer_feedback FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE TRIGGER trg_writer_projects_updated BEFORE UPDATE ON public.writer_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_writer_chapters_updated BEFORE UPDATE ON public.writer_chapters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_writer_chapters_project ON public.writer_chapters(project_id, position);
CREATE INDEX idx_writer_characters_project ON public.writer_characters(project_id);
CREATE INDEX idx_writer_lore_project ON public.writer_lore(project_id);
CREATE INDEX idx_writer_timeline_project ON public.writer_timeline_events(project_id, event_order);
