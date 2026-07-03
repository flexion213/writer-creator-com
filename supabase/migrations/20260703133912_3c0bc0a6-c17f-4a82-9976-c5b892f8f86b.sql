
-- 1. add flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_shadow_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system_locked boolean NOT NULL DEFAULT false;

-- 2. helper: is this user shadow-banned?
CREATE OR REPLACE FUNCTION public.is_shadow_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_shadow_banned FROM public.profiles WHERE id = _uid), false);
$$;

CREATE OR REPLACE FUNCTION public.is_system_locked(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_system_locked FROM public.profiles WHERE id = _uid), false);
$$;

-- 3. update feed_posts visibility to hide shadow-banned authors from other users,
--    and block system-locked users from reading anything.
DROP POLICY IF EXISTS "Feed posts visible unless hidden" ON public.feed_posts;
CREATE POLICY "Feed posts visible unless hidden or shadow banned"
ON public.feed_posts FOR SELECT
USING (
  NOT public.is_system_locked(auth.uid())
  AND (
    (
      hidden = false
      AND (author_id = auth.uid() OR NOT public.is_shadow_banned(author_id))
    )
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- also block writes from system-locked users
DROP POLICY IF EXISTS "authed write own posts" ON public.feed_posts;
CREATE POLICY "authed write own posts"
ON public.feed_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id AND NOT public.is_system_locked(auth.uid()));

DROP POLICY IF EXISTS "authed update own posts" ON public.feed_posts;
CREATE POLICY "authed update own posts"
ON public.feed_posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id AND NOT public.is_system_locked(auth.uid()))
WITH CHECK (auth.uid() = author_id);

-- 4. comments
DROP POLICY IF EXISTS "read all comments" ON public.feed_post_comments;
CREATE POLICY "read comments unless shadow banned"
ON public.feed_post_comments FOR SELECT
TO authenticated
USING (
  NOT public.is_system_locked(auth.uid())
  AND (
    author_id = auth.uid()
    OR NOT public.is_shadow_banned(author_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

DROP POLICY IF EXISTS "comment as self" ON public.feed_post_comments;
CREATE POLICY "comment as self"
ON public.feed_post_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id AND NOT public.is_system_locked(auth.uid()));

-- 5. allow admins to update the flags on any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
