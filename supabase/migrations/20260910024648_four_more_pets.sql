-- Four more companions: penguin, ghost, crab, bat.
alter table public.profiles drop constraint profiles_pet_check;
alter table public.profiles
  add constraint profiles_pet_check
  check (pet in ('cat', 'dog', 'frog', 'octopus', 'owl', 'snail', 'robot', 'dragon', 'penguin', 'ghost', 'crab', 'bat'));
