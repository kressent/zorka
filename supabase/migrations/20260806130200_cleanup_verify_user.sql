-- Убрать технический аккаунт, которым проверяли, что вход работает без подтверждения.
delete from auth.users where email like 'zorka-verify-%@mailinator.com';
