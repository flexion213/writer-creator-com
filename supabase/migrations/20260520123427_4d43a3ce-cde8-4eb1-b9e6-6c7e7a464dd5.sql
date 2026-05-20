
revoke execute on function public.is_notebook_owner(uuid, uuid) from public, anon;
revoke execute on function public.is_notebook_member(uuid, uuid) from public, anon;
revoke execute on function public.can_edit_notebook(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.touch_updated_at() from public, anon;
grant execute on function public.is_notebook_owner(uuid, uuid) to authenticated;
grant execute on function public.is_notebook_member(uuid, uuid) to authenticated;
grant execute on function public.can_edit_notebook(uuid, uuid) to authenticated;
