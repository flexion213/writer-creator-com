
-- Extend feed_posts with novel/comic mode + moderation
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS comic_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.notebooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.feed_posts
  DROP CONSTRAINT IF EXISTS feed_posts_kind_check;
ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_kind_check CHECK (post_kind IN ('text','novel','comic'));

-- Replace the broad SELECT policy so hidden posts are only visible to staff/author
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='feed_posts' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.feed_posts', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Feed posts visible unless hidden"
  ON public.feed_posts FOR SELECT
  USING (
    hidden = false
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Notebook lore (World-Building Bible)
CREATE TABLE IF NOT EXISTS public.notebook_lore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Location',
  title text NOT NULL DEFAULT 'Untitled',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_lore TO authenticated;
GRANT ALL ON public.notebook_lore TO service_role;
ALTER TABLE public.notebook_lore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read lore"
  ON public.notebook_lore FOR SELECT TO authenticated
  USING (public.is_notebook_member(notebook_id, auth.uid()));
CREATE POLICY "Editors can insert lore"
  ON public.notebook_lore FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "Editors can update lore"
  ON public.notebook_lore FOR UPDATE TO authenticated
  USING (public.can_edit_notebook(notebook_id, auth.uid()))
  WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "Editors can delete lore"
  ON public.notebook_lore FOR DELETE TO authenticated
  USING (public.can_edit_notebook(notebook_id, auth.uid()));

-- Feed post reports (moderation queue)
CREATE TABLE IF NOT EXISTS public.feed_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_post_reports TO authenticated;
GRANT ALL ON public.feed_post_reports TO service_role;
ALTER TABLE public.feed_post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
  ON public.feed_post_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Reporter or staff can view"
  ON public.feed_post_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );
CREATE POLICY "Staff can resolve"
  ON public.feed_post_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Auto-hide post after 3 unresolved reports
CREATE OR REPLACE FUNCTION public.auto_hide_reported_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c int;
BEGIN
  SELECT count(*) INTO c FROM public.feed_post_reports
   WHERE post_id = NEW.post_id AND resolved = false;
  IF c >= 3 THEN
    UPDATE public.feed_posts SET hidden = true WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_hide_reported_post ON public.feed_post_reports;
CREATE TRIGGER trg_auto_hide_reported_post
AFTER INSERT ON public.feed_post_reports
FOR EACH ROW EXECUTE FUNCTION public.auto_hide_reported_post();
