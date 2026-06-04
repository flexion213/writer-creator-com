
-- ============ FEED POSTS ============
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  title text,
  body text NOT NULL DEFAULT '',
  image text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read feed" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed write own posts" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "authed delete own posts" ON public.feed_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "authed update own posts" ON public.feed_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE INDEX feed_posts_created_idx ON public.feed_posts (created_at DESC);

-- ============ LIKES ============
CREATE TABLE public.feed_post_likes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_post_likes TO authenticated;
GRANT ALL ON public.feed_post_likes TO service_role;
ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all likes" ON public.feed_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "like as self" ON public.feed_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "unlike own" ON public.feed_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ COMMENTS ============
CREATE TABLE public.feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.feed_post_comments TO authenticated;
GRANT ALL ON public.feed_post_comments TO service_role;
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all comments" ON public.feed_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment as self" ON public.feed_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "delete own comments" ON public.feed_post_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX feed_post_comments_post_idx ON public.feed_post_comments (post_id, created_at);

-- ============ NOTEBOOK CHARACTERS ============
CREATE TABLE public.notebook_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Unnamed',
  role text NOT NULL DEFAULT '',
  traits text NOT NULL DEFAULT '',
  backstory text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_characters TO authenticated;
GRANT ALL ON public.notebook_characters TO service_role;
ALTER TABLE public.notebook_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view if notebook member" ON public.notebook_characters FOR SELECT TO authenticated USING (public.is_notebook_member(notebook_id, auth.uid()));
CREATE POLICY "insert if can edit" ON public.notebook_characters FOR INSERT TO authenticated WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "update if can edit" ON public.notebook_characters FOR UPDATE TO authenticated USING (public.can_edit_notebook(notebook_id, auth.uid())) WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "delete if can edit" ON public.notebook_characters FOR DELETE TO authenticated USING (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE INDEX notebook_characters_nb_idx ON public.notebook_characters (notebook_id);

-- ============ NOTEBOOK TIMELINE ============
CREATE TABLE public.notebook_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New event',
  description text NOT NULL DEFAULT '',
  event_order integer NOT NULL DEFAULT 0,
  event_date text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_timeline_events TO authenticated;
GRANT ALL ON public.notebook_timeline_events TO service_role;
ALTER TABLE public.notebook_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view if notebook member" ON public.notebook_timeline_events FOR SELECT TO authenticated USING (public.is_notebook_member(notebook_id, auth.uid()));
CREATE POLICY "insert if can edit" ON public.notebook_timeline_events FOR INSERT TO authenticated WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "update if can edit" ON public.notebook_timeline_events FOR UPDATE TO authenticated USING (public.can_edit_notebook(notebook_id, auth.uid())) WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE POLICY "delete if can edit" ON public.notebook_timeline_events FOR DELETE TO authenticated USING (public.can_edit_notebook(notebook_id, auth.uid()));
CREATE INDEX notebook_timeline_nb_idx ON public.notebook_timeline_events (notebook_id, event_order);
