-- Enum committed separately before any functions/checks reference the new role.
alter type public.peran add value if not exists 'marketing';
