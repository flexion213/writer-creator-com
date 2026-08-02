DROP POLICY IF EXISTS "View notebooks you own or are invited to" ON public.notebooks;
CREATE POLICY "View notebooks you own or are invited to"
ON public.notebooks FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_notebook_member(id, auth.uid()));